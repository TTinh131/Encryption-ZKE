// Set lưu trữ các file được chọn
let selectedFiles = new Set();

// Biến để theo dõi trạng thái download
let isDownloading = false;

// Lấy giá trị cookie theo tên
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Lấy CSRF token
function getCSRFToken() {
    let token = getCookie('csrftoken');
    if (!token) {
        const metaToken = document.querySelector('meta[name="csrf-token"]');
        if (metaToken) token = metaToken.getAttribute('content');
    }
    if (!token) {
        const inputToken = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (inputToken) token = inputToken.value;
    }
    return token;
}

// Hiển thị thông báo
function showMessage(message, type = 'info') {
    // Tạo container messages nếu chưa có
    let messageContainer = document.querySelector('.message-container');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        document.body.appendChild(messageContainer);
    }

    // Map type cho phù hợp với Bootstrap
    const alertTypeMap = {
        'success': 'success',
        'error': 'danger',
        'warning': 'warning',
        'info': 'info'
    };
    const bootstrapType = alertTypeMap[type] || 'info';

    // Map Icon tương ứng
    const iconMap = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    const icon = iconMap[type] || 'fa-info-circle';

    // Tạo alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${bootstrapType} alert-dismissible fade show custom-alert`;
    alertDiv.setAttribute('role', 'alert');
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
    alertDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Cập nhật số lượng file được chọn 
function updateSelectedCount() {
    const countElement = document.getElementById('selectedCount');
    const actionsBar = document.getElementById('actionsBar');
    
    if (countElement) {
        if (selectedFiles.size === 0) {
            countElement.textContent = '0 file được chọn';
        } else if (selectedFiles.size === 1) {
            countElement.textContent = '1 file được chọn';
        } else {
            countElement.textContent = `${selectedFiles.size} file được chọn`;
        }
    }
    
    if (actionsBar) {
        actionsBar.style.display = selectedFiles.size > 0 ? 'flex' : 'none';
    }
}


// Cập nhật trạng thái checkbox "Chọn tất cả"
function updateSelectAllCheckbox() {
    const selectAll = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.file-checkbox');
    
    if (!selectAll || checkboxes.length === 0) return;
    
    const checkedCount = Array.from(checkboxes).filter(cb => cb.classList.contains('checked')).length;
    const totalCount = checkboxes.length;
    
    if (checkedCount === totalCount && totalCount > 0) {
        selectAll.classList.add('checked');
        selectAll.setAttribute('data-state', 'all');
    } else if (checkedCount > 0 && checkedCount < totalCount) {
        selectAll.classList.add('checked');
        selectAll.setAttribute('data-state', 'partial');
        selectAll.style.opacity = '0.6';
    } else {
        selectAll.classList.remove('checked');
        selectAll.setAttribute('data-state', 'none');
        selectAll.style.opacity = '1';
    }
}

// Xử lý download một file duy nhất
function handleSingleFileDownload(e, fileId = null) {
    e.preventDefault();
    e.stopPropagation();
    
    // Nếu có truyền fileId, sử dụng nó, nếu không tìm từ data attribute
    if (!fileId) {
        const button = e.target.closest('.download-file-btn, #downloadFromModal');
        if (!button) return;
        
        fileId = button.dataset.fileId || 
                 button.closest('[data-file-id]')?.dataset.fileId;
    }
    
    if (!fileId) {
        showMessage('Không tìm thấy ID file', 'error');
        return;
    }
    
    // Tạo URL download với timestamp để tránh cache
    const timestamp = new Date().getTime();
    const downloadUrl = `/files/download/${fileId}/?_=${timestamp}`;
    
    // Tạo link ẩn và kích hoạt download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage('Đang tải file...', 'info');
}

