class EncryptionManager {
  constructor() {
    //khởi tạo trạng thái ban đầu
    this.initialized = false;
    this.currentKeyPair = null; // Cặp khóa hiện tại
    this.currentResult = null; // Kết quả mã hóa hiện tại
    this.userLoggedIn = window.userAuthenticated || false; // Trạng thái đăng nhập
    this.maxFileSize = 500 * 1024 * 1024; // 500MB
    this.selectedFile = null; // File đã chọn

    // Kiểm tra hỗ trợ Web Crypto API
    if (!this.checkCryptoSupport()) {
      this.showError(
        "Trình duyệt của bạn không hỗ trợ Web Crypto API. Vui lòng sử dụng Chrome, Firefox, Safari hoặc Edge phiên bản mới nhất."
      );
      return;
    }

    this.initialize();
  }

  checkCryptoSupport() {
    if (!window.crypto || !window.crypto.subtle) {
      console.error("Web Crypto API không được hỗ trợ");
      return false;
    }
    return true;
  }

  //Khởi tạo hệ thống
  async initialize() {
    try {
      if (!zkeCrypto) {
        await initializeCrypto();
      }
      this.initialized = true;
      this.initializeEventListeners(); // Thiết lập sự kiện
      this.initializeFileDrop(); // Khởi tạo khu vực kéo thả file
      if (this.userLoggedIn) {
        this.loadStoredKeyPairs(); // Tải khóa đã lưu nếu đã đăng nhập
      }
      console.log("Trình mã hóa đã được khởi tạo");
    } catch (error) {
      console.error("Không thể khởi tạo Trình mã hóa:", error);
      this.showError(
        "Không thể khởi tạo hệ thống mã hóa. Vui lòng tải lại trang."
      );
    }
  }

  //Thiết lập sựi kiện cho nút và form
  initializeEventListeners() {
    // Khởi tạo card options
    this.initializeCardOptions();

    // Chuyển đổi loại input (text/file) - SỬA: sử dụng select ẩn
    document.getElementById("inputType").addEventListener("change", (e) => {
        this.toggleInputType(e.target.value);
    });

    // Thay đổi loại mã hóa (đối xứng/bất đối xứng) - SỬA: sử dụng select ẩn  
    document.getElementById("encryptionType").addEventListener("change", (e) => {
        this.updateAlgorithmsByType(e.target.value);
    });

    // Thay đổi thuật toán mã hóa - SỬA: sử dụng select ẩn
    document.getElementById("algorithm").addEventListener("change", (e) => {
        this.updateAlgorithmInfo(e.target.value);
    });

    // Nút chức năng chính
    document.getElementById("encryptBtn").addEventListener("click", () => {
        this.handleEncryption();
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
        this.clearForm();
    });

    document.getElementById("downloadBtn").addEventListener("click", () => {
        this.downloadResult();
    });

    document.getElementById("copyBtn").addEventListener("click", () => {
        this.copyResult();
    });

    // Quản lý khóa - chỉ cho user đăng nhập
    if (this.userLoggedIn) {
        document.getElementById("generateKeysBtn")?.addEventListener("click", () => {
            this.generateKeyPair();
        });

        document.getElementById("useExistingKey")?.addEventListener("change", (e) => {
            this.toggleKeySelection(e.target.checked);
        });
    }

    // Xử lý toggle password visibility
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }

