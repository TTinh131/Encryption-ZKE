document.addEventListener("DOMContentLoaded", function () {
  initSteganographyUI();
});

// Cập nhật thanh tiến trình
function updateProgress(percent, status = "") {
  const progressFill = document.getElementById("progressFill");
  const progressPercent = document.getElementById("progressPercent");
  const progressStatus = document.getElementById("progressStatus");
  const progressText = document.getElementById("progressText");

  if (progressFill) {
    progressFill.style.width = percent + "%";
  } else {
    console.error("Không tìm thấy phần tử progressFill!");
  }

  if (progressPercent) {
    progressPercent.textContent = percent + "%";
  }

  if (progressStatus && status) {
    progressStatus.textContent = status;
  }
  // Cập nhật text chính (giấu tin/trích xuất)
  if (progressText) {
    const isExtract = window.location.pathname.includes("extract");
    progressText.textContent = isExtract
      ? "Đang xử lý trích xuất..."
      : "Đang xử lý giấu tin...";
  }
  updateProgressTime(percent);
}

function updateProgressTime(percent) {
  const progressTime = document.getElementById("progressTime");
  if (!progressTime) return;

  if (percent === 0) {
    progressTime.textContent = "--:--";
  } else if (percent === 100) {
    progressTime.textContent = "Hoàn thành!";
  } else {
    const remaining = 100 - percent;
    const speedFactor = percent < 30 ? 2 : percent < 70 ? 1.5 : 1;
    const estimatedSeconds = Math.round(
      (remaining / percent) * 20 * speedFactor
    );
    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = estimatedSeconds % 60;
    progressTime.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
}

function showProgress(show = true) {
  const progressSection = document.getElementById("loadingSection");
  const actionButtons = document.querySelector(".action-buttons");

  if (progressSection) {
    if (show) {
      progressSection.classList.remove("d-none");
      //hiệu ứng xuất hiện
      progressSection.style.opacity = "0";
      progressSection.style.transform = "translateY(20px)";

      setTimeout(() => {
        progressSection.style.transition = "all 0.5s ease";
        progressSection.style.opacity = "1";
        progressSection.style.transform = "translateY(0)";
      }, 50);
      // cuộn đến section tiến trình
      progressSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      progressSection.style.transition = "all 0.5s ease";
      progressSection.style.opacity = "0";
      progressSection.style.transform = "translateY(-20px)";

      setTimeout(() => {
        progressSection.classList.add("d-none");
        progressSection.style.opacity = "1";
        progressSection.style.transform = "translateY(0)";
      }, 500);
    }
  }

  // Vô hiệu hóa nút
  const actionBtn =
    document.getElementById("hideBtn") || document.getElementById("extractBtn");
  const clearBtn = document.getElementById("clearBtn");

  if (actionBtn) {
    actionBtn.disabled = show;
    actionBtn.style.opacity = show ? "0.7" : "1";
    actionBtn.style.transform = show ? "scale(0.98)" : "scale(1)";
  }
  if (clearBtn) {
    clearBtn.disabled = show;
    clearBtn.style.opacity = show ? "0.7" : "1";
    clearBtn.style.transform = show ? "scale(0.98)" : "scale(1)";
  }
}

// Đánh dấu tiến trình hoàn thành hay lỗi
function setProgressCompleted(success = true) {
  const progressContainer = document.querySelector(".progress-container");
  if (progressContainer) {
    progressContainer.style.transition = "all 0.5s ease";
    if (success) {
      progressContainer.classList.add("completed");
      updateProgress(100, "Hoàn thành!");

      // Hiệu ứng rung nhẹ khi hoàn thành
      progressContainer.style.animation = "celebrate 0.6s ease";
      setTimeout(() => {
        progressContainer.style.animation = "";
      }, 600);
    } else {
      progressContainer.classList.add("error");
      updateProgress(0, "Đã xảy ra lỗi");

      // Hiệu ứng rung khi lỗi
      progressContainer.style.animation = "shake 0.5s ease";
      setTimeout(() => {
        progressContainer.style.animation = "";
      }, 500);
    }
  }
}

function resetProgress() {
  const progressContainer = document.querySelector(".progress-container");
  if (progressContainer) {
    progressContainer.classList.remove("completed", "error");
    progressContainer.style.animation = "";
  }
  updateProgress(0, "Đang khởi tạo...");
}

// Thêm keyframes cho hiệu ứng hoàn thành và lỗi
const style = document.createElement("style");
style.textContent = `
    @keyframes celebrate {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.02); }
        50% { transform: scale(0.98); }
        75% { transform: scale(1.01); }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        50% { transform: translateX(5px); }
        75% { transform: translateX(-5px); }
    }
`;
document.head.appendChild(style);

// Mô phỏng tiến trình trích xuất
function simulateExtractProgress() {
  const steps = [
    { percent: 20, status: "Đang phân tích tệp chứa..." },
    { percent: 40, status: "Đang tìm kiếm dữ liệu ẩn..." },
    { percent: 60, status: "Đang trích xuất thông tin..." },
    { percent: 75, status: "Đang giải mã dữ liệu..." },
    { percent: 90, status: "Đang xác thực tính toàn vẹn..." },
    { percent: 95, status: "Đang hoàn tất quá trình..." },
  ];

  steps.forEach((step, index) => {
    setTimeout(() => {
      updateProgress(step.percent, step.status);
    }, (index + 1) * 1000);
  });
}

// Khởi tạo giao diện steganography cho trích xuất
function initSteganographyUI() {
  // Kiểm tra các phần tử cần thiết
  const requiredElements = [
    "carrierType",
    "method",
    "carrierTypeOptions",
    "methodOptions",
    "steganographyForm",
  ];

  let allElementsExist = true;
  requiredElements.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`Không tìm thấy phần tử: ${id}`);
      allElementsExist = false;
    }
  });

  if (!allElementsExist) {
    showAlert("Lỗi khởi tạo giao diện. Vui lòng tải lại trang.", "error");
    return;
  }

  // Khởi tạo các component
  initCardOptions();
  initFileUpload();
  initDragAndDrop();
  initEventListeners();
  initActionButtons();

  // Cập nhật UI ban đầu
  updateMethodOptions();
  updateMethodDetails();
}

