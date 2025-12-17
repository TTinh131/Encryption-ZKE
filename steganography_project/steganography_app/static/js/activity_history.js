// Set lưu trữ các hoạt động được chọn
let selectedActivities = new Set();

// Lấy giá trị cookie theo tên
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Lấy CSRF token từ cookie hoặc meta tag hoặc input hidden
function getCSRFToken() {
  let token = getCookie("csrftoken");
  if (!token) {
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) token = metaToken.getAttribute("content");
  }
  if (!token) {
    const inputToken = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    );
    if (inputToken) token = inputToken.value;
  }
  return token;
}

// Hiển thị thông báo kiểu Django
function showDjangoMessage(message, type = "info") {
  // Tạo container messages nếu chưa có
  let messageContainer = document.querySelector(".message-container");
  if (!messageContainer) {
    messageContainer = document.createElement("div");
    messageContainer.className = "message-container";
    document.body.appendChild(messageContainer);
  }

  // Map type cho phù hợp với Bootstrap
  const alertTypeMap = {
    success: "success",
    error: "danger",
    warning: "warning",
    info: "info",
  };
  const bootstrapType = alertTypeMap[type] || "info";

  // Map Icon tương ứng
  const iconMap = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };
  const icon = iconMap[type] || "fa-info-circle";

  // Tạo alert element
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${bootstrapType} alert-dismissible fade show custom-alert`;
  alertDiv.setAttribute("role", "alert");
  alertDiv.innerHTML = `
        <i class="fas ${icon} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Thêm vào container
  messageContainer.appendChild(alertDiv);

  // Tự động đóng sau 3 giây
  setTimeout(() => {
    if (alertDiv.parentNode) {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
      bsAlert.close();
    }
  }, 3000);

  // Scroll đến thông báo
  alertDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Cập nhật số lượng hoạt động được chọn
function updateSelectedCount() {
  const countElement = document.getElementById("selectedCount");
  const actionsBar = document.getElementById("actionsBar");
  const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");

  if (countElement) {
    if (selectedActivities.size === 0) {
      countElement.textContent = "0 hoạt động được chọn";
    } else if (selectedActivities.size === 1) {
      countElement.textContent = "1 hoạt động được chọn";
    } else {
      countElement.textContent = `${selectedActivities.size} hoạt động được chọn`;
    }
  }

  if (actionsBar) {
    actionsBar.style.display = selectedActivities.size > 0 ? "flex" : "none";
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = selectedActivities.size === 0;
  }
}

// Cập nhật trạng thái checkbox "Chọn tất cả"
function updateSelectAllCheckbox() {
  const selectAll = document.getElementById("selectAllCheckbox");
  const checkboxes = document.querySelectorAll(".activity-checkbox");

  if (!selectAll || checkboxes.length === 0) return;

  const checkedCount = Array.from(checkboxes).filter((cb) =>
    cb.classList.contains("checked")
  ).length;
  const totalCount = checkboxes.length;

  if (checkedCount === totalCount && totalCount > 0) {
    selectAll.classList.add("checked");
    selectAll.setAttribute("data-state", "all");
  } else if (checkedCount > 0 && checkedCount < totalCount) {
    selectAll.classList.add("checked");
    selectAll.setAttribute("data-state", "partial");
    selectAll.style.opacity = "0.6";
  } else {
    selectAll.classList.remove("checked");
    selectAll.setAttribute("data-state", "none");
    selectAll.style.opacity = "1";
  }
}

// Định dạng chi tiết hoạt động thành HTML
function formatActivityDetails(data) {
  // Hàm định dạng ngày tháng
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return (
        date.toLocaleDateString("vi-VN") +
        " " +
        date.toLocaleTimeString("vi-VN")
      );
    } catch (e) {
      return dateString || "Không có";
    }
  };

  // Hàm định dạng kích thước file
  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "Không có";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Tạo HTML chi tiết
  let html = `
        <div class="detail-item">
            <span class="detail-label">ID:</span>
            <span class="detail-value">#${data.id || "N/A"}</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Loại thao tác:</span>
            <span class="detail-value">${
              data.get_activity_type_display || data.activity_type || "Không có"
            }</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">File đầu vào:</span>
            <span class="detail-value">${
              data.input_filename || "Không có"
            }</span>
        </div>`;

  if (data.output_filename) {
    html += `
        <div class="detail-item">
            <span class="detail-label">File đầu ra:</span>
            <span class="detail-value">${data.output_filename}</span>
        </div>`;
  }

  html += `
        <div class="detail-item">
            <span class="detail-label">Thuật toán:</span>
            <span class="detail-value">${data.algorithm || "Không có"}</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Kích thước:</span>
            <span class="detail-value">${formatFileSize(data.file_size)}</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Trạng thái:</span>
            <span class="detail-value">${
              data.get_status_display || data.status || "Không có"
            }</span>
        </div>`;

  if (data.execution_time) {
    html += `
        <div class="detail-item">
            <span class="detail-label">Thời gian xử lý:</span>
            <span class="detail-value">${parseFloat(
              data.execution_time
            ).toFixed(2)} giây</span>
        </div>`;
  }

  if (data.error_message) {
    html += `
        <div class="detail-item">
            <span class="detail-label">Thông báo lỗi:</span>
            <span class="detail-value error-message">${data.error_message}</span>
        </div>`;
  }

  html += `
        <div class="detail-item">
            <span class="detail-label">Thời gian tạo:</span>
            <span class="detail-value">${formatDate(data.created_at)}</span>
        </div>`;

  if (data.parameters) {
    try {
      const params =
        typeof data.parameters === "string"
          ? JSON.parse(data.parameters)
          : data.parameters;
      html += `
        <div class="detail-item">
            <span class="detail-label">Tham số:</span>
            <span class="detail-value">
                <pre style="margin: 0; font-size: 12px; max-height: 200px; overflow: auto; background: var(--bg-primary); padding: 0.5rem; border-radius: 6px;">${JSON.stringify(
                  params,
                  null,
                  2
                )}</pre>
            </span>
        </div>`;
    } catch (e) {
      console.error("Lỗi khi phân tích tham số:", e);
    }
  }
  return html;
}

