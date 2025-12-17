/* Tự động điền thông tin form dựa trên các tham số URL
 * Luồng xử lý:
 * 1. Kiểm tra URL có tham số ?auto_fill=true&file_id=XXX...
 * 2. Ẩn tham số URL để bảo mật
 * 3. Gọi API lấy dữ liệu file từ server
 * 4. Phân tích URL để xác định đang ở trang nào (extract/decrypt)
 * 5. Tự động điền các trường form tương ứng
 * 6. Tải file từ server và gán vào input file
 * 7. Hiển thị thông báo cho người dùng
 */
document.addEventListener("DOMContentLoaded", function () {
  // 1. Kiểm tra xem có yêu cầu tự động điền không
  const urlParams = new URLSearchParams(window.location.search);
  const autoFill = urlParams.get("auto_fill");
  const fileId = urlParams.get("file_id");
  const algorithm = urlParams.get("algorithm");
  const method = urlParams.get("method");

  if (autoFill === "true" && fileId) {
    // Ẩn tham số URL
    hideUrlParameters();

    // Deplay để đảm bảo trang đã load xong
    setTimeout(() => {
      // Gọi API lấy thông tin file
      fetch(`/api/file/${fileId}/auto-fill-data/`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.form_data) {
            // Tự động điền form
            autoFillForm(data.form_data, data.file_data, algorithm, method);
          } else {
            showMessage(
              "Không thể tự động điền thông tin. " +
                (data.error || "File không tồn tại hoặc chỉ có metadata."),
              "error"
            );
          }
        })
        .catch((error) => {
          console.error("Lỗi khi lấy dữ liệu tự động điền:", error);
          showMessage("Lỗi khi tải thông tin file", "error");
        });
    }, 500);
  }
});

