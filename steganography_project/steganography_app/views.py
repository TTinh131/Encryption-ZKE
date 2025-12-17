from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, update_session_auth_hash, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.mail import send_mail
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.utils import timezone
from django.http import JsonResponse
from datetime import timedelta
import secrets
import pytz
import random
from django.http import HttpResponse, JsonResponse
import os
from django.http import FileResponse
from django.conf import settings
from django.db.models import Avg
import string
from .encryption_views import encrypt_page, decrypt_page
from .models import CustomUser, UserFile, ActivityLog, UserSettings
from django.core.mail import EmailMessage
from django.utils import timezone 
from allauth.socialaccount.models import SocialAccount
from django.views.decorators.http import require_GET

def get_activity_service():
    """Import trì hoãn để tránh circular imports"""
    from .services.activity_service import ActivityService
    return ActivityService

def get_file_service():
    """Import trì hoãn để tránh circular imports"""
    from .services.file_service import FileService
    return FileService
from .forms import (
    CustomUserCreationForm, CustomAuthenticationForm, 
    CustomPasswordResetForm, CustomSetPasswordForm, OTPVerificationForm
)

# 1. Views chính và các trang tĩnh
#============================================
def home_view(request):
    """Trang chủ"""
    context = {}
    if request.user.is_authenticated:
        context['user_theme'] = request.user.theme
    return render(request, 'index.html', context)

def about_view(request):
    """Trang giới thiệu"""
    return render(request, 'about.html')

def contact_view(request):
    """Trang liên hệ - xử lý form liên hệ"""
    if request.method == 'POST':
        messages.success(request, 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.')
        return redirect('contact')
    return render(request, 'contact.html')

def terms_of_service_view(request):
    """Điều khoản dịch vụ"""
    return render(request, 'accounts/terms_of_service.html')

# 2. Views cho các chức năng
# ===========================
def encrypt_file(request):
    """Mã hóa file - redirect đến trang mã hóa"""
    return redirect('encrypt')

def decrypt_file(request):
    """Giải mã file - redirect đến trang giải mã"""
    return redirect('decrypt')

# 3. Hàm hỗ trợ OTP
# ===================
def generate_otp():
    """Tạo mã OTP 6 chữ số ngẫu nhiên"""
    return ''.join(random.choices(string.digits, k=6))

def save_otp_to_session(request, email, purpose, user_id=None):
    """Lưu OTP vào session với thời gian hiệu lực 60s"""
    otp_code = generate_otp()
    request.session['otp_data'] = {
        'code': otp_code,
        'email': email,
        'purpose': purpose,
        'user_id': user_id, # Có thể là None
        'created_at': timezone.now().isoformat(),
        'attempts': 0 #Số lần nhập mã otp
    }
    # thời gian hiệu lực của session là 60s
    request.session.set_expiry(60)
    return otp_code

def get_otp_from_session(request):
    """Lấy OTP từ session"""
    return request.session.get('otp_data')

def clear_otp_from_session(request):
    """Xóa otp khỏi session"""
    if 'otp_data' in request.session:
        del request.session['otp_data']

def is_otp_valid(otp_data, max_age_seconds=60):
    """Kiểm tra OTP có hợp lệ không
    - Thời gian hiệu lực 60s
    - Số lần thử tối đa 3 lần"""
    if not otp_data:
        return False
    # Kiểm tra thời gian hết hạn
    created_at = timezone.datetime.fromisoformat(otp_data['created_at'])
    expiry_time = created_at + timezone.timedelta(seconds=max_age_seconds)
    # Kiểm tra số lần thử (tối đa 3 lần)
    return timezone.now() <= expiry_time and otp_data.get('attempts', 0) < 3

# 4. Xử lý email OTP
# =====================================
def send_otp_email(email, otp_code, purpose, username=None):
    """Gửi email OTP với định dạng HTML"""
    
    # Xác định subject và nội dung dựa trên purpose (mục đích)
    if purpose == 'registration':
        subject = 'Mã xác thực SecureMedia - Kích hoạt tài khoản'
        greeting_action = 'Cảm ơn bạn đã đăng ký tài khoản SecureMedia!'
        otp_title = 'MÃ XÁC THỰC CỦA BẠN'
        security_notes = [
            'Không chia sẻ mã OTP với bất kỳ ai',
            'Mã OTP sẽ hết hạn sau 60 giây',
            'Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email'
        ]
    elif purpose == 'password_reset':
        subject = 'Mã xác thực SecureMedia - Đặt lại mật khẩu'
        greeting_action = 'Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản SecureMedia của bạn.'
        otp_title = 'MÃ XÁC THỰC ĐẶT LẠI MẬT KHẨU'
        security_notes = [
            'Mã OTP chỉ sử dụng để đặt lại mật khẩu',
            'Mã OTP sẽ hết hạn sau 60 giây',
            'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này'
        ]
    elif purpose == 'enable_2fa':
        subject = 'Mã xác thực SecureMedia - Bật xác thực 2 yếu tố'
        greeting_action = 'Bạn đang bật xác thực 2 yếu tố cho tài khoản SecureMedia của mình.'
        otp_title = 'MÃ XÁC THỰC BẬT 2 YẾU TỐ'
        security_notes = [
            'Không chia sẻ mã OTP với bất kỳ ai',
            'Mã OTP sẽ hết hạn sau 60 giây',
            'Nếu bạn không yêu cầu bật 2 yếu tố, vui lòng bỏ qua email này'
        ]
    elif purpose == 'two_factor':
        subject = 'Mã xác thực SecureMedia - Đăng nhập 2 yếu tố'
        greeting_action = 'Bạn đang đăng nhập vào tài khoản SecureMedia với xác thực 2 yếu tố.'
        otp_title = 'MÃ XÁC THỰC ĐĂNG NHẬP 2 YẾU TỐ'
        security_notes = [
            'Không chia sẻ mã OTP với bất kỳ ai',
            'Mã OTP sẽ hết hạn sau 60 giây',
            'Nếu bạn không thực hiện đăng nhập, vui lòng bỏ qua email này'
        ]
    else:
        # Mặc định
        subject = 'Mã xác thực SecureMedia'
        greeting_action = 'Bạn đã yêu cầu mã OTP từ SecureMedia.'
        otp_title = 'MÃ XÁC THỰC'
        security_notes = [
            'Không chia sẻ mã OTP với bất kỳ ai',
            'Mã OTP sẽ hết hạn sau 60 giây',
            'Nếu bạn không yêu cầu, vui lòng bỏ qua email này'
        ]

    message = f'''
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
    <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50; margin: 0; font-size: 24px;"> SecureMedia</h1>
            <p style="color: #7f8c8d; margin: 5px 0 0 0;">Nền tảng bảo mật đa phương tiện</p>
        </div>

        <!-- Greeting -->
        <div style="margin-bottom: 25px;">
            <h2 style="color: #2c3e50; font-size: 18px; margin: 0 0 10px 0;">
                Xin chào <span style="color: #e74c3c;">{username if username else "bạn"}</span>,
            </h2>
            <p style="color: #5d6d7e; margin: 0; line-height: 1.5;">
                {greeting_action}
            </p>
        </div>

        <!-- OTP Section -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                   border-radius: 8px; padding: 25px; text-align: center; margin: 25px 0;">
            <h3 style="color: white; margin: 0 0 15px 0; font-size: 16px;">
                {otp_title}
            </h3>
            <div style="background: white; display: inline-block; padding: 15px 30px; 
                       border-radius: 6px; margin: 10px 0;">
                <div style="font-size: 32px; font-weight: bold; color: #2c3e50; letter-spacing: 5px;">
                    {otp_code}
                </div>
            </div>
            <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 14px;">
                Thời gian hiệu lực: <strong>60 giây</strong>
            </p>
        </div>

        <!-- Request Info -->
        <div style="background: #f8f9fa; border-left: 4px solid #3498db; 
                   padding: 15px; margin: 20px 0;">
            <p style="color: #5d6d7e; margin: 0; font-size: 14px;">
                Thời gian yêu cầu: {timezone.now().astimezone(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%H:%M %d/%m/%Y")}
            </p>
        </div>

        <!-- Security Notes -->
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; 
                   padding: 15px; margin: 20px 0;">
            <h4 style="color: #856404; margin: 0 0 10px 0; font-size: 14px;">LƯU Ý </h4>
            <ul style="color: #856404; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                {''.join(f'<li>{note}</li>' for note in security_notes)}
            </ul>
        </div>

        <!-- Support -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; 
                   border-top: 1px solid #ecf0f1;">
            <p style="color: #7f8c8d; margin: 0 0 10px 0; font-size: 13px;">
                Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi.
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px;">
            <p style="color: #95a5a6; margin: 0; font-size: 12px;">
                Trân trọng,<br>
                <strong style="color: #2c3e50;">Đội ngũ SecureMedia</strong>
            </p>
        </div>
        </div>
</div>
'''
    try:
        # Gửi email với HTML message
        from django.core.mail import EmailMessage
        
        email_msg = EmailMessage(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
        )
        email_msg.content_subtype = "html"  # Đặt nội dung là HTML
        email_msg.send(fail_silently=False)
        print(f"Mã OTP đã được gửi đến {email}: {otp_code}")
        return True
    except Exception as e:
        print(f"Lỗi khi gửi OTP đến {email}: {e}")
        return False

# 5. Xác thực người dùng
# ======================
def register_view(request):
    """Đăng ký tài khoản với OTP xác thực
    
    Quy trình:
        1. Validate form đăng ký
        2. Lưu thông tin tạm vào session
        3. Gửi OTP qua email
        4. Chuyển đến trang xác thực OTP
    """
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            try:
                # Lưu thông tin vào session tạm thời
                user_data = {
                    'username': form.cleaned_data['username'],
                    'email': form.cleaned_data['email'],
                    'password': form.cleaned_data['password1'],
                }
                request.session['pending_registration'] = user_data
                
                # Tạo và gửi OTP
                otp_code = save_otp_to_session(
                    request, 
                    user_data['email'], 
                    'registration'
                    # Không có user_id vì chưa lưu vào database
                )
                
                # Gửi email OTP
                email_sent = send_otp_email(
                    user_data['email'], 
                    otp_code, 
                    'registration', 
                    user_data['username']
                )
                
                if email_sent:
                    messages.success(request, 'Mã OTP đã được gửi đến email của bạn.')
                    return redirect('verify_otp')
                else:
                    # Xóa session data nếu gửi email thất bại
                    if 'pending_registration' in request.session:
                        del request.session['pending_registration']
                    messages.error(request, 'Lỗi gửi email OTP. Vui lòng thử lại.')
                    return render(request, 'accounts/register.html', {'form': form})
                
            except Exception as e:
                # Xóa session data nếu có lỗi
                if 'pending_registration' in request.session:
                    del request.session['pending_registration']
                messages.error(request, f'Có lỗi xảy ra khi đăng ký: {str(e)}')
        else:
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f'{field}: {error}')
    else:
        form = CustomUserCreationForm()
    return render(request, 'accounts/register.html', {'form': form})

