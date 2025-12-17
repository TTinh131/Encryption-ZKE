document.addEventListener("DOMContentLoaded", function () {
  // Particles.js khởi tạo - sử dụng màu từ CSS variables
  const primaryColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary-color")
    .trim();

  // Khởi tạo particles với cấu hình đúng
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
        value: primaryColor || "#8b5cf6",
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
        color: primaryColor || "#8b5cf6",
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

  // nhớ đăng nhập
  const rememberMeCheckbox = document.getElementById("rememberMe");
  const usernameInput = document.getElementById("id_username");
  const passwordInput = document.getElementById("id_password");
  const loginForm = document.querySelector(".login-form");

  // Kiểm tra xem có username đã lưu không
  const savedUsername = localStorage.getItem("savedUsername");
  if (savedUsername) {
    usernameInput.value = savedUsername;
    rememberMeCheckbox.checked = true;
    passwordInput.focus();
  } else {
    rememberMeCheckbox.checked = false;
    // Xóa mật khẩu nếu có
    passwordInput.value = "";
  }

  // Xử lý sự kiện khi form được submit
  document
    .querySelector(".login-form")
    .addEventListener("submit", function (e) {
      if (rememberMeCheckbox.checked) {
        // CHỈ lưu username, KHÔNG lưu password
        localStorage.setItem("savedUsername", usernameInput.value);
      } else {
        // Xóa username đã lưu
        localStorage.removeItem("savedUsername");
      }
    });

  window.addEventListener("beforeunload", function () {
    if (!rememberMeCheckbox.checked) {
      passwordInput.value = "";
    }
  });

  // Clear lỗi khi user bắt đầu nhập
  [usernameInput, passwordInput].forEach((input) => {
    input.addEventListener("input", function () {
      this.classList.remove("error");
      const feedback =
        this.closest(".input-group").querySelector(".form-feedback");
      if (feedback) {
        feedback.style.display = "none";
      }
    });
  });

  // Validation trước khi submit
  loginForm.addEventListener("submit", function (e) {
    let isValid = true;

    if (!usernameInput.value.trim()) {
      showFieldError(usernameInput, "Vui lòng nhập tên đăng nhập");
      isValid = false;
    }

    if (!passwordInput.value.trim()) {
      showFieldError(passwordInput, "Vui lòng nhập mật khẩu");
      isValid = false;
    }

    if (!isValid) {
      e.preventDefault();
    }
  });

  //Hiển thị thông báo lỗi cho field
  function showFieldError(inputElement, message) {
    inputElement.classList.add("error");
    let feedback = inputElement
      .closest(".input-group")
      .querySelector(".form-feedback");

    if (!feedback) {
      feedback = document.createElement("div");
      feedback.className = "form-feedback invalid";
      inputElement.closest(".input-group").appendChild(feedback);
    }

    feedback.innerHTML = `<i class="fas fa-exclamation-circle me-1"></i>${message}`;
    feedback.style.display = "flex";
  }

  // hiển thị/ ẩn mật khẩu
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

  //xử lý theme
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  const themeToggleLogin = document.getElementById("themeToggleLogin");
  if (themeToggleLogin) {
    const icon = themeToggleLogin.querySelector("i");
    icon.className = savedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }
});