// Hàm ẩn tham số URL
function hideUrlParameters() {
  if (window.history && window.history.replaceState) {
    // Lấy URL không có tham số
    const cleanUrl = window.location.pathname;
    // Thay thế URL hiện tại bằng URL sạch (không reload)
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

// Phân phối auto-fill cho các trang khác nhau
function autoFillForm(formData, fileData, algorithmFromUrl, methodFromUrl) {
  // Xác định xem đang ở trang nào
  const isExtractPage = window.location.pathname.includes("/extract");
  const isDecryptPage = window.location.pathname.includes("/decrypt");

  if (isExtractPage) {
    autoFillExtractForm(formData, fileData, algorithmFromUrl, methodFromUrl);
  } else if (isDecryptPage) {
    autoFillDecryptForm(formData, fileData, algorithmFromUrl);
  }
}

// Xử lý giao diện
function clickCardOption(containerId, value) {
  return new Promise((resolve) => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Không tìm thấy container: ${containerId}`);
      resolve(false);
      return;
    }

    // Tìm card option với giá trị phù hợp
    const cards = container.querySelectorAll(".card-option");
    let found = false;

    cards.forEach((card) => {
      const cardValue = card.getAttribute("data-value");
      if (cardValue === value) {
        found = true;
        // Kiểm tra xem card có disabled không
        if (card.getAttribute("data-disabled") !== "true") {
          // Kích hoạt sự kiện click
          card.click();
        } else {
          console.warn(`Card option ${value} đang bị disabled`);
        }
      }
    });
    if (!found) {
      console.warn(
        `Không tìm thấy card option với giá trị: ${value} trong ${containerId}`
      );
    }
    resolve(found);
  });
}

// Hàm cập nhật select và kích hoạt
function updateSelectAndTrigger(selectName, value) {
  const select = document.querySelector(`select[name="${selectName}"]`);
  if (select) {
    select.value = value;
    const event = new Event("change", { bubbles: true });
    select.dispatchEvent(event);
    return true;
  } else {
    console.warn(`Không tìm thấy select với name="${selectName}"`);
    return false;
  }
}

// Điền form tự động
async function autoFillExtractForm(
  formData,
  fileData,
  algorithmFromUrl,
  methodFromUrl
) {
  try {
    // 1. Xác định carrier type và method
    let carrierType = formData.carrier_type || "image";
    let method = methodFromUrl || formData.method || "LSB";

    // 2. Cập nhật carrier type
    if (updateSelectAndTrigger("carrier_type", carrierType)) {
      // Click card option cho carrier type
      await clickCardOption("carrierTypeOptions", carrierType);
    }

    // 3. Đợi để các method option được cập nhật
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4. Cập nhật method
    if (updateSelectAndTrigger("method", method)) {
      // Click card option cho method
      await clickCardOption("methodOptions", method);
    }

    // 5. Kiểm tra và gọi các hàm cập nhật UI nếu có
    if (typeof updateMethodDetails === "function") {
      setTimeout(() => updateMethodDetails(), 300);
    }

    if (typeof updateMethodOptions === "function") {
      setTimeout(() => updateMethodOptions(), 300);
    }

    // 6. Tải file nếu có
    if (fileData && fileData.id && formData.file_exists !== false) {
      setTimeout(() => {
        loadFileFromServer(fileData.id, fileData.name, fileData.stored_path);
      }, 800);
    }
    showMessage("Đã tự động điền thông tin từ file đã chọn", "success");
  } catch (error) {
    console.error("Lỗi khi tự động điền form trích xuất:", error);
    showMessage(
      "Không thể tự động điền đầy đủ thông tin. Vui lòng kiểm tra lại.",
      "error"
    );
  }
}

// Tự động điền cho giải mã
function autoFillDecryptForm(formData, fileData, algorithmFromUrl) {
  // 1. Tự động chọn loại input là "file"
  const fileInputType = document.querySelector(
    'input[name="input_type"][value="file"]'
  );
  if (fileInputType) {
    fileInputType.checked = true;
    fileInputType.dispatchEvent(new Event("change"));
  } else {
    console.warn('Không tìm thấy input[name="input_type"][value="file"]');
  }

  // 2. Tự động chọn thuật toán
  const algorithmToUse =
    algorithmFromUrl || formData.algorithm || "AES-256-GCM";
  if (algorithmToUse) {
    updateSelectAndTrigger("algorithm", algorithmToUse);
  }

  // 3. Tự động tải file
  if (fileData && fileData.id && formData.file_exists !== false) {
    setTimeout(() => {
      loadFileFromServer(
        fileData.id,
        fileData.name,
        fileData.stored_path,
        false
      );
    }, 500);
  }
  showMessage("Đã tự động điền thông tin từ file đã chọn", "success");
}

// Xử lý tải file từ server
function loadFileFromServer(
  fileId,
  fileName,
  storedPath,
  isExtractPage = true
) {
  // Kiểm tra xem có hàm fetch không
  if (typeof fetch === "undefined") {
    console.error("Trình duyệt không hỗ trợ fetch API");
    showMessage("Trình duyệt không hỗ trợ tải file tự động", "error");
    return;
  }

  fetch(`/files/download/${fileId}/?auto_fill=true`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.blob();
    })
    .then((blob) => {
      // Tạo file object từ blob
      const file = new File([blob], fileName, {
        type: blob.type || "application/octet-stream",
        lastModified: new Date().getTime(),
      });

      // Tạo DataTransfer và thêm file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Tìm input file tùy theo trang
      let fileInput;
      if (isExtractPage) {
        fileInput =
          document.querySelector('input[type="file"][name="carrier_file"]') ||
          document.getElementById("carrierFile");
      } else {
        fileInput =
          document.querySelector('input[type="file"][name="file"]') ||
          document.getElementById("fileInput");
      }
      if (fileInput) {
        fileInput.files = dataTransfer.files;
        // Kích hoạt sự kiện change để cập nhật UI
        try {
          const changeEvent = new Event("change", { bubbles: true });
        } catch (e) {
          console.error("Lỗi khi kích hoạt sự kiện change:", e);
        }
        // Cập nhật UI hiển thị tên file
        updateFileNameUI(fileName, file.size, isExtractPage);
      } else {
        console.error("Không tìm thấy input file");
        showMessage(
          "Không thể tự động tải file. Vui lòng chọn file thủ công.",
          "error"
        );
      }
    })
    .catch((error) => {
      console.error("Lỗi tải file:", error);
      showMessage("Không thể tải file. Vui lòng chọn file thủ công.", "error");
    });
}

// Hàm cập nhật UI tên file và hiển thị file
function updateFileNameUI(fileName, fileSize, isExtractPage) {
  if (isExtractPage) {
    // Tìm các phần tử cho trang extract
    const carrierFileName = document.getElementById("carrierFileName");
    const carrierFileSize = document.getElementById("carrierFileSize");
    const carrierInfo = document.getElementById("carrierInfo");

    if (carrierFileName && carrierFileSize && carrierInfo) {
      carrierFileName.textContent = fileName;
      carrierFileSize.textContent = formatFileSize(fileSize);
      carrierInfo.classList.remove("d-none");
      console.log("Đã cập nhật thông tin file cho trang extract");
    } else {
      // tìm phần tử hiển thị khác
      updateFallbackFileNameDisplay(fileName);
    }
  }
}

// Fallback hiển thị tên file
function updateFallbackFileNameDisplay(fileName) {
  // Thử tìm các phần tử hiển thị tên file chung
  const fileDisplays = document.querySelectorAll(
    ".file-name-display, .selected-file-name, .custom-file-label"
  );

  if (fileDisplays.length > 0) {
    fileDisplays.forEach((display) => {
      display.textContent = fileName;
      display.style.display = "block";
    });
  } else {
    // Tạo phần tử hiển thị mới nếu không có
    createFileNameDisplay(fileName);
  }
}

// Tạo phần tử hiển thị tên file nếu không có
function createFileNameDisplay(fileName) {
  const container =
    document.querySelector(".form-group") ||
    document.querySelector(".file-input-group") ||
    document.querySelector(".card-body");

  if (container) {
    const display = document.createElement("div");
    display.className = "file-name-display alert alert-info mt-2";
    display.innerHTML = `<i class="fas fa-file me-2"></i>${fileName}`;
    container.appendChild(display);
  }
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "Không xác định";
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function showMessage(message, type = "info") {
  let messageContainer = document.querySelector(".message-container");
  if (!messageContainer) {
    messageContainer = document.createElement("div");
    messageContainer.className = "message-container";
    document.body.appendChild(messageContainer);
  }

  const alertTypeMap = {
    success: "success",
    error: "danger",
    warning: "warning",
    info: "info",
  };
  const bootstrapType = alertTypeMap[type] || "info";

  const iconMap = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };
  const icon = iconMap[type] || "fa-info-circle";

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${bootstrapType} alert-dismissible fade show custom-alert`;
  alertDiv.setAttribute("role", "alert");
  alertDiv.innerHTML = `
        <i class="fas ${icon} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
  messageContainer.appendChild(alertDiv);
  setTimeout(() => {
    if (alertDiv.parentNode) {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
      bsAlert.close();
    }
  }, 3000);
}
