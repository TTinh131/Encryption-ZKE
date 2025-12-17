from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone

class CustomUserManager(BaseUserManager):
    # Quản lý tạo người dùng tùy chỉnh
    def create_user(self, username, email, password=None, **extra_fields):
        """Tạo và lưu người dùng thường với username, email và mật khẩu"""
        if not email:
            raise ValueError('Email phải được thiết lập')
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        """Tạo và lưu superuser với username, email và mật khẩu"""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Cần quyền quản trị viên is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Cần quyền quản trị viên is_superuser=True")
        return self.create_user(username, email, password, **extra_fields)
class CustomUser(AbstractBaseUser, PermissionsMixin):
    """
    Model người dùng tùy chỉnh kế thừa AbstractBaseUser
    Thay thế model User mặc định của Django để xác thực tùy chỉnh
    """
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    password = models.CharField(max_length=128) # Độ dài 128 char là của bcrypt/sha256
                                                # Django mặc định sử dụng PBKDF2 với SHA256:
                                                # Format lưu trữ trong database: pbkdf2_sha256$1000000$salt$hashed_password
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    joined_at = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)
    theme = models.CharField(max_length=20, default='dark')
    two_factor_enabled = models.BooleanField(default=False)
    objects = CustomUserManager()
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username

class UserFile(models.Model):
    FILE_TYPES = [
        ('image', 'Hình ảnh'),
        ('audio', 'Âm thanh'),
        ('document', 'Tài liệu'),
        ('encrypted', 'File mã hóa'),
        ('stego', 'File chứa tin ẩn'),
        ('other', 'Khác'),
    ]
    
    FILE_SOURCES = [
        ('other', 'File khác'),
        ('encrypted', 'File mã hóa'),
        ('stego', 'File chứa tin ẩn'),
    ]
    
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    name_original = models.CharField(max_length=255)
    name_stored = models.CharField(max_length=255)
    file_type = models.CharField(max_length=15, choices=FILE_TYPES)
    file_source = models.CharField(max_length=15, choices=FILE_SOURCES, default='other')
    file_size = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    description = models.TextField(null=True, blank=True)
    activity_log = models.ForeignKey('ActivityLog', on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'user_files'
        indexes = [
            models.Index(fields=['user', 'uploaded_at']),
            models.Index(fields=['file_type', 'file_source']),
        ]

    def __str__(self):
        return f"{self.name_original} ({self.get_file_source_display()})"

class ActivityLog(models.Model):
    """
    Model lưu trữ tất cả hoạt động của người dùng: mã hóa, giải mã, giấu tin, trích xuất
    """
    ACTIVITY_TYPES = [
        ('encryption', 'Mã hóa'),
        ('decryption', 'Giải mã'),
        ('hide_data', 'Giấu tin'),
        ('extract_data', 'Trích xuất tin'),
    ]
    
    STATUS_CHOICES = [
        ('success', 'Thành công'),
        ('failed', 'Thất bại'),
        ('processing', 'Đang xử lý'),
    ]
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    session_key = models.CharField(max_length=40, null=True, blank=True)
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    input_filename = models.CharField(max_length=255)
    output_filename = models.CharField(max_length=255, null=True, blank=True)
    algorithm = models.CharField(max_length=100, null=True, blank=True)
    file_size = models.BigIntegerField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='processing')
    error_message = models.TextField(null=True, blank=True)
    execution_time = models.FloatField(null=True, blank=True)
    parameters = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'activity_logs'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['activity_type', 'status']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.get_activity_type_display()} - {self.status}"

    #phương thức để xóa dữ liệu nhạy cảm
    def clean_sensitive_data(self):
        """Xóa các thông tin nhạy cảm trong parameters"""
        if self.parameters and isinstance(self.parameters, dict):
            sensitive_keys = ['password', 'secret', 'key', 'private_key']
            for key in sensitive_keys:
                if key in self.parameters:
                    self.parameters[key] = '***ĐÃ CHỈNH SỬA***'
            self.save()

class UserSettings(models.Model):
    """Lưu cấu hình người dùng"""
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, primary_key=True)
    save_files = models.BooleanField(default=True)
    save_activities = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_settings'

    def __str__(self):
        return f"Cài đặt của {self.user.username}"