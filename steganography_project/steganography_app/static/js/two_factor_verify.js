document.addEventListener("DOMContentLoaded", function () {
    // Ẩn email
    function maskEmailForDisplay() {
    if (!emailDisplay) return;
    const originalEmail = emailDisplay.textContent.trim();
    const atIndex = originalEmail.indexOf("@");
    if (atIndex === -1) {
      return;
    }

    const username = originalEmail.substring(0, atIndex);
    const domain = originalEmail.substring(atIndex);

    if (username.length <= 2) {
      emailDisplay.textContent = "*".repeat(username.length) + domain;
    } else {
      const visiblePart = username.substring(0, 2);
      const hiddenPart = "*".repeat(username.length - 2);
      emailDisplay.textContent = visiblePart + hiddenPart + domain;
    }
    emailDisplay.style.cursor = "default";
  }
  maskEmailForDisplay();
    particlesJS("particles-js", {
        particles: {
            number: {
                value: 80,
                density: {
                    enable: true,
                    value_area: 800,
                },
            },
            color: {
                value: getComputedStyle(document.documentElement)
                    .getPropertyValue("--primary-color")
                    .trim() || "#8b5cf6",
            },
            shape: {
                type: "circle",
                stroke: {
                    width: 0,
                    color: "#000000",
                },
            },
            opacity: {
                value: 0.5,
                random: true,
                anim: {
                    enable: true,
                    speed: 1,
                    opacity_min: 0.1,
                    sync: false,
                },
            },
            size: {
                value: 3,
                random: true,
                anim: {
                    enable: true,
                    speed: 2,
                    size_min: 0.1,
                    sync: false,
                },
            },
            line_linked: {
                enable: true,
                distance: 150,
                color: getComputedStyle(document.documentElement)
                    .getPropertyValue("--primary-color")
                    .trim() || "#8b5cf6",
                opacity: 0.4,
                width: 1,
            },
            move: {
                enable: true,
                speed: 2,
                direction: "none",
                random: false,
                straight: false,
                out_mode: "out",
                bounce: false,
                attract: {
                    enable: false,
                    rotateX: 600,
                    rotateY: 1200,
                },
            },
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: {
                    enable: true,
                    mode: "grab",
                },
                onclick: {
                    enable: false,
                    mode: "push",
                },
                resize: true,
            },
            modes: {
                grab: {
                    distance: 140,
                    line_linked: {
                        opacity: 1,
                    },
                },
                bubble: {
                    distance: 400,
                    size: 40,
                    duration: 2,
                    opacity: 8,
                    speed: 3,
                },
                repulse: {
                    distance: 200,
                    duration: 0.4,
                },
                push: {
                    particles_nb: 4,
                },
                remove: {
                    particles_nb: 2,
                },
            },
        },
        retina_detect: true,
    });

    // Đếm ngược thời gian gửi lại OTP
    let timeLeft = 60;
    const countdownElement = document.getElementById('countdown');
    const resendBtn = document.getElementById('resendOtpBtn');

    function startCountdown() {
        timeLeft = 60;
        resendBtn.disabled = true;
        resendBtn.classList.remove('enabled');
        
        const countdown = setInterval(() => {
            timeLeft--;
            countdownElement.textContent = timeLeft;
            
            if (timeLeft <= 10) {
                countdownElement.parentElement.classList.add('warning');
            }
            
            if (timeLeft <= 0) {
                clearInterval(countdown);
                resendBtn.disabled = false;
                resendBtn.classList.add('enabled');
                countdownElement.parentElement.classList.remove('warning');
            }
        }, 1000);
    }

    // Xử lý gửi lại OTP
    resendBtn.addEventListener('click', function() {
        if (!this.disabled) {
            const email = this.dataset.email;
            const purpose = this.dataset.purpose;
            const userId = this.dataset.userId;
            
            // Hiển thị trạng thái loading
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Đang gửi...';
            this.disabled = true;

            // Gửi request AJAX để gửi lại OTP
            fetch('/accounts/resend-otp/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: `email=${encodeURIComponent(email)}&purpose=${purpose}&user_id=${userId}`
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || "Mã OTP mới đã được gửi thành công!", "success");
                    startCountdown();
                } else {
                    showNotification(data.error || 'Có lỗi xảy ra khi gửi lại mã OTP', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Lỗi kết nối. Vui lòng thử lại.', 'error');
            })
            .finally(() => {
                // Reset nút về trạng thái ban đầu
                this.innerHTML = originalText;
                this.disabled = false;
            });
        }
    });

    // Hàm lấy CSRF token
    function getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    // Hàm hiển thị thông báo
    function showNotification(message, type) {
        // Tìm hoặc tạo container cho thông báo
        let alertContainer = document.querySelector('.alert-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.className = 'alert-container';
            document.querySelector('.form-box').insertBefore(alertContainer, document.querySelector('.login-form'));
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} notification`;
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'} me-2"></i>
                <span>${message}</span>
            </div>
        `;

        alertContainer.appendChild(alertDiv);

        // Tự động xóa thông báo sau 5 giây
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    // Xử lý input OTP
    const otpInput = document.getElementById('id_otp_code');
    if (otpInput) {
        otpInput.addEventListener('input', function() {
            // Chỉ cho phép nhập số
            this.value = this.value.replace(/[^0-9]/g, '');
            
            // Tự động submit form khi nhập đủ 6 số
            if (this.value.length === 6) {
                this.form.submit();
            }
        });

        // Focus vào input OTP khi trang load
        otpInput.focus();
    }

    startCountdown();
});