function initCardOptions() {
  // Xử lý chọn loại tệp chứa
  const carrierOptions = document.querySelectorAll(
    "#carrierTypeOptions .card-option"
  );
  carrierOptions.forEach((option) => {
    option.addEventListener("click", function () {
      carrierOptions.forEach((opt) => opt.classList.remove("active"));
      this.classList.add("active");
      document.getElementById("carrierType").value = this.dataset.value;

      updateMethodOptions();
      updateMethodDetails();
    });
  });

  // Xử lý chọn phương pháp
  const methodOptions = document.querySelectorAll(
    "#methodOptions .card-option"
  );
  methodOptions.forEach((option) => {
    option.addEventListener("click", function () {
      methodOptions.forEach((opt) => opt.classList.remove("active"));
      this.classList.add("active");
      document.getElementById("method").value = this.dataset.value;

      updateMethodDetails();
    });
  });
}

function updateMethodOptions() {
  const carrierType = document.getElementById("carrierType").value;
  const methodOptions = document.querySelectorAll(
    "#methodOptions .card-option"
  );

  // Ẩn tất cả phương pháp
  methodOptions.forEach((option) => {
    option.style.display = "none";
    option.classList.remove("active");
  });

  // Hiển thị phương pháp phù hợp
  let allowedMethods = [];
  switch (carrierType) {
    case "text":
      allowedMethods = ["ZWC"];
      break;
    case "image":
      allowedMethods = ["LSB", "DCT"];
      break;
    case "audio":
      allowedMethods = ["LSB"];
      break;
  }

  let visibleOptions = [];
  methodOptions.forEach((option) => {
    if (allowedMethods.includes(option.dataset.value)) {
      option.style.display = "flex";
      visibleOptions.push(option);
    }
  });

  // Kích hoạt phương pháp đầu tiên hiển thị
  if (visibleOptions.length > 0) {
    visibleOptions[0].classList.add("active");
    document.getElementById("method").value = visibleOptions[0].dataset.value;
  } else {
    console.error(
      "Không có phương pháp phù hợp cho loại tệp này: ",
      carrierType
    );
    showAlert("Không có phương pháp phù hợp cho loại tệp này", "warning");
  }

  // Cập nhật thông tin phương pháp
  updateMethodDetails();
}