def verify_otp_view(request):
    """
    Xác thực OTP cho đăng ký
    
    Quy trình:
        1. Kiểm tra OTP hợp lệ
        2. Nếu OTP đúng, tạo user trong database
        3. Đăng nhập user
        4. Redirect đến dashboard
    """
    otp_data = get_otp_from_session(request)
    user_data = request.session.get('pending_registration')
    
    # Kiểm tra session hợp lệ
    if not otp_data or otp_data.get('purpose') != 'registration' or not user_data:
        messages.error(request, 'Phiên đăng ký không hợp lệ. Vui lòng đăng ký lại.')
        # Dọn dẹp session
        clear_otp_from_session(request)
        if 'pending_registration' in request.session:
            del request.session['pending_registration']
        return redirect('register')
    
    # Kiểm tra OTP còn hiệu lực
    if not is_otp_valid(otp_data, max_age_seconds=60):
        clear_otp_from_session(request)
        if 'pending_registration' in request.session:
            del request.session['pending_registration']
        messages.error(request, 'Mã OTP đã hết hạn. Vui lòng đăng ký lại.')
        return redirect('register')
    
    if request.method == 'POST':
        form = OTPVerificationForm(request.POST)
        if form.is_valid():
            entered_otp = form.cleaned_data['otp_code']
            
            # Tăng số lần thử
            otp_data['attempts'] += 1
            request.session['otp_data'] = otp_data
            request.session.modified = True
            
            if entered_otp == otp_data['code']:
                # OTP chính xác - lưu user vào database
                try:
                    # Tạo user với thông tin từ session
                    user = CustomUser.objects.create_user(
                        username=user_data['username'],
                        email=user_data['email'],
                        password=user_data['password'], # Mật khẩu được băm tự động ở đây
                        is_active=True  # Kích hoạt ngay
                    )
                    
                    # Dọn dẹp session và đăng nhập
                    clear_otp_from_session(request)
                    if 'pending_registration' in request.session:
                        del request.session['pending_registration']
                    # Đăng nhập user
                    login(request, user)
                    
                    messages.success(request, f'Đăng ký thành công! Chào mừng {user.username} đến với SecureMedia.')
                    return redirect('dashboard')
                    
                except Exception as e:
                    messages.error(request, f'Có lỗi xảy ra khi tạo tài khoản: {str(e)}')
                    return redirect('register')
            else:
                # OTP sai
                attempts_left = 3 - otp_data["attempts"]
                if attempts_left > 0:
                    messages.error(request, f'Mã OTP không chính xác. Bạn còn {attempts_left} lần thử.')
                else:
                    # Nếu hết lượt thử, xóa session data
                    clear_otp_from_session(request)
                    if 'pending_registration' in request.session:
                        del request.session['pending_registration']
                    messages.error(request, 'Bạn đã nhập sai OTP quá 3 lần. Vui lòng đăng ký lại.')
                    return redirect('register')
        else:
            messages.error(request, 'Vui lòng nhập mã OTP hợp lệ.')
    else:
        form = OTPVerificationForm()
    return render(request, 'accounts/verify_otp.html', {
        'form': form,
        'email': user_data['email'],  # Lấy từ session
        'purpose': 'registration',
        'otp_data': otp_data,
        'debug': settings.DEBUG 
    })

def login_view(request):
    """
    Đăng nhập với hỗ trợ 2FA
    
    Quy trình:
        1. Xác thực username/password
        2. Nếu user bật 2FA, gửi OTP và chuyển đến xác thực 2FA
        3. Nếu không, đăng nhập ngay
    """
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        form = CustomAuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                if not user.is_active:
                    messages.error(request, 'Tài khoản của bạn chưa được kích hoạt. Vui lòng kiểm tra email để xác thực.')
                    return render(request, 'accounts/login.html', {'form': form})
                
                # Kiểm tra 2FA
                if user.two_factor_enabled:
                    # Lưu user_id vào session và gửi OTP
                    request.session['two_factor_user_id'] = user.id
                    # Tạo và gửi OTP
                    otp_code = save_otp_to_session(request, user.email, 'two_factor', str(user.id))
                    email_sent = send_otp_email(user.email, otp_code, 'two_factor', user.username)
                    
                    if email_sent:
                        messages.info(request, 'Vui lòng xác thực 2 yếu tố để tiếp tục đăng nhập.')
                        return redirect('two_factor_verify')
                    else:
                        messages.error(request, 'Lỗi gửi mã OTP. Vui lòng thử lại.')
                        return render(request, 'accounts/login.html', {'form': form})
                # Đăng nhập không 2FA
                user.backend = 'django.contrib.auth.backends.ModelBackend'
                login(request, user)
                user.last_login = timezone.now()
                user.save()
                messages.success(request, f'Chào mừng trở lại, {user.username}!')
                next_url = request.GET.get('next')
                if next_url:
                    return redirect(next_url)
                return redirect('dashboard')
            else:
                messages.error(request, 'Tên đăng nhập hoặc mật khẩu không đúng.')
        else:
            # Hiển thị lỗi form
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f'{error}')
    else:
        form = CustomAuthenticationForm()
    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    """Đăng xuất"""
    logout(request)
    messages.success(request, 'Đăng xuất thành công.')
    return redirect('home')

# 6. Reset password với OTP
# =================================
def password_reset_view(request):
    """Bước 1: Nhập email để reset password"""
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        form = CustomPasswordResetForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            try:
                user = CustomUser.objects.get(email=email)
                # Tạo OTP cho reset password
                otp_code = save_otp_to_session(request, email, 'password_reset', str(user.id))
                email_sent = send_otp_email(email, otp_code, 'password_reset', user.username)
                
                if email_sent:
                    messages.success(request, 'Mã OTP đã được gửi đến email của bạn.')
                    return redirect('password_reset_otp')
                else:
                    messages.error(request, 'Lỗi gửi email. Vui lòng thử lại.')
                    return render(request, 'accounts/password_reset.html', {'form': form})
            except CustomUser.DoesNotExist:
                messages.error(request, 'Email không tồn tại trong hệ thống.')
    else:
        form = CustomPasswordResetForm()
    return render(request, 'accounts/password_reset.html', {'form': form})