// ============ Các hàm chính ============
// Hiển thị modal chi tiết hoạt động
function showActivityDetails(activityId) {
  const modal = document.getElementById("activityDetailsModal");
  const content = document.getElementById("activityDetailsContent");

  if (!modal || !content) {
    showDjangoMessage("Lỗi: Không thể mở modal chi tiết", "error");
    return;
  }

  // Hiển thị loading
  content.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="loading-spinner"></div>
            <p>Đang tải chi tiết...</p>
        </div>
    `;

  // Hiện modal
  modal.classList.add("active");

  // Gọi API lấy chi tiết
  fetch(`/api/activity/${activityId}/details/`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.error) {
        content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${data.error}
                </div>
            `;
      } else {
        content.innerHTML = formatActivityDetails(data);
      }
    })
    .catch((error) => {
      console.error("Lỗi khi tải chi tiết hoạt động:", error);
      content.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Không thể tải chi tiết: ${error.message}
            </div>
        `;
    });
}

// Xóa một hoạt động
function deleteActivity(activityId) {
  if (
    !confirm(
      "Bạn có chắc muốn xóa hoạt động này? Hành động này không thể phục hồi."
    )
  ) {
    return;
  }

  const currentCsrfToken = getCSRFToken();
  if (!currentCsrfToken) {
    showDjangoMessage(
      "Lỗi: Không tìm thấy CSRF token. Vui lòng tải lại trang.",
      "error"
    );
    return;
  }

  const formData = new FormData();
  formData.append("activity_id", activityId);
  // Gọi API xóa
  fetch("/api/activity/delete/", {
    method: "POST",
    headers: { "X-CSRFToken": currentCsrfToken },
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Hiển thị thông báo thành công và reload trang
        showDjangoMessage("Đã xóa hoạt động thành công!", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showDjangoMessage(
          "Lỗi: " + (data.error || "Không thể xóa hoạt động"),
          "error"
        );
      }
    })
    .catch((error) => {
      console.error("Lỗi xóa:", error);
      showDjangoMessage("Lỗi kết nối: " + error.message, "error");
    });
}

// Xóa các hoạt động đã chọn
function deleteSelectedActivities() {
  if (selectedActivities.size === 0) {
    showDjangoMessage("Vui lòng chọn ít nhất một hoạt động để xóa", "warning");
    return;
  }

  const msg =
    selectedActivities.size === 1
      ? "Bạn có chắc muốn xóa 1 hoạt động đã chọn?"
      : `Bạn có chắc muốn xóa ${selectedActivities.size} hoạt động đã chọn?`;

  if (!confirm(msg + "\n\nHành động này không thể phục hồi.")) {
    return;
  }

  const currentCsrfToken = getCSRFToken();
  if (!currentCsrfToken) {
    showDjangoMessage(
      "Lỗi: Không tìm thấy CSRF token. Vui lòng tải lại trang.",
      "error"
    );
    return;
  }

  const formData = new FormData();
  formData.append("action", "delete_selected");
  selectedActivities.forEach((id) =>
    formData.append("selected_activities", id)
  );

  fetch(window.location.pathname, {
    method: "POST",
    headers: { "X-CSRFToken": currentCsrfToken },
    body: formData,
  })
    .then((response) => {
      if (response.redirected) {
        window.location.href = response.url;
      } else {
        return response.json().then((data) => {
          if (data && data.success) {
            showDjangoMessage(
              "Đã xóa các hoạt động đã chọn thành công!",
              "success"
            );
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            showDjangoMessage(data?.error || "Lỗi khi xóa", "error");
          }
        });
      }
    })
    .catch((error) => {
      console.error("Lỗi khi xóa số lượng lớn:", error);
      showDjangoMessage("Lỗi: " + error.message, "error");
    });
}

// Xóa tất cả hoạt động
function deleteAllActivities() {
  if (
    !confirm(
      "Bạn có chắc muốn xóa TẤT CẢ hoạt động?\n\nHành động này không thể phục hồi!"
    )
  ) {
    return;
  }

  const currentCsrfToken = getCSRFToken();
  if (!currentCsrfToken) {
    showDjangoMessage(
      "Lỗi: Không tìm thấy CSRF token. Vui lòng tải lại trang.",
      "error"
    );
    return;
  }

  const formData = new FormData();
  formData.append("action", "delete_all");

  fetch(window.location.pathname, {
    method: "POST",
    headers: { "X-CSRFToken": currentCsrfToken },
    body: formData,
  })
    .then((response) => {
      if (response.redirected) {
        window.location.href = response.url;
      } else {
        location.reload();
      }
    })
    .catch((error) => {
      console.error("Lỗi khi xóa toàn bộ:", error);
      showDjangoMessage("Lỗi: " + error.message, "error");
    });
}

// Sự kiện khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", function () {
  // Chèn style cho thông báo nếu chưa có
  if (!document.querySelector("#message-container-style")) {
    const style = document.createElement("style");
    style.id = "message-container-style";
    style.textContent = `
            .message-container {
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 9999;
                min-width: 300px;
            }
            .custom-alert {
                border-radius: 12px;
                border: 1px solid var(--border-color);
                box-shadow: var(--shadow-lg);
                background: var(--bg-card);
                color: var(--text-primary);
                margin-bottom: 10px;
            }
            .custom-alert .btn-close {
                filter: invert(1);
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(-20px); }
            }
        `;
    document.head.appendChild(style);
  }

  // Lấy các phần tử cần thiết
  const activitiesTable = document.querySelector(".activities-table");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
  const deleteAllBtn = document.getElementById("deleteAllBtn");
  const modal = document.getElementById("activityDetailsModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const resetFilterBtn = document.getElementById("resetFilterBtn");

  // EVENT: Click trên bảng
  if (activitiesTable) {
    activitiesTable.addEventListener("click", function (e) {
      // Xử lý click trên checkbox
      if (e.target.classList.contains("activity-checkbox")) {
        e.stopPropagation();
        const activityId = e.target.dataset.id;

        if (e.target.classList.contains("checked")) {
          e.target.classList.remove("checked");
          selectedActivities.delete(activityId);
        } else {
          e.target.classList.add("checked");
          selectedActivities.add(activityId);
        }

        updateSelectedCount();
        updateSelectAllCheckbox();
        return;
      }

      // Xử lý click trên nút xem chi tiết
      if (e.target.closest(".view-details-btn")) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest(".view-details-btn");
        const activityId = button.dataset.activityId;
        if (activityId) showActivityDetails(activityId);
        return;
      }

      // Xử lý click trên nút xóa
      if (e.target.closest(".delete-activity-btn")) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest(".delete-activity-btn");
        const activityId = button.dataset.activityId;
        if (activityId) deleteActivity(activityId);
        return;
      }

      // Xử lý click trên hàng
      const row = e.target.closest(".table-row");
      if (
        row &&
        !e.target.closest(".action-buttons") &&
        !e.target.closest(".checkbox-cell")
      ) {
        const activityId = row.dataset.activityId;
        if (activityId && !e.target.classList.contains("activity-checkbox")) {
          showActivityDetails(activityId);
        }
      }
    });
  }

  // EVENT: Chọn tất cả
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("click", function (e) {
      e.stopPropagation();
      const checkboxes = document.querySelectorAll(".activity-checkbox");
      const isCurrentlyChecked = this.classList.contains("checked");

      checkboxes.forEach((cb) => {
        const activityId = cb.dataset.id;
        if (isCurrentlyChecked) {
          cb.classList.remove("checked");
          selectedActivities.delete(activityId);
        } else {
          cb.classList.add("checked");
          selectedActivities.add(activityId);
        }
      });

      this.classList.toggle("checked");
      updateSelectedCount();
    });
  }

  // EVENT: Xóa đã chọn
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      deleteSelectedActivities();
    });
  }

  // EVENT: Xóa tất cả
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      deleteAllActivities();
    });
  }

  // EVENT: Đóng modal
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (modal) modal.classList.remove("active");
    });
  }

  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === this) this.classList.remove("active");
    });
  }

  // EVENT: Phím Escape đóng modal
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      modal.classList.remove("active");
    }
  });

  //Sự kiện cho bộ lọc
  const filterSelects = document.querySelectorAll(".filter-select");
  filterSelects.forEach((select) => {
    select.addEventListener("change", function () {
      document.getElementById("filterForm").submit();
    });
  });

  // Sự kiện cho nút đặt lại bộ lọc
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", function (e) {
      e.preventDefault();
      // Reset tất cả select về giá trị mặc định
      filterSelects.forEach((select) => {
        select.value = "";
      });
      // Submit form
      document.getElementById("filterForm").submit();
    });
  }
});
