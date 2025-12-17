class XChaCha20 {//mô phổng
    static async encrypt(password, data) {
        try {
            // 1. Chuẩn bị đầu vào: Kiểm tra xem data là string hay ArrayBuffer
            const isText = typeof data === 'string';
            let dataBuffer;
            
            if (isText) {
                const encoder = new TextEncoder();
                dataBuffer = encoder.encode(data);
            } else {
                dataBuffer = data;
            }
            
            //2. Tạo Salt và trích dẫn khóa
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            // Import mật khẩu thành key material cho PBKDF2
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            // Dẫn xuất khóa AES-256 từ mật khẩu
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',// 256-bit key tương đương với XChaCha20 key size
                    length: 256
                },
                false,
                ['encrypt']
            );
            
            //3. Tạo nonce và mã hóa
            // Tạo nonce 24-byte (đặc trưng của XChaCha20)
            const nonce = crypto.getRandomValues(new Uint8Array(24));
            
            // Mô phỏng XChaCha20 bằng AES-GCM
            // Sử dụng 12 bytes đầu của nonce làm IV cho AES-GCM
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: nonce.slice(0, 12) // Lấy 12 bytes đầu làm IV
                },
                key,
                dataBuffer
            );
            
            //4. Đóng gói metadata và kết quả
            const metadata = {
                algorithm: 'XChaCha20-Poly1305',// Ghi nhận thuật toán gốc
                salt: Array.from(salt),         // Salt cho PBKDF2
                nonce: Array.from(nonce),       // Nonce 24-byte đầy đủ
                isText: isText,                 // Loại dữ liệu
                timestamp: Date.now()           // Thời gian mã hóa
            };
            
            // Kết hợp metadata và ciphertext
            const metadataStr = JSON.stringify(metadata);
            const metadataBuffer = new TextEncoder().encode(metadataStr);
            const metadataLength = new Uint32Array([metadataBuffer.length]);
            
            // Tạo buffer kết quả cuối cùng
            const result = new Uint8Array(
                4 + metadataBuffer.length + ciphertext.byteLength
            );
            
            // Cấu trúc dữ liệu đầu ra: [4 bytes: metadata length][metadata JSON][ciphertext]
            result.set(new Uint8Array(metadataLength.buffer), 0);
            result.set(metadataBuffer, 4);
            result.set(new Uint8Array(ciphertext), 4 + metadataBuffer.length);
            
            return btoa(String.fromCharCode(...result));
            
        } catch (error) {
            throw new Error(`Mã hóa XChaCha20-Poly1305 thất bại: ${error.message}`);
        }
    }

    static async decrypt(password, encryptedData) {
        try {
            //1. Giải mã Base64 và phân tích cấu trúc
            const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            
            // Đọc độ dài metadata từ 4 bytes đầu
            const metadataLength = new Uint32Array(encryptedBuffer.slice(0, 4).buffer)[0];
            
            // Trích xuất metadata
            const metadataBuffer = encryptedBuffer.slice(4, 4 + metadataLength);
            const metadataStr = new TextDecoder().decode(metadataBuffer);
            const metadata = JSON.parse(metadataStr);
            
            // Trích xuất ciphertext
            const ciphertext = encryptedBuffer.slice(4 + metadataLength);
            
            // 2. Dẫn xuất lại khóa từ mật khẩu
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: new Uint8Array(metadata.salt), // Dùng lại salt
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['decrypt']
            );
            
            // 3. Giải mã dữ liệu
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: new Uint8Array(metadata.nonce.slice(0, 12)) // Lấy 12 bytes đầu làm IV
                },
                key,
                ciphertext
            );
            
            //4. Trả về đúng định dạng dữ liệu
            if (metadata.isText) {
                return new TextDecoder().decode(decryptedBuffer);
            } else {
                // Trả về ArrayBuffer cho file nhị phân
                return decryptedBuffer;
            }
            
        } catch (error) {
            throw new Error(`Giải mã XChaCha20-Poly1305 thất bại: ${error.message}`);
        }
    }
}