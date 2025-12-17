class SecureMediaApp {
    constructor() {
        this.sidebarHoverTimer = null;
        this.isThemeChanging = false;
        this.currentTheme = this.getInitialTheme(); // Lấy theme ban đầu
        this.init();
    }

    //1. Khởi tạo và cấu hình chính
    //===============================

    // Khởi tạo tất cả các chức năng của ứng dụng //
    init() {
        this.setupTheme();
        this.setupSidebar();
        this.setupHeader();
        this.setupEncryptionCards(); 
        this.setupEventListeners();  
        this.setupUIComponents();
        this.animateStats();
        this.setupThemeToggle(); 
        this.setupStorageEventListener(); 
    }

    //Lấy theme ban đầu - ưu tiên sessionStorage //
    getInitialTheme() {
        // Ưu tiên sessionStorage
        const sessionTheme = sessionStorage.getItem('theme');
        if (sessionTheme) {
            return sessionTheme;
        }
        // kiểm tra localStorage 
        const localTheme = localStorage.getItem('theme');
        if (localTheme) {
            return localTheme;
        }
        // Mặc định
        return 'dark';
    }

    //2. Quản lý Theme (Dark/Light)
    //===============================

    setupTheme() {
        const isAuthenticated = document.body.getAttribute('data-user-authenticated') === 'true';
        
        // Áp dụng theme đã được xác định
        this.applyTheme(this.currentTheme, false);
        
        // Thiết lập sự kiện click cho nút chuyển đổi theme
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                if (this.isThemeChanging) return;
                const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
                this.switchTheme(newTheme, isAuthenticated);
            });
        }
    }

    // Chuyển đổi theme và lưu trữ //
    switchTheme(newTheme, isAuthenticated) {
        this.applyTheme(newTheme);
        
        // Lưu vào sessionStorage (cho tab hiện tại)
        sessionStorage.setItem('theme', newTheme);
        
        // Lưu vào localStorage (cho toàn bộ trình duyệt)
        localStorage.setItem('theme', newTheme);
        
        // Lưu preference nếu user đã đăng nhập
        if (isAuthenticated) {
            this.saveUserTheme(newTheme);
        }
        this.currentTheme = newTheme;
    }

    // Áp dụng theme mới cho ứng dụng //
    applyTheme(theme, saveToStorage = true) {
        this.isThemeChanging = true;
        // Tạm thời vô hiệu hóa transitions để chuyển đổi mượt mà
        this.disableTransitions();
        
        // Áp dụng theme ngay lập tức
        document.documentElement.setAttribute('data-theme', theme);
        
        // Cập nhật icon toggle
        this.updateThemeToggleIcon(theme);
        
        // Khôi phục transitions sau khi chuyển đổi
        setTimeout(() => {
            this.enableTransitions();
            this.isThemeChanging = false;
        }, 50);
    }

    // Cập nhật icon cho nút chuyển đổi theme //
    updateThemeToggleIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
            themeToggle.title = theme === 'dark' ? 'Chuyển sang theme sáng' : 'Chuyển sang theme tối';
            // Hiệu ứng click
            themeToggle.style.transform = 'scale(0.95)';
            setTimeout(() => { themeToggle.style.transform = 'scale(1)'; }, 100);
        }
        // Cập nhật tất cả theme 
        const dropdownThemeToggles = document.querySelectorAll('.header-menu-link.btn-theme-toggle i');
        dropdownThemeToggles.forEach(icon => {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        });
    }

    // Thiết lập listener cho storage events - đồng bộ giữa các tab //
    setupStorageEventListener() {
        window.addEventListener('storage', (e) => {
            // Chỉ xử lý sự kiện thay đổi theme
            if (e.key === 'theme' && e.newValue && e.newValue !== this.currentTheme) {
                // Chỉ đồng bộ nếu theme thực sự thay đổi
                if (e.newValue === 'dark' || e.newValue === 'light') {
                    this.applyTheme(e.newValue, false);
                    this.currentTheme = e.newValue;
                    console.log('Theme synchronized from other tab:', e.newValue);
                }
            }
        });
    }

    //Tạm thời vô hiệu hóa tất cả CSS transition//
    disableTransitions() {
        const style = document.createElement('style');
        style.id = 'disable-transitions';
        style.textContent = `* { transition: none !important; animation: none !important; }`;
        document.head.appendChild(style);
    }

    //Khôi phục CSS transitions
    enableTransitions() {
        const style = document.getElementById('disable-transitions');
        if (style) style.remove();
    }
    
    //Lưu theme của người dùng
    saveUserTheme(theme) {
        localStorage.setItem('theme', theme);
        // Đồng bộ lên server (async)
        setTimeout(() => {
            this.saveThemeToServer(theme);
        }, 100);
    }

    // Lưu theme preference lên server
    async saveThemeToServer(theme) {
    try {
        const response = await fetch('/api/user/preferences/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCSRFToken(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ 
                theme: theme,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        if (data.success) {
            console.log('Theme đã lưu:', data.message);
        } else {
            throw new Error(data.error || 'Lỗi lưu theme không xác định');
        }
        
    } catch (error) {
        console.error('Lỗi lưu theme lên server', error);
        // Fallback: chỉ lưu local nếu server fail
        console.warn('Chỉ lưu theme cục bộ do lỗi server');
    }
}

    //Thiết lập theme toggle cho trang login
    setupThemeToggle() {
        const themeToggleLogin = document.getElementById('themeToggleLogin');
        if (themeToggleLogin) {
            themeToggleLogin.addEventListener('click', () => {
                if (this.isThemeChanging) return;
                const isAuthenticated = document.body.getAttribute('data-user-authenticated') === 'true';
                const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
                this.switchTheme(newTheme, isAuthenticated);
            });
        }
    }

    //3. Quản lý Sidebar
    //===============================

    // Thiết lập behavior cho sidebar
    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarToggleMobile = document.getElementById('sidebarToggleMobile');
        // Auto-collapse khi hover
        if (sidebar) {
            sidebar.addEventListener('mouseenter', () => {
                this.clearSidebarTimer();
                if (sidebar.classList.contains('collapsed')) {
                    sidebar.classList.remove('collapsed');
                }
            });
            sidebar.addEventListener('mouseleave', () => {
                this.startSidebarTimer();
            });
        }
        // Toggle thủ công
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('collapsed');
                this.clearSidebarTimer();
            });
        }
        // Toggle mobile
        if (sidebarToggleMobile) {
            sidebarToggleMobile.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
        }
        // Đóng sidebar khi click outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                sidebar && 
                sidebarToggleMobile && // THÊM KIỂM TRA NÀY
                !sidebar.contains(e.target) && 
                !sidebarToggleMobile.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        });
        // Khởi tạo Bootstrap collapse cho menu items
        this.setupSidebarCollapses();
    }

    // Thiết lập collapse behavior cho sidebar menu
    setupSidebarCollapses() {
        const collapses = document.querySelectorAll('.collapse');
        collapses.forEach(collapse => {
            collapse.addEventListener('show.bs.collapse', () => {
                const arrow = collapse.previousElementSibling?.querySelector('.arrow');
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            });
            
            collapse.addEventListener('hide.bs.collapse', () => {
                const arrow = collapse.previousElementSibling?.querySelector('.arrow');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            });
        });
    }

    // Bắt đầu timer cho auto-collapse sidebar
    startSidebarTimer() {
        this.clearSidebarTimer();
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('collapsed') && window.innerWidth > 768) {
            this.sidebarHoverTimer = setTimeout(() => {
                sidebar.classList.add('collapsed');
            }, 1000); // 1 giây delay
        }
    }

    // Xóa sidebar auto-collapse timer
    clearSidebarTimer() {
        if (this.sidebarHoverTimer) {
            clearTimeout(this.sidebarHoverTimer);
            this.sidebarHoverTimer = null;
        }
    }

    //Ngăn sidebar auto-collapse khi tương tác với menu
    preventSidebarAutoCollapse() {
        document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', () => this.clearSidebarTimer());
        });

        document.querySelectorAll('.nav-submenu').forEach(submenu => {
            submenu.addEventListener('mouseenter', () => this.clearSidebarTimer());
        });
    }

    //4. Quản lý Header
    //===============================

    //Thiết lập behavior cho header và dropdown menu
    setupHeader() {
        const headerMenuToggle = document.getElementById('headerMenuToggle');
        const headerDropdownMenu = document.getElementById('headerDropdownMenu');
        const header = document.querySelector('.main-header');
        // Toggle dropdown menu
        if (headerMenuToggle) {
            headerMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                header.classList.toggle('header-menu-open');
            });
        }
        // Đóng dropdown khi click outside
        document.addEventListener('click', (e) => {
            if (header && 
                !header.contains(e.target) && 
                !e.target.closest('.header-dropdown-menu')) {
                header.classList.remove('header-menu-open');
            }
        });
        // Xử lý click trên menu items
        this.setupHeaderMenuItems(header);
        // Ngăn sự kiện click trên dropdown lan ra ngoài
        if (headerDropdownMenu) {
            headerDropdownMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    //Thiết lập sự kiện cho các menu items trong header
    setupHeaderMenuItems(header) {
        document.querySelectorAll('.header-menu-link').forEach(link => {
            if (!link.classList.contains('btn-theme-toggle')) {
                // Đóng dropdown khi click menu item thông thường
                link.addEventListener('click', () => {
                    header.classList.remove('header-menu-open');
                });
            } else {
                // Xử lý theme toggle trong dropdown
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this.isThemeChanging) return;
                    const isAuthenticated = document.body.getAttribute('data-user-authenticated') === 'true';
                    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
                    this.switchTheme(newTheme, isAuthenticated);
                    header.classList.remove('header-menu-open');
                });
            }
        });
    }

    //5. Quản lý encryption và tab
    //===============================

    //Thiết lập tabs cho encryption cards
    setupEncryptionCards() {
        const tabs = document.querySelectorAll('.encryption-tab');
        const cardContents = document.querySelectorAll('.encryption-card-content');
        const badges = document.querySelectorAll('.security-badge');
        // Kích hoạt tab theo ID
        const activateTab = (tabId) => {
            // Remove active class từ tất cả elements
            tabs.forEach(t => t.classList.remove('active'));
            cardContents.forEach(card => card.classList.remove('active'));
            badges.forEach(badge => badge.classList.remove('active'));
            // Add active class đến target elements
            const targetTab = document.querySelector(`.encryption-tab[data-tab="${tabId}"]`);
            const targetCard = document.getElementById(`${tabId}-card`);
            const targetBadge = document.querySelector(`.security-badge[data-tab="${tabId}"]`);
            if (targetTab) targetTab.classList.add('active');
            if (targetCard) targetCard.classList.add('active');
            if (targetBadge) targetBadge.classList.add('active');
        };
        // Sự kiện click cho tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                activateTab(targetTab);
            });
        });
        // Sự kiện click cho badges
        badges.forEach(badge => {
            badge.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                activateTab(targetTab);
            });
        });
        // Auto-rotate tabs mỗi 5 giây
        this.startTabAutoRotation(['aes', 'zero', 'client'], activateTab);
    }

    //Tự động chuyển đổi giữa các tabs
    startTabAutoRotation(tabIds, activateTab) {
        let currentTabIndex = 0;
        
        setInterval(() => {
            currentTabIndex = (currentTabIndex + 1) % tabIds.length;
            activateTab(tabIds[currentTabIndex]);
        }, 5000);
    }

    //6. Event Listeners và UI Components
    //===============================

    //Thiết lập các event listeners chung
    setupEventListeners() {
        // Smooth scrolling cho anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
        // Xử lý loading state cho forms
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) this.showLoadingState(submitBtn);
            });
        });
        // Ngăn auto-collapse sidebar khi tương tác với dropdowns
        this.preventSidebarAutoCollapse();
    }

    //Khởi tạo các UI components*/
    setupUIComponents() {
        // Bootstrap tooltips
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
        // Auto-dismiss alerts
        this.setupAutoDismissAlerts();
        // Active states cho navigation
        this.setupActiveStates();
    }

    //Thiết lập auto-dismiss cho alerts
    setupAutoDismissAlerts() {
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => {
            setTimeout(() => {
                if (alert.parentNode) {
                    const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
                    bsAlert.close();
                }
            }, 5000);
        });
    }

    //Thiết lập active states cho navigation links
    setupActiveStates() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link, .submenu-link');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPath || (currentPath === '/' && href === '/')) {
                link.classList.add('active');
                // Mở rộng parent section cho submenu links
                const submenu = link.closest('.nav-submenu');
                if (submenu) {
                    const collapse = new bootstrap.Collapse(submenu);
                    collapse.show();
                }
            }
        });
    }

    //7. Hiệu ứng và tiện ích bổ sung
    //===============================

    //Khởi tạo animation cho statistics counters
    animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.startCounting(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        statNumbers.forEach(stat => observer.observe(stat));
    }

    //Bắt đầu counting animation
    startCounting(element) {
        const target = parseInt(element.getAttribute('data-count'));
        const duration = 2000; // 2 giây
        const step = target / (duration / 16); // 60fps
        let current = 0;
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current) + (element.textContent.includes('%') ? '%' : '');
        }, 16);
    }

    //Hiển thị trạng thái loading cho button
    showLoadingState(button) {
        const originalText = button.innerHTML;
        button.disabled = true;
        button.classList.add('loading');
        // Safety: Tự động re-enable sau 10 giây
        setTimeout(() => {
            button.disabled = false;
            button.classList.remove('loading');
            button.innerHTML = originalText;
        }, 10000);
    }

    //8. Tiện ích chung
    //===============================

    //Lấy CSRF token từ cookies
    getCSRFToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return cookieValue || '';
    }

    // Hiển thị notification
    static showNotification(message, type = 'info') {
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${alertClass} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        const container = document.querySelector('.container') || document.body;
        container.prepend(alertDiv);
        // Auto-dismiss sau 5 giây
        setTimeout(() => {
            if (alertDiv.parentNode) {
                const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                bsAlert.close();
            }
        }, 5000);
    }

    //Định dạng kích thước file
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

//9. Khởi tạo ứng dụng khi DOM đã sẵn sàng
//===============================

// Khởi tạo ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SecureMediaApp();
});

//Xử lý window resize
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('collapsed');
    }
});