def password_reset_otp_view(request):
    """Bước 2: Xác thực OTP"""
    otp_data = get_otp_from_session(request)
    
    if not otp_data or otp_data.get('purpose') != 'password_reset':
        messages.error(request, 'Phiên OTP không hợp lệ.')
        return redirect('password_reset')
    
    if not is_otp_valid(otp_data):
        clear_otp_from_session(request)
        messages.error(request, 'Mã OTP đã hết hạn. Vui lòng thử lại.')
        return redirect('password_reset')
    
    if request.method == 'POST':
        form = OTPVerificationForm(request.POST)
        if form.is_valid():
            entered_otp = form.cleaned_data['otp_code']
            
            # Kiểm tra OTP và tăng số lần thử
            otp_data['attempts'] += 1
            request.session['otp_data'] = otp_data
            request.session.modified = True
            
            if entered_otp == otp_data['code']:
                # OTP đúng, tạo reset token
                token = secrets.token_urlsafe(32)
                request.session['reset_token'] = token
                request.session['reset_user_id'] = otp_data['user_id']
                request.session['reset_expires'] = (timezone.now() + timezone.timedelta(hours=1)).isoformat()
                # Xóa OTP data sau khi xác thực thành công
                clear_otp_from_session(request)
                
                messages.success(request, 'Xác thực thành công. Vui lòng đặt mật khẩu mới.')
                return redirect('password_reset_confirm')
            else:
                attempts_left = 3 - otp_data["attempts"]
                if attempts_left > 0:
                    messages.error(request, f'Mã OTP không chính xác. Bạn còn {attempts_left} lần thử.')
                else:
                    # Nếu hết lượt thử, xóa OTP data
                    clear_otp_from_session(request)
                    messages.error(request, 'Bạn đã nhập sai OTP quá 3 lần. Vui lòng thử lại từ đầu.')
                    return redirect('password_reset')
        else:
            messages.error(request, 'Vui lòng nhập mã OTP hợp lệ.')
    else:
        form = OTPVerificationForm()
    return render(request, 'accounts/password_reset_otp.html', {
        'form': form,
        'email': otp_data['email'],
        'purpose': 'password_reset',
        'otp_data': otp_data,
        'debug': settings.DEBUG
    })

def password_reset_confirm_view(request):
    """Bước 3: Đặt mật khẩu mới"""
    # Kiểm tra reset token
    token = request.session.get('reset_token')
    user_id = request.session.get('reset_user_id')
    expires_str = request.session.get('reset_expires')
    
    if not token or not user_id or not expires_str:
        messages.error(request, 'Liên kết đặt lại mật khẩu không hợp lệ.')
        return redirect('password_reset')
    # Kiểm tra thời hạn token
    expires = timezone.datetime.fromisoformat(expires_str)
    if timezone.now() > expires:
        messages.error(request, 'Liên kết đặt lại mật khẩu đã hết hạn.')
        return redirect('password_reset')
    
    try:
        user = CustomUser.objects.get(id=user_id)
        if request.method == 'POST':
            form = CustomSetPasswordForm(user, request.POST)
            if form.is_valid():
                form.save()
                # Dọn dẹp session
                if 'reset_token' in request.session:
                    del request.session['reset_token']
                if 'reset_user_id' in request.session:
                    del request.session['reset_user_id']
                if 'reset_expires' in request.session:
                    del request.session['reset_expires']
                
                update_session_auth_hash(request, user)
                messages.success(request, 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.')
                return redirect('login')
        else:
            form = CustomSetPasswordForm(user)
        return render(request, 'accounts/password_reset_confirm.html', {'form': form})
    except CustomUser.DoesNotExist:
        messages.error(request, 'Người dùng không tồn tại.')
        return redirect('password_reset')

# 7. Quản lý hồ sơ người dùng
# =====================================
@login_required
def profile_view(request):
    """
    Trang hồ sơ người dùng với các chức năng:
        - Đổi mật khẩu
        - Cài đặt tùy chọn
        - Thay đổi theme
        - Bật/tắt 2FA
    """
    user = request.user
    user_settings, created = UserSettings.objects.get_or_create(user=user)
    
    if request.method == 'POST':
        form_type = request.POST.get('form_type')
            
        if form_type == 'password':
            # Đổi mật khẩu
            current_password = request.POST.get('current_password')
            new_password = request.POST.get('new_password')
            confirm_password = request.POST.get('confirm_password')
            
            # Kiểm tra các trường bắt buộc
            if not current_password or not new_password or not confirm_password:
                messages.error(request, 'Vui lòng điền đầy đủ thông tin.')
            elif not user.check_password(current_password):
                messages.error(request, 'Mật khẩu hiện tại không đúng.')
            elif new_password != confirm_password:
                messages.error(request, 'Mật khẩu xác nhận không khớp.')
            elif len(new_password) < 8:
                messages.error(request, 'Mật khẩu phải có ít nhất 8 ký tự.')
            else:
                try:
                    # Đổi mật khẩu thực sự
                    user.set_password(new_password)
                    user.save()
                    # Cập nhật session để không bị logout
                    update_session_auth_hash(request, user)
                    messages.success(request, 'Đổi mật khẩu thành công!')
                except Exception as e:
                    messages.error(request, f'Có lỗi xảy ra: {str(e)}')
            return redirect('profile')
        
        elif form_type == 'settings':
            # Xử lý cài đặt 
            save_files = request.POST.get('save_files') == 'on'
            save_activities = request.POST.get('save_activities') == 'on'
            
            # Lưu cài đặt vào UserSettings
            user_settings.save_files = save_files
            user_settings.save_activities = save_activities
            user_settings.save()
            messages.success(request, 'Đã lưu cài đặt!')
            return redirect('profile')
            
        elif form_type == 'theme':
            # Xử lý theme
            new_theme = request.POST.get('theme')
            if new_theme in ['dark', 'light']:
                user.theme = new_theme
                user.save()
                # Kiểm tra nếu là AJAX request thì trả về JSON
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': True, 
                        'message': 'Cập nhật giao diện thành công!',
                        'theme': new_theme
                    })
                else:
                    messages.success(request, 'Cập nhật giao diện thành công!')
            else:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({
                        'success': False, 
                        'error': 'Theme không hợp lệ.'
                    })
                else:
                    messages.error(request, 'Theme không hợp lệ.')
            
            # Nếu không phải AJAX request, redirect bình thường
            if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
                return redirect('profile')
            else:
                return JsonResponse({'success': True})
        
        elif form_type == 'two_factor':
            # Bật/tắt 2FA
            two_factor_enabled = 'two_factor_enabled' in request.POST
            user.two_factor_enabled = two_factor_enabled
            user.save()
            status = "bật" if two_factor_enabled else "tắt"
            messages.success(request, f'Đã {status} xác thực 2 yếu tố!')
            return redirect('profile')
    return render(request, 'profile.html', {'user_settings': user_settings})

# 8. Dashboard
#====================================
@login_required
def dashboard_view(request):
    """
    Dashboard chính với thống kê và hoạt động gần đây
    
    Hiển thị:
        - Thống kê file và hoạt động
        - 4 hoạt động gần đây nhất
        - Tổng quan tài khoản
    """
    ActivityService = get_activity_service()
    FileService = get_file_service()
    
    file_count = 0
    recent_activities = []
    key_count = 0
    
    try:
        # Lấy thống kê cơ bản
        activity_stats = ActivityService.get_activity_stats(request.user)
        file_stats = FileService.get_file_stats(request.user)
        
        # Lấy số lượng file và khóa
        file_count = file_stats.get('total', 0)
        
        # Hoạt động gần đây (4 hoạt động mới nhất)
        recent_activities = ActivityService.get_user_activities(request.user, limit=4)
        
        # Chuyển đổi thành định dạng template
        formatted_activities = []
        for activity in recent_activities:
            # Xác định loại và icon
            activity_info = {
                'type': activity.status,
                'timestamp': activity.created_at,
                'status': activity.status,
                'status_display': activity.get_status_display()
            }
            # Xác định icon và mô tả
            if activity.activity_type == 'encryption':
                activity_info['icon'] = 'fas fa-lock'
                activity_info['description'] = f'Mã hóa {activity.input_filename}'
            elif activity.activity_type == 'decryption':
                activity_info['icon'] = 'fas fa-unlock'
                activity_info['description'] = f'Giải mã {activity.input_filename}'
            elif activity.activity_type == 'hide_data':
                activity_info['icon'] = 'fas fa-eye-slash'
                activity_info['description'] = f'Giấu tin {activity.input_filename}'
            elif activity.activity_type == 'extract_data':
                activity_info['icon'] = 'fas fa-search'
                activity_info['description'] = f'Trích xuất {activity.input_filename}'
            else:
                activity_info['icon'] = 'fas fa-cog'
                activity_info['description'] = f'{activity.get_activity_type_display()} {activity.input_filename}'
            formatted_activities.append(activity_info)
        recent_activities = formatted_activities
        
    except Exception as e:
        print(f"Lỗi tải dữ liệu dashboard: {e}")
        # Dữ liệu mẫu để tránh lỗi template
        file_stats = {'total': 0, 'encrypted': 0, 'decrypted': 0}
        activity_stats = {'total': 0, 'success': 0, 'failed': 0}
    
    context = {
        'file_stats': file_stats,
        'activity_stats': activity_stats,
        'recent_activities': recent_activities,
        'file_count': file_count,
        'key_count': key_count,
    }
    return render(request, 'dashboard.html', context)

