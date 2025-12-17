document.addEventListener("DOMContentLoaded", function () {
  initSteganographyUI();
});

//Cập nhật thanh tiến trình
function updateProgress(percent, status = "") {
  const progressFill = document.getElementById("progressFill");
  const progressPercent = document.getElementById("progressPercent");
  const progressStatus = document.getElementById("progressStatus");
  const progressText = document.getElementById("progressText");

  // Cập nhật thanh tiến trình với hiệu ứng mượt mà
  if (progressFill) {
    progressFill.style.width = percent + "%";
  } else {
    console.error("Không tìm thấy phần tử progressFill!");
  }
  // Cập nhật phần trăm
  if (progressPercent) {
    progressPercent.textContent = percent + "%";
  }
  // Cập nhật trạng thái
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

  // Cập nhật thời gian ước tính
  updateProgressTime(percent);
}

// Cập nhật thời gian ước tính còn lại
function updateProgressTime(percent) {
  const progressTime = document.getElementById("progressTime");
  if (!progressTime) return;

  if (percent === 0) {
    progressTime.textContent = "--:--";
  } else if (percent === 100) {
    progressTime.textContent = "Hoàn thành!";
  } else {
    // Ước tính thời gian còn lại dựa trên phần trăm hoàn thành
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

//Hiển thị/ẩn section tiến trình
function showProgress(show = true) {
  const progressSection = document.getElementById("loadingSection");
  const actionButtons = document.querySelector(".action-buttons");

  if (progressSection) {
    if (show) {
      progressSection.classList.remove("d-none");
      // hiệu ứng xuất hiện
      progressSection.style.opacity = "0";
      progressSection.style.transform = "translateY(20px)";

      setTimeout(() => {
        progressSection.style.transition = "all 0.5s ease";
        progressSection.style.opacity = "1";
        progressSection.style.transform = "translateY(0)";
      }, 50);

      // Cuộn đến phần tiến trình
      progressSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      // hiệu ứng biến mất
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

  // Vô hiệu hóa nút hành động trong khi xử lý
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

// Đánh dấu tiến trình hoàn thành hoặc lỗi
function setProgressCompleted(success = true) {
  const progressContainer = document.querySelector(".progress-container");
  if (progressContainer) {
    // hiệu ứng hoàn thành
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

//Reset tiến trình về trạng thái ban đầu
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

// Mô phỏng tiến trình giấu tin
function simulateHideProgress() {
  const steps = [
    { percent: 15, status: "Đang phân tích tệp chứa..." },
    { percent: 30, status: "Đang mã hóa dữ liệu bí mật..." },
    { percent: 50, status: "Đang tối ưu hóa thuật toán..." },
    { percent: 70, status: "Đang giấu tin vào carrier..." },
    { percent: 85, status: "Đang xác thực tính toàn vẹn..." },
    { percent: 95, status: "Đang hoàn tất quá trình..." },
  ];

  steps.forEach((step, index) => {
    setTimeout(() => {
      updateProgress(step.percent, step.status);
    }, (index + 1) * 1000);
  });
}

//Khởi tạo giao diện steganography
function initSteganographyUI() {
  // Kiểm tra các phần tử cần thiết
  const requiredElements = [
    "carrierType",
    "method",
    "carrierTypeOptions",
    "methodOptions",
    "dataTypeOptions",
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
  updateDataType();
  updateMethodDetails();
}

//Khởi tạo card options cho các lựa chọn
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

  // Xử lý chọn loại dữ liệu
  const dataTypeOptions = document.querySelectorAll(
    "#dataTypeOptions .card-option"
  );
  dataTypeOptions.forEach((option) => {
    option.addEventListener("click", function () {
      dataTypeOptions.forEach((opt) => opt.classList.remove("active"));
      this.classList.add("active");
      document.getElementById("dataType").value = this.dataset.value;

      updateDataType();
    });
  });
}

//Cập nhật giao diện theo loại dữ liệu được chọn
function updateDataType() {
  const dataType = document.getElementById("dataType").value;
  const textDataGroup = document.getElementById("textDataGroup");
  const fileDataGroup = document.getElementById("fileDataGroup");

  if (dataType === "text") {
    textDataGroup.classList.remove("d-none");
    fileDataGroup.classList.add("d-none");
  } else {
    textDataGroup.classList.add("d-none");
    fileDataGroup.classList.remove("d-none");
  }
}

//Cập nhật các phương pháp khả dụng theo loại carrier
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
      "Không có phương pháp phù hợp cho loại tệp này:",
      carrierType
    );
    showAlert("Không có phương pháp phù hợp cho loại tệp này", "warning");
  }

  // Cập nhật thông tin phương pháp
  updateMethodDetails();
}

//Cập nhật thông tin chi tiết về phương pháp được chọn
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

//  Cập nhật nội dung text của element
function updateElementText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

// Lấy tên loại carrier
function getCarrierTypeName(carrierType) {
  const names = {
    text: "Văn bản",
    image: "Hình ảnh",
    audio: "Âm thanh",
  };
  return names[carrierType] || carrierType;
}

// Lấy thông tin dung lượng theo loại carrier và phương pháp
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

// Lấy khuyến nghị sử dụng theo loại carrier và phương pháp
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

//Lấy mô tả chi tiết về phương pháp
function getMethodDescription(carrierType, method) {
  const descriptions = {
    LSB: `LSB (Least Significant Bit) thay thế bit ít quan trọng nhất trong ${getCarrierTypeName(
      carrierType
    ).toLowerCase()}. Phương pháp này có dung lượng cao và bảo toàn chất lượng file.`,
    DCT: `DCT (Discrete Cosine Transform) giấu tin trong miền tần số của ${getCarrierTypeName(
      carrierType
    ).toLowerCase()}. Độ bền cao, khó phát hiện.`,
    ZWC: `Zero-Width Characters chèn ký tự không độ rộng vào văn bản. Khó phát hiện bằng mắt thường nhưng dễ mất khi copy.`,
  };
  return descriptions[method] || "Phương pháp giấu tin tiên tiến.";
}

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
        `Đã chọn tệp chứa: ${file.name} (${formatFileSize(file.size)})`,
        "success"
      );
    }
  }

  // Xử lý upload tệp bí mật
  const secretFileDropArea = document.getElementById("secretFileDropArea");
  const secretFileInput = document.getElementById("secretFile");
  const secretFileInfo = document.getElementById("secretFileInfo");
  const secretFileName = document.getElementById("secretFileName");
  const secretFileSize = document.getElementById("secretFileSize");

  secretFileDropArea.addEventListener("click", () => secretFileInput.click());
  secretFileInput.addEventListener("change", handleSecretFileSelect);

  function handleSecretFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      secretFileName.textContent = file.name;
      secretFileSize.textContent = formatFileSize(file.size);
      secretFileInfo.classList.remove("d-none");

      showAlert(
        `Đã chọn tệp bí mật: ${file.name} (${formatFileSize(file.size)})`,
        "success"
      );
    }
  }
}