function updateMethodDetails() {
  const method = document.getElementById("method").value;
  const carrierType = document.getElementById("carrierType").value;
  const details = {
    LSB: {
      name: "Least Significant Bit",
      carrierType: getCarrierTypeName(carrierType),
      security: "Trung bình",
      capacity: getCapacityInfo(carrierType, "LSB"),
      robustness: "Trung bình",
      recommendation: getRecommendation(carrierType, "LSB"),
      description: getMethodDescription(carrierType, "LSB"),
    },
    DCT: {
      name: "Biến đổi Cosine Rời rạc",
      carrierType: getCarrierTypeName(carrierType),
      security: "Cao",
      capacity: getCapacityInfo(carrierType, "DCT"),
      robustness: "Cao",
      recommendation: getRecommendation(carrierType, "DCT"),
      description: getMethodDescription(carrierType, "DCT"),
    },
    ZWC: {
      name: "Zero-Width Characters",
      carrierType: getCarrierTypeName(carrierType),
      security: "Thấp",
      capacity: getCapacityInfo(carrierType, "ZWC"),
      robustness: "Rất thấp",
      recommendation: getRecommendation(carrierType, "ZWC"),
      description: getMethodDescription(carrierType, "ZWC"),
    },
  };

  const methodDetail = details[method] || details["LSB"];
  // Cập nhật DOM elements
  updateElementText("methodName", methodDetail.name);
  updateElementText("methodCarrierType", methodDetail.carrierType);
  updateElementText("methodSecurity", methodDetail.security);
  updateElementText("methodCapacity", methodDetail.capacity);
  updateElementText("methodRobustness", methodDetail.robustness);
  updateElementText("methodRecommendation", methodDetail.recommendation);
  updateElementText("methodDescription", methodDetail.description);
}

function updateElementText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

function getCarrierTypeName(carrierType) {
  const names = {
    text: "Văn bản",
    image: "Hình ảnh",
    audio: "Âm thanh",
  };
  return names[carrierType] || carrierType;
}

function getCapacityInfo(carrierType, method) {
  const capacities = {
    text: {
      ZWC: "Thấp",
    },
    image: {
      LSB: "Cao",
      DCT: "Trung bình",
    },
    audio: {
      LSB: "Trung bình",
    },
  };
  return capacities[carrierType]?.[method] || "Không xác định";
}

function getRecommendation(carrierType, method) {
  const recommendations = {
    text: {
      ZWC: "Cho văn bản ít quan trọng",
    },
    image: {
      LSB: "Cho ảnh thông thường",
      DCT: "Cho ảnh cần độ bền cao",
    },
    audio: {
      LSB: "Cho audio chất lượng cao",
    },
  };
  return (
    recommendations[carrierType]?.[method] || "Sử dụng cho dữ liệu thông thường"
  );
}

function getMethodDescription(carrierType, method) {
  const descriptions = {
    LSB: `LSB (Least Significant Bit) trích xuất từ bit ít quan trọng nhất trong ${getCarrierTypeName(
      carrierType
    ).toLowerCase()}.`,
    DCT: `DCT (Discrete Cosine Transform) trích xuất từ miền tần số của ${getCarrierTypeName(
      carrierType
    ).toLowerCase()}.`,
    ZWC: `Zero-Width Characters trích xuất ký tự không độ rộng từ văn bản.`,
  };
  return descriptions[method] || "Phương pháp trích xuất tin tiên tiến.";
}

//Khởi tạo xử lý upload file
function initFileUpload() {
  // Xử lý upload tệp chứa
  const carrierDropArea = document.getElementById("carrierDropArea");
  const carrierFileInput = document.getElementById("carrierFile");
  const carrierInfo = document.getElementById("carrierInfo");
  const carrierFileName = document.getElementById("carrierFileName");
  const carrierFileSize = document.getElementById("carrierFileSize");

  carrierDropArea.addEventListener("click", () => carrierFileInput.click());
  carrierFileInput.addEventListener("change", handleCarrierFileSelect);

  function handleCarrierFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      carrierFileName.textContent = file.name;
      carrierFileSize.textContent = formatFileSize(file.size);
      carrierInfo.classList.remove("d-none");

      showAlert(
        `Đã chọn tệp chứa tin: ${file.name} (${formatFileSize(file.size)})`,
        "success"
      );
    }
  }
}

//Đặt giá trị phương pháp và cập nhật UI
function setMethodValue(method) {
  const methodSelect = document.getElementById("method");
  if (methodSelect) {
    methodSelect.value = method;

    // Cập nhật UI của card options
    const methodOptions = document.querySelectorAll(
      "#methodOptions .card-option"
    );
    methodOptions.forEach((option) => {
      option.classList.remove("active");
      if (option.dataset.value === method) {
        option.classList.add("active");
      }
    });
  }
}

