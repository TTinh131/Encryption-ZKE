from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import CustomUser
from django.core.exceptions import ValidationError

# 1. Form đăng ký người dùng 
#==============================
class CustomUserCreationForm(UserCreationForm):
    """
    Form đăng ký người dùng với validation tùy chỉnh
    - Kế thừa UserCreationForm để có sẵn password validation
    - Thêm field đồng ý điều khoản
    - Custom validation cho username và email
    """
    email = forms.EmailField(
        required=True,
        label='Địa chỉ email',
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nhập email của bạn',
            'autocomplete': 'email'
        }),
        error_messages={
            'required': 'Vui lòng nhập địa chỉ email',
            'invalid': 'Địa chỉ email không hợp lệ'
        }
    )
    
    agree_terms = forms.BooleanField(
        required=True,
        label='Đồng ý điều khoản',
        error_messages={'required': 'Bạn phải đồng ý với điều khoản dịch vụ'},
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        })
    )
    
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'password1', 'password2')
        labels = {
            'username': 'Tên đăng nhập',
            'password1': 'Mật khẩu',
            'password2': 'Xác nhận mật khẩu',
        }
    
    def __init__(self, *args, **kwargs):
        """Khởi tạo form"""
        super().__init__(*args, **kwargs)
        
        # Cập nhật attributes cho các fields
        self.fields['username'].widget.attrs.update({
            'class': 'form-control',
            'placeholder': 'Nhập tên đăng nhập',
            'autocomplete': 'username',
            'minlength': '3',
            'maxlength': '150'
        })
        
        self.fields['password1'].widget.attrs.update({
            'class': 'form-control',
            'placeholder': 'Nhập mật khẩu',
            'autocomplete': 'new-password',
            'minlength': '8'
        })
        
        self.fields['password2'].widget.attrs.update({
            'class': 'form-control', 
            'placeholder': 'Xác nhận mật khẩu',
            'autocomplete': 'new-password'
        })
        
        # Xóa help text mặc định
        self.fields['username'].help_text = ''
        self.fields['password1'].help_text = ''
        self.fields['password2'].help_text = ''
    
    def clean_username(self):
        """Validation cho username"""
        username = self.cleaned_data.get('username')
        if username:
            # Kiểm tra độ dài
            if len(username) < 3:
                raise ValidationError('Tên đăng nhập phải có ít nhất 3 ký tự')
            # Kiểm tra ký tự hợp lệ
            if not all(c.isalnum() or c == '_' for c in username):
                raise ValidationError('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới')
            # Kiểm tra username đã tồn tại
            if CustomUser.objects.filter(username=username).exists():
                raise ValidationError('Tên đăng nhập đã được sử dụng')
        return username
    
    def clean_email(self):
        """Validation cho email"""
        email = self.cleaned_data.get('email')
        if email:
            # Kiểm tra định dạng email cơ bản
            if '@' not in email or '.' not in email:
                raise ValidationError('Địa chỉ email không hợp lệ')
            
            # Kiểm tra email đã tồn tại
            if CustomUser.objects.filter(email=email).exists():
                raise ValidationError('Email đã được sử dụng')
        return email
    
    def clean(self):
        """Validation tổng thể form"""
        return super().clean()

# 2. Form đăng nhập
#==============================
class CustomAuthenticationForm(AuthenticationForm):
    """Chỉ sử dụng username (không hỗ trợ đăng nhập bằng email)"""
    username = forms.CharField(
        label='Tên đăng nhập',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Tên đăng nhập',
            'autocomplete': 'username'
        }),
        error_messages={
            'required': 'Vui lòng nhập tên đăng nhập'
        }
    )
    password = forms.CharField(
        label='Mật khẩu',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Mật khẩu',
            'autocomplete': 'current-password'
        }),
        error_messages={
            'required': 'Vui lòng nhập mật khẩu'
        }
    )
    
    # Tùy chỉnh thông báo lỗi
    error_messages = {
        'invalid_login': (
            "Tên đăng nhập hoặc mật khẩu không chính xác. "
            "Vui lòng kiểm tra lại thông tin đăng nhập."
        ),
        'inactive': "Tài khoản này đã bị vô hiệu hóa.",
    }
    
    def __init__(self, *args, **kwargs):
        """Khởi tạo form"""
        super().__init__(*args, **kwargs)
        
    def clean(self):
        # xóa toàn bộ logic xử lý email, chỉ dùng logic mặc định của Django
        return super().clean()
    