    // Thiết lập giao diện ban đầu
    this.toggleInputType("text");
    this.updateAlgorithmsByType("symmetric"); // Mặc định là mã hóa đối xứng
    this.updateUIForLoginStatus();
}

  // Khởi tạo khu vực kéo thả file
  initializeFileDrop() {
    const fileDropArea = document.getElementById("fileDropArea");
    const fileInput = document.getElementById("inputFile");
    const fileLink = fileDropArea.querySelector(".file-link");

    // Click vào khu vực hoặc link để chọn file
    fileLink.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });

    fileDropArea.addEventListener("click", (e) => {
      // Chỉ xử lý click trực tiếp vào khu vực drop, không phải vào các phần tử con
      if (e.target === fileDropArea) {
        fileInput.click();
      }
    });

    // Xử lý kéo thả
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      fileDropArea.addEventListener(eventName, this.preventDefaults, false);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      fileDropArea.addEventListener(eventName, this.highlight, false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      fileDropArea.addEventListener(eventName, this.unhighlight, false);
    });

    // Xử lý file được thả
    fileDropArea.addEventListener("drop", this.handleDrop.bind(this), false);

    // Xử lý file được chọn - SỬA LẠI: chỉ gọi 1 lần
    fileInput.addEventListener("change", (e) => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.handleFileSelect(fileInput.files[0]);
        // Reset input file để có thể chọn cùng file lại
        fileInput.value = "";
      }
    });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  highlight(e) {
    document.getElementById("fileDropArea").classList.add("dragover");
  }

  unhighlight(e) {
    document.getElementById("fileDropArea").classList.remove("dragover");
  }

  handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files.length > 0) {
      this.handleFileSelect(files[0]);
    }
    this.unhighlight(e);
  }

  //Xử lý khi người dùng chọn file
  async handleFileSelect(file) {
    try {
      // Kiểm tra kích thước file
      CryptoUtils.validateFileSize(file, this.maxFileSize);

      // Hiển thị thông tin file
      const fileInfo = document.getElementById("fileInfo");
      const fileName = document.getElementById("fileName");
      const fileSize = document.getElementById("fileSize");

      fileName.textContent = file.name;
      fileSize.textContent = CryptoUtils.formatFileSize(file.size);
      fileInfo.classList.remove("d-none");

      this.showSuccess(
        `Đã chọn file: ${file.name} (${CryptoUtils.formatFileSize(file.size)})`
      );

      // Lưu file đã chọn để sử dụng sau này
      this.selectedFile = file;
    } catch (error) {
      this.showError(error.message);
      document.getElementById("fileInfo").classList.add("d-none");
      this.selectedFile = null;
    }
  }

  //cập nhật giao diện khi đăng nhập
  updateUIForLoginStatus() {
    const loginNotice = document.getElementById("loginNotice");
    const keyManagement = document.getElementById("keyManagement");

    if (this.userLoggedIn) {
      if (loginNotice) loginNotice.style.display = "none";
    } else {
      if (loginNotice) loginNotice.style.display = "block";
      if (keyManagement) keyManagement.style.display = "none";
    }
  }

  //tải danh sách khóa đã lưu
  loadStoredKeyPairs() {
  if (!zkeCrypto || !this.userLoggedIn) return;

  try {
    const keyPairs = zkeCrypto.getStoredKeyPairs();
    const keySelect = document.getElementById("keyPairSelect");

    if (keySelect) {
      // Lưu giá trị đang chọn trước khi cập nhật
      const currentValue = keySelect.value;
      
      keySelect.innerHTML = '<option value="">Chọn khóa công khai...</option>';
      
      if (keyPairs && keyPairs.length > 0) {
        keyPairs.forEach((keyPair) => {
          const option = document.createElement("option");
          option.value = keyPair.publicKey;
          option.textContent = `${keyPair.algorithm} - ${new Date(
            keyPair.created
          ).toLocaleDateString("vi-VN")}`;
          option.dataset.privateKey = keyPair.privateKey;
          option.dataset.algorithm = keyPair.algorithm;
          keySelect.appendChild(option);
        });

        // Khôi phục giá trị đang chọn nếu có
        if (currentValue) {
          keySelect.value = currentValue;
        }
      }
    }
  } catch (error) {
    console.error("Lỗi tải danh sách khóa:", error);
  }
}