// Đặt giá trị phương pháp và cập nhật UI
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

// Khởi tạo chức năng kéo thả tệp
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

// Khởi tạo các event listeners
function initEventListeners() {
  // Xử lý hiển thị/ẩn mật khẩu
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

  // Xử lý xác thực mật khẩu theo thời gian thực
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.addEventListener("input", validatePassword);
    passwordInput.addEventListener("focus", function () {
      document
        .getElementById("passwordRequirements")
        .classList.remove("d-none");
    });
    passwordInput.addEventListener("blur", function () {
      if (this.value.length === 0) {
        document.getElementById("passwordRequirements").classList.add("d-none");
      }
    });
  }
}

// Xác thực mật khẩu và cập nhật UI
function validatePassword() {
  const password = document.getElementById("password").value;

  // Kiểm tra và cập nhật từng yêu cầu
  const requirements = {
    reqLength: password.length >= 8,
    reqUpper: /[A-Z]/.test(password),
    reqLower: /[a-z]/.test(password),
    reqNumber: /[0-9]/.test(password),
    reqSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  Object.keys(requirements).forEach((reqId) => {
    const requirementElement = document.getElementById(reqId);
    if (requirementElement) {
      const icon = requirementElement.querySelector("i");
      const text = requirementElement.textContent.trim();

      if (requirements[reqId]) {
        requirementElement.classList.remove("invalid");
        requirementElement.classList.add("valid");
        icon.className = "fas fa-check";
        requirementElement.innerHTML = `<i class="fas fa-check"></i> ${text}`;
      } else {
        requirementElement.classList.remove("valid");
        requirementElement.classList.add("invalid");
        icon.className = "fas fa-times";
        requirementElement.innerHTML = `<i class="fas fa-times"></i> ${text}`;
      }
    }
  });

  // Ẩn các requirement đã đạt được
  const allRequirements = document.querySelectorAll(".requirement");
  let hasInvalidRequirements = false;

  allRequirements.forEach((req) => {
    if (req.classList.contains("valid")) {
      req.style.display = "none";
    } else {
      req.style.display = "flex";
      hasInvalidRequirements = true;
    }
  });

  // Ẩn toàn bộ section nếu tất cả requirement đều đạt
  const passwordRequirements = document.getElementById("passwordRequirements");
  const allValid = Object.values(requirements).every((val) => val);

  if (allValid) {
    passwordRequirements.classList.add("d-none");
  } else if (password.length > 0) {
    passwordRequirements.classList.remove("d-none");
  }
}

// Kiểm tra tính hợp lệ của mật khẩu
function isPasswordValid() {
  const password = document.getElementById("password").value;
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  );
}