// Định dạng chi tiết file thành HTML
function formatFileDetails(data) {
    // Hàm định dạng ngày tháng
    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
        } catch (e) {
            return dateString || 'Không có';
        }
    };

    // Hàm định dạng kích thước file
    const formatFileSize = (bytes) => {
        if (!bytes && bytes !== 0) return 'Không có';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Tạo HTML chi tiết
    let html = `
        <div class="detail-item">
            <span class="detail-label">ID:</span>
            <span class="detail-value">#${data.id || 'N/A'}</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Tên file gốc:</span>
            <span class="detail-value">${data.name_original || 'Không có'}</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Tên file lưu trữ:</span>
            <span class="detail-value">
                ${(data.name_stored || '').split('/').pop() || 'Không có'}
            </span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Loại file:</span>
            <span class="detail-value">${getFileTypeDisplay(data.file_type)}</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Nguồn file:</span>
            <span class="detail-value">${getFileSourceDisplay(data.file_source)}</span>
        </div>
        
        <div class="detail-item">
            <span class="detail-label">Kích thước:</span>
            <span class="detail-value">${formatFileSize(data.file_size)}</span>
        </div>`;
    
    if (data.description) {
        html += `
        <div class="detail-item">
            <span class="detail-label">Mô tả:</span>
            <span class="detail-value">${data.description}</span>
        </div>`;
    }
    
    html += `
        <div class="detail-item">
            <span class="detail-label">Ngày upload:</span>
            <span class="detail-value">${formatDate(data.uploaded_at)}</span>
        </div>`;
    return html;
}


// Hiển thị modal chi tiết file
function showFileDetails(fileId) {
    const modal = document.getElementById('fileDetailsModal');
    const content = document.getElementById('fileDetailsContent');
    const downloadBtn = document.getElementById('downloadFromModal');
    
    if (!modal || !content) {
        showMessage('Lỗi: Không thể mở modal chi tiết', 'error');
        return;
    }
    
    // Hiển thị loading
    content.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="spinner-border text-primary"></div>
            <p>Đang tải chi tiết...</p>
        </div>
    `;
    
    // Cập nhật nút download
    if (downloadBtn) {
        // Xóa các sự kiện cũ trước khi thêm mới
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
        
        // Thêm sự kiện click
        newDownloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleSingleFileDownload(e, fileId);
        });
        // Cũng có thể thêm data attribute để hàm handleSingleFileDownload nhận diện
        newDownloadBtn.setAttribute('data-file-id', fileId);
    }
    // Hiện modal
    modal.classList.add('active');
    // Gọi API lấy chi tiết
    fetch(`/api/file/${fileId}/details/`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${data.error}
                </div>
            `;
        } else {
            content.innerHTML = formatFileDetails(data);
            // Cập nhật lại nút download với fileId
            const downloadBtn = document.getElementById('downloadFromModal');
            if (downloadBtn) {
                downloadBtn.setAttribute('data-file-id', fileId);
                downloadBtn.style.display = 'inline-flex';
            }
        }
    })
    .catch(error => {
        console.error('Lỗi khi tải chi tiết file:', error);
        content.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Không thể tải chi tiết: ${error.message}
            </div>
        `;
    });
}

// Xóa một file
function deleteFile(fileId, fileName = '') {
    const message = fileName 
        ? `Bạn có chắc muốn xóa file "${fileName}"?` 
        : 'Bạn có chắc muốn xóa file này?';
    if (!confirm(message + '\n\nHành động này không thể phục hồi.')) {
        return;
    }
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        showMessage('Lỗi: Không tìm thấy CSRF token. Vui lòng tải lại trang.', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file_id', fileId);
    // Gọi API xóa
    fetch('/api/file/delete/', {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage('Đã xóa file thành công!', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showMessage('Lỗi: ' + (data.error || 'Không thể xóa file'), 'error');
        }
    })
    .catch(error => {
        console.error('Lỗi xóa:', error);
        showMessage('Lỗi kết nối: ' + error.message, 'error');
    });
}

// Xóa các file đã chọn
function deleteSelectedFiles() {
    if (selectedFiles.size === 0) {
        showMessage('Vui lòng chọn ít nhất một file để xóa', 'warning');
        return;
    }
    
    const msg = selectedFiles.size === 1 
        ? 'Bạn có chắc muốn xóa 1 file đã chọn?' 
        : `Bạn có chắc muốn xóa ${selectedFiles.size} file đã chọn?`;
    
    if (!confirm(msg + '\n\nHành động này không thể phục hồi.')) {
        return;
    }
    
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        showMessage('Lỗi: Không tìm thấy CSRF token. Vui lòng tải lại trang.', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('action', 'delete_selected');
    selectedFiles.forEach(id => formData.append('selected_files', id));
    
    fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
        body: formData
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            return response.json().then(data => {
                if (data && data.success) {
                    showMessage('Đã xóa các file đã chọn thành công!', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    showMessage(data?.error || 'Lỗi khi xóa', 'error');
                }
            });
        }
    })
    .catch(error => {
        console.error('Lỗi khi xóa số lượng lớn:', error);
        showMessage('Lỗi: ' + error.message, 'error');
    });
}

// Tải về các file đã chọn (ZIP)
function downloadSelectedFiles() {
    // Kiểm tra nếu đang trong quá trình download
    if (isDownloading) {
        showMessage('Đang xử lý download... Vui lòng đợi', 'warning');
        return;
    }
    
    if (selectedFiles.size === 0) {
        showMessage('Vui lòng chọn ít nhất một file để tải về', 'warning');
        return;
    }
    
    const msg = selectedFiles.size === 1 
        ? 'Bạn có chắc muốn tải về 1 file đã chọn?' 
        : `Bạn có chắc muốn tải về ${selectedFiles.size} file đã chọn?`;
    
    if (!confirm(msg + '\n\nFile sẽ được tải về dưới dạng ZIP.')) {
        return;
    }
    
    // Đánh dấu đang download
    isDownloading = true;
    
    // Disable nút download
    const downloadBtn = document.getElementById('downloadSelectedBtn');
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Đang xử lý...';
    downloadBtn.disabled = true;
    
    // Tạo URL với các file IDs
    const fileIds = Array.from(selectedFiles).join(',');
    const timestamp = new Date().getTime();
    
    // Sử dụng URL trực tiếp với GET request
    const downloadUrl = `/file-management/download-zip/?file_ids=${fileIds}&_=${timestamp}`;
    
    // Tạo link ẩn và kích hoạt download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'securemedia_files.zip';
    link.style.display = 'none';
    
    // Thêm sự kiện để biết khi nào download hoàn tất
    link.onclick = function() {
        // Đặt timeout để reset trạng thái
        setTimeout(() => {
            isDownloading = false;
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
            // Xóa các file đã chọn sau khi download
            selectedFiles.clear();
            updateSelectedCount();
            updateSelectAllCheckbox();
        }, 2000); // Delay 2 giây để đảm bảo download bắt đầu
    };
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage('Đang tạo file ZIP...', 'info');
}


// Hàm hiển thị modal với thông báo lỗi
function showModalWithError(fileName, errorMessage) {
    const modal = document.getElementById('processFileModal');
    const modalTitle = document.getElementById('processModalTitle');
    const modalContent = document.getElementById('processFileContent');
    const confirmBtn = document.getElementById('confirmProcessBtn');
    const cancelBtn = document.getElementById('cancelProcessBtn');
    
    modalTitle.textContent = 'Không thể xử lý file';
    modalContent.innerHTML = `
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Lỗi khi xử lý file "${fileName}"</strong>
            <p class="mt-2">${errorMessage}</p>
        </div>
        <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            Vui lòng thực hiện mã hóa/giải mã lại file bằng phương pháp tương ứng.
        </div>
    `;
    
    // Ẩn nút tiếp tục, chỉ hiển thị nút đóng
    confirmBtn.style.display = 'none';
    cancelBtn.textContent = 'Đóng';
    cancelBtn.className = 'btn-action btn-danger';
    
    cancelBtn.onclick = function(e) {
        e.preventDefault();
        modal.classList.remove('active');
        // Reset lại nút
        setTimeout(() => {
            confirmBtn.style.display = 'inline-block';
            cancelBtn.textContent = 'Hủy';
            cancelBtn.className = 'btn-action';
            modalContent.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Đang chuẩn bị dữ liệu...</p>
                </div>
            `;
        }, 300);
    };
    modal.classList.add('active');
}