# 9. Quản lý hoạt động
#======================================
@login_required
def activity_history_view(request):
    """
    Trang lịch sử hoạt động 
    
    Tính năng:
        - Lọc theo loại hoạt động, trạng thái, khoảng thời gian
        - Phân trang (10 items/page)
        - Xóa hoạt động (đơn lẻ hoặc nhiều)
        - Xuất CSV
        - In báo cáo
    """
    try:
        ActivityService = get_activity_service()
        # Xử lý POST actions trước khi lấy dữ liệu
        if request.method == 'POST':
            action = request.POST.get('action')

            if action == 'delete_selected':
                # Xóa các activity được chọn
                selected_ids = request.POST.getlist('selected_activities')
                success_count = 0
                for activity_id in selected_ids:
                    if ActivityService.delete_activity(request.user, activity_id):
                        success_count += 1
                messages.success(request, f'Đã xóa {success_count} hoạt động.')
                return redirect('activity_history')
                
            elif action == 'delete_all':
                # Xóa tất cả activities
                count = ActivityLog.objects.filter(user=request.user).count()
                ActivityService.delete_all_activities(request.user)
                messages.success(request, f'Đã xóa {count} hoạt động.')
                return redirect('activity_history')
        
        # Lấy tham số filter
        activity_type = request.GET.get('type', '')
        status = request.GET.get('status', '')
        date_range = request.GET.get('date_range', '')
        
        # Lấy và lọc dữ liệu
        activities = ActivityService.get_user_activities(request.user)
        # Áp dụng filter
        filtered_activities = activities
        if activity_type:
            filtered_activities = filtered_activities.filter(activity_type=activity_type)
        if status:
            filtered_activities = filtered_activities.filter(status=status)
        if date_range:
            now = timezone.now()
            if date_range == 'today':
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
                filtered_activities = filtered_activities.filter(created_at__gte=start_date)
            elif date_range == 'week':
                start_date = now - timedelta(days=now.weekday())
                start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                filtered_activities = filtered_activities.filter(created_at__gte=start_date)
            elif date_range == 'month':
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered_activities = filtered_activities.filter(created_at__gte=start_date)

        # Phân trang
        from django.core.paginator import Paginator
        paginator = Paginator(filtered_activities, 10)
        page_number = request.GET.get('page', 1)
        page_obj = paginator.get_page(page_number)
        
        # Thống kê dựa theo dữ liệu lọc
        stats = calculate_filtered_stats(filtered_activities)
        
        # Lấy user settings
        user_settings, created = UserSettings.objects.get_or_create(user=request.user)
        
        context = {
            'activities': page_obj,
            'total_activities': filtered_activities.count(), 
            'stats': stats,
            'filters': {
                'activity_type': activity_type,
                'status': status,
                'date_range': date_range
            },
            'activity_types': [
                ('encryption', 'Mã hóa'),
                ('decryption', 'Giải mã'),
                ('hide_data', 'Giấu tin'),
                ('extract_data', 'Trích xuất')
            ],
            'status_choices': ActivityLog.STATUS_CHOICES,
            'page_title': 'Lịch Sử Thao Tác',
            'user_settings': user_settings
        }
        return render(request, 'activity_history.html', context)
    
    except Exception as e:
        print(f"Lỗi trong activity_history_view: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Fallback
        user_settings, created = UserSettings.objects.get_or_create(user=request.user)
        
        context = {
            'activities': [],
            'total_activities': 0,
            'stats': {
                'total': 0, 'success': 0, 'failed': 0, 'encryption': 0,
                'decryption': 0, 'hide_data': 0, 'extract_data': 0,
                'avg_time': 0 
            },
            'filters': {
                'activity_type': '',
                'status': '',
                'date_range': ''
            },
            'activity_types': [
                ('encryption', 'Mã hóa'),
                ('decryption', 'Giải mã'),
                ('hide_data', 'Giấu tin'),
                ('extract_data', 'Trích xuất')
            ],
            'status_choices': ActivityLog.STATUS_CHOICES,
            'page_title': 'Lịch Sử Thao Tác',
            'user_settings': user_settings
        }
        return render(request, 'activity_history.html', context)

# 10. Quản lý File
#====================================
@login_required
def file_management_view(request):
    """
    Trang quản lý file 
    
    Tính năng:
        - Xem danh sách file
        - Lọc theo loại file, nguồn, thời gian
        - Tải về file (đơn hoặc nhiều)
        - Xóa file
        - Xem chi tiết file
    """
    try:
        FileService = get_file_service()
        
        # Lấy tham số filter
        file_source = request.GET.get('source', '')
        file_type = request.GET.get('type', '')
        date_range = request.GET.get('date_range', '')
        
        # Lấy và lọc dữ liệu
        files = FileService.get_user_files(request.user)

        # Áp dụng filter
        if file_source:
            # Chỉ lọc các giá trị hợp lệ trong FILE_SOURCES
            valid_sources = [source[0] for source in UserFile.FILE_SOURCES]
            if file_source in valid_sources:
                files = files.filter(file_source=file_source)
                
        if file_type:
            # Chỉ lọc các giá trị hợp lệ trong FILE_TYPES
            valid_types = [ftype[0] for ftype in UserFile.FILE_TYPES]
            if file_type in valid_types:
                files = files.filter(file_type=file_type)
                
        if date_range:
            now = timezone.now()
            if date_range == 'today':
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
                files = files.filter(uploaded_at__gte=start_date)
            elif date_range == 'week':
                start_date = now - timedelta(days=now.weekday())
                start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                files = files.filter(uploaded_at__gte=start_date)
            elif date_range == 'month':
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                files = files.filter(uploaded_at__gte=start_date)

        # Xử lý các action
        if request.method == 'POST':
            action = request.POST.get('action')
            
            if action == 'delete_selected':
                selected_ids = request.POST.getlist('selected_files')
                success_count = 0
                for file_id in selected_ids:
                    if FileService.delete_file(request.user, file_id):
                        success_count += 1
                messages.success(request, f'Đã xóa {success_count} file.')
                return redirect('file_management')
                
            elif action == 'delete_all':
                FileService.delete_all_files(request.user)
                messages.success(request, 'Đã xóa tất cả file.')
                return redirect('file_management')
                
            elif action == 'download_selected':
                selected_ids = request.POST.getlist('selected_files')
                if not selected_ids:
                    messages.error(request, 'Vui lòng chọn ít nhất một file để tải về.')
                    return redirect('file_management')
                # Gọi hàm tạo file Zip
                return download_files(request, selected_ids)
        
        # Phân trang
        from django.core.paginator import Paginator
        paginator = Paginator(files, 10)
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)
        
        # Thống kê
        stats = FileService.get_file_stats(request.user)
        
        # Lấy user settings
        user_settings, created = UserSettings.objects.get_or_create(user=request.user)
        
        context = {
            'files': page_obj,
            'stats': stats,
            'filters': {
                'file_source': file_source,
                'file_type': file_type,
                'date_range': date_range
            },
            'file_sources': UserFile.FILE_SOURCES,  # Lấy từ model
            'file_types': UserFile.FILE_TYPES,      # Lấy từ model
            'page_title': 'Quản Lý File',
            'user_settings': user_settings,
            'debug': settings.DEBUG
        }
        return render(request, 'file_management.html', context)
    except Exception as e:
        print(f"Lỗi trong file_management_view: {e}")
        import traceback
        traceback.print_exc()
        user_settings, created = UserSettings.objects.get_or_create(user=request.user)
        
        context = {
            'files': [],
            'stats': {'total': 0, 'total_size': 0, 'total_size_mb': 0},
            'filters': {},
            'file_sources': UserFile.FILE_SOURCES,
            'file_types': UserFile.FILE_TYPES,
            'page_title': 'Quản Lý File',
            'user_settings': user_settings,
        }
        return render(request, 'file_management.html', context)

# 11. Tải file
#====================================
@login_required
@require_GET
def download_single_file(request, file_id):
    """
    Tải về một file đơn
    
    Quy trình:
        1. Kiểm tra quyền truy cập
        2. Kiểm tra file tồn tại trong storage
        3. Trả về file hoặc metadata fallback
    """
    try:
        user_file = UserFile.objects.get(id=file_id, user=request.user)
        
        from django.core.files.storage import default_storage
        import mimetypes
        
        # Kiểm tra file thực
        if default_storage.exists(user_file.name_stored):
            file = default_storage.open(user_file.name_stored, 'rb')
            response = FileResponse(file)
            
            # Xác định content type và tên file
            content_type, encoding = mimetypes.guess_type(user_file.name_original)
            if content_type:
                response['Content-Type'] = content_type
            else:
                response['Content-Type'] = 'application/octet-stream'
            
            # Đảm bảo Header Correct
            response['Content-Disposition'] = f'attachment; filename="{user_file.name_original}"'
            response['X-Content-Type-Options'] = 'nosniff'
            return response
        else:
            # Nếu không có file thực -> Fallback: tạo file metadata
            return download_metadata_fallback(user_file)
            
    except UserFile.DoesNotExist:
        # Trả về JSON lỗi nếu là auto-fill request
        if 'auto_fill' in request.GET:
            return JsonResponse({
                'success': False,
                'error': 'File không tồn tại'
            }, status=404)
        from django.http import HttpResponseNotFound
        return HttpResponseNotFound("File không tồn tại.")
    except Exception as e:
        # Trả về JSON lỗi nếu là auto-fill request
        if 'auto_fill' in request.GET:
            return JsonResponse({
                'success': False,
                'error': f'Lỗi khi tải file: {str(e)}'
            }, status=500)
        # không trả về JSON - trả về lỗi 500 với trang lỗi
        from django.http import HttpResponseServerError
        return HttpResponseServerError(f"Lỗi khi tải file: {str(e)}")

