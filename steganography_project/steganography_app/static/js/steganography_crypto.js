class SteganographyCrypto {
  constructor() {
    this.delimiter = "B2203743"; // Delimiter để đánh dấu kết thúc dữ liệu
  }

  async encryptData(password, data) {
    try {
      // Sử dụng ZKECrypto để mã hóa dữ liệu (AES-256-GCM)
      if (!zkeCrypto) {
        throw new Error("Hệ thống mã hóa chưa được khởi tạo");
      }

      // Chuyển đổi dữ liệu đầu vào thành ArrayBuffer
      let dataBuffer;
      if (typeof data === "string") {
        const encoder = new TextEncoder();
        dataBuffer = encoder.encode(data).buffer;
      } else if (data instanceof ArrayBuffer) {
        dataBuffer = data;
      } else {
        throw new Error("Định dạng dữ liệu không được hỗ trợ");
      }

      // Mã hóa dữ liệu sử dụng AES-256-GCM
      const encryptedBase64 = await zkeCrypto.encryptSymmetric(
        "AES-256-GCM",
        password,
        dataBuffer
      );

      // Chuyển base64 thành Uint8Array để gửi lên server
      const encryptedBytes = this.base64ToUint8Array(encryptedBase64);
      return encryptedBytes;
    } catch (error) {
      console.error("Lỗi mã hóa:", error);
      throw new Error(`${error.message}`);
    }
  }

  async decryptData(password, encryptedData) {
    try {
      if (!zkeCrypto) {
        throw new Error("Hệ thống mã hóa chưa được khởi tạo");
      }

      // Chuyển ArrayBuffer thành base64 để giải mã
      const encryptedBase64 = this.arrayBufferToBase64(encryptedData);

      // Giải mã dữ liệu
      const decryptedData = await zkeCrypto.decryptSymmetric(
        "AES-256-GCM",
        password,
        encryptedBase64
      );
      return decryptedData;
    } catch (error) {
      console.error("Lỗi giải mã:", error);
      // Xử lý lỗi mật khẩu sai
      if (
        error.message.includes("authentication") ||
        error.message.includes("mật khẩu")
      ) {
        throw new Error("SAI_MAT_KHAU");
      }
      throw error;
    }
  }

  async prepareSecretData(password, dataType, textData, fileData) {
    try {
      let payload;

      if (dataType === "text") {
        // Xử lý text data
        payload = {
          metadata: {
            filename: "text_data.txt",
            type: "text",
            size: new TextEncoder().encode(textData).length,
            mimeType: "text/plain",
          },
          data: textData,
        };
      } else {
        // Xử lý file data
        const arrayBuffer = await this.readFileAsArrayBuffer(fileData);
        const fileBase64 = this.arrayBufferToBase64(arrayBuffer);

        payload = {
          metadata: {
            filename: fileData.name,
            type: "file",
            size: fileData.size,
            mimeType: fileData.type || "application/octet-stream",
          },
          data: fileBase64,
          dataType: "base64", // Đánh dấu đây là dữ liệu base64
        };
      }

      console.log("Payload trước khi mã hóa:", {
        metadata: payload.metadata,
        dataLength: payload.data.length,
        dataType: payload.dataType,
      });

      // Mã hóa toàn bộ payload
      const payloadStr = JSON.stringify(payload);
      const encryptedPayload = await this.encryptData(password, payloadStr);
      return encryptedPayload;
    } catch (error) {
      console.error("Lỗi trong việc chuẩn bị dữ liệu: ", error);
      throw new Error(`${error.message}`);
    }
  }

  async processExtractedData(password, encryptedData) {
    try {
      // Giải mã dữ liệu
      const decryptedData = await this.decryptData(password, encryptedData);
      // Chuyển ArrayBuffer thành string
      const decoder = new TextDecoder();
      const payloadStr = decoder.decode(decryptedData);

      // Parse JSON để lấy payload
      const payload = JSON.parse(payloadStr);

      // console.log("Dữ liệu đã phân tích:", {
      //   metadata: payload.metadata,
      //   dataLength: payload.data ? payload.data.length : 0,
      //   dataType: payload.dataType,
      // });

      let processedData;
      if (payload.metadata.type === "text") {
        // Dữ liệu văn bản - trả về trực tiếp
        processedData = payload.data;
      } else {
        // Dữ liệu file - chuyển từ base64 về ArrayBuffer
        if (payload.dataType === "base64" && payload.data) {
          processedData = this.base64ToUint8Array(payload.data).buffer;
        } else {
          throw new Error("Định dạng dữ liệu file không hợp lệ");
        }
      }
      return {
        metadata: payload.metadata,
        data: processedData,
      };
    } catch (error) {
      console.error("Lỗi trong quá trình trích xuất dữ liệu:", error);
      if (error.message === "SAI_MAT_KHAU") {
        throw error;
      }
      throw new Error(`Sai mật khẩu! Vui lòng kiểm tra lại.`);
    }
  }

  // Chuyển đổi base64 thành Uint8Array
  base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Chuyển đổi ArrayBuffer thành base64
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Đọc file dưới dạng ArrayBuffer
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
}

// sử dụng var thay vì let để tránh lỗi re-declaration
var stegoCrypto;

async function initializeSteganoCrypto() {
  try {
    if (!stegoCrypto) {
      stegoCrypto = new SteganographyCrypto();
      console.log("SteganographyCrypto đã được khởi tạo thành công.");
    }
    return stegoCrypto;
  } catch (error) {
    console.error("Khởi tạo SteganographyCrypto thất bại:", error);
    throw error;
  }
}

// Khởi tạo khi DOM ready
document.addEventListener("DOMContentLoaded", function () {
  initializeSteganoCrypto().catch(console.error);
});
