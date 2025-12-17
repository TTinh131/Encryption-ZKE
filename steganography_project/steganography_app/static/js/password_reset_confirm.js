document.addEventListener("DOMContentLoaded", function () {
  const password1 = document.getElementById("id_new_password1");
  const password2 = document.getElementById("id_new_password2");
  const submitBtn = document.getElementById("submitBtn");
  const requirementsList = document.getElementById("requirementsList");

  // Yêu cầu mật khẩu
  const reqLength = document.getElementById("reqLength");
  const reqLowercase = document.getElementById("reqLowercase");
  const reqUppercase = document.getElementById("reqUppercase");
  const reqNumber = document.getElementById("reqNumber");
  const reqSpecial = document.getElementById("reqSpecial");

  //hiển thị/ẩn mật khẩu yêu cầu
  document.querySelectorAll(".btn-password-toggle").forEach((button) => {
    button.addEventListener("click", function () {
      const input = this.parentElement.querySelector(".input-field");
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
    // Ẩn/hiện theo điều kiện
    updateRequirementsUI(requirements);
    // Kiểm tra xem có yêu cầu nào chưa đáp ứng không
    const hasInvalidRequirements = Object.values(requirements).some(
      (req) => !req
    );
    // Hiện/ẩn list yêu cầu
    if (password.length > 0 && hasInvalidRequirements) {
      requirementsList.style.display = "block";
    } else {
      requirementsList.style.display = "none";
    }
    return { requirements };
  }

  function updateRequirementsUI(requirements) {
    // Cập nhật từng yêu cầu - chỉ hiện khi chưa đáp ứng
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
      // Đã đáp ứng - ẩn đi
      element.style.display = "none";
    } else {
      // Chưa đáp ứng - hiện lên
      element.style.display = "flex";
      element.className = "requirement invalid";
      element.innerHTML = `<i class="fas fa-times"></i>${text}`;
    }
  }

  function validatePassword() {
    const password = password1.value;
    const { requirements } = checkPasswordStrength(password);

    // Kiểm tra nếu mật khẩu đáp ứng tất cả yêu cầu
    const isStrongPassword = Object.values(requirements).every((req) => req);
    return isStrongPassword;
  }

  function validatePasswordMatch() {
    const isMatch = password1.value === password2.value;

    if (password2.value && !isMatch) {
      password2.classList.add("error");
      document.getElementById("passwordMatchFeedback").style.display = "flex";
      return false;
    } else {
      password2.classList.remove("error");
      document.getElementById("passwordMatchFeedback").style.display = "none";
      return true;
    }
  }

  // kiểm tra khi người dùng nhập mật khẩu
  password1.addEventListener("input", function () {
    validatePassword();
    validatePasswordMatch();
    updateSubmitButton();
  });

  password2.addEventListener("input", function () {
    validatePasswordMatch();
    updateSubmitButton();
  });

  // Cập nhật trạng thái nút submit
  function updateSubmitButton() {
    const isPasswordStrong = validatePassword();
    const isPasswordMatch = validatePasswordMatch();

    if (isPasswordStrong && isPasswordMatch) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
      submitBtn.style.background = "var(--primary-color)";
      submitBtn.style.color = "white";
    } else {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.6";
      submitBtn.style.cursor = "not-allowed";
      submitBtn.style.background = "var(--bg-secondary)";
      submitBtn.style.color = "var(--text-secondary)";
    }
  }

  // Xử lý submit form
  const form = document.querySelector(".login-form");

  form.addEventListener("submit", function (e) {
    const isPasswordStrong = validatePassword();
    const isPasswordMatch = validatePasswordMatch();

    if (!isPasswordStrong || !isPasswordMatch) {
      e.preventDefault();

      // Hiển thị tất cả lỗi
      validatePassword();
      validatePasswordMatch();

      // Hiển thị tất cả yêu cầu khi submit thất bại
      if (!isPasswordStrong && password1.value.length > 0) {
        requirementsList.style.display = "block";
      }

      // Cuộn đến lỗi đầu tiên
      const firstError =
        form.querySelector(".error") ||
        form.querySelector('.form-feedback.invalid[style*="display: flex"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

  // Xóa lỗi khi người dùng chỉnh sửa lại
  form.querySelectorAll(".input-field").forEach((field) => {
    field.addEventListener("input", function () {
      this.classList.remove("error");
      const feedback =
        this.closest(".input-group").querySelector(".form-feedback");
      if (feedback && !feedback.id) {
        feedback.style.display = "none";
      }
    });
  });

  // Khởi tạo trạng thái nút submit
  updateSubmitButton();
});
