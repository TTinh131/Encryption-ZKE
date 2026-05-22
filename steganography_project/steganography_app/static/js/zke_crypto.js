class ZKECrypto {
  constructor() {
    // Registry của các thuật toán được hỗ trợ
    this.algorithms = {
      "AES-256-GCM": { type: "symmetric", class: AES256GCM },
      "XChaCha20-Poly1305": { type: "symmetric", class: XChaCha20 },
      Ascon128a: { type: "symmetric", class: Ascon128a },
      X25519: { type: "asymmetric", class: X25519 },
      Kyber1024: { type: "asymmetric", class: Kyber1024 },
    };
    this.initialized = false;
  }

  async init() {
    try {
      // Kiểm tra Web Crypto API availability
      if (!window.crypto?.subtle) {
        throw new Error(
          "Trình duyệt không hỗ trợ Web Crypto API. Vui lòng sử dụng trình duyệt hiện đại."
        );
      }

      this.initialized = true;
      console.log("ZKECrypto đã được khởi tạo thành công với Web Crypto API");
    } catch (error) {
      console.error("Khởi tạo ZKECrypto không thành công:", error);
      throw error;
    }
  }

  // Đảm bảo hệ thống đã được khởi tạo trước khi sử dụng
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // Mã hóa đối xứng
  async encryptSymmetric(algorithm, password, plaintext) {
    await this.ensureInitialized();

    const algoConfig = this.algorithms[algorithm];
    if (!algoConfig || algoConfig.type !== "symmetric") {
      throw new Error(
        `Thuật toán ${algorithm} không được hỗ trợ hoặc không phải đối xứng`
      );
    }

    this.validatePassword(password);
    return await algoConfig.class.encrypt(password, plaintext);
  }

  // Giải mã đối xứng
  async decryptSymmetric(algorithm, password, encryptedData) {
    await this.ensureInitialized();

    const algoConfig = this.algorithms[algorithm];
    if (!algoConfig || algoConfig.type !== "symmetric") {
      throw new Error(
        `Thuật toán ${algorithm} không được hỗ trợ hoặc không phải đối xứng`
      );
    }

    this.validatePassword(password);
    return await algoConfig.class.decrypt(password, encryptedData);
  }

  // Mã hóa bất đối xứng
  async encryptAsymmetric(algorithm, publicKey, plaintext) {
    await this.ensureInitialized();

    const algoConfig = this.algorithms[algorithm];
    if (!algoConfig || algoConfig.type !== "asymmetric") {
      throw new Error(
        `Thuật toán ${algorithm} không được hỗ trợ hoặc không phải bất đối xứng`
      );
    }

    // Validate public key
    if (!publicKey || typeof publicKey !== "string") {
      throw new Error("Khóa công khai không hợp lệ");
    }

    // Kiểm tra định dạng public key (ít nhất phải là base64)
    try {
      // Kiểm tra xem có phải base64 hợp lệ không
      if (!this.isValidBase64(publicKey)) {
        throw new Error("Khóa công khai không phải định dạng base64 hợp lệ");
      }
    } catch (error) {
      throw new Error(`Khóa công khai không hợp lệ: ${error.message}`);
    }

    try {
      return await algoConfig.class.encrypt(publicKey, plaintext);
    } catch (error) {
      console.error(`Lỗi mã hóa ${algorithm}:`, error);
      throw new Error(`Mã hóa ${algorithm} thất bại: ${error.message}`);
    }
  }

  // Giải mã bất đối xứng với xử lý lỗi tốt hơn
  async decryptAsymmetric(algorithm, privateKey, encryptedData) {
    await this.ensureInitialized();

    const algoConfig = this.algorithms[algorithm];
    if (!algoConfig || algoConfig.type !== "asymmetric") {
      throw new Error(
        `Thuật toán ${algorithm} không được hỗ trợ hoặc không phải bất đối xứng`
      );
    }

    // xác thực private key
    if (!privateKey || typeof privateKey !== "string") {
      throw new Error("Khóa bí mật không hợp lệ");
    }

    // xác thực encrypted data
    if (!encryptedData) {
      throw new Error("Dữ liệu mã hóa không hợp lệ");
    }

    try {
      // Kiểm tra định dạng private key
      if (!this.isValidBase64(privateKey)) {
        throw new Error("Khóa bí mật không phải định dạng base64 hợp lệ");
      }

      return await algoConfig.class.decrypt(privateKey, encryptedData);
    } catch (error) {
      console.error(`Lỗi giải mã ${algorithm}:`, error);

      // Cung cấp thông báo lỗi cụ thể hơn
      if (error.message.includes("atob") || error.message.includes("base64")) {
        throw new Error(
          "Dữ liệu mã hóa hoặc khóa không phải định dạng base64 hợp lệ"
        );
      } else if (error.message.includes("JSON")) {
        throw new Error("Dữ liệu mã hóa không đúng định dạng JSON");
      } else {
        throw new Error(`Giải mã ${algorithm} thất bại: ${error.message}`);
      }
    }
  }

  // Kiểm tra base64 hợp lệ
  isValidBase64(str) {
    try {
      // Loại bỏ các ký tự không phải base64
      const cleaned = str.replace(/[^A-Za-z0-9+/=]/g, "");
      if (cleaned.length === 0) return false;

      // Kiểm tra độ dài phải chia hết cho 4
      if (cleaned.length % 4 !== 0) return false;

      // Thử giải mã
      const decoded = atob(cleaned);
      // Thử mã hóa lại để kiểm tra
      const reencoded = btoa(decoded);
      return reencoded === cleaned;
    } catch (e) {
      return false;
    }
  }

  // Giải mã bất đối xứng
  async decryptAsymmetric(algorithm, privateKey, encryptedData) {
    await this.ensureInitialized();

    const algoConfig = this.algorithms[algorithm];
    if (!algoConfig || algoConfig.type !== "asymmetric") {
      throw new Error(
        `Thuật toán ${algorithm} không được hỗ trợ hoặc không phải bất đối xứng`
      );
    }

    return await algoConfig.class.decrypt(privateKey, encryptedData);
  }

  // Tạo cặp khóa
  async generateKeyPair(algorithm, keyName = "") {
    await this.ensureInitialized();

    const algoConfig = this.algorithms[algorithm];
    if (!algoConfig || algoConfig.type !== "asymmetric") {
      throw new Error(
        `Thuật toán ${algorithm} không được hỗ trợ hoặc không phải bất đối xứng`
      );
    }

    const keyPair = await algoConfig.class.generateKeyPair();

    // Tự động lưu khóa nếu user đã đăng nhập
    if (this.isUserLoggedIn()) {
      this.saveKeyPair(algorithm, keyPair, keyName);
    }

    return keyPair;
  }
  //Lấy key pairs theo thuật toán
  getStoredKeyPairsByAlgorithm(algorithm) {
    return this.getStoredKeyPairs().filter(
      (key) => key.algorithm === algorithm
    );
  }

  //Lấy key pairs theo ngày
  getStoredKeyPairsByDate(date) {
    return this.getStoredKeyPairs().filter((key) => {
      const keyDate = key.created.split("T")[0];
      return keyDate === date;
    });
  }

  //Lấy key pairs theo tên
  getStoredKeyPairsByName(keyName) {
    return this.getStoredKeyPairs().filter((key) =>
      (key.keyName?.toLowerCase() ?? "").includes(keyName.toLowerCase())
    );
  }

  // Kiểm tra mật khẩu
  validatePassword(password) {
    if (!password || password.length < 1) {
      throw new Error("Mật khẩu không được để trống");
    }
    if (password.length < 8) {
      throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
    }
    return true;
  }

  // Kiểm tra thuật toán đối xứng
  isSymmetricAlgorithm(algorithm) {
    return this.algorithms[algorithm]?.type === "symmetric";
  }

  // Kiểm tra thuật toán bất đối xứng
  isAsymmetricAlgorithm(algorithm) {
    return this.algorithms[algorithm]?.type === "asymmetric";
  }
  async encryptUnified(algorithm, key, plaintext, isSymmetric = true) {
    await this.ensureInitialized();

    if (isSymmetric) {
      return await this.encryptSymmetric(algorithm, key, plaintext);
    } else {
      // Mã hóa bất đối xứng nhưng trả về base64 đơn giản
      const encryptedResult = await this.encryptAsymmetric(
        algorithm,
        key,
        plaintext
      );

      // Chuyển đổi JSON thành base64 đơn giản để hiển thị
      if (typeof encryptedResult === "string") {
        try {
          // Nếu đã là JSON, parse và trả về ciphertext
          const data = JSON.parse(encryptedResult);
          return data.ciphertext || data.encryptedData || encryptedResult;
        } catch (e) {
          // Nếu không phải JSON, trả về trực tiếp
          return encryptedResult;
        }
      }
      return encryptedResult;
    }
  }

  // Phương thức giải mã thống nhất
  async decryptUnified(algorithm, key, encryptedData, isSymmetric = true) {
    await this.ensureInitialized();

    if (isSymmetric) {
      return await this.decryptSymmetric(algorithm, key, encryptedData);
    } else {
      return await this.decryptAsymmetric(algorithm, key, encryptedData);
    }
  }
  static detectDataFormat(data) {
    if (typeof data !== "string") return "binary";

    try {
      JSON.parse(data);
      return "json";
    } catch (e) {
      // Không phải JSON
    }

    // Kiểm tra base64
    try {
      const cleaned = data.replace(/[^A-Za-z0-9+/=]/g, "");
      if (cleaned.length > 0 && cleaned.length % 4 === 0) {
        atob(cleaned);
        return "base64";
      }
    } catch (e) {
      // Không phải base64
    }

    return "text";
  }

  // giải mã bất đối xứng
  async decryptAsymmetric(algorithm, privateKey, encryptedData) {
    await this.ensureInitialized();

    const algoConfig = this.algorithms[algorithm];
    if (!algoConfig || algoConfig.type !== "asymmetric") {
      throw new Error(
        `Thuật toán ${algorithm} không được hỗ trợ hoặc không phải bất đối xứng`
      );
    }

    // Validate private key
    if (!privateKey || typeof privateKey !== "string") {
      throw new Error("Khóa bí mật không hợp lệ");
    }

    // Xác định định dạng dữ liệu
    const dataFormat = ZKECrypto.detectDataFormat(encryptedData);
    console.log(`Định dạng dữ liệu: ${dataFormat}`);

    let processedData = encryptedData;

    // Xử lý dựa trên định dạng
    if (dataFormat === "base64") {
      try {
        // Giải mã base64 để lấy JSON
        const decoded = atob(encryptedData.replace(/[^A-Za-z0-9+/=]/g, ""));
        processedData = decoded;
      } catch (e) {
        throw new Error("Không thể giải mã base64 thành JSON");
      }
    } else if (dataFormat === "binary") {
      // Chuyển binary sang text
      const decoder = new TextDecoder();
      processedData = decoder.decode(encryptedData);
    }

    try {
      return await algoConfig.class.decrypt(privateKey, processedData);
    } catch (error) {
      console.error(`Lỗi giải mã ${algorithm}:`, error);

      if (error.message.includes("atob") || error.message.includes("base64")) {
        throw new Error(
          "Định dạng dữ liệu không hợp lệ cho giải mã bất đối xứng"
        );
      } else if (error.message.includes("JSON")) {
        throw new Error("Dữ liệu mã hóa không đúng định dạng JSON");
      } else {
        throw new Error(`Giải mã ${algorithm} thất bại: ${error.message}`);
      }
    }
  }
  // lấy ciphertext đơn giản từ kết quả mã hóa bất đối xứng
  static extractSimpleCiphertext(encryptedResult) {
    if (typeof encryptedResult === "string") {
      try {
        const data = JSON.parse(encryptedResult);
        // Trả về ciphertext nếu có, không thì trả về toàn bộ dữ liệu
        return data.ciphertext || data.encryptedData || encryptedResult;
      } catch (e) {
        // Nếu không parse được JSON, trả về nguyên bản
        return encryptedResult;
      }
    }
    return encryptedResult;
  }

  // tạo dữ liệu đầy đủ từ ciphertext đơn giản (dùng khi tải về)
  static createFullEncryptedData(
    algorithm,
    simpleCiphertext,
    originalData = {}
  ) {
    const fullData = {
      algorithm: algorithm,
      ciphertext: simpleCiphertext,
      timestamp: new Date().toISOString(),
      version: "1.0",
      ...originalData,
    };
    return JSON.stringify(fullData, null, 2);
  }
  // Lưu trữ khóa
  saveKeyPair(algorithm, keyPair, keyName = "") {
    if (!this.isUserLoggedIn()) {
      console.warn("User chưa đăng nhập, không lưu khóa");
      return;
    }

    // Kiểm tra cài đặt lưu khóa từ server
    if (!this.shouldSaveKeys()) {
      console.warn("User đã tắt tính năng lưu khóa");
      return;
    }

    // Tạo tên key chi tiết với timestamp
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
    const timestamp = now.getTime(); // Unix timestamp

    let key;
    if (keyName) {
      // Nếu có tên custom
      key = `zke_keypair_${algorithm}_${keyName}_${dateStr}_${timeStr}`;
    } else {
      // Tên mặc định
      key = `zke_keypair_${algorithm}_${dateStr}_${timeStr}_${timestamp}`;
    }

    const storageData = {
      algorithm: algorithm,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      created: now.toISOString(),
      keyName: keyName || "Tự động tạo",
      description: `Cập khóa cho ${algorithm} được tọa vào ${dateStr}`,
    };

    localStorage.setItem(key, JSON.stringify(storageData));
    console.log(`Đã lưu key pair: ${key}`);
  }

  // Kiểm tra cài đặt lưu khóa từ server
  async shouldSaveKeys() {
    try {
      // Gọi API để kiểm tra cài đặt user
      const response = await fetch("/api/user/settings/");
      if (response.ok) {
        const settings = await response.json();
        return settings.save_keys !== false;
      }
    } catch (error) {
      console.error("Lỗi khi lấy cài đặt user:", error);
    }
    return true; // Mặc định cho phép lưu
  }

  // Lấy danh sách khóa đã lưu
  getStoredKeyPairs() {
    if (!this.isUserLoggedIn()) {
      return [];
    }

    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey.startsWith("zke_keypair_")) {
        try {
          const keyData = JSON.parse(localStorage.getItem(storageKey));

          // Parse thông tin từ key name
          const keyInfo = this.parseKeyName(storageKey);

          keys.push({
            id: storageKey,
            storageKey: storageKey, // Giữ nguyên key gốc trong localStorage
            ...keyData,
            ...keyInfo,
          });
        } catch (e) {
          console.warn("Lỗi parse key data:", e);
        }
      }
    }

    // Sắp xếp theo thời gian tạo (mới nhất đầu tiên)
    return keys.sort((a, b) => new Date(b.created) - new Date(a.created));
  }

  parseKeyName(keyName) {
    const parts = keyName.replace("zke_keypair_", "").split("_");

    let algorithm = parts[0];
    let customName = "";
    let date = "";
    let time = "";
    let timestamp = "";

    if (parts.length >= 4) {
      // Format: algorithm_customName_date_time
      customName = parts[1];
      date = parts[2];
      time = parts[3];

      // Nếu có phần thứ 5, đó là timestamp
      if (parts.length >= 5) {
        timestamp = parts[4];
      }
    } else if (parts.length >= 3) {
      // Format: algorithm_date_time_timestamp
      date = parts[1];
      time = parts[2];
      if (parts.length >= 4) {
        timestamp = parts[3];
      }
    }

    // Tạo display name đẹp hơn
    let displayName = customName || `${algorithm} Key`;
    if (date) {
      displayName += ` (${date})`;
    }

    return {
      algorithm: algorithm,
      customName: customName,
      date: date,
      time: time,
      timestamp: timestamp,
      displayName: displayName,
    };
  }

  // Kiểm tra user đã đăng nhập
  isUserLoggedIn() {
    return (
      typeof window.userAuthenticated !== "undefined" &&
      window.userAuthenticated === true
    );
  }
}