// Thêm phương thức mới để đồng bộ khóa
async syncKeyPairs() {
  if (!this.userLoggedIn) return;
  
  try {
    // Đồng bộ với server nếu cần
    if (typeof zkeCrypto.syncKeyPairs === 'function') {
      await zkeCrypto.syncKeyPairs();
    }
    
    // Tải lại danh sách
    this.loadStoredKeyPairs();
  } catch (error) {
    console.error("Lỗi đồng bộ khóa:", error);
  }
}

//tạo khóa mới
  async generateKeyPair() {
  if (!this.userLoggedIn) {
    this.showError("Vui lòng đăng nhập để sử dụng tính năng tạo khóa");
    return;
  }

  const algorithm = document.getElementById("algorithm").value;

  try {
    this.showLoading();
    const keyPair = await zkeCrypto.generateKeyPair(algorithm);
    this.currentKeyPair = keyPair;

    // Hiển thị thông tin khóa
    this.showKeyInfo(keyPair, algorithm);
    
    // Đồng bộ và tải lại danh sách
    await this.syncKeyPairs();
    
    // Cập nhật UI
    this.updateKeyManagementUI();

    this.showSuccess(`Đã tạo cặp khóa ${algorithm} thành công!`);
  } catch (error) {
    console.error("Lỗi tạo khóa:", error);
    this.showError("Lỗi tạo khóa: " + error.message);
  } finally {
    this.hideLoading();
  }
}

  //chuyển đổi giữa input text và file
  toggleInputType(type) {
    const textGroup = document.getElementById("textInputGroup");
    const fileGroup = document.getElementById("fileInputGroup");

    if (type === "text") {
      textGroup.classList.remove("d-none");
      fileGroup.classList.add("d-none");
    } else {
      textGroup.classList.add("d-none");
      fileGroup.classList.remove("d-none");
    }
  }

  // Cập nhật danh sách thuật toán dựa trên loại mã hóa
  updateAlgorithmsByType(type) {
    const algorithmSelect = document.getElementById("algorithm");
    // Xóa tất cả options hiện tại
    algorithmSelect.innerHTML = "";
    let algorithms = [];
    if (type === "symmetric") {
      algorithms = [
        { value: "AES-256-GCM", text: "AES-256-GCM" },
        { value: "XChaCha20-Poly1305", text: "XChaCha20-Poly1305" },
        { value: "Ascon128a", text: "Ascon128a" },
      ];

      // Hiển thị password group, ẩn key management
      document.getElementById("passwordGroup").style.display = "block";
      document.getElementById("keyManagement").style.display = "none";
    } else {
      algorithms = [
        { value: "X25519", text: "X25519" },
        { value: "Kyber1024", text: "Kyber1024" },
      ];

      // Ẩn password group, hiển thị key management
      document.getElementById("passwordGroup").style.display = "none";
      document.getElementById("keyManagement").style.display = "block";
    }

    // Thêm options mới
    algorithms.forEach((algo) => {
      const option = document.createElement("option");
      option.value = algo.value;
      option.textContent = algo.text;
      algorithmSelect.appendChild(option);
    });

    // Cập nhật thông tin thuật toán
    this.updateAlgorithmInfo(algorithmSelect.value);
  }

  //cập nhật thông tin thuật toán
  updateAlgorithmInfo(algorithm) {
    // Cập nhật thông tin chi tiết thuật toán - không cần tạo element mới
    this.updateAlgorithmDetails(algorithm);
}

