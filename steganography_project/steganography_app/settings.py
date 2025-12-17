import os
from pathlib import Path

# 1. Đường dẫn cơ bản của dự án
BASE_DIR = Path(__file__).resolve().parent.parent

# 2. Cấu hình bảo mật và debug
SECRET_KEY = 'django-insecure-your-secret-key-here'
DEBUG = True
ALLOWED_HOSTS = []

# 3. Cài đặt ứng dụng
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Ứng dụng tùy chỉnh
    'steganography_app',
    
    # django-allauth bắt buộc
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
]

SITE_ID = 1

# 4. Cấu hình middleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    
    # Middleware tùy chỉnh
    'steganography_app.middleware.AutoLogoutMiddleware',  # Tự động đăng xuất
    'steganography_app.middleware.UserThemeMiddleware',   # Quản lý giao diện người dùng
    'steganography_app.middleware.AutoLogoutMiddleware',
    
    'allauth.account.middleware.AccountMiddleware',
]

# 5. Cấu hình URL và template
ROOT_URLCONF = 'steganography_app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'steganography_app.wsgi.application'

# 6. Cấu hình cơ sở dữ liệu
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "ct492",
        "USER": "root",
        "PASSWORD": "130104",
        "HOST": "localhost",
        "PORT": "3307",
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        }
    }
}

# 7. Cấu hình xác thực và mật khẩu
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# 8. Cấu hình thời gian
LANGUAGE_CODE = 'vi'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True # Bật tính năng quốc tế hóa
USE_L10N = True # Bật định dạng theo vùng
USE_TZ = True   # Sử dụng timezone-aware

# 9. Cấu hình tài nguyên tĩnh và media
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# 10. Xác thực người dùng 
AUTH_USER_MODEL = 'steganography_app.CustomUser'

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

# URL chuyển hướng authentication
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = 'dashboard'  # Sau khi đăng nhập
LOGOUT_REDIRECT_URL = 'home'      # Sau khi đăng xuất

# 11. Cấu hình Email 
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'tinhb2203743@student.ctu.edu.vn'
EMAIL_HOST_PASSWORD = 'kyvc qdhu qngu riin'

# Cấu hình hiển thị email
DEFAULT_FROM_EMAIL = 'SecureMedia <tinhb2203743@student.ctu.edu.vn>'
SERVER_EMAIL = 'SecureMedia <tinhb2203743@student.ctu.edu.vn>'

# 12. Bảo mật và CSRF

# Cấu hình CSRF
CSRF_COOKIE_SECURE = False  # Đặt True khi dùng HTTPS (production)
CSRF_COOKIE_HTTPONLY = True  # Bảo mật CSRF cookie
CSRF_TRUSTED_ORIGINS = []  # Thêm domain trusted trong production
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Định dạng file được phép upload
ALLOWED_FILE_TYPES = [
    'image/png', 'image/jpeg', 'image/bmp', 'image/bmp',
    'audio/wav', 'audio/mpeg', 'audio/mp3', 
    'video/mp4', 'video/avi', 'video/mkv',
    'text/plain', 'application/octet-stream',
    'application/zip', 'application/x-rar-compressed',
]


# 14. Cấu hình mặc định
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

