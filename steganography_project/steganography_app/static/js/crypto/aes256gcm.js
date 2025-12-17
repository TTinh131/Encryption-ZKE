// Lớp mã hóa đối xứng AES-256-GCM
// Sử dụng PBKDF2 để dẫn xuất khóa từ mật khẩu
// Định dạng output: [4-byte metadata length][metadata JSON][ciphertext]

class AES256GCM {
    static async encrypt(password, data) {
        try {
            // 1. CHuẩn bị dữ liệu: Kiểm tra xem data là string hay ArrayBuffer
            const isText = typeof data === 'string';
            let dataBuffer;
            
            if (isText) {
                const encoder = new TextEncoder();
                dataBuffer = encoder.encode(data);
            } else {
                dataBuffer = data;
            }
            
            //2. Tạo Salt và dẫn xuất khóa
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            // Import mật khẩu thành key material
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            // Dẫn xuất khóa AES-256 từ mật khẩu sử dụng PBKDF2
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,// Số vòng lặp để chống brute-force
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256 // 256-bit key
                },
                false, // Không cho phép export key
                ['encrypt'] // Chỉ cho phép mã hóa
            );
            
            //3. Mã hóa dữ liệu
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV cho GCM
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                dataBuffer
            );
            
            //4. Đóng gói metadata và kết quả
            const metadata = {
                algorithm: 'AES-256-GCM',   
                salt: Array.from(salt),     // Chuyển Uint8Array thành mảng thường
                iv: Array.from(iv),         // Chuyển Uint8Array thành mảng thường
                isText: isText,             // Đánh dấu loại dữ liệu
                timestamp: Date.now()       // Thời gian mã hóa
            };
            
            // Kết hợp metadata và ciphertext
            const metadataStr = JSON.stringify(metadata);
            const metadataBuffer = new TextEncoder().encode(metadataStr);
            // Tạo buffer chứa độ dài metadata (4 bytes)
            const metadataLength = new Uint32Array([metadataBuffer.length]);
            
            // Tạo buffer kết quả cuối cùng
            const result = new Uint8Array(
                4 + metadataBuffer.length + ciphertext.byteLength
            );
            
            // Ghép các phần lại với nhau:
            // [4 bytes độ dài metadata][metadata JSON][ciphertext]
            result.set(new Uint8Array(metadataLength.buffer), 0);   // Bytes 0-3: độ dài metadata
            result.set(metadataBuffer, 4);  // Bytes 4+: metadata
            result.set(new Uint8Array(ciphertext), 4 + metadataBuffer.length);  // Bytes sau metadata: ciphertext
            
            // Chuyển thành base64 để dễ lưu trữ và truyền tải
            return btoa(String.fromCharCode(...result));
            
        } catch (error) {
            throw new Error(`Mã hóa AES-256-GCM thất bại`);
        }
    }
    
    static async decrypt(password, encryptedData) {
        try {
            //1. Giải mã Base64 và tách các phần
            const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            
            // Đọc 4 bytes đầu để lấy độ dài metadata
            const metadataLength = new Uint32Array(encryptedBuffer.slice(0, 4).buffer)[0];
            
            // Trích xuất metadata buffer dựa trên độ dài đã đọc
            const metadataBuffer = encryptedBuffer.slice(4, 4 + metadataLength);
            const metadataStr = new TextDecoder().decode(metadataBuffer);
            const metadata = JSON.parse(metadataStr);
            
            // Trích xuất ciphertext (phần còn lại sau metadata)
            const ciphertext = encryptedBuffer.slice(4 + metadataLength);
            
            // 2. Dẫn xuất lại khóa từ mật khẩu
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            // Dẫn xuất khóa với cùng salt và parameters đã dùng khi mã hóa
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: new Uint8Array(metadata.salt), // Dùng lại salt từ metadata
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['decrypt']// Chỉ cho phép giải mã
            );
            
            // 3. Giải mã dữ liệu
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: new Uint8Array(metadata.iv) // Dùng lại IV từ metadata
                },
                key,
                ciphertext
            );
            
            //4. Trả về dữ liệu đúng định dạng
            if (metadata.isText) {
                const decoder = new TextDecoder();
                return decoder.decode(decryptedBuffer);
            } else {
                // Trả về ArrayBuffer cho file nhị phân
                return decryptedBuffer;
            }
            
        } catch (error) {
            throw new Error(`Giải mã AES-256-GCM thất bại: ${error.message}`);
        }
    }
}