// THÊM phương thức xử lý card options vào EncryptionManager
initializeCardOptions() {
    // Xử lý sự kiện click cho card options
    document.querySelectorAll('.card-option').forEach(card => {
        card.addEventListener('click', () => {
            if (card.getAttribute('data-disabled') === 'true') return;
            
            const parent = card.closest('.input-section-card');
            const options = parent.querySelectorAll('.card-option');
            
            // Xóa active class từ tất cả các card
            options.forEach(opt => opt.classList.remove('active'));
            
            // Thêm active class vào card được click
            card.classList.add('active');
            
            // Cập nhật giá trị select ẩn
            const select = parent.querySelector('select');
            if (select) {
                select.value = card.getAttribute('data-value');
                select.dispatchEvent(new Event('change'));
            }
        });
    });
}


  // Cập nhật thông tin chi tiết thuật toán
  updateAlgorithmDetails(algorithm) {
    const algorithmDetails = {
      "AES-256-GCM": { type: "Đối xứng", security: "Rất cao", speed: "Nhanh" },
      "XChaCha20-Poly1305": {
        type: "Đối xứng",
        security: "Cao",
        speed: "Rất nhanh",
      },
      Ascon128a: { type: "Đối xứng", security: "Cao", speed: "Nhẹ" },
      X25519: { type: "Bất đối xứng", security: "Cao", speed: "Nhanh" },
      Kyber1024: {
        type: "Bất đối xứng",
        security: "Kháng lượng tử",
        speed: "Trung bình",
      },
    };

    const details = algorithmDetails[algorithm] || {
      type: "Không xác định",
      security: "Không xác định",
      speed: "Không xác định",
    };

    document.getElementById("algoType").textContent = details.type;
    document.getElementById("algoSecurity").textContent = details.security;
    document.getElementById("algoSpeed").textContent = details.speed;
  }

  //Hiển thị ẩn quản lý khóa
  toggleKeyManagement(showAsymmetric) {
    const keyManagement = document.getElementById("keyManagement");
    const passwordGroup = document.getElementById("passwordGroup");

    if (keyManagement) {
      keyManagement.style.display = showAsymmetric ? "block" : "none";
    }
    if (passwordGroup) {
      passwordGroup.style.display = showAsymmetric ? "none" : "block";
    }
  }

  //chuyển đổi giữa tạo khóa mới và sử dụng khóa có sẵn
  toggleKeySelection(useExisting) {
    const keyGeneration = document.getElementById("keyGeneration");
    const keySelection = document.getElementById("keySelection");

    if (keyGeneration && keySelection) {
      keyGeneration.style.display = useExisting ? "none" : "block";
      keySelection.style.display = useExisting ? "block" : "none";
    }
  }

