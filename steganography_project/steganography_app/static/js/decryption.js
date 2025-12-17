class DecryptionManager {
  constructor() {
    //khởi tạo trạng thái ban đầu
    this.initialized = false;
    this.currentResult = null; // Kết quả giải mã hiện tại
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

  //phương thức kiểm tra hỗ trợ
  checkCryptoSupport() {
    if (!window.crypto || !window.crypto.subtle) {
      console.error("Web Crypto API không được hỗ trợ");
      return false;
    }
    return true;
  }

  //khởi tạo hệ thống
  async initialize() {
    try {
      if (!zkeCrypto) {
        await initializeCrypto();
      }
      this.initialized = true;
      this.initializeEventListeners(); // Thiết lập sự kiện
      this.initializeFileDrop(); // Khởi tạo khu vực kéo thả file
      this.loadStoredKeyPairs(); // Tải khóa đã lưu
      console.log("Trình giải mã đã được khởi tạo");
    } catch (error) {
      console.error("Không thể khởi tạo Trình giải mã:", error);
      this.showError(
        "Không thể khởi tạo hệ thống giải mã. Vui lòng tải lại trang."
      );
    }
  }

  //thiết lập sự kiện cho các nút và form
initializeEventListeners() {
    // Khởi tạo card options
    this.initializeCardOptions();

    // Chuyển đổi loại input (text/file)
    document.getElementById("inputType").addEventListener("change", (e) => {
        this.toggleInputType(e.target.value);
    });

    // loại mã hóa (đối xứng/bất đối xứng)
    document.getElementById("encryptionType").addEventListener("change", (e) => {
        this.updateAlgorithmsByType(e.target.value);
    });

    // thuật toán giải mã
    document.getElementById("algorithm").addEventListener("change", (e) => {
        this.updateAlgorithmInfo(e.target.value);
    });

    // Nút chức năng chính
    document.getElementById("decryptBtn").addEventListener("click", () => {
        this.handleDecryption();
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

    // thiết lập giao diện ban đầu
    this.toggleInputType("text");
    this.updateAlgorithmsByType("symmetric"); // Mặc định là giải mã đối xứng
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

    // Xử lý file được chọn
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

  //xử lý khi người dùng chọn file
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
  //tải danh sách prive key đã lưu - user đã đăng nhập
  loadStoredKeyPairs() {
    if (!zkeCrypto || !this.userLoggedIn) return;

    const keyPairs = zkeCrypto.getStoredKeyPairs();
    const keySelect = document.getElementById("privateKeySelect");

    if (keySelect && keyPairs.length > 0) {
      keySelect.innerHTML = '<option value="">Chọn khóa bí mật...</option>';
      keyPairs.forEach((keyPair) => {
        const option = document.createElement("option");
        option.value = keyPair.privateKey;
        option.textContent = `${keyPair.algorithm} - ${new Date(
          keyPair.created
        ).toLocaleDateString("vi-VN")}`;
        option.dataset.algorithm = keyPair.algorithm;
        keySelect.appendChild(option);
      });
    }
  }

  // chuyển đổi giữa input text và file
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

  updateAlgorithmInfo(algorithm) {
    // Cập nhật thông tin chi tiết thuật toán - không cần tạo element mới
    this.updateAlgorithmDetails(algorithm);
    
    // Cập nhật mô tả thuật toán
    const algorithmDescription = document.getElementById("algorithmDescription");
    if (algorithmDescription) {
        const descriptions = {
            "AES-256-GCM": "Giải mã đối xứng - Dùng mật khẩu đã mã hóa",
            "XChaCha20-Poly1305": "Giải mã đối xứng - Dùng mật khẩu đã mã hóa", 
            "Ascon128a": "Giải mã đối xứng - Dùng mật khẩu đã mã hóa",
            "X25519": "Giải mã bất đối xứng - Cần khóa bí mật tương ứng",
            "Kyber1024": "Giải mã bất đối xứng - Cần khóa bí mật tương ứng"
        };
        algorithmDescription.textContent = descriptions[algorithm] || "Thông tin giải mã";
    }
}

// THÊM phương thức xử lý card options vào DecryptionManager
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
      "AES-256-GCM": {
        type: "Đối xứng",
        requirement: "Mật khẩu",
        speed: "Nhanh",
      },
      "XChaCha20-Poly1305": {
        type: "Đối xứng",
        requirement: "Mật khẩu",
        speed: "Rất nhanh",
      },
      Ascon128a: { type: "Đối xứng", requirement: "Mật khẩu", speed: "Nhẹ" },
      X25519: {
        type: "Bất đối xứng",
        requirement: "Khóa bí mật",
        speed: "Nhanh",
      },
      Kyber1024: {
        type: "Bất đối xứng",
        requirement: "Khóa bí mật",
        speed: "Trung bình",
      },
    };

    const details = algorithmDetails[algorithm] || {
      type: "Không xác định",
      requirement: "Không xác định",
      speed: "Không xác định",
    };

    document.getElementById("algoType").textContent = details.type;
    document.getElementById("algoRequirement").textContent =
      details.requirement;
    document.getElementById("algoSpeed").textContent = details.speed;
  }

  //hiển thị/ ẩn quản lý khóa
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

  //tạo phần tử hiển thị thông tin thuật toán
  createAlgorithmInfoElement() {
    const algorithmGroup = document
      .querySelector("#algorithm")
      .closest(".form-group");
    let infoElement = document.getElementById("algorithmInfo");

    if (!infoElement) {
      infoElement = document.createElement("small");
      infoElement.id = "algorithmInfo";
      infoElement.className = "form-text text-info mt-1";
      algorithmGroup.appendChild(infoElement);
    }

    return infoElement;
  }

  // Giải mã file đã được chia nhỏ
  async decryptLargeFile(
    algorithm,
    password,
    encryptedData,
    isAsymmetric = false,
    privateKey = null
  ) {
    const data = JSON.parse(encryptedData);
    const { chunks, totalChunks, originalSize, chunkSize } = data;

    this.showInfo(`Đang giải mã file lớn: ${totalChunks} phần...`);

    // Sắp xếp các chunk theo thứ tự
    chunks.sort((a, b) => a.index - b.index);

    const decryptedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Hiển thị tiến trình
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      this.updateProgress(
        progress,
        `Đang giải mã phần ${i + 1}/${totalChunks}`
      );

      // Giải mã chunk
      let decryptedChunk;
      if (!isAsymmetric) {
        decryptedChunk = await zkeCrypto.decryptSymmetric(
          algorithm,
          password,
          chunk.data
        );
      } else {
        decryptedChunk = await zkeCrypto.decryptAsymmetric(
          algorithm,
          privateKey,
          chunk.data
        );
      }

      decryptedChunks.push(decryptedChunk);
    }

    // Kết hợp các chunk thành file hoàn chỉnh
    const totalLength = decryptedChunks.reduce(
      (total, chunk) => total + chunk.byteLength,
      0
    );
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of decryptedChunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
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

  //xử lý quá trình giải mã chính
    async handleDecryption() {
    if (!this.initialized) {
      this.showError("Hệ thống chưa sẵn sàng. Vui lòng thử lại sau.");
      return;
    }

    const algorithm = document.getElementById("algorithm").value;
    const inputType = document.getElementById("inputType").value;
    const encryptionType = document.getElementById("encryptionType").value;
    const isAsymmetric = encryptionType === "asymmetric";

    let encryptedData, filename, isFile = false, fileMetadata = null;

    try {
      // Xử lý đầu vào với validation
      if (inputType === "text") {
        encryptedData = document.getElementById("inputData").value.trim();
        if (!encryptedData) {
          this.showError("Vui lòng nhập dữ liệu mã hóa");
          return;
        }
        filename = `decrypted_${algorithm.toLowerCase()}.txt`;
      } else {
        if (!this.selectedFile) {
          this.showError("Vui lòng chọn file mã hóa");
          return;
        }
        const file = this.selectedFile;
        CryptoUtils.validateFileSize(file, this.maxFileSize);

        const fileContent = await CryptoUtils.readFileAsText(file);
        
        try {
          fileMetadata = JSON.parse(fileContent);
        } catch (e) {
          throw new Error("File không phải định dạng JSON hợp lệ");
        }
        
        const decodedMetadata = this.decodeMetadata(fileMetadata);
        
        if (decodedMetadata.chunked) {
          await this.handleLargeFileDecryption(algorithm, isAsymmetric, decodedMetadata);
          return;
        }

        encryptedData = decodedMetadata.encryptedData;
        isFile = true;
        filename = decodedMetadata.originalFilename;
        
        if (!encryptedData) {
          throw new Error("File metadata không chứa dữ liệu mã hóa");
        }
      }

      this.showLoading();
      let decryptedData;

      if (!isAsymmetric) {
        // Giải mã đối xứng - dữ liệu là base64
        const password = document.getElementById("password").value;
        if (!password) {
          throw new Error("Vui lòng nhập mật khẩu");
        }
        zkeCrypto.validatePassword(password);
        encryptedData = this.validateAndPrepareSymmetricData(encryptedData);
        decryptedData = await zkeCrypto.decryptSymmetric(algorithm, password, encryptedData);
      } else {
        // Giải mã bất đối xứng - dữ liệu là JSON string
        let privateKey = document.getElementById("privateKeySelect").value;
        const directPrivateKey = document.getElementById("privateKeyInput").value.trim();
        if (directPrivateKey) {
          privateKey = directPrivateKey;
        }
        
        if (!privateKey) {
          throw new Error("Vui lòng chọn khóa bí mật hoặc nhập khóa bí mật trực tiếp");
        }

        console.log("Bắt đầu giải mã bất đối xứng:", {
          algorithm,
          encryptedDataLength: encryptedData.length,
          privateKeyLength: privateKey.length,
          isFile: isFile
        });

        // Xử lý dữ liệu bất đối xứng - KHÔNG xác thực base64
        encryptedData = this.validateAndPrepareAsymmetricData(encryptedData, fileMetadata);
        decryptedData = await zkeCrypto.decryptAsymmetric(algorithm, privateKey, encryptedData);
      }

      // Xử lý kết quả giải mã
      if (isFile && decryptedData instanceof ArrayBuffer) {
        this.currentResult = {
          data: decryptedData,
          filename: filename,
          isFile: true,
          mimeType: fileMetadata?.originalType || CryptoUtils.getMimeType(filename),
        };
        this.showFileResult(filename, decryptedData.byteLength);
      } else {
        this.currentResult = {
          data: decryptedData,
          filename: filename,
          isFile: false,
        };
        this.showResult(decryptedData, filename);
      }
      await this.logActivity(algorithm, inputType, filename, encryptedData.length);
    } catch (error) {
      console.error("Lỗi giải mã chi tiết:", error);
      this.handleDecryptionError(error);
    } finally {
      this.hideLoading();
    }
  }
  validateAndPrepareSymmetricData(encryptedData) {
    try {
      if (typeof encryptedData === "string") {
        // Kiểm tra base64 hợp lệ
        if (this.isValidBase64(encryptedData)) {
          return encryptedData;
        }

        // Thử làm sạch chuỗi
        const cleaned = encryptedData.replace(/[^A-Za-z0-9+/=]/g, "");
        if (this.isValidBase64(cleaned)) {
          return cleaned;
        }

        throw new Error("Dữ liệu mã hóa đối xứng phải là base64 hợp lệ");
      } else if (encryptedData instanceof ArrayBuffer) {
        // Chuyển ArrayBuffer sang base64
        return CryptoUtils.arrayBufferToBase64(encryptedData);
      } else {
        throw new Error("Định dạng dữ liệu mã hóa không được hỗ trợ");
      }
    } catch (error) {
      throw new Error(`Dữ liệu mã hóa đối xứng không hợp lệ: ${error.message}`);
    }
  }

  // Xử lý dữ liệu bất đối xứng (JSON)
  validateAndPrepareAsymmetricData(encryptedData, fileMetadata = null) {
    try {
      if (typeof encryptedData === "string") {
        // THỬ 1: Kiểm tra xem có phải JSON hợp lệ không
        try {
          const parsedData = JSON.parse(encryptedData);
          console.log("Dữ liệu là JSON hợp lệ:", Object.keys(parsedData));
          return encryptedData; // Trả về JSON string
        } catch (jsonError) {
          console.log("Không phải JSON, kiểm tra base64:", jsonError);
        }

        // THỬ 2: Nếu không phải JSON, có thể là base64 của JSON
        if (this.isValidBase64(encryptedData)) {
          try {
            const decodedJson = atob(encryptedData);
            const parsedData = JSON.parse(decodedJson);
            console.log("Dữ liệu là base64 encoded JSON:", Object.keys(parsedData));
            return decodedJson; // Trả về JSON string đã decode
          } catch (e) {
            console.log("Base64 nhưng không phải JSON:", e);
          }
        }

        // THỬ 3: Có thể là ciphertext trực tiếp
        // Tạo cấu trúc JSON giả định
        console.log("Tạo cấu trúc JSON giả định từ ciphertext");
        const assumedData = {
          ciphertext: encryptedData,
          algorithm: document.getElementById("algorithm").value,
          timestamp: new Date().toISOString(),
          assumed: true // Đánh dấu là dữ liệu giả định
        };

        return JSON.stringify(assumedData);
      } else if (encryptedData instanceof ArrayBuffer) {
        // Chuyển ArrayBuffer sang text và xử lý như string
        const decoder = new TextDecoder();
        const textData = decoder.decode(encryptedData);
        return this.validateAndPrepareAsymmetricData(textData, fileMetadata);
      } else {
        throw new Error("Định dạng dữ liệu mã hóa không được hỗ trợ");
      }
    } catch (error) {
      console.error("Lỗi xử lý dữ liệu bất đối xứng:", error);
      throw new Error(`Dữ liệu mã hóa bất đối xứng không hợp lệ: ${error.message}`);
    }
  }

  // Phương thức kiểm tra base64
  isValidBase64(str) {
    try {
      if (typeof str !== 'string') return false;
      
      const cleaned = str.replace(/[^A-Za-z0-9+/=]/g, "");
      if (cleaned.length === 0) return false;
      if (cleaned.length % 4 !== 0) return false;
      
      // Kiểm tra ký tự padding
      if (cleaned.indexOf('=') > 0) {
        const padding = cleaned.substring(cleaned.indexOf('='));
        if (padding !== '=' && padding !== '==' && padding !== '===') {
          return false;
        }
      }
      
      const decoded = atob(cleaned);
      const reencoded = btoa(decoded);
      return reencoded === cleaned;
    } catch (e) {
      return false;
    }
  }

  //phương thức xử lý lỗi
  handleDecryptionError(error) {
    console.error("Chi tiết lỗi giải mã:", error);

    if (error.message.includes("Mật khẩu giải mã không đúng") ||
        error.message.includes("authentication tag") ||
        error.message.includes("Khóa bí mật không đúng")) {
      this.showError("Khóa bí mật hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.");
    } else if (error.message.includes("Thuật toán không khớp")) {
      this.showError("Thuật toán không khớp. Vui lòng chọn đúng thuật toán đã dùng để mã hóa.");
    } else if (error.message.includes("JSON") || 
               error.message.includes("định dạng") ||
               error.message.includes("Thiếu")) {
      this.showError("Dữ liệu mã hóa không đúng định dạng. Vui lòng sử dụng file tải về từ hệ thống.");
    } else if (error.message.includes("atob") ||
               error.message.includes("base64")) {
      this.showError("Định dạng dữ liệu không hợp lệ. Vui lòng kiểm tra lại dữ liệu đầu vào.");
    } else if (error.message.includes("importKey") ||
               error.message.includes("không tương thích")) {
      this.showError("Khóa không hợp lệ hoặc không tương thích với thuật toán đã chọn.");
    } else {
      this.showError("Giải mã thất bại: " + error.message);
    }
  }

  validateAndPrepareEncryptedData(encryptedData, isAsymmetric = false) {
    try {
      if (typeof encryptedData === "string") {
        // Nếu là bất đối xứng, kiểm tra xem có phải JSON không
        if (isAsymmetric) {
          try {
            JSON.parse(encryptedData);
            return encryptedData; // Đã là JSON hợp lệ
          } catch (e) {
            throw new Error("Dữ liệu mã hóa bất đối xứng phải là JSON hợp lệ");
          }
        }
        
        // Kiểm tra base64 hợp lệ
        if (this.isValidBase64(encryptedData)) {
          return encryptedData;
        }

        // Thử làm sạch chuỗi
        const cleaned = encryptedData.replace(/[^A-Za-z0-9+/=]/g, "");
        if (this.isValidBase64(cleaned)) {
          return cleaned;
        }

        throw new Error("Dữ liệu không phải base64 hợp lệ");
      } else if (encryptedData instanceof ArrayBuffer) {
        // Chuyển ArrayBuffer sang base64
        return CryptoUtils.arrayBufferToBase64(encryptedData);
      } else {
        throw new Error("Định dạng dữ liệu mã hóa không được hỗ trợ");
      }
    } catch (error) {
      throw new Error(`Dữ liệu mã hóa không hợp lệ: ${error.message}`);
    }
  }


async handleLargeFileDecryption(algorithm, isAsymmetric, decodedMetadata) {
  let decryptedData;
  
  if (!isAsymmetric) {
    const password = document.getElementById("password").value;
    zkeCrypto.validatePassword(password);
    decryptedData = await this.decryptLargeFile(
      algorithm, password, decodedMetadata.encryptedData, false
    );
  } else {
    let privateKey = document.getElementById("privateKeySelect").value;
    const directPrivateKey = document.getElementById("privateKeyInput").value.trim();
    if (directPrivateKey) {
      privateKey = directPrivateKey;
    }
    if (!privateKey) {
      throw new Error("Vui lòng chọn khóa bí mật hoặc nhập khóa bí mật trực tiếp");
    }
    decryptedData = await this.decryptLargeFile(
      algorithm, "", decodedMetadata.encryptedData, true, privateKey
    );
  }

  this.currentResult = {
    data: decryptedData,
    filename: decodedMetadata.originalFilename,
    isFile: true,
    mimeType: decodedMetadata.originalType || CryptoUtils.getMimeType(decodedMetadata.originalFilename),
  };
  
  this.showFileResult(decodedMetadata.originalFilename, decryptedData.byteLength);
  await this.logActivity(algorithm, "file", decodedMetadata.originalFilename, 
    decodedMetadata.encryptedData.length);
}


// chuẩn bị dữ liệu bất đối xứng
prepareAsymmetricData(algorithm, simpleCiphertext, originalMetadata = null) {
  // Tạo cấu trúc dữ liệu đầy đủ từ ciphertext đơn giản
  const fullData = {
    algorithm: algorithm,
    ciphertext: simpleCiphertext,
    timestamp: new Date().toISOString(),
    ...originalMetadata
  };
  
  return JSON.stringify(fullData);
}

  // Giải mã metadata đã bị làm rối
  decodeMetadata(obfuscatedMetadata) {
    return {
      originalFilename: obfuscatedMetadata.n,
      originalSize: obfuscatedMetadata.s,
      originalType: obfuscatedMetadata.t,
      algorithm: obfuscatedMetadata.a,
      encryptedData: obfuscatedMetadata.d,
      timestamp: obfuscatedMetadata.i,
      chunked: obfuscatedMetadata.c,
      totalChunks: obfuscatedMetadata.p,
      chunkSize: obfuscatedMetadata.z,
    };
  }

  //hiển thị kết quả giải mã
  showFileResult(filename, fileSize) {
    const resultSection = document.getElementById("resultSection");
    const outputData = document.getElementById("outputData");

    // Hiển thị thông báo cho file
    outputData.value = `[File đã được giải mã thành công]\nTên file: ${filename}\nKích thước: ${CryptoUtils.formatFileSize(
      fileSize
    )}\nĐịnh dạng: ${CryptoUtils.getFileExtension(
      filename
    ).toUpperCase()}\n\nFile đã sẵn sàng để tải xuống.`;
    resultSection.classList.remove("d-none");

    this.showSuccess(
      `Giải mã file thành công! File "${filename}" đã sẵn sàng để tải xuống.`
    );
    resultSection.scrollIntoView({ behavior: "smooth" });
  }

  //tải xuống kết quả giải mã
  downloadResult() {
    if (!this.currentResult) {
      this.showError("Không có dữ liệu để tải xuống");
      return;
    }

    if (this.currentResult.isFile) {
      // Tải xuống file nhị phân với đúng định dạng và MIME type gốc
      CryptoUtils.downloadArrayBuffer(
        this.currentResult.data,
        this.currentResult.filename,
        this.currentResult.mimeType
      );
      this.showSuccess(
        `Đã tải file "${this.currentResult.filename}" thành công!`
      );
    } else {
      // Tải xuống văn bản
      CryptoUtils.downloadFile(
        this.currentResult.data,
        this.currentResult.filename,
        "text/plain"
      );
      this.showSuccess(
        `Đã tải file giải mã "${this.currentResult.filename}" thành công!`
      );
    }
  }

  //hiển thị kết quả giải mã text
  showResult(decryptedData, filename) {
    const outputData = document.getElementById("outputData");
    const resultSection = document.getElementById("resultSection");

    outputData.value = decryptedData;
    resultSection.classList.remove("d-none");
    this.currentResult = { data: decryptedData, filename: filename };

    this.showSuccess("Giải mã thành công!");
    resultSection.scrollIntoView({ behavior: "smooth" });
  }

  //các phương thức hiển thị thông báo
  showError(message) {
    this.showNotification("error", "Lỗi", message);
  }

  showSuccess(message) {
    this.showNotification("success", "Thành công", message);
  }

  showInfo(message) {
    this.showNotification("info", "Thông tin", message);
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

    // Tự động xóa sau 5 giây
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
    document.getElementById("decryptBtn").disabled = true;
  }

  hideLoading() {
    document.getElementById("loadingSection").classList.add("d-none");
    document.getElementById("decryptBtn").disabled = false;
  }

  //xóa form và dữ liệu
  clearForm() {
    document.getElementById("inputData").value = "";
    document.getElementById("inputFile").value = "";
    document.getElementById("password").value = "";
    document.getElementById("privateKeySelect").value = "";
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
    if (this.currentResult && !this.currentResult.isFile) {
      navigator.clipboard
        .writeText(this.currentResult.data)
        .then(() =>
          this.showSuccess("Đã sao chép kết quả giải mã vào clipboard!")
        )
        .catch(() => this.showError("Lỗi khi sao chép!"));
    } else if (this.currentResult && this.currentResult.isFile) {
      this.showError("Không thể sao chép file nhị phân vào clipboard.");
    }
  }

  //ghi log hoạt động
  async logActivity(algorithm, inputType, filename, dataLength) {
    if (!this.userLoggedIn) return;

    try {
      const formData = new FormData();
      formData.append("algorithm", algorithm);
      formData.append("action", "decrypt");
      formData.append("input_type", inputType);
      formData.append("input_data", "[ZKE - Dữ liệu giải mã tại chỗ]");

      if (inputType === "file") {
        const blob = new Blob(["ZKE - Tệp được giải mã cục bộ]"], {
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
        throw new Error("Phản hồi mạng không ổn");
      }
    } catch (error) {
      console.error("Lỗi ghi log hoạt động:", error);
    }
  }

  // lấy csrf token
  getCSRFToken() {
    return document.querySelector("[name=csrfmiddlewaretoken]").value;
  }
}

// Khởi tạo khi trang load
document.addEventListener("DOMContentLoaded", function () {
  new DecryptionManager();
});