def download_metadata_fallback(user_file):
    """Tạo file metadata khi không có file thực"""
    content = f"""=== SECUREMEDIA - FILE METADATA ===
THÔNG TIN FILE:
- Tên file gốc: {user_file.name_original}
- Tên file lưu trữ: {user_file.name_stored}
- Loại file: {user_file.get_file_type_display()}
- Nguồn file: {user_file.get_file_source_display()}
- Kích thước: {user_file.file_size} bytes

THÔNG TIN BẢO MẬT:
- File thực tế không tồn tại trên server
- Đây chỉ là bản ghi metadata

Thời gian xuất: {timezone.now().strftime('%d/%m/%Y %H:%M:%S')}
"""
    response = HttpResponse(content, content_type='application/octet-stream')
    # Đản bảo đúng Header
    response['Content-Disposition'] = f'attachment; filename="metadata_{user_file.name_original}.txt"'
    response['X-Content-Type-Options'] = 'nosniff'
    return response

@login_required
def download_files(request, file_ids):
    """
    Tải về nhiều file dưới dạng ZIP
    
    Quy trình:
        1. Tạo buffer ZIP trong memory
        2. Thêm từng file vào ZIP
        3. Trả về response với file ZIP
    """
    if not file_ids:
        messages.error(request, 'Không có file nào được chọn.')
        return redirect('file_management')
    
    try:
        import zipfile
        from io import BytesIO
        from django.http import HttpResponse
        from django.core.files.storage import default_storage
        from django.utils import timezone
        
        # Tạo buffer cho file zip 
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_id in file_ids:
                try:
                    user_file = UserFile.objects.get(id=file_id, user=request.user)
                    
                    # Đảm bảo tên file an toàn
                    safe_filename = "".join(c for c in user_file.name_original if c.isalnum() or c in (' ', '.', '_')).rstrip()
                    if not safe_filename:
                        safe_filename = f"file_{user_file.id}"
                    
                    # Kiểm tra file thực
                    if default_storage.exists(user_file.name_stored):
                        try:
                            # Đọc file thực
                            file_path = user_file.name_stored
                            with default_storage.open(file_path, 'rb') as file:
                                file_data = file.read()
                            
                            # Kiểm tra dữ liệu không rỗng
                            if file_data:
                                # Thêm vào zip với tên an toàn
                                zipf.writestr(safe_filename, file_data)
                            else:
                                raise ValueError("File rỗng")
                                
                        except Exception as file_error:
                            # Fallback: tạo metadata
                            content = create_metadata_content(user_file, f"Lỗi đọc file: {file_error}")
                            zipf.writestr(f"metadata_{safe_filename}.txt", content.encode('utf-8'))
                    else:
                        # Tạo file metadata
                        content = create_metadata_content(user_file)
                        zipf.writestr(f"metadata_{safe_filename}.txt", content.encode('utf-8'))
                        
                except UserFile.DoesNotExist:
                    print(f"File {file_id} không timg thấy, bỏ qua!")
                    continue
                except Exception as e:
                    print(f"Lỗi xử lý file {file_id}: {e}")
                    continue
        # Di chuyển con trỏ về đầu buffer
        zip_buffer.seek(0)
        
        # Tạo response với đầy đủ headers
        response = HttpResponse(
            zip_buffer.getvalue(), 
            content_type='application/zip'
        )
        response['Content-Disposition'] = 'attachment; filename="securemedia_files.zip"'
        response['Content-Length'] = len(zip_buffer.getvalue())
        response['X-Content-Type-Options'] = 'nosniff'
        print(f"Tạo file ZIP thành công, size: {len(zip_buffer.getvalue())} bytes")
        return response
            
    except Exception as e:
        print(f"Lỗi trong download_files: {e}")
        import traceback
        traceback.print_exc()
        
        # Tạo ZIP đơn giản với thông báo lỗi
        try:
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w') as zipf:
                error_content = f"Lỗi khi tạo file ZIP: {str(e)}"
                zipf.writestr("ERROR.txt", error_content.encode('utf-8'))
            
            zip_buffer.seek(0)
            response = HttpResponse(
                zip_buffer.getvalue(), 
                content_type='application/zip'
            )
            response['Content-Disposition'] = 'attachment; filename="error.zip"'
            return response
        except:
            messages.error(request, f'Lỗi nghiêm trọng khi tạo file ZIP: {str(e)}')
            return redirect('file_management')

