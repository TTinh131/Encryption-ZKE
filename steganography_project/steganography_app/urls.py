from django.urls import path
from . import views
from .encryption_views import encrypt_page, decrypt_page, process_encryption, generate_key_pair, get_encryption_history
from .steganography_views import hide_data_view, extract_data_view, process_steganography
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Trang chính
    path('', views.home_view, name='home'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    
    # Đăng ký tài khoản và xác thực mã OTP
    path('accounts/register/', views.register_view, name='register'),
    path('accounts/verify-otp/', views.verify_otp_view, name='verify_otp'),
    
    # API gửi OTP
    path('accounts/resend-otp/', views.resend_otp_view, name='resend_otp'),
    path('accounts/send-otp-api/', views.send_otp_api, name='send_otp_api'),
    path('api/user/preferences/', views.update_user_preferences, name='update_user_preferences'),
    
    # Đăng nhập/Đăng xuất
    path('accounts/login/', views.login_view, name='login'),
    path('accounts/logout/', views.logout_view, name='logout'),
    
    # Reset mật khẩu với OTP
    path('accounts/password-reset/', views.password_reset_view, name='password_reset'),
    path('accounts/password-reset-otp/', views.password_reset_otp_view, name='password_reset_otp'),
    path('accounts/password-reset-confirm/', views.password_reset_confirm_view, name='password_reset_confirm'),
    
    # Hồ sơ người dùng
    path('accounts/profile/', views.profile_view, name='profile'),
    path('accounts/toggle-two-factor/', views.toggle_two_factor, name='toggle_two_factor'),
    path('accounts/change-password/', views.change_password_view, name='change_password'),
    
    # Xác thực 2 yếu tố
    path('accounts/two-factor-verify/', views.two_factor_verify_view, name='two_factor_verify'),
    path('accounts/verify-password-2fa/', views.verify_password_for_2fa, name='verify_password_2fa'), # Xác minh mật khẩu cho 2FA
    
    #  Giấu tin & Trích xuất
    path('hide/', hide_data_view, name='hide'),
    path('extract/', extract_data_view, name='extract'),
    path('api/process-steganography/', process_steganography, name='process_steganography'),
    
    # Mã hóa & Giải mã
    path('encrypt/', encrypt_page, name='encrypt'),
    path('decrypt/', decrypt_page, name='decrypt'),
    
    # API xử lý mã hóa ZKE
    path('api/process-encryption/', process_encryption, name='process_encryption'),
    path('api/generate-key-pair/', generate_key_pair, name='generate_key_pair'),
    path('api/get-encryption-history/', get_encryption_history, name='get_encryption_history'),
    
    # Trang khác
    path('terms/', views.terms_of_service_view, name='terms_of_service'),
    
    #Quản lý hoạt động
    path('activity-history/', views.activity_history_view, name='activity_history'),
    path('api/activity/<int:activity_id>/details/', views.get_activity_details_api, name='get_activity_details'),
    path('api/activity/delete/', views.delete_activity_api, name='delete_activity_api'), 
    # Xuất CSV 
    path('activity-history/export-csv/', views.export_activity_csv, name='export_activity_csv'),
    path('activity-history/print-log/', views.print_activity_log, name='print_activity_log'),
    
    #Quản lý file
    path('file-management/', views.file_management_view, name='file_management'),
    path('api/file/<int:file_id>/details/', views.get_file_details_api, name='get_file_details'),
    path('api/file/delete/', views.delete_file_api, name='delete_file_api'),
    path('api/file/download/<int:file_id>/', views.download_single_file, name='download_single_file'),
    path('api/file/<int:file_id>/processing-info/', views.get_file_processing_info, name='get_file_processing_info'),
    path('api/file/<int:file_id>/processing-details/', views.get_file_processing_details, name='get_file_processing_details'),
    path('api/file/<int:file_id>/auto-fill-data/', views.get_auto_fill_data, name='get_auto_fill_data'),
    path('files/download/<int:file_id>/', views.download_single_file, name='file_download'),
    path('file-management/download-zip/', views.download_files_zip, name='download_files_zip'),
    path('api/file/download/<int:file_id>/', views.download_single_file, name='api_file_download'),
]
#URL xử lý lỗi khi chạy thực tế
handler404 = 'steganography_app.views.handler404'
handler500 = 'steganography_app.views.handler500'
handler403 = 'steganography_app.views.handler403'
handler400 = 'steganography_app.views.handler400'

# URL phục vụ file media
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)