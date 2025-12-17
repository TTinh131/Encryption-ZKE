document.addEventListener("DOMContentLoaded", function () {
  // Cấu hình
  const config = {
    sendOtpUrl:
      typeof SEND_OTP_URL !== "undefined"
        ? SEND_OTP_URL
        : "/accounts/send-otp-api/",
    toggle2faUrl:
      typeof TOGGLE_2FA_URL !== "undefined"
        ? TOGGLE_2FA_URL
        : "/accounts/toggle-two-factor/",
    verifyPassword2faUrl:
      typeof VERIFY_PASSWORD_2FA_URL !== "undefined"
        ? VERIFY_PASSWORD_2FA_URL
        : "/accounts/verify-password-2fa/",
    profileUrl:
      typeof PROFILE_URL !== "undefined" ? PROFILE_URL : window.location.href,
    userId: typeof USER_ID !== "undefined" ? USER_ID : null,
    userEmail: typeof USER_EMAIL !== "undefined" ? USER_EMAIL : "",
    userTheme: typeof USER_THEME !== "undefined" ? USER_THEME : "dark",
    csrfToken:
      typeof CSRF_TOKEN !== "undefined" ? CSRF_TOKEN : getCsrfTokenFromForm(),
  };
  // Khởi tạo theme
  initializeTheme();

  function getCsrfTokenFromForm() {
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");
    return csrfToken ? csrfToken.value : "";
  }

  function initializeTheme() {
    let theme = config.userTheme || localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    sessionStorage.setItem("theme", theme);

    const themeOptions = document.querySelectorAll(".theme-option");
    themeOptions.forEach((option) => {
      if (option.dataset.theme === theme) {
        option.classList.add("active");
      } else {
        option.classList.remove("active");
      }
    });
  }

  // === XỬ LÝ ĐỔI MẬT KHẨU ===
  const password1 = document.getElementById("newPassword");
  const password2 = document.getElementById("confirmPassword");
  const submitBtn = document.getElementById("submitBtn");
  const requirementsList = document.getElementById("passwordRequirements");

  // Hiển thị/ẩn mật khẩu
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", function () {
      const input = this.parentElement.querySelector(".password-input");
      const icon = this.querySelector("i");
      if (input.type === "password") {
        input.type = "text";
        icon.className = "fas fa-eye-slash";
      } else {
        input.type = "password";
        icon.className = "fas fa-eye";
      }
    });
  });

  // Kiểm tra độ mạnh mật khẩu
  function checkPasswordStrength(password) {
    const requirements = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    updateRequirementsUI(requirements);

    const hasInvalidRequirements = Object.values(requirements).some(
      (req) => !req
    );

    if (password.length > 0 && hasInvalidRequirements) {
      requirementsList.style.display = "block";
    } else {
      requirementsList.style.display = "none";
    }

    return { requirements };
  }

  function updateRequirementsUI(requirements) {
    updateRequirement(reqLength, requirements.length, "Ít nhất 8 ký tự");
    updateRequirement(
      reqLowercase,
      requirements.lowercase,
      "Chứa chữ thường (a-z)"
    );
    updateRequirement(
      reqUppercase,
      requirements.uppercase,
      "Chứa chữ hoa (A-Z)"
    );
    updateRequirement(reqNumber, requirements.number, "Chứa số (0-9)");
    updateRequirement(
      reqSpecial,
      requirements.special,
      "Chứa ký tự đặc biệt (!@#$%^&*)"
    );
  }

  function updateRequirement(element, isValid, text) {
    if (isValid) {
      element.className = "requirement valid";
      element.innerHTML = `<i class="fas fa-check"></i><span>${text}</span>`;
    } else {
      element.className = "requirement invalid";
      element.innerHTML = `<i class="fas fa-times"></i><span>${text}</span>`;
    }
  }

  function validatePassword() {
    if (!password1) return false;
    const password = password1.value;
    const { requirements } = checkPasswordStrength(password);
    return Object.values(requirements).every((req) => req);
  }

  function validatePasswordMatch() {
    if (!password2) return true;
    const isMatch = password1.value === password2.value;
    const feedback = document.getElementById("passwordMatchFeedback");

    if (password2.value && !isMatch) {
      password2.classList.add("is-invalid");
      if (feedback) feedback.style.display = "flex";
      return false;
    } else {
      password2.classList.remove("is-invalid");
      if (feedback) feedback.style.display = "none";
      return true;
    }
  }

  if (password1) {
    password1.addEventListener("input", function () {
      validatePassword();
      validatePasswordMatch();
      updateSubmitButton();
    });
  }

  if (password2) {
    password2.addEventListener("input", function () {
      validatePasswordMatch();
      updateSubmitButton();
    });
  }

  function updateSubmitButton() {
    if (!submitBtn) return;

    const isPasswordStrong = validatePassword();
    const isPasswordMatch = validatePasswordMatch();

    if (isPasswordStrong && isPasswordMatch) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-secondary");
      submitBtn.classList.add("btn-primary");
    } else {
      submitBtn.disabled = true;
      submitBtn.classList.remove("btn-primary");
      submitBtn.classList.add("btn-secondary");
    }
  }

  // Xử lý form đổi mật khẩu - SỬA LẠI ĐỂ GỬI REQUEST BÌNH THƯỜNG
  const passwordForm = document.getElementById("passwordForm");
  if (passwordForm) {
    passwordForm.addEventListener("submit", function (e) {
      // KHÔNG ngăn submit mặc định, để server xử lý
      const isPasswordStrong = validatePassword();
      const isPasswordMatch = validatePasswordMatch();

      if (!isPasswordStrong || !isPasswordMatch) {
        e.preventDefault(); // Chỉ preventDefault nếu validation client fail
        validatePassword();
        validatePasswordMatch();

        if (!isPasswordStrong && password1.value.length > 0) {
          requirementsList.style.display = "block";
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.innerHTML = '<i class="fas fa-key me-2"></i>Đổi Mật Khẩu';
          submitBtn.disabled = false;
        }

        if (!isPasswordStrong) {
          showMessage(
            "Mật khẩu mới không đủ mạnh. Vui lòng kiểm tra các yêu cầu.",
            "error"
          );
        }
        if (!isPasswordMatch) {
          showMessage("Mật khẩu xác nhận không khớp.", "error");
        }
        return;
      }

      // Nếu hợp lệ, cho phép form submit bình thường đến server
      // Hiển thị loading state
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i>Đang xử lý...';
      submitBtn.disabled = true;

      // Reset sau 10 giây nếu có lỗi
      setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }, 10000);
    });
  }

  // === XỬ LÝ THEME ===
  const themeOptions = document.querySelectorAll(".theme-option");
  themeOptions.forEach((option) => {
    option.addEventListener("click", function () {
      const theme = this.dataset.theme;

      themeOptions.forEach((opt) => opt.classList.remove("active"));
      this.classList.add("active");

      const formData = new FormData();
      formData.append("csrfmiddlewaretoken", config.csrfToken);
      formData.append("form_type", "theme");
      formData.append("theme", theme);

      fetch(config.profileUrl, {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text().then((text) => {
            try {
              return JSON.parse(text);
            } catch {
              return { success: true, message: "Thao tác thành công" };
            }
          });
        })
        .then((data) => {
          if (data && data.success) {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem("theme", theme);
            sessionStorage.setItem("theme", theme);
            config.userTheme = theme;
            showMessage(
              data.message || "Đã cập nhật giao diện thành công!",
              "success"
            );
          } else {
            const errorMsg =
              data && data.error ? data.error : "Lỗi không xác định";
            showMessage("Có lỗi khi cập nhật theme: " + errorMsg, "error");
            initializeTheme();
          }
        })
        .catch((error) => {
          console.error("Error saving theme:", error);
          showMessage(
            "Lỗi kết nối khi cập nhật theme: " + error.message,
            "error"
          );
          initializeTheme();
        });
    });
  });

  // === XỬ LÝ 2FA - SỬA LẠI HOÀN TOÀN ===
  const twoFactorToggle = document.getElementById("twoFactorToggle");

  if (twoFactorToggle) {
    // Lưu trạng thái ban đầu từ data attribute
    let currentTwoFactorState = twoFactorToggle.dataset.currentState === "true";

    // Sử dụng sự kiện click thay vì change để kiểm soát tốt hơn
    twoFactorToggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const newState = !currentTwoFactorState;

      if (newState) {
        // Muốn bật 2FA
        showOtpModal();
      } else {
        // Muốn tắt 2FA - hiển thị modal xác nhận với mật khẩu
        const modal = new bootstrap.Modal(
          document.getElementById("disableTwoFactorModal")
        );
        modal.show();

        // Reset form khi modal hiển thị
        const passwordForm = document.getElementById("disableTwoFactorForm");
        if (passwordForm) {
          passwordForm.reset();
          const feedback = document.getElementById(
            "disable2FAPasswordFeedback"
          );
          if (feedback) feedback.style.display = "none";
        }
      }

      // KHÔNG thay đổi trạng thái toggle ngay lập tức
      // Giữ nguyên trạng thái hiện tại cho đến khi xác nhận
      this.checked = currentTwoFactorState;
    });

    // Ngăn sự kiện change mặc định
    twoFactorToggle.addEventListener("change", function (e) {
      e.preventDefault();
      this.checked = currentTwoFactorState;
    });
  }

  // Xử lý khi modal đóng
  const otpModalEl = document.getElementById("otpModal");
  const disableTwoFactorModalEl = document.getElementById(
    "disableTwoFactorModal"
  );

  if (otpModalEl) {
    otpModalEl.addEventListener("hidden.bs.modal", function () {
      // Đảm bảo toggle giữ nguyên trạng thái khi modal OTP đóng
      if (twoFactorToggle) {
        twoFactorToggle.checked = currentTwoFactorState;
      }
    });
  }

  if (disableTwoFactorModalEl) {
    disableTwoFactorModalEl.addEventListener("hidden.bs.modal", function () {
      // Đảm bảo toggle giữ nguyên trạng thái khi modal tắt 2FA đóng
      if (twoFactorToggle) {
        twoFactorToggle.checked = currentTwoFactorState;
      }
    });
  }

  // Hàm cập nhật trạng thái 2FA sau khi xác nhận thành công
  function updateTwoFactorState(newState) {
    if (twoFactorToggle) {
        currentTwoFactorState = newState;
        twoFactorToggle.checked = newState;
        twoFactorToggle.dataset.currentState = newState.toString();
        update2FAStatus(newState); // QUAN TRỌNG: Gọi hàm cập nhật giao diện
    }
}

  // Xử lý form nhập mật khẩu khi tắt 2FA
  const disableTwoFactorForm = document.getElementById("disableTwoFactorForm");
  if (disableTwoFactorForm) {
    disableTwoFactorForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const password = document.getElementById("disable2FAPassword").value;
      const feedback = document.getElementById("disable2FAPasswordFeedback");

      if (!password) {
        if (feedback) {
          feedback.querySelector("span").textContent = "Vui lòng nhập mật khẩu";
          feedback.style.display = "flex";
        }
        return;
      }

      const submitBtn = this.querySelector("#confirmDisableTwoFactorBtn");
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i>Đang xác nhận...';
      submitBtn.disabled = true;

      // Xác thực mật khẩu trước
      verifyPasswordFor2FA(password)
        .then((success) => {
          if (success) {
            // Nếu mật khẩu đúng, thực hiện tắt 2FA
            toggleTwoFactor(false, password)
              .then((result) => {
                if (result.success) {
                  const modal = bootstrap.Modal.getInstance(
                    document.getElementById("disableTwoFactorModal")
                  );
                  if (modal) modal.hide();
                  updateTwoFactorState(false);
                } else {
                  showMessage("Lỗi khi tắt 2FA: " + result.error, "error");
                  submitBtn.innerHTML = originalText;
                  submitBtn.disabled = false;
                }
              })
              .catch((error) => {
                showMessage("Lỗi khi tắt 2FA: " + error.message, "error");
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
              });
          } else {
            // Hiển thị lỗi mật khẩu
            if (feedback) {
              feedback.querySelector("span").textContent =
                "Mật khẩu không đúng";
              feedback.style.display = "flex";
            }
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
          }
        })
        .catch((error) => {
          showMessage("Lỗi xác thực mật khẩu: " + error.message, "error");
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        });
    });
  }

  // Hàm xác thực mật khẩu cho 2FA (giữ nguyên)
  function verifyPasswordFor2FA(password) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("csrfmiddlewaretoken", config.csrfToken);
      formData.append("current_password", password);

      fetch(config.verifyPassword2faUrl, {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text().then((text) => {
            try {
              return JSON.parse(text);
            } catch {
              return { success: false, error: "Invalid response" };
            }
          });
        })
        .then((data) => {
          if (data && data.success) {
            resolve(true);
          } else {
            resolve(false);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  // Hàm toggleTwoFactor trả về Promise
  function toggleTwoFactor(isEnabled, currentPassword = null) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("csrfmiddlewaretoken", config.csrfToken);
      formData.append("two_factor_enabled", isEnabled);
      if (currentPassword) {
        formData.append("current_password", currentPassword);
      }

      fetch(config.toggle2faUrl, {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text().then((text) => {
            try {
              return JSON.parse(text);
            } catch {
              return { success: false, error: "Invalid response" };
            }
          });
        })
        .then((data) => {
          if (data && data.success) {
            resolve({ success: true, message: data.message });
          } else {
            resolve({
              success: false,
              error: data.error || "Lỗi không xác định",
            });
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  // Xử lý form OTP cho bật 2FA
  const otpForm = document.getElementById("otpForm");
  if (otpForm) {
    otpForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const otpCode = document.getElementById("otpCode");
      const submitBtn = this.querySelector("#confirmOtpBtn");
      const originalText = submitBtn.innerHTML;

      if (otpCode && otpCode.value.length === 6) {
        submitBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin me-2"></i>Đang xác nhận...';
        submitBtn.disabled = true;

        // Giả lập xác thực OTP thành công
        setTimeout(() => {
          toggleTwoFactor(true)
            .then((result) => {
              if (result.success) {
                const modal = bootstrap.Modal.getInstance(
                  document.getElementById("otpModal")
                );
                if (modal) modal.hide();
                updateTwoFactorState(true);
                showMessage(
                  "Xác thực 2 yếu tố đã được kích hoạt thành công!",
                  "success"
                );
              } else {
                showMessage("Lỗi khi bật 2FA: " + result.error, "error");
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
              }
            })
            .catch((error) => {
              showMessage("Lỗi khi bật 2FA: " + error.message, "error");
              submitBtn.innerHTML = originalText;
              submitBtn.disabled = false;
            });
        }, 1000);
      } else {
        showMessage("Vui lòng nhập đủ 6 chữ số OTP", "error");
      }
    });
  }

  // Hàm hiển thị modal OTP
  function showOtpModal() {
    const modal = new bootstrap.Modal(document.getElementById("otpModal"));
    modal.show();

    // Reset form OTP
    const otpForm = document.getElementById("otpForm");
    if (otpForm) {
      otpForm.reset();
    }

    sendOtpFor2FA("enable");
  }

  // Hàm gửi OTP (giữ nguyên)
  function sendOtpFor2FA(purpose) {
    if (!config.userId) {
      showMessage("Lỗi: Không tìm thấy ID người dùng", "error");
      return;
    }

    const formData = new FormData();
    formData.append("csrfmiddlewaretoken", config.csrfToken);
    formData.append("email", config.userEmail);
    formData.append(
      "purpose",
      purpose === "enable" ? "enable_2fa" : "test_2fa"
    );
    formData.append("user_id", config.userId);

    fetch(config.sendOtpUrl, {
      method: "POST",
      body: formData,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text().then((text) => {
          try {
            return JSON.parse(text);
          } catch {
            return { success: true, message: "Thao tác thành công" };
          }
        });
      })
      .then((data) => {
        if (data && data.success) {
          if (purpose === "enable") {
            startCountdown();
          }
          showMessage(
            data.message || "Mã OTP đã được gửi đến email của bạn!",
            "success"
          );
        } else {
          const errorMsg =
            data && data.error ? data.error : "Lỗi không xác định";
          showMessage("Lỗi khi gửi OTP: " + errorMsg, "error");
        }
      })
      .catch((error) => {
        console.error("Error sending OTP:", error);
        showMessage("Lỗi kết nối khi gửi OTP: " + error.message, "error");
      });
  }

  // Hàm đếm ngược OTP (giữ nguyên)
  function startCountdown() {
    let timeLeft = 60;
    const countdownElement = document.getElementById("countdown");
    const resendBtn = document.getElementById("resendOtpBtn");

    if (!countdownElement || !resendBtn) return;

    resendBtn.disabled = true;
    resendBtn.classList.add("disabled");

    const countdown = setInterval(() => {
      timeLeft--;
      countdownElement.textContent = timeLeft;

      if (timeLeft <= 10) {
        countdownElement.parentElement.classList.add("warning");
      }

      if (timeLeft <= 0) {
        clearInterval(countdown);
        resendBtn.disabled = false;
        resendBtn.classList.remove("disabled");
      }
    }, 1000);

    resendBtn.addEventListener("click", function () {
      if (!this.disabled) {
        this.disabled = true;
        this.classList.add("disabled");
        countdownElement.parentElement.classList.remove("warning");
        timeLeft = 60;
        countdownElement.textContent = timeLeft;
        startCountdown();
        sendOtpFor2FA("enable");
      }
    });
  }

  // Hàm cập nhật giao diện 2FA (giữ nguyên)
  function update2FAStatus(isEnabled) {
    const twoFactorContent = document.getElementById('twoFactorContent');
    if (!twoFactorContent) return;

    if (isEnabled) {
        // Trạng thái bật
        twoFactorContent.innerHTML = `
            <div class="twofactor-status">
                <div class="status-badge enabled">
                    <i class="fas fa-check-circle me-2"></i>
                    <span>Xác thực 2 yếu tố đang hoạt động</span>
                </div>
                <p class="status-description mt-2">
                    Tài khoản của bạn được bảo vệ bằng xác thực 2 yếu tố. 
                    Bạn sẽ nhận được mã OTP qua email khi đăng nhập từ thiết bị mới.
                </p>
            </div>
        `;
    } else {
        // Trạng thái tắt
        twoFactorContent.innerHTML = `
            <div class="twofactor-note">
                <i class="fas fa-info-circle"></i>
                <span>Khi bật, bạn sẽ nhận được mã OTP qua email để xác nhận</span>
            </div>
        `;
    }

    // Cập nhật các phần tử status khác (giữ nguyên)
    const statusElements = document.querySelectorAll('.meta-status, .action-status');
    statusElements.forEach(element => {
        if (isEnabled) {
            element.textContent = 'Đã bật';
            element.className = element.className.replace('disabled', 'enabled');
            element.className = element.className.replace('inactive', 'active');
        } else {
            element.textContent = 'Đã tắt';
            element.className = element.className.replace('enabled', 'disabled');
            element.className = element.className.replace('active', 'inactive');
        }
    });
    
    const avatarStatus = document.querySelector('.avatar-status');
    if (avatarStatus) {
        if (isEnabled) {
            avatarStatus.classList.remove('offline');
            avatarStatus.classList.add('online');
        } else {
            avatarStatus.classList.remove('online');
            avatarStatus.classList.add('offline');
        }
    }
    
    updateTwoFactorTabContent(isEnabled);
}

  // Hàm cập nhật nội dung tab 2FA (giữ nguyên)
  function updateTwoFactorTabContent(isEnabled) {
    const twoFactorNote = document.querySelector(".twofactor-note");
    const twoFactorStatus = document.querySelector(".twofactor-status");

    if (isEnabled) {
      if (twoFactorNote) twoFactorNote.style.display = "none";
      if (twoFactorStatus) twoFactorStatus.style.display = "block";
    } else {
      if (twoFactorNote) twoFactorNote.style.display = "flex";
      if (twoFactorStatus) twoFactorStatus.style.display = "none";
    }
  }

  // Hiển thị thông báo
  function showMessage(message, type) {
    let messageContainer = document.querySelector(".message-container");
    if (!messageContainer) {
      messageContainer = document.createElement("div");
      messageContainer.className = "message-container";
      document.body.appendChild(messageContainer);
    }

    const alertClass =
      type === "success"
        ? "alert-success"
        : type === "error"
        ? "alert-danger"
        : type === "warning"
        ? "alert-warning"
        : "alert-info";

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show custom-alert`;
    alertDiv.setAttribute("role", "alert");

    const iconClass =
      type === "success"
        ? "fa-check-circle"
        : type === "error"
        ? "fa-exclamation-circle"
        : type === "warning"
        ? "fa-exclamation-triangle"
        : "fa-info-circle";

    alertDiv.innerHTML = `
            <i class="fas ${iconClass} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

    messageContainer.appendChild(alertDiv);

    setTimeout(() => {
      if (alertDiv.parentNode) {
        const bsAlert = new bootstrap.Alert(alertDiv);
        bsAlert.close();
      }
    }, 5000);
  }

  // Khởi tạo trạng thái ban đầu
  updateSubmitButton();
  // Khởi tạo trạng thái ban đầu - SỬA LẠI
const initialTwoFactorState = twoFactorToggle ? twoFactorToggle.checked : false;
update2FAStatus(initialTwoFactorState);
});