// lấy dữ liệu tự động điền
function getAutoFillData(fileId, action) {
    return fetch(`/api/file/${fileId}/auto-fill-data/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data;
            } else {
                throw new Error(data.error || 'Không thể lấy dữ liệu tự động điền');
            }
        });
}

// Xử lý khi nhấn nút giải mã
document.querySelectorAll('.decrypt-file-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const fileId = this.dataset.fileId;
        const fileName = this.dataset.fileName;
        try {
            // Lấy dữ liệu tự động điền
            const response = await fetch(`/api/file/${fileId}/auto-fill-data/`);
            const data = await response.json();
            
            // Kiểm tra lỗi
            if (!data.success) {
                showModalWithError(fileName, data.error || 'Không thể xử lý file');
                return;
            }
            
            const formData = data.form_data;
            const fileData = data.file_data;
            
            // Hiển thị modal với thông tin chi tiết
            const modal = document.getElementById('processFileModal');
            const modalTitle = document.getElementById('processModalTitle');
            const modalContent = document.getElementById('processFileContent');
            const confirmBtn = document.getElementById('confirmProcessBtn');
            const cancelBtn = document.getElementById('cancelProcessBtn');
            
            modalTitle.textContent = 'Giải mã file';
            
            // Tạo nội dung modal với thông tin tự động điền
            let contentHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    <strong>Đã tìm thấy file và có thể tự động điền thông tin</strong>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tên file:</span>
                    <span class="detail-value">${fileName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Loại file:</span>
                    <span class="detail-value">${getFileTypeDisplay(formData.file_type)}</span>
                </div>`;
            
            // Thêm thông tin thuật toán nếu có
            if (formData.algorithm) {
                contentHTML += `
                <div class="detail-item">
                    <span class="detail-label">Thuật toán:</span>
                    <span class="detail-value">${formData.algorithm}</span>
                </div>`;
            }
            
            // Thêm thông tin từ parameters nếu có
            if (formData.parameters) {
                contentHTML += `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Thông tin sẽ được điền tự động:</strong>
                    <div class="mt-2 small">
                `;
                
                for (const [key, value] of Object.entries(formData.parameters)) {
                    contentHTML += `<div>• ${key}: ${value}</div>`;
                }
                contentHTML += `</div></div>`;
            }
            
            contentHTML += `
                <div class="alert alert-warning mt-3">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Bạn sẽ được chuyển đến trang giải mã với các thông tin đã điền sẵn.
                    Vui lòng kiểm tra và nhập mật khẩu nếu cần.
                </div>`;
            
            modalContent.innerHTML = contentHTML;
            
            // Tạo URL chuyển hướng với tất cả thông tin cần thiết
            let redirectUrl = `/decrypt/?file_id=${fileId}&auto_fill=true`;
            if (formData.algorithm) {
                redirectUrl += `&algorithm=${encodeURIComponent(formData.algorithm)}`;
            }
            if (formData.file_type) {
                redirectUrl += `&file_type=${encodeURIComponent(formData.file_type)}`;
            }
            
            confirmBtn.href = redirectUrl;
            confirmBtn.style.display = 'inline-block';
            cancelBtn.textContent = 'Hủy';
            cancelBtn.className = 'btn-action';
            
            modal.classList.add('active');
            
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu tự động điền:', error);
            showModalWithError(fileName, `Lỗi hệ thống: ${error.message}`);
        }
    });
});