# 12. API xử lý
#========================================
@csrf_exempt
@login_required
@require_http_methods(["POST"])
def delete_activity_api(request):
    """API xóa activity đơn lẻ"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method không hợp lệ.'}, status=405)
    try:
        activity_id = request.POST.get('activity_id')
        if not activity_id:
            return JsonResponse({'success': False, 'error': 'Thiếu activity_id'}, status=400)
        
        # Kiểm tra activity tồn tại và thuộc về user
        try:
            activity = ActivityLog.objects.get(id=activity_id, user=request.user)
        except ActivityLog.DoesNotExist:
            return JsonResponse(
                {'success': False, 'error': 'Hoạt động không tồn tại hoặc bạn không có quyền truy cập'}, 
                status=404
            )
        # Xóa activity
        activity.delete()
        
        return JsonResponse({
            'success': True, 
            'message': 'Đã xóa hoạt động thành công.',
            'activity_id': activity_id
        })
        
    except Exception as e:
        print(f"Lỗi trong delete_activity_api: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
@login_required
def delete_file_api(request):
    """API xóa file"""
    if request.method == 'POST':
        file_id = request.POST.get('file_id')
        FileService = get_file_service()
        if FileService.delete_file(request.user, file_id):
            return JsonResponse({'success': True, 'message': 'Đã xóa file.'})
        else:
            return JsonResponse({'success': False, 'error': 'Không thể xóa file.'})
    return JsonResponse({'success': False, 'error': 'Method không hợp lệ.'})


@login_required
def delete_file_api(request):
    """API xóa file"""
    if request.method == 'POST':
        file_id = request.POST.get('file_id')
        FileService = get_file_service()
        if FileService.delete_file(request.user, file_id):
            return JsonResponse({'success': True, 'message': 'Đã xóa file.'})
        else:
            print(f"Xóa file {file_id} không thành công")
            return JsonResponse({'success': False, 'error': 'Không thể xóa file.'})
    print(f"Phương thức không hợp lệ cho delete_file_api")
    return JsonResponse({'success': False, 'error': 'Method không hợp lệ.'})

# 13. Xử lý lỗi
#===============================
def handler404(request):
    """Xử lý lỗi 404 - Page Not Found"""
    return render(request, 'errors/404.html', status=404)

def handler500(request):
    """Xử lý lỗi 500 - Server Error"""
    return render(request, 'errors/500.html', status=500)

def handler403(request):
    """Xử lý lỗi 403 - Forbidden"""
    return render(request, 'errors/403.html', status=403)

def handler400(request):
    """Xử lý lỗi 400 - Bad Request"""
    return render(request, 'errors/400.html', status=400)

# 14. Các hàm tiện ích
#===================================
def calculate_filtered_stats(queryset):
    """Tính toán thống kê dựa trên queryset đã lọc"""
    from django.db.models import Count, Q, Avg
    
    try:
        stats = queryset.aggregate(
            total=Count('id'),
            success=Count('id', filter=Q(status='success')),
            failed=Count('id', filter=Q(status='failed')),
            encryption=Count('id', filter=Q(activity_type='encryption')),
            decryption=Count('id', filter=Q(activity_type='decryption')),
            hide_data=Count('id', filter=Q(activity_type='hide_data')),
            extract_data=Count('id', filter=Q(activity_type='extract_data')),
        )
        # Tính thời gian trung bình
        avg_time = queryset.filter(
            execution_time__isnull=False,
            status='success'
        ).aggregate(avg_time=Avg('execution_time'))
        
        stats['avg_time'] = avg_time['avg_time'] or 0
        return stats
    except Exception as e:
        print(f"Lỗi khi tính toán thống kê: {e}")
        return {
            'total': 0, 'success': 0, 'failed': 0, 'encryption': 0,
            'decryption': 0, 'hide_data': 0, 'extract_data': 0,
            'avg_time': 0 
        }
        
def is_ajax(request):
    """Kiểm tra nếu request là AJAX request"""
    return request.headers.get('X-Requested-With') == 'XMLHttpRequest'

#15. Các hàm khác
#======================================
@login_required
@require_http_methods(["POST"])
@csrf_exempt
def update_user_preferences(request):
    """API cập nhật theme cho user đang đăng nhập"""
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Chưa đăng nhập'}, status=401)
        import json
        data = json.loads(request.body)
        theme = data.get('theme')

        if theme not in ['dark', 'light']:
            return JsonResponse({'success': False, 'error': 'Theme không hợp lệ'}, status=400)
        # Cập nhật theme cho user
        user = request.user
        user.theme = theme
        user.save()
        
        return JsonResponse({
            'success': True, 
            'message': f'Đã cập nhật theme thành {theme}'
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Dữ liệu JSON không hợp lệ'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
@login_required
def toggle_two_factor(request):
    """API bật/tắt xác thực 2 yếu tố"""
    if request.method == 'POST':
        user = request.user
        two_factor_enabled = request.POST.get('two_factor_enabled') == 'true'
        user.two_factor_enabled = two_factor_enabled
        user.save()
        
        return JsonResponse({
            'success': True, 
            'two_factor_enabled': user.two_factor_enabled,
            'message': f'Đã {"bật" if two_factor_enabled else "tắt"} xác thực 2 yếu tố!'
        })
    return JsonResponse({'success': False, 'error': 'Method không hợp lệ'})

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def verify_password_for_2fa(request):
    """API xác thực mật khẩu khi tắt 2FA"""
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Chưa đăng nhập'}, status=401)
        current_password = request.POST.get('current_password')
        if not current_password:
            return JsonResponse({'success': False, 'error': 'Vui lòng nhập mật khẩu'})
        user = request.user
        if not user.check_password(current_password):
            return JsonResponse({'success': False, 'error': 'Mật khẩu không đúng'})
        return JsonResponse({'success': True, 'message': 'Xác thực mật khẩu thành công'})
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def toggle_two_factor(request):
    """API bật/tắt xác thực 2 yếu tố"""
    if request.method == 'POST':
        user = request.user
        two_factor_enabled = request.POST.get('two_factor_enabled') == 'true'
        
        # Nếu đang tắt 2FA, cần xác thực mật khẩu
        if not two_factor_enabled:
            current_password = request.POST.get('current_password')
            if not current_password:
                return JsonResponse({'success': False, 'error': 'Vui lòng nhập mật khẩu để tắt 2FA'})
            if not user.check_password(current_password):
                return JsonResponse({'success': False, 'error': 'Mật khẩu không đúng'})
        user.two_factor_enabled = two_factor_enabled
        user.save()
        return JsonResponse({
            'success': True, 
            'two_factor_enabled': user.two_factor_enabled,
            'message': f'Đã {"bật" if two_factor_enabled else "tắt"} xác thực 2 yếu tố!'
        })
    return JsonResponse({'success': False, 'error': 'Method không hợp lệ'})

@login_required
def change_password_view(request):
    """Đổi mật khẩu cho người dùng đã đăng nhập"""
    if request.method == 'POST':
        current_password = request.POST.get('current_password')
        new_password = request.POST.get('new_password')
        confirm_password = request.POST.get('confirm_password')
        user = request.user
        if not user.check_password(current_password):
            messages.error(request, 'Mật khẩu hiện tại không đúng.')
            return redirect('profile')
        if new_password != confirm_password:
            messages.error(request, 'Mật khẩu xác nhận không khớp.')
            return redirect('profile')
        if len(new_password) < 8:
            messages.error(request, 'Mật khẩu phải có ít nhất 8 ký tự.')
            return redirect('profile')
        user.set_password(new_password)
        user.save()
        update_session_auth_hash(request, user)
        messages.success(request, 'Đổi mật khẩu thành công!')
        return redirect('profile')
    return redirect('profile')

def send_otp_api(request):
    """API tạo và gửi OTP 
    - Hỗ trợ cả registration và password_reset
    - Trả về JSON response"""
    if request.method == 'POST':
        email = request.POST.get('email')
        purpose = request.POST.get('purpose')
        user_id = request.POST.get('user_id')
        
        if not email or not purpose:
            return JsonResponse({'success': False, 'error': 'Thiếu thông tin email hoặc purpose'})
        
        try:
            # Lấy thông tin user nếu có
            username = None
            if user_id:
                try:
                    user = CustomUser.objects.get(id=user_id)
                    username = user.username
                except CustomUser.DoesNotExist:
                    pass
            # Tạo OTP mới
            otp_code = save_otp_to_session(request, email, purpose, user_id)
            # Gửi OTP email
            email_sent = send_otp_email(email, otp_code, purpose, username)
            
            if email_sent:
                return JsonResponse({
                    'success': True, 
                    'message': 'Mã OTP đã được gửi đến email của bạn.'
                })
            else:
                return JsonResponse({
                    'success': False, 
                    'error': 'Không thể gửi email. Vui lòng thử lại sau.'
                })
        except Exception as e:
            return JsonResponse({
                'success': False, 
                'error': f'Lỗi hệ thống: {str(e)}'
            })
    return JsonResponse({'success': False, 'error': 'Method không hợp lệ'})

def resend_otp_view(request):
    """Gửi lại OTP - hỗ trợ cả AJAX và normal request"""
    if request.method == 'POST':
        purpose = request.POST.get('purpose')
        email = request.POST.get('email')
        user_id = request.POST.get('user_id')
        
        # Kiểm tra nếu là AJAX request
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        
        try:
            # Xử lý registration - lấy thông tin từ session
            if purpose == 'registration':
                user_data = request.session.get('pending_registration')
                if not user_data:
                    error_msg = 'Phiên đăng ký không hợp lệ.'
                    if is_ajax:
                        return JsonResponse({'success': False, 'error': error_msg})
                    else:
                        messages.error(request, error_msg)
                        return redirect('register')
                username = user_data['username']
                email = user_data['email']
                user_id = None  # Không có user_id vì chưa lưu vào database
            # Lấy thông tin user
            username = None
            if user_id:
                try:
                    user = CustomUser.objects.get(id=user_id)
                    username = user.username
                except CustomUser.DoesNotExist:
                    pass
            
            # Tạo OTP mới
            otp_code = save_otp_to_session(request, email, purpose, user_id)
            # Gửi email OTP
            email_sent = send_otp_email(email, otp_code, purpose, username)
            
            if email_sent:
                message = 'Mã OTP mới đã được gửi đến email của bạn.'
                if is_ajax:
                    return JsonResponse({'success': True, 'message': message})
                else:
                    messages.success(request, message)
            else:
                error_msg = 'Không thể gửi email OTP. Vui lòng thử lại.'
                if is_ajax:
                    return JsonResponse({'success': False, 'error': error_msg})
                else:
                    messages.error(request, error_msg)
                
        except Exception as e:
            error_msg = f'Lỗi hệ thống: {str(e)}'
            if is_ajax:
                return JsonResponse({'success': False, 'error': error_msg})
            else:
                messages.error(request, error_msg)
        
        # Chuyển hướng nếu không phải AJAX
        if not is_ajax:
            if purpose == 'registration':
                return redirect('verify_otp')
            else:
                return redirect('password_reset_otp')
    return JsonResponse({'success': False, 'error': 'Method không hợp lệ'})

def get_recent_activities(user, limit=5):
    """Lấy hoạt động gần đây từ tất cả các bảng"""
    activities = []
    
    try:
        from .models import Encryption, Steganography, Detection, Signature
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        # Lấy từ Encryption - chỉ lấy các trường cần thiết
        encryptions = Encryption.objects.filter(
            user=user, 
            created_at__gte=thirty_days_ago
        ).select_related('user').only(
            'operation', 'input_filename', 'success', 'created_at'
        ).order_by('-created_at')[:limit]
        
        for enc in encryptions:
            activities.append({
                'type': 'success' if enc.success else 'error',
                'icon': 'fas fa-lock' if enc.operation == 'encrypt' else 'fas fa-unlock',
                'description': f"{'Mã hóa' if enc.operation == 'encrypt' else 'Giải mã'} {enc.input_filename}",
                'timestamp': enc.created_at,
                'status': 'success' if enc.success else 'failed',
                'status_display': 'Thành công' if enc.success else 'Thất bại'
            })
        
        # Nếu chưa đủ limit, tiếp tục lấy từ Steganography
        if len(activities) < limit:
            steganos = Steganography.objects.filter(
                user=user, 
                created_at__gte=thirty_days_ago
            ).select_related('user').only(
                'operation', 'carrier_filename', 'success', 'created_at'
            ).order_by('-created_at')[:limit - len(activities)]
            
            for stego in steganos:
                activities.append({
                    'type': 'success' if stego.success else 'error',
                    'icon': 'fas fa-eye-slash' if stego.operation == 'hide' else 'fas fa-search',
                    'description': f"{'Giấu tin' if stego.operation == 'hide' else 'Trích xuất'} {stego.carrier_filename}",
                    'timestamp': stego.created_at,
                    'status': 'success' if stego.success else 'failed',
                    'status_display': 'Thành công' if stego.success else 'Thất bại'
                })
        
        # Nếu vẫn chưa đủ limit, tiếp tục lấy từ Detection
        if len(activities) < limit:
            detections = Detection.objects.filter(
                user=user, 
                created_at__gte=thirty_days_ago
            ).select_related('user').only(
                'analyzed_filename', 'probability', 'created_at'
            ).order_by('-created_at')[:limit - len(activities)]
            
            for det in detections:
                activities.append({
                    'type': 'info',
                    'icon': 'fas fa-radar',
                    'description': f"Phát hiện steganography {det.analyzed_filename}",
                    'timestamp': det.created_at,
                    'status': 'success',
                    'status_display': f'{(det.probability * 100):.1f}%'
                })
        
        # Nếu vẫn chưa đủ limit, tiếp tục lấy từ Signature
        if len(activities) < limit:
            signatures = Signature.objects.filter(
                user=user, 
                created_at__gte=thirty_days_ago
            ).select_related('user').only(
                'operation', 'filename', 'signature_result', 'created_at'
            ).order_by('-created_at')[:limit - len(activities)]
            
            for sig in signatures:
                activities.append({
                    'type': 'success' if sig.signature_result else 'warning',
                    'icon': 'fas fa-signature',
                    'description': f"{'Ký số' if sig.operation == 'sign' else 'Xác thực'} {sig.filename}",
                    'timestamp': sig.created_at,
                    'status': 'success' if sig.signature_result else 'failed',
                    'status_display': 'Hợp lệ' if sig.signature_result else 'Không hợp lệ'
                })
        
        # Sắp xếp theo thời gian và giới hạn
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        activities = activities[:limit]
        
    except (ImportError, Exception) as e:
        # Nếu model chưa tồn tại hoặc có lỗi, trả về danh sách rỗng
        print(f"Lỗi khi tải các hoạt động: {e}")
        return activities

def export_activity_csv(request, queryset=None):
    """Xuất CSV đẹp hơn, dễ đọc trong Excel"""
    import csv
    from django.http import HttpResponse
    from django.utils import timezone
    from datetime import timedelta
    ActivityService = get_activity_service()

    # Nếu không truyền queryset, tự lọc từ request
    if queryset is None:
        queryset = ActivityService.get_user_activities(request.user)

        activity_type = request.GET.get('type', '')
        status = request.GET.get('status', '')
        date_range = request.GET.get('date_range', '')

        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        if status:
            queryset = queryset.filter(status=status)
        if date_range:
            now = timezone.now()
            if date_range == 'today':
                queryset = queryset.filter(created_at__date=now.date())
            elif date_range == 'week':
                start = now - timedelta(days=now.weekday())
                queryset = queryset.filter(created_at__gte=start)
            elif date_range == 'month':
                start = now.replace(day=1)
                queryset = queryset.filter(created_at__gte=start)

    # Đặt tên file
    today = timezone.now().strftime("%d-%m-%Y")
    filename = f"History_{request.user.username}_{today}.csv"

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write('\ufeff')  # BOM UTF-8
    writer = csv.writer(response)

    # Header đẹp
    writer.writerow([
        "STT", "Loại thao tác", "Tên File", "Kích thước",
        "Thuật toán", "Ngày", "Giờ", "Thời gian xử lý", "Trạng thái"
    ])

    def format_size(size):
        for unit in ['bytes', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} TB"

    for i, a in enumerate(queryset, start=1):
        created_date = a.created_at.strftime("%d/%m/%Y")
        created_time = a.created_at.strftime("%H:%M:%S")
        exec_time = f"{a.execution_time:.2f}s" if a.execution_time else "-"

        writer.writerow([
            i,
            a.get_activity_type_display(),
            a.input_filename,
            format_size(a.file_size),
            a.algorithm or "-",
            created_date,
            created_time,
            exec_time,
            a.get_status_display(),
        ])
    return response

@login_required
def print_activity_log(request):
    """In lịch sử theo A4 chuyên nghiệp có logo + watermark"""
    ActivityService = get_activity_service()
    activities = ActivityService.get_user_activities(request.user)

    # Lọc dữ liệu theo request
    activity_type = request.GET.get("type", "")
    status = request.GET.get("status", "")
    date_range = request.GET.get("date_range", "")

    if activity_type:
        activities = activities.filter(activity_type=activity_type)
    if status:
        activities = activities.filter(status=status)
    if date_range:
        now = timezone.now()
        if date_range == "today":
            activities = activities.filter(created_at__date=now.date())
        elif date_range == "week":
            start = now - timedelta(days=now.weekday())
            activities = activities.filter(created_at__gte=start)
        elif date_range == "month":
            start = now.replace(day=1)
            activities = activities.filter(created_at__gte=start)

    # Tính toán thống kê
    success_count = activities.filter(status='success').count()
    failed_count = activities.filter(status='failed').count()
    pending_count = activities.filter(status='pending').count()
    
    encryption_count = activities.filter(activity_type='encryption').count()
    decryption_count = activities.filter(activity_type='decryption').count()
    hide_data_count = activities.filter(activity_type='hide_data').count()
    extract_data_count = activities.filter(activity_type='extract_data').count()
    
    # Tính thời gian trung bình của các hoạt động thành công
    from django.db.models import Avg
    avg_time_result = activities.filter(
        status='success', 
        execution_time__isnull=False
    ).aggregate(avg_time=Avg('execution_time'))
    avg_time = avg_time_result['avg_time'] or 0

    # Tính tổng kích thước và thời gian
    total_size = sum(a.file_size for a in activities if a.file_size)
    total_time = sum(a.execution_time for a in activities if a.execution_time)

    return render(request, "print_activity_log.html", {
        "activities": activities,
        "username": request.user.username,
        "printed_at": timezone.now(),
        "filters": {
            "type": activity_type,
            "status": status,
            "date_range": date_range,
        },
        "success_count": success_count,
        "failed_count": failed_count,
        "pending_count": pending_count,
        "encryption_count": encryption_count,
        "decryption_count": decryption_count,
        "hide_data_count": hide_data_count,
        "extract_data_count": extract_data_count,
        "avg_time": avg_time,
        "total_size": total_size,
        "total_time": total_time,
    })

@login_required
def get_activity_details_api(request, activity_id):
    """API lấy chi tiết activity"""
    try:
        activity = ActivityLog.objects.get(id=activity_id, user=request.user)
        
        # Chuẩn bị dữ liệu chi tiết
        activity_data = {
            'id': activity.id,
            'activity_type': activity.activity_type,
            'get_activity_type_display': activity.get_activity_type_display(),
            'input_filename': activity.input_filename,
            'output_filename': activity.output_filename,
            'algorithm': activity.algorithm,
            'file_size': activity.file_size,
            'status': activity.status,
            'get_status_display': activity.get_status_display(),
            'error_message': activity.error_message,
            'execution_time': activity.execution_time,
            'parameters': activity.parameters,
            'created_at': activity.created_at.isoformat(),
            'updated_at': activity.updated_at.isoformat(),
        }
        return JsonResponse(activity_data)
        
    except ActivityLog.DoesNotExist:
        return JsonResponse({'error': 'Activity not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    
@login_required
def download_files_zip(request):
    """Download ZIP file qua GET request"""
    file_ids_str = request.GET.get('file_ids', '')
    
    if not file_ids_str:
        messages.error(request, 'Không có file nào được chọn.')
        return redirect('file_management')
    # Chuyển đổi string thành list
    file_ids = file_ids_str.split(',')
    # Gọi hàm download_files đã sửa
    return download_files(request, file_ids)

@login_required
def get_file_processing_details(request, file_id):
    """API lấy thông tin chi tiết file để tự động điền form giải mã/trích xuất"""
    try:
        # Lấy file và kiểm tra quyền truy cập
        user_file = UserFile.objects.get(id=file_id, user=request.user)
        # Lấy activity log liên quan nếu có
        activity_log = None
        if user_file.activity_log:
            try:
                activity_log = ActivityLog.objects.get(id=user_file.activity_log.id)
            except ActivityLog.DoesNotExist:
                pass
        
        # Chuẩn bị dữ liệu response
        response_data = {
            'success': True,
            'file': {
                'id': user_file.id,
                'name_original': user_file.name_original,
                'name_stored': user_file.name_stored,
                'file_type': user_file.file_type,
                'file_source': user_file.file_source,
                'file_size': user_file.file_size,
                'description': user_file.description,
                'uploaded_at': user_file.uploaded_at.isoformat(),
            }
        }
        
        # Thêm thông tin từ activity log nếu có
        if activity_log:
            # Lấy thông tin thuật toán và phương thức
            algorithm_info = {
                'algorithm': activity_log.algorithm,
                'activity_type': activity_log.activity_type,
                'status': activity_log.status,
                'execution_time': activity_log.execution_time,
            }
            
            # Xử lý parameters nếu có
            if activity_log.parameters:
                try:
                    params = activity_log.parameters
                    # Loại bỏ thông tin nhạy cảm (nếu có)
                    if isinstance(params, dict):
                        sensitive_keys = ['password', 'secret', 'key', 'private_key']
                        for key in sensitive_keys:
                            if key in params:
                                params[key] = '***'
                    
                    algorithm_info['parameters'] = params
                except:
                    algorithm_info['parameters'] = activity_log.parameters
            response_data['activity_log'] = algorithm_info
        return JsonResponse(response_data)
        
    except UserFile.DoesNotExist:
        return JsonResponse({
            'success': False, 
            'error': 'File không tồn tại hoặc bạn không có quyền truy cập'
        }, status=404)
    except Exception as e:
        print(f"lỗi trong get_file_processing_details: {e}")
        return JsonResponse({
            'success': False, 
            'error': f'Lỗi hệ thống: {str(e)}'
        }, status=500)

@login_required
def get_auto_fill_data(request, file_id):
    """API trả về dữ liệu tự động điền cho form dựa trên loại file"""
    try:
        user_file = UserFile.objects.get(id=file_id, user=request.user)
        # Kiểm tra file có thực tồn tại
        from django.core.files.storage import default_storage
        file_exists = default_storage.exists(user_file.name_stored)
        
        # Xác định loại form cần điền
        form_data = {
            'file_name': user_file.name_original,
            'file_type': user_file.file_type,
            'file_source': user_file.file_source,
            'file_exists': file_exists,
        }
        
        # Xác định carrier_type dựa trên file_type cho steganography
        carrier_type_map = {
            'image': 'image',
            'audio': 'audio',
            'document': 'text',
            'encrypted': 'document',
            'stego': 'image',  # File stego thường là image
            'other': 'document'
        }
        
        form_data['carrier_type'] = carrier_type_map.get(user_file.file_type, 'document')
        
        # Nếu có activity log, lấy thêm thông tin
        if user_file.activity_log:
            activity_log = user_file.activity_log
            
            # Thêm thông tin thuật toán/phương pháp
            if activity_log.algorithm:
                # Đối với steganography, algorithm thường là method
                form_data['method'] = activity_log.algorithm
                form_data['algorithm'] = activity_log.algorithm
            
            # Thêm thông tin từ parameters
            if activity_log.parameters:
                try:
                    params = activity_log.parameters
                    if isinstance(params, dict):
                        # Chỉ lấy các thông tin an toàn
                        safe_params = {}
                        for key, value in params.items():
                            # Bỏ qua thông tin nhạy cảm
                            sensitive_keys = ['password', 'passphrase', 'secret', 
                                            'private_key', 'key_data', 'iv']
                            if key.lower() not in sensitive_keys:
                                safe_params[key] = value
                        if safe_params:
                            form_data['parameters'] = safe_params
                            # Trích xuất method từ parameters nếu có
                            if 'method' in safe_params:
                                form_data['method'] = safe_params['method']
                            if 'carrier_type' in safe_params:
                                form_data['carrier_type'] = safe_params['carrier_type']
                            if 'carrier_type' in params:  # Kiểm tra cả params gốc
                                form_data['carrier_type'] = params['carrier_type']
                except Exception as e:
                    print(f"Lỗi khi phân tích tham số: {e}")
        
        # Đảm bảo method có giá trị mặc định
        if 'method' not in form_data:
            form_data['method'] = 'LSB'  # Mặc định
        return JsonResponse({
            'success': True,
            'form_data': form_data,
            'redirect_url': get_redirect_url(user_file),
            'file_data': {
                'id': user_file.id,
                'name': user_file.name_original,
                'type': user_file.file_type,
                'source': user_file.file_source,
                'stored_path': user_file.name_stored,
                'exists': file_exists
            }
        })
        
    except UserFile.DoesNotExist:
        return JsonResponse({
            'success': False, 
            'error': 'File không tồn tại hoặc bạn không có quyền truy cập',
            'error_type': 'not_found'
        }, status=404)

def get_redirect_url(user_file):
    """Xác định URL redirect dựa trên loại file"""
    if user_file.file_source == 'encrypted':
        return f'/decrypt/?file_id={user_file.id}&auto_fill=true'
    elif user_file.file_source == 'stego':
        return f'/extract/?file_id={user_file.id}&auto_fill=true'
    else:
        return None
    
@login_required
def get_file_details_api(request, file_id):
    """API lấy chi tiết file"""
    try:
        user_file = UserFile.objects.get(id=file_id, user=request.user)
        # Chuẩn bị dữ liệu chi tiết
        file_data = {
            'id': user_file.id,
            'name_original': user_file.name_original,
            'name_stored': user_file.name_stored,
            'file_type': user_file.file_type,
            'get_file_type_display': user_file.get_file_type_display(),
            'file_source': user_file.file_source,
            'get_file_source_display': user_file.get_file_source_display(),
            'file_size': user_file.file_size,
            'description': user_file.description,
            'uploaded_at': user_file.uploaded_at.isoformat(),
            'is_active': user_file.is_active,
        }
        return JsonResponse(file_data)
        
    except UserFile.DoesNotExist:
        print(f"File {file_id} của người dùng không tồn tại {request.user.username}")
        return JsonResponse({'error': 'File không tồn tại hoặc không có quyền truy cập'}, status=404)
    except Exception as e:
        print(f"Lỗi trong get_file_details_api: {e}")
        return JsonResponse({'error': str(e)}, status=500)

def create_metadata_content(user_file, error_msg=None):
    """Tạo nội dung metadata file"""
    base_content = f"""=== SECUREMEDIA - FILE METADATA ===
