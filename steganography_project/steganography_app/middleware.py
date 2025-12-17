from django.contrib.auth import logout

class ForceSingleTabSessionMiddleware:
    """
    Middleware buộc mỗi tab phải dùng session độc lập.
    Nếu tab mới tạo session_key khác → tự động logout tab đó.
    mở tab mới phải đăng nhập lại.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Nếu chưa có session_key, Django tự tạo
        if not request.session.session_key:
            request.session.create()

        current_key = request.session.session_key
        saved_key = request.session.get('saved_session_key')

        # Nếu tồn tại saved_key và khác session_key hiện tại
        # → có nghĩa là tab khác đã login → tab này bị buộc logout
        if saved_key and saved_key != current_key:
            logout(request)

        # Cập nhật session_key vào session
        request.session['saved_session_key'] = current_key

        return self.get_response(request)
