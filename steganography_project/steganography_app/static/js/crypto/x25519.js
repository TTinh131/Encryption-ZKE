class X25519 {// Sử dụng ECDH với P-256
    //Tạo cặp khóa
    static async generateKeyPair() {
        try {
            // Tạo cặp khóa ECDH với curve P-256 (tương đương bảo mật với X25519)
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'// Sử dụng P-256 thay vì curve25519
                },
                true,// Có thể export key
                ['deriveKey']// Cho phép dẫn xuất khóa
            );
            
            //khóa công khai dạng raw
            const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
            //khóa bí mật dạng PKCS8
            const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
            
            return {
                publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
                privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKey)))
            };
            
        } catch (error) {
            throw new Error(`Tạo khóa X25519 thất bại: ${error.message}`);
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

            //2. Chọn phương thức mã hóa
            // Dữ liệu lớn hơn 100MB sử dụng hybrid encryption
            if (plaintextBuffer.byteLength > 100 * 1024 * 1024) {
                return await this.encryptHybrid(publicKeyBase64, plaintextBuffer, isText);
            }

            //3. Phương pháp Direct (dữ liệu nhỏ)
            // Tạo ephemeral key pair (khóa tạm thời cho phiên này)
            const ephemeralKeyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                true,
                ['deriveKey']
            );
            
            // Import khóa công khai của người nhận
            const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
            const recipientPublicKey = await crypto.subtle.importKey(
                'raw',
                publicKeyBuffer,
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                true,// Khóa chỉ đọc
                []// Không cần operations cho public key
            );
            
            // 4. Dẫn xuất shared secret
            const sharedSecret = await crypto.subtle.deriveKey(
                {
                    name: 'ECDH',
                    public: recipientPublicKey  // Khóa công khai người nhận
                },
                ephemeralKeyPair.privateKey, // Khóa bí mật ephemeral
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false, // Không cho phép export shared secret
                ['encrypt'] // Chỉ cho phép mã hóa
            );
            
            //5. Mã hóa dữ liệu
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                sharedSecret,
                plaintextBuffer
            );
            
            // 6. Đóng gói kết quả
            const ephemeralPublicKey = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
            
            const result = {
                ephemeralPublicKey: btoa(String.fromCharCode(...new Uint8Array(ephemeralPublicKey))),
                iv: btoa(String.fromCharCode(...iv)),
                ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
                isText: isText,
                method: 'direct'// Đánh dấu phương pháp trực tiếp
            };
            
            return JSON.stringify(result);
            
        } catch (error) {
            throw new Error(`Mã hóa X25519 thất bại: ${error.message}`);
        }
    }

    // Phương pháp hybrid - cho dữ liệu lớn
    static async encryptHybrid(publicKeyBase64, plaintextBuffer, isText) {
        try {
            //1. Thiết lập ECDH và shared secret
            const ephemeralKeyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                true,
                ['deriveKey']
            );
            
            const publicKeyBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
            const recipientPublicKey = await crypto.subtle.importKey(
                'raw',
                publicKeyBuffer,
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                true,
                []
            );
            
            const sharedSecret = await crypto.subtle.deriveKey(
                {
                    name: 'ECDH',
                    public: recipientPublicKey
                },
                ephemeralKeyPair.privateKey,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['encrypt']
            );
            
            // 2. Tạo và mã hóa data key 
            // Tạo khóa đối xứng ngẫu nhiên cho dữ liệu
            const dataKey = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,// Có thể export
                ['encrypt', 'decrypt']
            );
            
            // Mã hóa data key bằng shared secret
            const exportedDataKey = await crypto.subtle.exportKey('raw', dataKey);
            const iv1 = crypto.getRandomValues(new Uint8Array(12));
            const encryptedDataKey = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv1
                },
                sharedSecret,
                exportedDataKey
            );
            
            // 3. Mã hóa dữ liệu với data key
            const iv2 = crypto.getRandomValues(new Uint8Array(12));
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv2
                },
                dataKey,
                plaintextBuffer
            );
            
            // 4. Đóng gói kết quả
            const ephemeralPublicKey = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
            
            const result = {
                ephemeralPublicKey: btoa(String.fromCharCode(...new Uint8Array(ephemeralPublicKey))),
                encryptedDataKey: btoa(String.fromCharCode(...new Uint8Array(encryptedDataKey))),
                iv1: btoa(String.fromCharCode(...iv1)),// IV cho data key encrypt
                iv2: btoa(String.fromCharCode(...iv2)), // IV cho data encrypt
                ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
                isText: isText,
                method: 'hybrid' // Đánh dấu phương pháp hybrid
            };
            
            return JSON.stringify(result);
            
        } catch (error) {
            throw new Error(`Mã hóa lai X25519 thất bại: ${error.message}`);
        }
    }

    static async decrypt(privateKeyBase64, encryptedData) {
    try {
      console.log("Bắt đầu giải mã X25519...");
      
      // 1. xác thực và parse dữ liệu đầu vào
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
      if (!data.ephemeralPublicKey) {
        throw new Error("Thiếu ephemeralPublicKey trong dữ liệu mã hóa");
      }
      if (!data.iv && !(data.iv1 && data.iv2)) {
        throw new Error("Thiếu IV trong dữ liệu mã hóa");
      }
      if (!data.ciphertext) {
        throw new Error("Thiếu ciphertext trong dữ liệu mã hóa");
      }

      // 3. xác thực base64 các trường
      const requiredFields = ['ephemeralPublicKey', 'ciphertext'];
      if (data.method === 'hybrid') {
        requiredFields.push('encryptedDataKey', 'iv1', 'iv2');
      } else {
        requiredFields.push('iv');
      }

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

      // 4. Import private key với xác thực
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
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false,
        ['deriveKey']
      );

      // 5.Nhập khóa công khai nhất thời
      let ephemeralPublicKeyBuffer;
      try {
        ephemeralPublicKeyBuffer = Uint8Array.from(atob(data.ephemeralPublicKey), c => c.charCodeAt(0));
      } catch (e) {
        throw new Error("Ephemeral public key không phải base64 hợp lệ");
      }

      const senderPublicKey = await crypto.subtle.importKey(
        'raw',
        ephemeralPublicKeyBuffer,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        []
      );

      // 6. Dẫn xuất shared secret
      const sharedSecret = await crypto.subtle.deriveKey(
        {
          name: 'ECDH',
          public: senderPublicKey
        },
        privateKey,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['decrypt']
      );
      let plaintextBuffer;
      // 7. Giải mã theo phương pháp
      if (data.method === 'hybrid') {
        console.log("Sử dụng phương pháp hybrid");
        const encryptedDataKey = Uint8Array.from(atob(data.encryptedDataKey), c => c.charCodeAt(0));
        const iv1 = Uint8Array.from(atob(data.iv1), c => c.charCodeAt(0));
        const iv2 = Uint8Array.from(atob(data.iv2), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

        // Giải mã data key
        const dataKeyBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv1
          },
          sharedSecret,
          encryptedDataKey
        );

        // Import data key
        const dataKey = await crypto.subtle.importKey(
          'raw',
          dataKeyBuffer,
          {
            name: 'AES-GCM',
            length: 256
          },
          false,
          ['decrypt']
        );

        // Giải mã dữ liệu
        plaintextBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv2
          },
          dataKey,
          ciphertext
        );
      } else {
        console.log("Sử dụng phương pháp direct");
        
        const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

        plaintextBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          sharedSecret,
          ciphertext
        );
      }

      console.log("Giải mã thành công");

      // 8. Trả về kết quả
      if (data.isText) {
        const decoder = new TextDecoder();
        return decoder.decode(plaintextBuffer);
      } else {
        return plaintextBuffer;
      }

    } catch (error) {
      console.error("Chi tiết lỗi giải mã X25519:", {
        error: error.message,
        encryptedDataLength: encryptedData?.length,
        privateKeyLength: privateKeyBase64?.length
      });
      
      if (error.message.includes("atob") || error.message.includes("base64")) {
        throw new Error("Dữ liệu mã hóa hoặc khóa không phải định dạng base64 hợp lệ");
      } else if (error.message.includes("JSON")) {
        throw new Error("Dữ liệu mã hóa không đúng định dạng JSON");
      } else if (error.message.includes("importKey") || error.message.includes("deriveKey")) {
        throw new Error("Khóa không hợp lệ hoặc không tương thích với thuật toán");
      } else {
        throw new Error(`Giải mã X25519 thất bại: ${error.message}`);
      }
    }
  }
}