document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  const emailInput = document.getElementById("id_email");
  const resetForm = document.getElementById("resetForm");
  const submitBtn = document.getElementById("submitBtn");

  if (!emailInput || !resetForm) return;
  emailInput.className = "input-field";

  // xác thực email 
  const validateEmail = function (email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Hiển thị lỗi
  const showError = function (message) {
    // Xóa lỗi cũ trước
    const oldError = emailInput.parentNode.querySelector(
      ".form-feedback.invalid"
    );
    if (oldError) oldError.remove();

    // Tạo lỗi mới
    const errorDiv = document.createElement("div");
    errorDiv.className = "form-feedback invalid";
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle me-1"></i>${message}`;
    emailInput.parentNode.appendChild(errorDiv);
    emailInput.classList.add("error");
  };

  const clearError = function () {
    const errorDiv = emailInput.parentNode.querySelector(
      ".form-feedback.invalid"
    );
    if (errorDiv) errorDiv.remove();
    emailInput.classList.remove("error");
  };

  emailInput.addEventListener("input", function () {
    clearError(); 
    const email = emailInput.value.trim();
    if (email && !validateEmail(email)) {
      showError("Email không hợp lệ");
    }
  });
  resetForm.addEventListener("submit", function (e) {
    const email = emailInput.value.trim();
    let hasError = false;

    if (!email) {
      showError("Vui lòng nhập email");
      hasError = true;
    } else if (!validateEmail(email)) {
      showError("Vui lòng nhập email hợp lệ");
      hasError = true;
    }

    if (hasError) {
      e.preventDefault();
      emailInput.focus();
      return; // Dừng ngay nếu có lỗi
    }
  });

  emailInput.addEventListener("blur", function () {
    const email = emailInput.value.trim();
    if (email && !validateEmail(email)) {
      showError("Email không hợp lệ");
    }
  });

  // Clear error khi focus
  emailInput.addEventListener("focus", function () {
    clearError();
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const resetForm = document.getElementById("resetForm");
  const submitBtn = document.getElementById("submitBtn");

  if (resetForm && submitBtn) {
    resetForm.addEventListener("submit", function () {
      // Chỉ hiển thị loading khi form thực sự submit 
      setTimeout(function () {
        submitBtn.disabled = true;
      }, 10); // Delay nhỏ để browser kịp xử lý submit
    });
  }
});
