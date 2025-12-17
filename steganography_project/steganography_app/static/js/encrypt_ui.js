class EncryptionUI {
    constructor() {
        this.initializeCardOptions();
        this.initializeEventListeners();
    }

    // Khởi tạo các card options
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
                
                // Xử lý logic đặc biệt
                this.handleCardSelection(card);
            });
        });
    }

    // Xử lý logic khi chọn card
    handleCardSelection(card) {
        const value = card.getAttribute('data-value');
        const section = card.closest('.input-section-card');
        
        // Xử lý theo loại section
        if (section.querySelector('#encryptionType')) {
            // Section loại mã hóa
            this.handleEncryptionTypeChange(value);
        } else if (section.querySelector('#algorithm')) {
            // Section thuật toán
            this.handleAlgorithmChange(value);
        } else if (section.querySelector('#inputType')) {
            // Section loại dữ liệu
            this.handleInputTypeChange(value);
        }
    }

    // Xử lý thay đổi loại mã hóa
    handleEncryptionTypeChange(type) {
        const passwordGroup = document.getElementById('passwordGroup');
        const keyManagement = document.getElementById('keyManagement');
        
        if (type === 'symmetric') {
            if (passwordGroup) passwordGroup.style.display = 'block';
            if (keyManagement) keyManagement.style.display = 'none';
            
            // Cập nhật thuật toán cho mã hóa đối xứng
            this.updateAlgorithmOptions([
                { value: 'AES-256-GCM', name: 'AES-256-GCM', icon: 'fas fa-shield-alt', desc: 'Mã hóa đối xứng mạnh mẽ' },
                { value: 'XChaCha20-Poly1305', name: 'XChaCha20-Poly1305', icon: 'fas fa-bolt', desc: 'Mã hóa dòng hiệu suất cao' },
                { value: 'Ascon128a', name: 'Ascon128a', icon: 'fas fa-microchip', desc: 'Mã hóa nhẹ cho IoT' }
            ]);
        } else {
            if (passwordGroup) passwordGroup.style.display = 'none';
            if (keyManagement) keyManagement.style.display = 'block';
            
            // Cập nhật thuật toán cho mã hóa bất đối xứng
            this.updateAlgorithmOptions([
                { value: 'X25519', name: 'X25519', icon: 'fas fa-exchange-alt', desc: 'Trao đổi khóa an toàn' },
                { value: 'Kyber1024', name: 'Kyber1024', icon: 'fas fa-atom', desc: 'Mã hóa kháng lượng tử' }
            ]);
            
            // Kiểm tra đăng nhập cho mã hóa bất đối xứng
            if (!window.userAuthenticated) {
                this.showNotification('warning', 'Yêu cầu đăng nhập', 'Bạn cần đăng nhập để sử dụng mã hóa bất đối xứng.');
            }
        }
    }

    // Cập nhật options thuật toán
    updateAlgorithmOptions(algorithms) {
        const algorithmSection = document.querySelector('.input-section-card #algorithm')?.closest('.input-section-card');
        if (!algorithmSection) return;
        
        const algorithmOptions = algorithmSection.querySelector('.card-options');
        if (!algorithmOptions) return;
        
        // Xóa tất cả options hiện tại
        algorithmOptions.innerHTML = '';
        
        // Thêm options mới
        algorithms.forEach((algo, index) => {
            const card = document.createElement('div');
            card.className = `card-option ${index === 0 ? 'active' : ''}`;
            card.setAttribute('data-value', algo.value);
            
            card.innerHTML = `
                <div class="card-option-icon">
                    <i class="${algo.icon}"></i>
                </div>
                <div class="card-option-text">
                    <div class="card-option-title">${algo.name}</div>
                    <div class="card-option-desc">${algo.desc}</div>
                </div>
            `;
            
            algorithmOptions.appendChild(card);
        });
        
        // Cập nhật select ẩn
        const select = algorithmSection.querySelector('select');
        if (select && algorithms.length > 0) {
            select.value = algorithms[0].value;
            select.dispatchEvent(new Event('change'));
        }
        
        // Khởi tạo lại event listeners cho các card mới
        this.initializeCardOptions();
    }

    // Xử lý thay đổi thuật toán
    handleAlgorithmChange(algorithm) {
        this.updateAlgorithmInfo(algorithm);
    }

    // Xử lý thay đổi loại dữ liệu
    handleInputTypeChange(type) {
        const textGroup = document.getElementById('textInputGroup');
        const fileGroup = document.getElementById('fileInputGroup');
        
        if (type === 'text') {
            if (textGroup) textGroup.classList.remove('d-none');
            if (fileGroup) fileGroup.classList.add('d-none');
        } else {
            if (textGroup) textGroup.classList.add('d-none');
            if (fileGroup) fileGroup.classList.remove('d-none');
        }
    }

    // Cập nhật thông tin thuật toán
    updateAlgorithmInfo(algorithm) {
        const algorithmData = {
            "AES-256-GCM": {
                name: "AES-256-GCM",
                type: "Đối xứng",
                security: "Cao",
                speed: "Nhanh",
                keySize: "256 bit",
                recommendation: "Sử dụng cho dữ liệu nhạy cảm",
                description: "AES-256-GCM là một trong những thuật toán mã hóa đối xứng mạnh nhất hiện nay, kết hợp mã hóa khối AES với 256-bit key và chế độ xác thực GCM."
            },
            "XChaCha20-Poly1305": {
                name: "XChaCha20-Poly1305",
                type: "Đối xứng",
                security: "Rất cao",
                speed: "Rất nhanh",
                keySize: "256 bit",
                recommendation: "Lý tưởng cho dữ liệu lớn",
                description: "XChaCha20-Poly1305 là thuật toán mã hóa dòng hiện đại với hiệu suất cao, đặc biệt phù hợp cho mã hóa dữ liệu lớn và streaming."
            },
            "Ascon128a": {
                name: "Ascon128a",
                type: "Đối xứng",
                security: "Cao",
                speed: "Nhanh",
                keySize: "128 bit",
                recommendation: "Sử dụng cho IoT và thiết bị nhúng",
                description: "Ascon128a là thuật toán mã hóa nhẹ, được thiết kế cho các ứng dụng IoT và thiết bị có tài nguyên hạn chế."
            },
            "X25519": {
                name: "X25519",
                type: "Bất đối xứng",
                security: "Cao",
                speed: "Nhanh",
                keySize: "256 bit",
                recommendation: "Trao đổi khóa an toàn",
                description: "X25519 là thuật toán trao đổi khóa dựa trên Curve25519, cung cấp bảo mật cao và hiệu suất tốt."
            },
            "Kyber1024": {
                name: "Kyber1024",
                type: "Bất đối xứng",
                security: "Kháng lượng tử",
                speed: "Trung bình",
                keySize: "1024 bit",
                recommendation: "Bảo mật tương lai",
                description: "Kyber1024 là thuật toán mã hóa kháng lượng tử, đảm bảo an toàn trước các cuộc tấn công bằng máy tính lượng tử."
            }
        };
        
        const algo = algorithmData[algorithm];
        if (!algo) return;
        
        // Cập nhật thông tin thuật toán
        const elements = {
            'algoName': algo.name,
            'algoType': algo.type,
            'algoSecurity': algo.security,
            'algoSpeed': algo.speed,
            'algoKeySize': algo.keySize,
            'algoRecommendation': algo.recommendation,
            'algoDescription': algo.description,
            'algorithmDescription': algo.description
        };
        
        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = elements[id];
            }
        });
    }

    // Khởi tạo event listeners
    initializeEventListeners() {
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
        
        // Xử lý use existing key checkbox
        const useExistingKey = document.getElementById('useExistingKey');
        if (useExistingKey) {
            useExistingKey.addEventListener('change', (e) => {
                const keySelection = document.getElementById('keySelection');
                const keyGeneration = document.getElementById('keyGeneration');
                
                if (e.target.checked) {
                    if (keySelection) keySelection.style.display = 'block';
                    if (keyGeneration) keyGeneration.style.display = 'none';
                } else {
                    if (keySelection) keySelection.style.display = 'none';
                    if (keyGeneration) keyGeneration.style.display = 'block';
                }
            });
        }
    }

    // Hiển thị thông báo
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
        notification.className = `alert alert-${type} alert-dismissible fade show custom-alert`;
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
}

// Khởi tạo khi trang load
document.addEventListener("DOMContentLoaded", function () {
    new EncryptionUI();
});