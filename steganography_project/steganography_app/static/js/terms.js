document.addEventListener("DOMContentLoaded", function () {
  const sections = [
    "introduction",
    "legal-framework",
    "prohibited-acts",
    "user-rights",
    "data-security",
    "service-policy",
    "contact",
  ];

  let currentMode = "all"; // 'all' hoặc 'single'
  const navItems = document.querySelectorAll(".nav-item");
  const termsContent = document.getElementById("terms-content");

  // Hiển thị toàn bộ nội dung
  function showAllContent() {
    termsContent.classList.remove("single-content");
    termsContent.classList.add("full-content");
    sections.forEach((section) => {
      const sectionEl = document.getElementById(section + "-section");
      if (sectionEl) {
        sectionEl.style.display = "block";
        sectionEl.classList.remove("active");
      }
    });
    currentMode = "all";
  }

  // Hiển thị một section duy nhất
  function showSingleSection(sectionId) {
    termsContent.classList.remove("full-content");
    termsContent.classList.add("single-content");
    sections.forEach((section) => {
      const sectionEl = document.getElementById(section + "-section");
      if (sectionEl) {
        sectionEl.style.display = "none";
        sectionEl.classList.remove("active");
      }
    });

    const targetSection = document.getElementById(sectionId + "-section");
    if (targetSection) {
      targetSection.style.display = "block";
      targetSection.classList.add("active");
    }
    currentMode = "single";
  }

  // Sự kiện click nav
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.getAttribute("data-section");

      // Cập nhật nav
      navItems.forEach((navItem) => {
        navItem.classList.remove("active");
      });
      item.classList.add("active");

      // Hiển thị nội dung
      if (section === "all") {
        showAllContent();
      } else {
        showSingleSection(section);
      }
    });
  });

  //hiển thị toàn bộ nội dung
  showAllContent();
});