// Thêm phương thức cập nhật UI quản lý khóa
updateKeyManagementUI() {
  const useExistingCheckbox = document.getElementById("useExistingKey");
  const keySelection = document.getElementById("keySelection");
  const keyGeneration = document.getElementById("keyGeneration");
  
  if (useExistingCheckbox && useExistingCheckbox.checked) {
    if (keySelection) keySelection.style.display = "block";
    if (keyGeneration) keyGeneration.style.display = "none";
  } else {
    if (keySelection) keySelection.style.display = "none";
    if (keyGeneration) keyGeneration.style.display = "block";
  }
}

  //hiển thị thông tin khóa
  showKeyInfo(keyPair, algorithm) {
    let keyInfoSection = document.getElementById("keyInfoSection");
    if (!keyInfoSection) {
      keyInfoSection = document.createElement("div");
      keyInfoSection.id = "keyInfoSection";
      keyInfoSection.className = "mt-3";
      document.getElementById("keyManagement").appendChild(keyInfoSection);
    }

    keyInfoSection.innerHTML = `
            <div class="card-key">
                <h6 class="section-title">Thông tin khóa ${algorithm}</h6>
                <div class="mb-2">
                    <label class="form-check-label" style="margin-bottom: 10px;">Khóa công khai (Public Key):</label>
                    <textarea class="form-control form-control-sm" rows="2" readonly>${keyPair.publicKey}</textarea>
                </div>
                <div class="mb-2">
                    <label class="form-check-label" style="margin-bottom: 10px;">Khóa bí mật (Private Key):</label>
                    <textarea class="form-control form-control-sm" rows="2" readonly>${keyPair.privateKey}</textarea>
                </div>
                <small class="form-check-label" style="margin-bottom: 10px;color:red">
                    <i class="fas fa-exclamation-triangle me-1"></i>
                    LƯU Ý: Lưu trữ khóa bí mật cẩn thận! Mất khóa = Mất dữ liệu vĩnh viễn
                </small>
            </div>
        `;
  }

  // Phương thức xử lý file lớn bằng cách chia nhỏ
  async processLargeFile(
    algorithm,
    password,
    file,
    isAsymmetric = false,
    publicKey = null
  ) {
    const CHUNK_SIZE = 120 * 1024; // 120KB mỗi chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let encryptedChunks = [];

    this.showInfo(`Đang xử lý file lớn: ${totalChunks} phần...`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      // Hiển thị tiến trình
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      this.updateProgress(progress, `Đang mã hóa phần ${i + 1}/${totalChunks}`);

      // Đọc chunk
      const chunkBuffer = await CryptoUtils.readFileAsArrayBuffer(chunk);

      // Mã hóa chunk
      let encryptedChunk;
      if (!isAsymmetric) {
        encryptedChunk = await zkeCrypto.encryptSymmetric(
          algorithm,
          password,
          chunkBuffer
        );
      } else {
        encryptedChunk = await zkeCrypto.encryptAsymmetric(
          algorithm,
          publicKey,
          chunkBuffer
        );
      }

      encryptedChunks.push({
        index: i,
        data: encryptedChunk,
        size: chunk.size,
      });
    }

    return {
      chunks: encryptedChunks,
      totalChunks: totalChunks,
      originalSize: file.size,
      algorithm: algorithm,
      chunkSize: CHUNK_SIZE,
    };
  }

  // Cập nhật progress
  updateProgress(percent, message) {
    const loadingSection = document.getElementById("loadingSection");
    let progressElement = loadingSection.querySelector(".progress-container");

    if (!progressElement) {
      progressElement = this.createProgressElement();
    }

    const progressBar = progressElement.querySelector(".progress-bar");
    const progressText = progressElement.querySelector(".progress-text");
    const progressPercent = progressElement.querySelector(".progress-percent");

    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", percent);
    progressText.textContent = message;
    progressPercent.textContent = `${percent}%`;
  }

  // Tạo progress element
  createProgressElement() {
    const loadingSection = document.getElementById("loadingSection");
    const progressElement = document.createElement("div");
    progressElement.className = "progress-container mt-3";
    progressElement.innerHTML = `
            <div class="d-flex justify-content-between mb-1">
                <small class="progress-text">0%</small>
                <small class="progress-percent">0%</small>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     role="progressbar" style="width: 0%" 
                     aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                </div>
            </div>
        `;
    loadingSection.appendChild(progressElement);
    return progressElement;
  }

  //xử lý trình mã hóa chính
  async handleEncryption() {
  if (!this.initialized) {
    this.showError("Hệ thống chưa sẵn sàng. Vui lòng thử lại sau.");
    return;
  }

  const algorithm = document.getElementById("algorithm").value;
  const inputType = document.getElementById("inputType").value;
  const encryptionType = document.getElementById("encryptionType").value;
  const isAsymmetric = encryptionType === "asymmetric";

  let plaintext, filename, isFile = false, originalFile = null;
  let encryptedResult;
  let resultMessage = "";

  try {
    // Xử lý đầu vào
    if (inputType === "text") {
      plaintext = document.getElementById("inputData").value;
      if (!plaintext.trim()) {
        this.showError("Vui lòng nhập dữ liệu cần mã hóa");
        return;
      }
      filename = `encrypted_${algorithm.toLowerCase()}.enc`;
    } else {
      if (!this.selectedFile) {
        this.showError("Vui lòng chọn file cần mã hóa");
        return;
      }
      originalFile = this.selectedFile;
      CryptoUtils.validateFileSize(originalFile, this.maxFileSize);
      
      // Xử lý file lớn
      if (originalFile.size > 120 * 1024) {
        await this.handleLargeFileEncryption(algorithm, isAsymmetric, originalFile);
        return;
      }
      
      plaintext = await CryptoUtils.readFileAsArrayBuffer(originalFile);
      isFile = true;
      filename = `${originalFile.name.substring(0, originalFile.name.lastIndexOf('.')) || originalFile.name}.enc`;
    }

    this.showLoading();

    // MÃ HÓA THỐNG NHẤT - sử dụng phương thức mới
      if (!isAsymmetric) {
        // Mã hóa đối xứng - trả về base64
        const password = document.getElementById("password").value;
        if (!password) {
          throw new Error("Vui lòng nhập mật khẩu");
        }
        zkeCrypto.validatePassword(password);
        encryptedResult = await zkeCrypto.encryptSymmetric(algorithm, password, plaintext);
        resultMessage = `Mã hóa ${algorithm} thành công. Dùng cùng thuật toán và mật khẩu để giải mã.`;
      } else {
        // Mã hóa bất đối xứng - trả về JSON string
        const useExistingKey = document.getElementById("useExistingKey")?.checked;
        let publicKey;

        if (useExistingKey) {
          const keySelect = document.getElementById("keyPairSelect");
          publicKey = keySelect.value;
          if (!publicKey) {
            throw new Error("Vui lòng chọn khóa công khai");
          }
        } else {
          if (!this.currentKeyPair) {
            throw new Error("Vui lòng tạo cặp khóa trước khi mã hóa");
          }
          publicKey = this.currentKeyPair.publicKey;
        }

        console.log("Bắt đầu mã hóa bất đối xứng:", {
          algorithm,
          publicKeyLength: publicKey.length,
          dataSize: plaintext.length || plaintext.byteLength
        });

        // Mã hóa và nhận JSON string
        encryptedResult = await zkeCrypto.encryptAsymmetric(algorithm, publicKey, plaintext);
        
        // Đảm bảo kết quả là JSON string hợp lệ
        if (typeof encryptedResult !== 'string') {
          encryptedResult = JSON.stringify(encryptedResult);
        }
        
        // Validate JSON
        try {
          JSON.parse(encryptedResult);
        } catch (e) {
          throw new Error("Kết quả mã hóa không phải JSON hợp lệ");
        }

        resultMessage = `Mã hóa ${algorithm} thành công. Cần khóa bí mật tương ứng để giải mã.`;
      }

      // TẠO METADATA THỐNG NHẤT
      const metadata = {
        n: isFile ? originalFile.name : "text_data.txt",
        s: isFile ? originalFile.size : plaintext.length,
        t: isFile ? originalFile.type : "text/plain",
        a: algorithm,
        d: encryptedResult, // Base64 cho đối xứng, JSON string cho bất đối xứng
        i: new Date().toISOString(),
        c: false,
        asymmetric: isAsymmetric
      };

      this.currentResult = {
        data: JSON.stringify(metadata, null, 2),
        displayData: encryptedResult,
        filename: filename,
        isFile: isFile,
        originalFilename: isFile ? originalFile.name : "text_data.txt",
        originalMimeType: isFile ? originalFile.type : "text/plain",
        fileMetadata: metadata,
        isAsymmetric: isAsymmetric
      };

      // HIỂN THỊ KẾT QUẢ
      this.showResult(encryptedResult, filename, resultMessage);

      // Ghi log nếu user đã đăng nhập
      if (this.userLoggedIn) {
        await this.logActivity(algorithm, inputType, filename, 
          isFile ? originalFile.size : plaintext.length);
      }

    } catch (error) {
      console.error("Encryption error details:", error);
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  // Sửa phương thức hiển thị kết quả
  showResult(displayData, filename, message) {
    const outputData = document.getElementById("outputData");
    const resultSection = document.getElementById("resultSection");

    let displayText = displayData;

    // XỬ LÝ HIỂN THỊ KHÁC NHAU CHO 2 LOẠI MÃ HÓA
    if (this.currentResult.isAsymmetric) {
      // Bất đối xứng: hiển thị JSON format đẹp
      try {
        const jsonData = JSON.parse(displayData);
        displayText = JSON.stringify(jsonData, null, 2);
        
        // Cắt ngắn nếu quá dài
        if (displayText.length > 2000) {
          displayText = displayText.substring(0, 2000) + 
            '\n... [Dữ liệu JSON đã được cắt bớt - Tải file để xem đầy đủ]';
        }
      } catch (e) {
        // Nếu không parse được, hiển thị nguyên bản
        if (displayData.length > 1000) {
          displayText = displayData.substring(0, 1000) + 
            '\n... [Dữ liệu đã được cắt bớt]';
        }
      }
    } else {
      // Đối xứng: hiển thị base64
      if (typeof displayData === "string" && displayData.length > 1000) {
        displayText = displayData.substring(0, 1000) + 
          "\n... [Dữ liệu đã được cắt bớt để hiển thị]";
      }
    }

    outputData.value = displayText;
    resultSection.classList.remove("d-none");
    this.showSuccess(message);
    resultSection.scrollIntoView({ behavior: "smooth" });
  }

// Thêm phương thức xử lý file lớn
async handleLargeFileEncryption(algorithm, isAsymmetric, file) {
  let publicKey = null;
  if (isAsymmetric) {
    const useExistingKey = document.getElementById("useExistingKey")?.checked;
    if (useExistingKey) {
      const keySelect = document.getElementById("keyPairSelect");
      publicKey = keySelect.value;
      if (!publicKey) {
        throw new Error("Vui lòng chọn khóa công khai");
      }
    } else {
      if (!this.currentKeyPair) {
        throw new Error("Vui lòng tạo cặp khóa trước khi mã hóa");
      }
      publicKey = this.currentKeyPair.publicKey;
    }
  }

  const encryptedResult = await this.processLargeFile(
    algorithm,
    isAsymmetric ? "" : document.getElementById("password").value,
    file,
    isAsymmetric,
    publicKey
  );

  // Tạo metadata cho file lớn
  const fileMetadata = {
    n: file.name,
    s: file.size,
    t: file.type,
    a: algorithm,
    d: JSON.stringify(encryptedResult),
    i: new Date().toISOString(),
    c: true,
    p: encryptedResult.totalChunks,
    z: encryptedResult.chunkSize,
    asymmetric: isAsymmetric
  };

  const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const filename = `${originalName}.enc`;

  this.currentResult = {
    data: JSON.stringify(fileMetadata, null, 2),
    displayData: "File lớn đã được mã hóa thành công. Vui lòng tải file để lưu kết quả.",
    filename: filename,
    isFile: true,
    originalFilename: file.name,
    originalMimeType: file.type,
    fileMetadata: fileMetadata,
    isAsymmetric: isAsymmetric
  };

  this.showResult(this.currentResult.displayData, filename, 
    `Mã hóa ${algorithm} thành công. File đã được chia thành ${encryptedResult.totalChunks} phần.`);

  if (this.userLoggedIn) {
    await this.logActivity(algorithm, "file", filename, file.size);
  }
}

  //hiển thị thông báo
  showInfo(message) {
    this.showNotification("info", "Thông tin", message);
  }

  //tải xuống kết quả - ĐÃ SỬA LỖI
  downloadResult() {
    if (!this.currentResult) {
      this.showError("Không có dữ liệu để tải xuống");
      return;
    }

    let filename = this.currentResult.filename;

    // Đảm bảo filename có đuôi .enc
    if (filename && !filename.endsWith(".enc")) {
      filename += ".enc";
    }

    // LUÔN TẢI VỀ METADATA ĐẦY ĐỦ
    CryptoUtils.downloadFile(
      this.currentResult.data,
      filename,
      "application/json"
    );
    this.showSuccess(`Đã tải file mã hóa "${filename}" thành công!`);
  }

  //hiển thị kết quả mã hóa - chỉ hiển thị cipertext
  showResult(displayData, filename, message) {
  const outputData = document.getElementById("outputData");
  const resultSection = document.getElementById("resultSection");

  // Hiển thị cipertext đơn giản
  let displayText = displayData;
  if (typeof displayData === "string" && displayData.length > 1000) {
    displayText = displayData.substring(0, 1000) + 
      "\n... [Dữ liệu đã được cắt bớt để hiển thị]";
  }

  outputData.value = displayText;
  resultSection.classList.remove("d-none");
  this.showSuccess(message);
  resultSection.scrollIntoView({ behavior: "smooth" });
}

  showError(message) {
    this.showNotification("error", "Lỗi", message);
  }

  showSuccess(message) {
    this.showNotification("success", "Thành công", message);
  }

  showNotification(type, title, message) {
    // Tạo container nếu chưa có
    let messageContainer = document.querySelector(".message-container");
    if (!messageContainer) {
      messageContainer = document.createElement("div");
      messageContainer.className = "message-container";
      document.body.appendChild(messageContainer);
    }

    // Tạo thông báo
    const notification = document.createElement("div");
    notification.className = `alert alert-${
      type === "error" ? "danger" : type
    } alert-dismissible fade show custom-alert`;
    notification.innerHTML = `
            <i class="fas fa-${this.getIcon(type)} me-2"></i>
            <strong>${title}</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

    messageContainer.appendChild(notification);

    // Tự động đóng sau 5 giây
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  getIcon(type) {
    const icons = {
      success: "check-circle",
      error: "exclamation-circle",
      warning: "exclamation-triangle",
      info: "info-circle",
    };
    return icons[type] || "info-circle";
  }

  //trạng thái load
  showLoading() {
    document.getElementById("loadingSection").classList.remove("d-none");
    document.getElementById("encryptBtn").disabled = true;
  }

  hideLoading() {
    document.getElementById("loadingSection").classList.add("d-none");
    document.getElementById("encryptBtn").disabled = false;
  }

  //xóa form
  clearForm() {
    document.getElementById("inputData").value = "";
    document.getElementById("inputFile").value = "";
    document.getElementById("password").value = "";
    document.getElementById("outputData").value = "";
    document.getElementById("resultSection").classList.add("d-none");
    this.currentResult = null;

    // Xóa thông tin file
    document.getElementById("fileInfo").classList.add("d-none");

    //xóa thông báo
    document.querySelectorAll(".custom-alert").forEach((alert) => {
      alert.remove();
    });
  }

  //sao chép kết quả
  copyResult() {
    if (this.currentResult) {
      // Sao chép ciphertext (displayData) thay vì toàn bộ metadata
      const textToCopy =
        this.currentResult.displayData || this.currentResult.data;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => this.showSuccess("Đã sao chép ciphertext vào clipboard!"))
        .catch(() => this.showError("Lỗi khi sao chép!"));
    }
  }

  //ghi log hoạt động
  async logActivity(algorithm, inputType, filename, dataLength) {
    if (!this.userLoggedIn) return;

    try {
      const formData = new FormData();
      formData.append("algorithm", algorithm);
      formData.append("action", "encrypt");
      formData.append("input_type", inputType);
      formData.append("input_data", "[ZKE - Dữ liệu được mã hóa tại chỗ]");

      if (inputType === "file") {
        const blob = new Blob(["[ZKE - Tệp được mã hóa cục bộy]"], {
          type: "text/plain",
        });
        formData.append("file", blob, filename);
      }

      const response = await fetch("/api/process-encryption/", {
        method: "POST",
        body: formData,
        headers: {
          "X-CSRFToken": this.getCSRFToken(),
        },
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
    } catch (error) {
      console.error("Lỗi ghi log hoạt động:", error);
    }
  }

  //lấy csrf token
  getCSRFToken() {
    return document.querySelector("[name=csrfmiddlewaretoken]").value;
  }
}

// Khởi tạo khi trang load
document.addEventListener("DOMContentLoaded", function () {
  new EncryptionManager();
});