# 3. Form xác thực OTP
#==============================
class OTPVerificationForm(forms.Form):
    """
    Form xác thực mã OTP 6 chữ số
    - Sử dụng cho cả đăng ký và reset mật khẩu
    - Chỉ cho phép nhập số
    """
    otp_code = forms.CharField(
        label='Mã OTP',
        max_length=6,
        min_length=6,
        widget=forms.TextInput(attrs={
            'class': 'input-field',
            'placeholder': 'Nhập mã OTP 6 chữ số',
            'pattern': '[0-9]{6}',
            'inputmode': 'numeric',
            'autocomplete': 'one-time-code'
        }),
        error_messages={
            'required': 'Vui lòng nhập mã OTP',
            'min_length': 'Mã OTP phải có 6 chữ số',
            'max_length': 'Mã OTP phải có 6 chữ số'
        },
        help_text='Nhập mã OTP 6 chữ số đã được gửi đến email của bạn'
    )
    
    def clean_otp_code(self):
        """Validation cho mã OTP chỉ được chứa số"""
        otp_code = self.cleaned_data.get('otp_code')
        if otp_code:
            # Kiểm tra chỉ chứa số
            if not otp_code.isdigit():
                raise forms.ValidationError('Mã OTP chỉ được chứa số')
            
            # Kiểm tra đúng 6 chữ số
            if len(otp_code) != 6:
                raise forms.ValidationError('Mã OTP phải có đúng 6 chữ số')
        return otp_code

# 4. Form đặt lại mật khẩu
#==============================
class CustomPasswordResetForm(forms.Form):
    """
    Form yêu cầu reset mật khẩu - 1
    - Người dùng nhập email để nhận OTP
    """
    email = forms.EmailField(
        label='Địa chỉ email',
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nhập email của bạn',
            'autocomplete': 'email'
        }),
        error_messages={
            'required': 'Vui lòng nhập địa chỉ email',
            'invalid': 'Địa chỉ email không hợp lệ'
        },
        help_text='Nhập email đã đăng ký tài khoản'
    )
    
    def clean_email(self):
        """Validation email - kiểm tra tồn tại trong hệ thống"""
        email = self.cleaned_data.get('email')
        if email:
            if not CustomUser.objects.filter(email=email).exists():
                raise forms.ValidationError('Email không tồn tại trong hệ thống')
        return email

class CustomSetPasswordForm(forms.Form):
    """
    Form đặt lại mật khẩu mới - 3
    - Sau khi xác thực OTP thành công
    """
    new_password1 = forms.CharField(
        label='Mật khẩu mới',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Mật khẩu mới',
            'autocomplete': 'new-password',
            'minlength': '8'
        }),
        error_messages={
            'required': 'Vui lòng nhập mật khẩu mới'
        },
        help_text='Mật khẩu phải có ít nhất 8 ký tự'
    )
    
    new_password2 = forms.CharField(
        label='Xác nhận mật khẩu mới',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Xác nhận mật khẩu mới',
            'autocomplete': 'new-password'
        }),
        error_messages={
            'required': 'Vui lòng xác nhận mật khẩu mới'
        }
    )
    
    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
    
    def clean(self):
        """Validation tổng thể - kiểm tra mật khẩu khớp"""
        cleaned_data = super().clean()
        password1 = cleaned_data.get('new_password1')
        password2 = cleaned_data.get('new_password2')
        
        # Kiểm tra mật khẩu khớp
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Mật khẩu không khớp")
        return cleaned_data
    
    def save(self, commit=True):
        self.user.set_password(self.cleaned_data['new_password1'])
        if commit:
            self.user.save()
        return self.user

