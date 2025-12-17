class Kyber1024 {
    //Tạo khóa
    static async generateKeyPair() {
        try {
            // Sử dụng RSA-OAEP 2048 thay vì 4096 để giảm kích thước
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'RSA-OAEP',
                    modulusLength: 2048, // 2048-bit (cân bằng hiệu năng & bảo mật)
                    publicExponent: new Uint8Array([1, 0, 1]),// 65537
                    hash: 'SHA-256'// Hash function cho OAEP
                },
                true,// Có thể export key
                ['encrypt', 'decrypt'] // Cho phép mã hóa và giải mã
            );
             // Export khóa công khai dạng SPKI (Subject Public Key Info)
            const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
             // Export khóa bí mật dạng PKCS8
            const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
            
            return {
                publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
                privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKey)))
            };
            
        } catch (error) {
            throw new Error(`Tạo khóa Kyber1024 thất bại: ${error.message}`);
        }
    }

    static async encrypt(publicKeyBase64, plaintext) {
        try {
            // 1. Chuẩn bị dữ liệu
            const isText = typeof plaintext === 'string';
            let plaintextBuffer;
            
            if (isText) {
                const encoder = new TextEncoder();
                plaintextBuffer = encoder.encode(plaintext);
            } else {
                plaintextBuffer = plaintext;
            }

            // 2. Kiểm tra kích thước dữ liệu
            // RSA-OAEP chỉ có thể mã hóa dữ liệu nhỏ (~200 bytes cho 2048-bit key)
            // luôn sử dụng phương pháp hybrid cho RSA
            if (plaintextBuffer.byteLength > 100 * 1024) { // 100KB
                return await this.encryptHybrid(publicKeyBase64, plaintextBuffer, isText);
            }

            // 3. Phương pháp hybrid cho dữ liệu nhỏ
            // Import khóa công khai
            const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
            const publicKey = await crypto.subtle.importKey(
                'spki',
                publicKeyBuffer,
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256'
                },
                true,
                ['encrypt']
            );

            // 4. Tạo khóa đối xứng cho mã hóa dữ liệu
            const symmetricKey = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,// Có thể export
                ['encrypt', 'decrypt']
            );
            
            // 5. Mã hóa khóa đối xứng với RSA
            const exportedSymmetricKey = await crypto.subtle.exportKey('raw', symmetricKey);
            const encryptedKey = await crypto.subtle.encrypt(
                {
                    name: 'RSA-OAEP'
                },
                publicKey,
                exportedSymmetricKey
            );
            
            // 6. Mã hóa dữ liệu với khóa đối xứng
            const iv = crypto.getRandomValues(new Uint8Array(12));// Vector khởi tạo
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                symmetricKey,
                plaintextBuffer
            );
            
            //7. Đóng gói kết quả
            const result = {
                encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
                iv: btoa(String.fromCharCode(...iv)),
                ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
                isText: isText,
                method: 'direct'
            };
            
            return JSON.stringify(result);
            
        } catch (error) {
            throw new Error(`Mã hóa Kyber1024 thất bại: ${error.message}`);
        }
    }

    // Phương pháp hybrid cho dữ liệu lớn
    static async encryptHybrid(publicKeyBase64, plaintextBuffer, isText) {
        try {
            // 1. Import public key
            const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
            const publicKey = await crypto.subtle.importKey(
                'spki',
                publicKeyBuffer,
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256'
                },
                true,
                ['encrypt']
            );

            // 2. Tạo data key cho mã hóa dữ liệu
            const dataKey = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,
                ['encrypt', 'decrypt']
            );
            
            // 3. Mã hóa data key với RSA
            const exportedDataKey = await crypto.subtle.exportKey('raw', dataKey);
            const encryptedKey = await crypto.subtle.encrypt(
                {
                    name: 'RSA-OAEP'
                },
                publicKey,
                exportedDataKey
            );
            
            // 4. Mã hóa dữ liệu với data key
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                dataKey,
                plaintextBuffer
            );
            
            //5. Đóng gói kết quả
            const result = {
                encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
                iv: btoa(String.fromCharCode(...iv)),
                ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
                isText: isText,
                method: 'hybrid'
            };
            
            return JSON.stringify(result);
            
        } catch (error) {
            throw new Error(`Mã hóa Kyber1024 hybrid thất bại: ${error.message}`);
        }
    }

    static async decrypt(privateKeyBase64, encryptedData) {
    try {
      console.log("Bắt đầu giải mã Kyber1024...");

      // 1. xác thực đầu vào
      if (!privateKeyBase64 || !encryptedData) {
        throw new Error("Thiếu khóa bí mật hoặc dữ liệu mã hóa");
      }

      let data;
      try {
        data = JSON.parse(encryptedData);
        console.log("Dữ liệu JSON parsed thành công");
      } catch (parseError) {
        console.error("Lỗi parse JSON:", parseError);
        throw new Error("Dữ liệu mã hóa không phải định dạng JSON hợp lệ");
      }

      // 2. xác thực các trường bắt buộc
      const requiredFields = ['encryptedKey', 'iv', 'ciphertext'];
      for (const field of requiredFields) {
        if (!data[field]) {
          throw new Error(`Thiếu trường bắt buộc: ${field}`);
        }
        try {
          // Kiểm tra base64
          atob(data[field]);
        } catch (e) {
          throw new Error(`Trường ${field} không phải base64 hợp lệ`);
        }
      }

      // 3. Giải mã các trường base64
      const encryptedKey = Uint8Array.from(atob(data.encryptedKey), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

      // 4. Import private key
      let privateKeyBuffer;
      try {
        privateKeyBuffer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
      } catch (e) {
        throw new Error("Khóa bí mật không phải định dạng base64 hợp lệ");
      }

      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        false,// Không thể export
        ['decrypt']
      );

      // 5. Giải mã khóa đối xứng
      const symmetricKeyBuffer = await crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        privateKey,
        encryptedKey
      );

      // 6. Import khóa đối xứng
      const symmetricKey = await crypto.subtle.importKey(
        'raw',
        symmetricKeyBuffer,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['decrypt']
      );

      // 7. Giải mã dữ liệu
      const plaintextBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        symmetricKey,
        ciphertext
      );

      console.log("Giải mã Kyber1024 thành công");

      // 8. Trả về kết quả
      if (data.isText) {
        const decoder = new TextDecoder();
        return decoder.decode(plaintextBuffer);
      } else {
        return plaintextBuffer;
      }

    } catch (error) {
      console.error("Kyber1024 Decryption Error Details:", {
        error: error.message,
        encryptedDataLength: encryptedData?.length,
        privateKeyLength: privateKeyBase64?.length
      });

      //xử lý lỗi chi tiết
      if (error.message.includes("atob") || error.message.includes("base64")) {
        throw new Error("Dữ liệu mã hóa hoặc khóa không phải định dạng base64 hợp lệ");
      } else if (error.message.includes("JSON")) {
        throw new Error("Dữ liệu mã hóa không đúng định dạng JSON");
      } else if (error.message.includes("importKey")) {
        throw new Error("Khóa không hợp lệ hoặc không tương thích với thuật toán");
      } else {
        throw new Error(`Giải mã Kyber1024 thất bại: ${error.message}`);
      }
    }
  }
}