//Khởi tạo action buttons
function initActionButtons() {
  const hideBtn = document.getElementById("hideBtn");
  const clearBtn = document.getElementById("clearBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  hideBtn.addEventListener("click", startHidingProcess);
  clearBtn.addEventListener("click", clearForm);
  downloadBtn.addEventListener("click", downloadResult);
}

// Bắt đầu quá trình giấu tin
async function startHidingProcess() {
  const carrierType = document.getElementById("carrierType").value;
  const method = document.getElementById("method").value;
  const carrierFile = document.getElementById("carrierFile").files[0];
  const secretData = document.getElementById("secretData").value;
  const secretFile = document.getElementById("secretFile").files[0];
  const dataType = document.getElementById("dataType").value;
  const password = document.getElementById("password").value;

  // Kiểm tra dữ liệu đầu vào
  if (!carrierFile) {
    showAlert("Vui lòng chọn tệp chứa", "warning");
    return;
  }

  if (dataType === "text" && !secretData.trim()) {
    showAlert("Vui lòng nhập dữ liệu cần giấu", "warning");
    return;
  }

  if (dataType === "file" && !secretFile) {
    showAlert("Vui lòng chọn tệp cần giấu", "warning");
    return;
  }

  if (!password) {
    showAlert("Vui lòng nhập mật khẩu mã hóa", "warning");
    return;
  }

  if (!isPasswordValid()) {
    showAlert("Mật khẩu không đáp ứng yêu cầu bảo mật", "error");
    return;
  }
  // Hiển thị thanh tiến trình
  showProgress(true);
  resetProgress();
  startProcessWithProgress();

  try {
    // Mã hóa dữ liệu trên client
    updateProgress(10, "Đang mã hóa dữ liệu...");
    // Đảm bảo stegoCrypto đã được khởi tạo
    if (typeof stegoCrypto === "undefined") {
      await initializeSteganoCrypto();
    }

    // console.log("Chuẩn bị dữ liệu...", {
    //   dataType,
    //   hasTextData: !!secretData,
    //   textDataLength: secretData?.length,
    //   hasFileData: !!secretFile,
    //   fileName: secretFile?.name,
    //   fileSize: secretFile?.size,
    // });

    // Gọi hàm mã hóa từ stegoCrypto
    const encryptedData = await stegoCrypto.prepareSecretData(
      password,
      dataType,
      secretData,
      secretFile
    );

    if (encryptedData.byteLength === 0) {
      throw new Error("Dữ liệu mã hóa bị rỗng");
    }

    updateProgress(30, "Đang chuẩn bị gửi dữ liệu...");

    // Tạo FormData để gửi lên server
    const formData = new FormData();
    formData.append("operation", "hide");
    formData.append("carrier_type", carrierType);
    formData.append("method", method);
    formData.append("carrier_file", carrierFile);

    const encryptedBase64 = stegoCrypto.arrayBufferToBase64(encryptedData);
    if (encryptedBase64.length === 0) {
      throw new Error("Dữ liệu base64 bị rỗng");
    }
    formData.append("secret_data", encryptedBase64);
    // Tiếp tục các bước xử lý progress
    simulateHideProgress();

    // Gửi request đến server
    const response = await fetch(window.hideDataUrl, {
      method: "POST",
      body: formData,
      headers: {
        "X-CSRFToken": getCSRFToken(),
      },
    });

    if (!response.ok) {
      throw new Error(`Lỗi HTTP! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.success) {
      updateProgress(100, "Hoàn thành!");
      setProgressCompleted(true);

      setTimeout(() => {
        showResult(data);
        showAlert(
          "Giấu tin thành công! Dữ liệu đã được mã hóa và giấu an toàn.",
          "success"
        );
        setTimeout(() => showProgress(false), 2000);
      }, 1000);
    } else {
      setProgressCompleted(false);
      setTimeout(() => {
        showProgress(false);
        showAlert("Lỗi: " + data.error, "error");
      }, 1000);
    }
  } catch (error) {
    console.error(error);
    setProgressCompleted(false);
    setTimeout(() => {
      showProgress(false);
      showAlert(error.message, "error");
    }, 1000);
  }
}

//Hiển thị kết quả giấu tin
function showResult(data) {
  const resultSection = document.getElementById("resultSection");
  const outputFileName = document.getElementById("outputFileName");
  const outputFileSize = document.getElementById("outputFileSize");

  outputFileName.textContent = data.filename;
  outputFileSize.textContent = formatFileSize(atob(data.stego_data).length);

  // Lưu dữ liệu để tải về
  resultSection.dataset.stegoData = data.stego_data;
  resultSection.dataset.filename = data.filename;
  resultSection.classList.remove("d-none");
  // Cuộn đến kết quả
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadResult() {
  const resultSection = document.getElementById("resultSection");
  const stegoData = resultSection.dataset.stegoData;
  const filename = resultSection.dataset.filename;
  if (!stegoData) {
    showAlert("Không có dữ liệu để tải về", "warning");
    return;
  }

  // Giải mã base64
  const binaryData = atob(stegoData);
  const bytes = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }

  // Tạo blob và tải về
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showAlert(`Đã tải xuống tệp: ${filename}`, "success");
}

function clearForm() {
  // Reset form
  document.getElementById("steganographyForm").reset();

  // Ẩn các phần tử thông tin
  document.getElementById("carrierInfo").classList.add("d-none");
  document.getElementById("secretFileInfo").classList.add("d-none");
  document.getElementById("resultSection").classList.add("d-none");
  document.getElementById("passwordRequirements").classList.add("d-none");

  // Reset trạng thái card options
  resetCardOptions();

  // Cập nhật UI
  updateMethodOptions();
  updateDataType();
  updateMethodDetails();

  // Xóa thông báo cũ
  clearAlerts();
  showAlert("Đã xóa tất cả dữ liệu", "info");
}

// Reset các lựa chọn card options về mặc định
function resetCardOptions() {
  // Reset carrier type
  const carrierOptions = document.querySelectorAll(
    "#carrierTypeOptions .card-option"
  );
  carrierOptions.forEach((opt) => opt.classList.remove("active"));
  carrierOptions[0].classList.add("active");
  document.getElementById("carrierType").value = "text";

  // Reset method
  const methodOptions = document.querySelectorAll(
    "#methodOptions .card-option"
  );
  methodOptions.forEach((opt) => opt.classList.remove("active"));
  methodOptions[0].classList.add("active");
  document.getElementById("method").value = "LSB";

  // Reset data type
  const dataTypeOptions = document.querySelectorAll(
    "#dataTypeOptions .card-option"
  );
  dataTypeOptions.forEach((opt) => opt.classList.remove("active"));
  dataTypeOptions[0].classList.add("active");
  document.getElementById("dataType").value = "text";
}

// Xóa tất cả thông báo
function clearAlerts() {
  const jsAlertContainer = document.getElementById("jsAlertContainer");
  if (jsAlertContainer) {
    jsAlertContainer.innerHTML = "";
  }
}

// Định dạng kích thước file
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Lấy CSRF token từ form
function getCSRFToken() {
  return document.querySelector("[name=csrfmiddlewaretoken]").value;
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
    container.appendChild(alertDiv);
  }

  // Tự động xóa sau 5 giây
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
      // Ẩn container nếu không còn thông báo
      if (container.children.length === 0) {
        container.style.display = "none";
      }
    }
  }, 5000);
}

//Lấy CSRF token từ form
function getAlertIcon(type) {
  const icons = {
    success: "check-circle",
    error: "exclamation-circle",
    warning: "exclamation-triangle",
    info: "info-circle",
  };
  return icons[type] || "info-circle";
}

//Đảm bảo styles cho progress bar được áp dụng
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