function initDragAndDrop() {
  const dropZones = document.querySelectorAll(".file-drop-zone");

  dropZones.forEach((zone) => {
    const fileInput = zone.querySelector(".file-input");

    // Ngăn chặn hành vi mặc định
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight khi kéo vào
    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(
        eventName,
        () => zone.classList.add("highlight"),
        false
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(
        eventName,
        () => zone.classList.remove("highlight"),
        false
      );
    });

    // Xử lý drop
    zone.addEventListener("drop", handleDrop, false);
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length) {
        fileInput.files = files;
        // Kích hoạt sự kiện change
        const event = new Event("change", { bubbles: true });
        fileInput.dispatchEvent(event);
      }
    }
  });
}

function initEventListeners() {
  // Xử lý toggle password visibility
  const togglePassword = document.getElementById("togglePassword");
  if (togglePassword) {
    togglePassword.addEventListener("click", function () {
      const passwordInput = document.getElementById("password");
      const type =
        passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);

      const icon = this.querySelector("i");
      icon.className = type === "password" ? "fas fa-eye" : "fas fa-eye-slash";
    });
  }
}

function initActionButtons() {
  const extractBtn = document.getElementById("extractBtn");
  const clearBtn = document.getElementById("clearBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const copyTextBtn = document.getElementById("copyTextBtn");

  if (extractBtn) extractBtn.addEventListener("click", startExtractionProcess);
  if (clearBtn) clearBtn.addEventListener("click", clearForm);
  if (downloadBtn) downloadBtn.addEventListener("click", downloadResult);
  if (copyTextBtn) copyTextBtn.addEventListener("click", copyTextToClipboard);
}

//Bắt đầu quá trình trích xuất tin
async function startExtractionProcess() {
  const carrierType = document.getElementById("carrierType").value;
  const method = document.getElementById("method").value;
  const carrierFile = document.getElementById("carrierFile").files[0];
  const password = document.getElementById("password").value;

  // Kiểm tra dữ liệu đầu vào
  if (!carrierFile) {
    showAlert("Vui lòng chọn tệp chứa tin", "warning");
    return;
  }

  if (!password) {
    showAlert("Vui lòng nhập mật khẩu giải mã", "warning");
    return;
  }
  // Hiển thị thanh tiến trình
  showProgress(true);
  resetProgress();
  startProcessWithProgress();

  try {
    simulateExtractProgress();

    // Tạo FormData
    const formData = new FormData();
    formData.append("operation", "extract");
    formData.append("carrier_type", carrierType);
    formData.append("method", method);
    formData.append("carrier_file", carrierFile);

    // Gửi request
    const response = await fetch(window.hideDataUrl, {
      method: "POST",
      body: formData,
      headers: {
        "X-CSRFToken": getCSRFToken(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lỗi phản hồi Server:", errorText);
      throw new Error(`Lỗi HTTP! status: ${response.status}`);
    }
    const data = await response.json();

    if (data.success) {
      // giải mã trên client
      updateProgress(80, "Đang giải mã dữ liệu...");
      // Đảm bảo stegoCrypto đã được khởi tạo
      if (typeof stegoCrypto === "undefined") {
        await initializeSteganoCrypto();
      }

    //   console.log(
    //     "Dữ liệu bí mật từ máy chủ (200 ký tự đầu tiên): ",
    //     data.secret_data.substring(0, 200)
    //   );

      // Chuyển dữ liệu từ base64 thành ArrayBuffer
      const encryptedData = stegoCrypto.base64ToUint8Array(
        data.secret_data
      ).buffer;

      // Giải mã dữ liệu với metadata
      const decryptedResult = await stegoCrypto.processExtractedData(
        password,
        encryptedData
      );
    //   console.log("Giải mã hoàn tất:", {
    //     metadata: decryptedResult.metadata,
    //     dataType: typeof decryptedResult.data,
    //     dataLength:
    //       decryptedResult.data.byteLength || decryptedResult.data.length,
    //   });

      updateProgress(100, "Hoàn thành!");
      setProgressCompleted(true);

      // Hiển thị kết quả sau 0.5 giây
      setTimeout(() => {
        showDecryptedResult(decryptedResult);
        showAlert("Trích xuất tin thành công!", "success");
        setTimeout(() => showProgress(false), 2000);
      }, 500);
    }
  } catch (error) {
    console.error("Lỗi quá trình trích xuất: ", error);
    setProgressCompleted(false);
    setTimeout(() => {
      showProgress(false);
      if (error.message === "SAI_MAT_KHAU") {
        showAlert("Sai mật khẩu! Vui lòng kiểm tra lại.", "error");
      } else {
        if (
          error.message ===
          "Không thể đọc các thuộc tính của giá trị không xác định 'length'"
        )
          showAlert(
            "Sai định dạng tệp chứa tin hoặc phương pháp! Vui lòng kiểm tra lại.",
            "error"
          );
        else showAlert(error.message, "error");
      }
    }, 1000);
  }
}

//Hiển thị kết quả đã giải mã
function showDecryptedResult(decryptedResult) {
  const resultSection = document.getElementById("resultSection");
  const outputFileName = document.getElementById("outputFileName");
  const outputFileSize = document.getElementById("outputFileSize");
  const previewText = document.getElementById("previewText");
  const textPreview = document.getElementById("textPreview");

  const { metadata, data } = decryptedResult;

  outputFileName.textContent = metadata.filename;
  outputFileSize.textContent = formatFileSize(metadata.size);

  // Xóa dữ liệu cũ
  resultSection.dataset.secretData = "";
  resultSection.dataset.filename = "";
  resultSection.dataset.isText = "";
  resultSection.dataset.mimeType = "";

  if (metadata.type === "text") {
    previewText.value = data;
    textPreview.style.display = "block";

    // Hiển thị nút copy text
    const copyTextBtn = document.getElementById("copyTextBtn");
    if (copyTextBtn) {
      copyTextBtn.style.display = "inline-block";
    }

    // Lưu dữ liệu text dưới dạng base64
    const textBase64 = btoa(unescape(encodeURIComponent(data)));
    resultSection.dataset.secretData = textBase64;
    resultSection.dataset.filename = metadata.filename;
    resultSection.dataset.isText = "true";
    resultSection.dataset.mimeType = metadata.mimeType;
  } else {
    // Là file nhị phân
    textPreview.style.display = "none";
    // Ẩn nút copy text
    const copyTextBtn = document.getElementById("copyTextBtn");
    if (copyTextBtn) {
      copyTextBtn.style.display = "none";
    }

    // data đã là ArrayBuffer, chuyển thành base64 để lưu trữ
    let binaryBase64;
    if (data instanceof ArrayBuffer) {
      binaryBase64 = stegoCrypto.arrayBufferToBase64(data);
    } else {
      //nếu không phải ArrayBuffer, thử chuyển đổi
      const uint8Array = new Uint8Array(data);
      binaryBase64 = stegoCrypto.arrayBufferToBase64(uint8Array.buffer);
    }

    resultSection.dataset.secretData = binaryBase64;
    resultSection.dataset.filename = metadata.filename;
    resultSection.dataset.isText = "false";
    resultSection.dataset.mimeType = metadata.mimeType;

    showAlert(
      `Đã trích xuất file "${metadata.filename}" thành công. Sử dụng nút "Tải về" để lưu file.`,
      "info"
    );
  }

  resultSection.classList.remove("d-none");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function isValidText(text) {
  // Kiểm tra xem text có phải là văn bản hợp lệ không
  if (!text || text.length === 0) return false;

  // Loại bỏ các ký tự control trừ tab, newline, carriage return
  const cleanText = text.replace(/[^\x20-\x7E\n\t\r]/g, "");

  // Nếu sau khi làm sạch, text quá ngắn hoặc toàn ký tự đặc biệt
  if (cleanText.length < text.length * 0.7) {
    return false;
  }
  return true;
}

//Tải về kết quả trích xuất
function downloadResult() {
  const resultSection = document.getElementById("resultSection");
  const secretData = resultSection.dataset.secretData;
  const filename = resultSection.dataset.filename;
  const isText = resultSection.dataset.isText === "true";
  const mimeType = resultSection.dataset.mimeType || "application/octet-stream";

  if (!secretData) {
    showAlert("Không có dữ liệu để tải về", "warning");
    return;
  }

  try {
    let binaryData;
    let blob;

    if (isText) {
      // Dữ liệu text - giải mã base64 để lấy string, sau đó chuyển thành Uint8Array
      const decodedText = decodeURIComponent(escape(atob(secretData)));
      const encoder = new TextEncoder();
      binaryData = encoder.encode(decodedText);
      blob = new Blob([binaryData], { type: mimeType });
    } else {
      // Dữ liệu nhị phân - chuyển base64 thành Uint8Array
      binaryData = stegoCrypto.base64ToUint8Array(secretData);
      blob = new Blob([binaryData], { type: mimeType });
    }

    // Tạo blob và tải về
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showAlert(`Đã tải xuống tệp: ${filename}`, "success");
  } catch (error) {
    console.error("Lỗi tải về:", error);
    showAlert("Lỗi tải về: " + error.message, "error");
  }
}

//Sao chép văn bản vào clipboard
function copyTextToClipboard() {
  const previewText = document.getElementById("previewText");

  if (!previewText || !previewText.value.trim()) {
    showAlert("Không có văn bản để sao chép", "warning");
    return;
  }

  previewText.select();
  previewText.setSelectionRange(0, 99999); // Dành cho thiết bị di động

  try {
    navigator.clipboard
      .writeText(previewText.value)
      .then(() => {
        showAlert("Đã sao chép văn bản vào clipboard!", "success");
      })
      .catch((err) => {
        // Dự phòng cho trình duyệt cũ
        try {
          document.execCommand("copy");
          showAlert("Đã sao chép văn bản vào clipboard!", "success");
        } catch (fallbackErr) {
          showAlert("Lỗi sao chép văn bản", "error");
        }
      });
  } catch (err) {
    console.error("Lỗi sao chép văn bản:", err);
    showAlert("Lỗi sao chép văn bản", "error");
  }
}

//Xóa form và reset về trạng thái ban đầu
function clearForm() {
  // Reset form
  document.getElementById("steganographyForm").reset();

  // Ẩn các phần tử thông tin
  document.getElementById("carrierInfo").classList.add("d-none");
  document.getElementById("resultSection").classList.add("d-none");

  // Reset trạng thái card options
  resetCardOptions();

  // Cập nhật UI
  updateMethodOptions();
  updateMethodDetails();

  // Xóa thông báo cũ
  clearAlerts();

  showAlert("Đã xóa tất cả dữ liệu", "info");
}

// Reset trạng thái card options
function resetCardOptions() {
  // Reset carrier type
  const carrierOptions = document.querySelectorAll(
    "#carrierTypeOptions .card-option"
  );
  carrierOptions.forEach((opt) => opt.classList.remove("active"));
  if (carrierOptions[0]) {
    carrierOptions[0].classList.add("active");
    document.getElementById("carrierType").value =
      carrierOptions[0].dataset.value;
  }

  // Reset method
  const methodOptions = document.querySelectorAll(
    "#methodOptions .card-option"
  );
  methodOptions.forEach((opt) => opt.classList.remove("active"));
  if (methodOptions[0]) {
    methodOptions[0].classList.add("active");
    document.getElementById("method").value = methodOptions[0].dataset.value;
  }
}

function clearAlerts() {
  const jsAlertContainer = document.getElementById("jsAlertContainer");
  if (jsAlertContainer) {
    jsAlertContainer.innerHTML = "";
    jsAlertContainer.style.display = "none";
  }
}

// Các hàm tiện ích
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getCSRFToken() {
  const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");
  return csrfToken ? csrfToken.value : "";
}

function showAlert(message, type) {
  const alertClass =
    type === "error"
      ? "alert-danger"
      : type === "warning"
      ? "alert-warning"
      : type === "info"
      ? "alert-info"
      : "alert-success";

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert ${alertClass} alert-dismissible fade show custom-alert`;
  alertDiv.innerHTML = `
        <i class="fas fa-${getAlertIcon(type)} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Sử dụng container JavaScript
  const container = document.getElementById("jsAlertContainer");
  if (container) {
    container.style.display = "block";
    // Giới hạn số lượng thông báo
    if (container.children.length >= 3) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(alertDiv);
  }

  // Tự động xóa sau 5 giây
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
      // Ẩn container nếu không còn thông báo
      if (container && container.children.length === 0) {
        container.style.display = "none";
      }
    }
  }, 5000);
}

// Lấy icon cho loại thông báo
function getAlertIcon(type) {
  const icons = {
    success: "check-circle",
    error: "exclamation-circle",
    warning: "exclamation-triangle",
    info: "info-circle",
  };
  return icons[type] || "info-circle";
}

// Chuyển base64 sang ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Đảm bảo styles cho progress bar được áp dụng
function ensureProgressStyles() {
  // Kiểm tra xem styles đã được áp dụng chưa
  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    // Force reflow để kích hoạt animation
    progressFill.style.animation = "none";
    setTimeout(() => {
      progressFill.style.animation = "";
    }, 10);
  }
}

// Bắt đầu quá trình với progress bar
function startProcessWithProgress() {
  ensureProgressStyles();
  showProgress(true);
  resetProgress();
}
