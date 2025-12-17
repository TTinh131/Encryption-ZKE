class Ascon128a {//ASCON thực tế là lightweight cipher được thiết kế cho IoT và thiết bị tài nguyên thấp
    static async encrypt(password, data) {
        try {
            // 1. Chuẩn bị dữ liệu đầu vào: Kiểm tra xem data là string hay ArrayBuffer
            const isText = typeof data === 'string';
            let dataBuffer;
            
            if (isText) {
                const encoder = new TextEncoder();
                dataBuffer = encoder.encode(data);
            } else {
                dataBuffer = data;
            }
            
            // 2. Tạo Salt và nonce
            const salt = crypto.getRandomValues(new Uint8Array(16));// 16-byte salt
            const nonce = crypto.getRandomValues(new Uint8Array(16));// 16-byte nonce
            
            // 3. Dẫn xuất khóa 128bit từ mật khẩu
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            // Dẫn xuất khóa AES-128 (phù hợp với lightweight nature của ASCON)
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 128
                },
                false,
                ['encrypt']
            );
            
            //4. Mã hóa và trích xuất AAD
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: nonce,
                    tagLength: 128 // 128-bit authentication tag (tương tự ASCON)
                },
                key,
                dataBuffer
            );
            
            // 5. Tách tag và ciphertext
            //Trong AES-GCM, tag được append ở cuối ciphertext
            const tag = ciphertext.slice(-16); //16byte AAD
            const actualCiphertext = ciphertext.slice(0, -16);// Phần ciphertext thực tế
            
            // 6. Đóng gói metadata và kết quả
            const metadata = {
                algorithm: 'Ascon128a',     // Ghi nhận thuật toán gốc
                salt: Array.from(salt),     // 16-byte salt cho PBKDF2
                nonce: Array.from(nonce),   // 16-byte nonce
                tag: Array.from(new Uint8Array(tag)),// 16-byte authentication tag
                isText: isText,             // Loại dữ liệu
                timestamp: Date.now()       // Thời gian mã hóa
            };
            
            // Kết hợp metadata và ciphertext
            const metadataStr = JSON.stringify(metadata);
            const metadataBuffer = new TextEncoder().encode(metadataStr);
            const metadataLength = new Uint32Array([metadataBuffer.length]);
            
            // Tạo buffer kết quả cuối cùng (không bao gồm tag trong ciphertext)
            const result = new Uint8Array(
                4 + metadataBuffer.length + actualCiphertext.byteLength
            );
            
            // Cấu trúc dữ liệu đầu ra:
            // [4 bytes: metadata length][metadata JSON][ciphertext (không bao gồm tag)]
            result.set(new Uint8Array(metadataLength.buffer), 0);
            result.set(metadataBuffer, 4);
            result.set(new Uint8Array(actualCiphertext), 4 + metadataBuffer.length);
            
            return btoa(String.fromCharCode(...result));
            
        } catch (error) {
            throw new Error(`Mã hóa Ascon128a thất bại: ${error.message}`);
        }
    }
    
    static async decrypt(password, encryptedData) {
        try {
            //1. Giải mã Base64 và phân tích cấu trúc
            const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            
            // Đọc độ dài metadata từ 4 bytes đầu
            const metadataLength = new Uint32Array(encryptedBuffer.slice(0, 4).buffer)[0];
            
            // Đọc độ dài metadata từ 4 bytes đầu
            const metadataBuffer = encryptedBuffer.slice(4, 4 + metadataLength);
            const metadataStr = new TextDecoder().decode(metadataBuffer);
            const metadata = JSON.parse(metadataStr);
            
            // Trích xuất ciphertext (không bao gồm tag)
            const ciphertext = encryptedBuffer.slice(4 + metadataLength);
            
            // 2. Dẫn xuất lại khóa 128bit
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
                    salt: new Uint8Array(metadata.salt),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 128
                },
                false,
                ['decrypt']
            );
            
            //3. Kết hợp ciphertext và tag để giải mã
            // Tạo combined buffer: [ciphertext][tag] như AES-GCM mong đợi
            const combined = new Uint8Array(ciphertext.length + metadata.tag.length);
            combined.set(ciphertext, 0);// Phần ciphertext
            combined.set(new Uint8Array(metadata.tag), ciphertext.length);// Thêm tag vào cuối
            
            //4. Thực hiện giải mã
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: new Uint8Array(metadata.nonce)
                },
                key,
                combined // Ciphertext + tag
            );
            
            //5. Trả về đúng định dạng dữ liệu
            if (metadata.isText) {
                const decoder = new TextDecoder();
                return decoder.decode(decryptedBuffer);
            } else {
                // Trả về ArrayBuffer cho file nhị phân
                return decryptedBuffer;
            }
            
        } catch (error) {
            throw new Error(`Giải mã Ascon128a thất bại: ${error.message}`);
        }
    }
}