THÔNG TIN FILE:
- Tên file gốc: {user_file.name_original}
- Tên file lưu trữ: {user_file.name_stored}
- Loại file: {user_file.get_file_type_display()}
- Nguồn file: {user_file.get_file_source_display()}
- Kích thước: {user_file.file_size} bytes
- Mô tả: {user_file.description or 'Không có mô tả'}

THÔNG TIN BẢO MẬT:
- File thực tế không tồn tại trên server
- Đây chỉ là bản ghi metadata

Thời gian xuất: {timezone.now().strftime('%d/%m/%Y %H:%M:%S')}
"""
    if error_msg:
        base_content += f"\nLỖI: {error_msg}"
    return base_content

@login_required
def get_file_processing_info(request, file_id):
    """API lấy thông tin file để tự động điền trên trang giải mã/trích xuất"""
    try:
        # Lấy thông tin file
        user_file = UserFile.objects.get(id=file_id, user=request.user)
        
        # Lấy thông tin activity log liên quan nếu có
        activity_log = None
        if user_file.activity_log:
            activity_log = ActivityLog.objects.filter(id=user_file.activity_log.id).first()
        
        # Chuẩn bị dữ liệu
        file_data = {
            'file': {
                'id': user_file.id,
                'name_original': user_file.name_original,
                'name_stored': user_file.name_stored,
                'file_type': user_file.file_type,
                'file_source': user_file.file_source,
                'file_size': user_file.file_size,
                'uploaded_at': user_file.uploaded_at.isoformat(),
            },
            'activity': None
        }
        
        if activity_log:
            file_data['activity'] = {
                'id': activity_log.id,
                'activity_type': activity_log.activity_type,
                'algorithm': activity_log.algorithm,
                'parameters': activity_log.parameters,
                'input_filename': activity_log.input_filename,
                'output_filename': activity_log.output_filename,
            }
        
        return JsonResponse(file_data)
        
    except UserFile.DoesNotExist:
        return JsonResponse({'error': 'File không tồn tại hoặc không có quyền truy cập'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def two_factor_view(request):
    """Trang quản lý xác thực 2 yếu tố"""
    two_factor_enabled = getattr(request.user, 'two_factor_enabled', False)
    
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'enable':
            request.user.two_factor_enabled = True
            request.user.save()
            two_factor_enabled = True
        elif action == 'disable':
            request.user.two_factor_enabled = False
            request.user.save()
            two_factor_enabled = False
    
    return render(request, 'two_factor.html', {
        'two_factor_enabled': two_factor_enabled
    })
from django.http import JsonResponse

@login_required
def delete_activity_api(request):
    """API xóa activity"""
    if request.method == 'POST':
        activity_id = request.POST.get('activity_id')
        ActivityService = get_activity_service()
        if ActivityService.delete_activity(request.user, activity_id):
            return JsonResponse({'success': True, 'message': 'Đã xóa hoạt động.'})
        else:
            return JsonResponse({'success': False, 'error': 'Không thể xóa hoạt động.'})
    return JsonResponse({'success': False, 'error': 'Method không hợp lệ.'})

def two_factor_verify_view(request):
    """Xác thực 2 yếu tố sau khi đăng nhập"""
    # Kiểm tra xem có user_id trong session không
    user_id = request.session.get('two_factor_user_id')
    if not user_id:
        messages.error(request, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.')
        return redirect('login')
    try:
        user = CustomUser.objects.get(id=user_id)
    except CustomUser.DoesNotExist:
        messages.error(request, 'Người dùng không tồn tại. Vui lòng đăng nhập lại.')