//  Xử lý khi nhấn nút trích xuất
document.querySelectorAll('.extract-file-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
        e.preventDefault();
        const fileId = this.dataset.fileId;
        const fileName = this.dataset.fileName;
        
        try {
            const autoFillData = await getAutoFillData(fileId, 'extract');
            const formData = autoFillData.form_data;
            
            const modal = document.getElementById('processFileModal');
            const modalTitle = document.getElementById('processModalTitle');
            const modalContent = document.getElementById('processFileContent');
            const confirmBtn = document.getElementById('confirmProcessBtn');
            
            modalTitle.textContent = 'Trích xuất tin ẩn';
            
            let contentHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Thông tin file sẽ được tự động điền:</strong>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tên file:</span>
                    <span class="detail-value">${fileName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Loại file:</span>
                    <span class="detail-value">${getFileTypeDisplay(formData.file_type)}</span>
                </div>`;
            
            if (formData.algorithm) {
                contentHTML += `
                <div class="detail-item">
                    <span class="detail-label">Thuật toán:</span>
                    <span class="detail-value">${formData.algorithm}</span>
                </div>`;
            }
            
            if (formData.parameters) {
                contentHTML += `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Thông tin sẽ được điền tự động:</strong>
                    <div class="mt-2 small">
                `;
                
                for (const [key, value] of Object.entries(formData.parameters)) {
                    contentHTML += `<div>• ${key}: ${value}</div>`;
                }
                
                contentHTML += `</div></div>`;
            }
            
            contentHTML += `
                <div class="alert alert-warning mt-3">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Bạn sẽ được chuyển đến trang trích xuất với các thông tin đã điền sẵn.
                    Vui lòng kiểm tra và nhập mật khẩu nếu cần.
                </div>`;
            
            modalContent.innerHTML = contentHTML;
            
            if (autoFillData.redirect_url) {
                confirmBtn.href = autoFillData.redirect_url;
            } else {
                confirmBtn.href = `/extract/?file_id=${fileId}&auto_fill=true`;
            }
            
            modal.classList.add('active');
            
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu tự động điền:', error);
            showMessage(`Lỗi: ${error.message}`, 'error');
        }
    });
});

// Sự kiện khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", function() {
    // Chèn style cho thông báo nếu chưa có
    if (!document.querySelector('#message-container-style')) {
        const style = document.createElement('style');
        style.id = 'message-container-style';
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
        `;
        document.head.appendChild(style);
    }
    
    // Thêm sự kiện cho nút download đơn
    document.addEventListener('click', function(e) {
        if (e.target.closest('.download-file-btn')) {
            handleSingleFileDownload(e);
        }
    });

    // Thêm sự kiện cho nút download trong modal
    document.addEventListener('click', function(e) {
        if (e.target.closest('#downloadFromModal') || 
            e.target.id === 'downloadFromModal') {
            const fileId = e.target.closest('#downloadFromModal')?.dataset.fileId;
            if (fileId) {
                handleSingleFileDownload(e, fileId);
            }
        }
    });

    // Lấy các phần tử cần thiết
    const filesTable = document.querySelector('.files-table');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const modal = document.getElementById('fileDetailsModal');
    const closeModalBtn = document.getElementById('closeFileModalBtn');
    const closeModalBtn2 = document.getElementById('closeModalBtn');
    
    // Click trên bảng
    if (filesTable) {
        filesTable.addEventListener('click', function(e) {
            // Xử lý click trên checkbox
            if (e.target.classList.contains('file-checkbox')) {
                e.stopPropagation();
                const fileId = e.target.dataset.id;
                
                if (e.target.classList.contains('checked')) {
                    e.target.classList.remove('checked');
                    selectedFiles.delete(fileId);
                } else {
                    e.target.classList.add('checked');
                    selectedFiles.add(fileId);
                }
                
                updateSelectedCount();
                updateSelectAllCheckbox();
                return;
            }
            
            // Xử lý click trên nút xem chi tiết
            if (e.target.closest('.view-file-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const button = e.target.closest('.view-file-btn');
                const fileId = button.dataset.fileId;
                if (fileId) showFileDetails(fileId);
                return;
            }
            
            // Xử lý click trên nút xóa
            if (e.target.closest('.delete-file-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const button = e.target.closest('.delete-file-btn');
                const fileId = button.dataset.fileId;
                const row = button.closest('.table-row');
                const fileName = row?.querySelector('.file-name-cell strong')?.textContent || '';
                if (fileId) deleteFile(fileId, fileName);
                return;
            }
            
            // Xử lý click trên nút tải về (đơn)
            if (e.target.closest('.download-file-btn')) {
                return;
            }
            
            // Xử lý click trên hàng
            const row = e.target.closest('.table-row');
            if (row && !e.target.closest('.action-buttons') && !e.target.closest('.checkbox-cell')) {
                const fileId = row.dataset.fileId;
                if (fileId && !e.target.classList.contains('file-checkbox')) {
                    showFileDetails(fileId);
                }
            }
        });
    }
    
    // EVENT: Chọn tất cả 
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('click', function(e) {
            e.stopPropagation();
            const checkboxes = document.querySelectorAll('.file-checkbox');
            const isCurrentlyChecked = this.classList.contains('checked');
            
            checkboxes.forEach(cb => {
                const fileId = cb.dataset.id;
                if (isCurrentlyChecked) {
                    cb.classList.remove('checked');
                    selectedFiles.delete(fileId);
                } else {
                    cb.classList.add('checked');
                    selectedFiles.add(fileId);
                }
            });
            
            this.classList.toggle('checked');
            updateSelectedCount();
        });
    }
    
    // EVENT: Xóa đã chọn 
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteSelectedFiles();
        });
    }
    
    // EVENT: Tải về đã chọn
    if (downloadSelectedBtn) {
        downloadSelectedBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            downloadSelectedFiles();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (modal) modal.classList.remove('active');
        });
    }
    
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    }
    
    // EVENT: Phím Escape đóng modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });

    // Đóng modal khi nhấn ra ngoài
    document.getElementById('processFileModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });

    // Đóng modal bằng phím Escape
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('processFileModal');
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });

    // Đóng modal bằng nút đóng
    document.getElementById('closeProcessModalBtn').addEventListener('click', function() {
        document.getElementById('processFileModal').classList.remove('active');
    });
    document.getElementById('closeFileModalBtn').addEventListener('click', function() {
        document.getElementById('fileDetailsModal').classList.remove('active');
    });
});