// Lớp tiện ích cho các thao tác crypto và file
class CryptoUtils {
  //Chuyển định dạng file
  static arrayToBase64(array) {
    return btoa(String.fromCharCode(...array));
  }

  static base64ToArray(base64) {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  static downloadFile(content, filename, contentType = "text/plain") {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  //Các thao tác tệp
  static downloadArrayBuffer(
    arrayBuffer,
    filename,
    mimeType = "application/octet-stream"
  ) {
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  static readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Hàm lấy phần mở rộng file
  static getFileExtension(filename) {
    return filename.slice(
      (Math.max(0, filename.lastIndexOf(".")) || Infinity) + 1
    );
  }

  // Hàm lấy MIME type từ filename
  static getMimeType(filename) {
    const ext = this.getFileExtension(filename).toLowerCase();
    const mimeTypes = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      svg: "image/svg+xml",
      ico: "image/x-icon",

      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar",
      gz: "application/gzip",

      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      flac: "audio/flac",

      mp4: "video/mp4",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      mov: "video/quicktime",
      wmv: "video/x-ms-wmv",

      txt: "text/plain",
      html: "text/html",
      css: "text/css",

      js: "application/javascript",
      json: "application/json",
      xml: "application/xml",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  // Hàm chuyển ArrayBuffer sang Base64
  static arrayBufferToBase64(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    uint8Array.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  // Hàm chuyển Base64 sang ArrayBuffer
  static base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array.buffer;
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Hàm kiểm tra kích thước file (tăng lên 500MB)
  static validateFileSize(file, maxSize = 500 * 1024 * 1024) {
    if (file.size > maxSize) {
      throw new Error(
        `File quá lớn. Kích thước tối đa là ${this.formatFileSize(maxSize)}`
      );
    }
    return true;
  }
}

let zkeCrypto;

async function initializeCrypto() {
  try {
    zkeCrypto = new ZKECrypto();
    await zkeCrypto.init();
    console.log("ZKECrypto đã được khởi tạo thành công");
    return zkeCrypto;
  } catch (error) {
    console.error("Không thể khởi tạo ZKECrypto: ", error);

    // Hiển thị thông báo lỗi chi tiết hơn
    const errorMessage = error.message.includes("Web Crypto API")
      ? "Trình duyệt của bạn không hỗ trợ tính năng mã hóa. Vui lòng sử dụng Chrome, Firefox, Safari hoặc Edge phiên bản mới nhất."
      : `Lỗi khởi tạo hệ thống mã hóa: ${error.message}`;

    throw new Error(errorMessage);
  }
}

// Khởi tạo khi DOM ready
document.addEventListener("DOMContentLoaded", function () {
  initializeCrypto().catch((error) => {
    console.error("Crypto initialization failed:", error);
    // Hiển thị thông báo lỗi cho user
    const errorDiv = document.createElement("div");
    errorDiv.className = "alert alert-danger alert-dismissible fade show";
    errorDiv.innerHTML = `
            <strong>Lỗi khởi tạo hệ thống mã hóa!</strong> ${error.message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    const container = document.querySelector(".container-fluid");
    if (container) {
      container.insertBefore(errorDiv, container.firstChild);
    }
  });
});
