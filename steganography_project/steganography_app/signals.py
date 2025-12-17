from allauth.socialaccount.signals import social_account_added
from django.dispatch import receiver

#Lấy dữ liệu từ người dùng đăng nhập bằng email
@receiver(social_account_added)
def populate_user_data(request, sociallogin, **kwargs):
    """Tự động điền thông tin người dùng từ tài khoản Google khi đăng nhập lần đầu"""
    user = sociallogin.user
    data = sociallogin.account.extra_data

    # Lấy email Google 
    email = data.get("email")
    full_name = data.get("name")
    if email:
        user.email = email
    user.username = email.split("@")[0]
    user.save()
