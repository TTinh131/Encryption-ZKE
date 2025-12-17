document.addEventListener("DOMContentLoaded", function () {
  let countdownInterval;
  let timeLeft = 60;
  const otpInput = document.getElementById("id_otp_code");
  const countdownTimer = document.getElementById("countdownTimer");
  const countdownText = document.getElementById("countdown");
  const resendOtpBtn = document.getElementById("resendOtpBtn");
  const emailDisplay = document.getElementById("emailDisplay");

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

  // Xử lý input OTP
  if (otpInput) {
    otpInput.addEventListener("input", function (e) {
      this.value = this.value.replace(/[^0-9]/g, "");
      if (this.value.length > 6) {
        this.value = this.value.slice(0, 6);
      }
    });
    otpInput.addEventListener("focus", function () {
      this.parentElement.classList.add("focused");
    });
    otpInput.addEventListener("blur", function () {
      this.parentElement.classList.remove("focused");
    });
  }

  // đồng hồ đếm ngược
  function startCountdown() {
    timeLeft = 60;
    updateCountdownDisplay();
    countdownInterval = setInterval(function () {
      timeLeft--;
      updateCountdownDisplay();
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        enableResendButton();
      }
    }, 1000);
  }

  function updateCountdownDisplay() {
    if (countdownText) {
      countdownText.textContent = timeLeft;
    }

    if (timeLeft <= 10 && countdownTimer) {
      countdownTimer.classList.add("warning");
    } else if (countdownTimer) {
      countdownTimer.classList.remove("warning");
    }
  }

  function enableResendButton() {
    if (resendOtpBtn) {
      resendOtpBtn.disabled = false;
      resendOtpBtn.classList.add("enabled");
    }
    if (countdownTimer) {
      countdownTimer.style.display = "none";
    }
  }

  function disableResendButton() {
    if (resendOtpBtn) {
      resendOtpBtn.disabled = true;
      resendOtpBtn.classList.remove("enabled");
    }
    if (countdownTimer) {
      countdownTimer.style.display = "flex";
    }
  }

  // Hàm lấy CSRF token
  function getCSRFToken() {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
    return csrfToken ? csrfToken.value : '';
  }

  // gửi lại OTP - gọi API  
  if (resendOtpBtn) {
    resendOtpBtn.addEventListener("click", function () {
      if (this.disabled) return;
      
      // Hiển thị loading
      const originalText = this.innerHTML;
      this.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Đang gửi...';
      this.disabled = true;

      // Tạo form data từ data attributes
      const formData = new FormData();
      const btnEmail = this.dataset.email || '';
      const btnPurpose = this.dataset.purpose || '';
      const btnUserId = this.dataset.userId || '';

      if (btnEmail) {
        formData.append('email', btnEmail);
      }
      if (btnPurpose) {
        formData.append('purpose', btnPurpose);
      }
      if (btnUserId) {
        formData.append('user_id', btnUserId);
      }
      formData.append('csrfmiddlewaretoken', getCSRFToken());

      const resendUrl = '/accounts/resend-otp/'; // URL API gửi lại OTP
      fetch(resendUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          showNotification(data.message || "Mã OTP mới đã được gửi thành công!", "success");
          // Bắt đầu lại đếm ngược
          disableResendButton();
          startCountdown();
        } else {
          showNotification(data.error || "Có lỗi xảy ra khi gửi OTP", "error");
        }
      })
      .catch(error => {
        showNotification("Lỗi kết nối: " + error.message, "error");
      })
      .finally(() => {
        // Reset nút
        this.innerHTML = originalText;
        this.disabled = false;
      });
    });
  }

  // Hiển thị thông báo
  function showNotification(message, type) {
    // Xóa thông báo cũ
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(notification => notification.remove());

    // Tạo thông báo mới
    const notification = document.createElement("div");
    notification.className = `alert alert-${type === "success" ? "success" : "danger"} notification`;
    notification.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-${type === "success" ? "check-circle" : "exclamation-triangle"} me-2"></i>
        <span>${message}</span>
      </div>
    `;

    // Thêm vào form
    const form = document.querySelector(".login-form");
    if (form) {
      form.insertBefore(notification, form.firstChild);
      // Tự động ẩn sau 5 giây
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);
    }
  }

  // Khởi động khi trang load
  startCountdown();
});