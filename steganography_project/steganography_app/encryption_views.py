from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
import os
import json
import base64
import time
from django.utils import timezone
from .services.file_service import FileService
from .models import ActivityLog, UserFile, UserSettings  

@ensure_csrf_cookie
def encrypt_page(request):
    """Trang mã hóa - Hiển thị giao diện"""
    
    # Tạo context cho template
    context = {
        'page_title': 'SecureMedia - Mã Hóa',
        'active_tab': 'encrypt',  # Đánh dấu tab đang active
        'user_theme': request.user.theme if request.user.is_authenticated else 'dark' # Lấy theme của user
    }
    return render(request, 'operations/encrypt.html', context)

@ensure_csrf_cookie
def decrypt_page(request):
    """Trang giải mã"""
    context = {
        'page_title': 'SecureMedia - Giải Mã',
        'active_tab': 'decrypt',
        'user_theme': request.user.theme if request.user.is_authenticated else 'dark'
    }
    return render(request, 'operations/decrypt.html', context)

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def process_encryption(request):
    """API xử lý mã hóa/giải mã"""
    start_time = time.time() # Bắt đầu đếm thời gian thực thi
    activity_log = None
    
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Yêu cầu đăng nhập'})
        
        # Lấy tham số từ request
        algorithm = request.POST.get('algorithm', 'AES-256-GCM')
        action = request.POST.get('action', 'encrypt')
        input_type = request.POST.get('input_type', 'text')
        # LẤY CẤU HÌNH USER
        try:
            # Lấy hoặc tạo UserSettings cho user
            user_settings, created = UserSettings.objects.get_or_create(user=request.user)
            save_activities = user_settings.save_activities # Có lưu hoạt động không
            save_files = user_settings.save_files # Có lưu file không
        except Exception as e:
            print(f"Lỗi khi lấy UserSettings: {e}")
            return JsonResponse({'success': False, 'error': f'Lỗi cấu hình: {str(e)}'})
        
        # Xác định loại file gốc
        original_file_type = 'document'  # mặc định cho text
        filename = 'unknown'
        file_size = 0
        
        if input_type == 'file' and 'file' in request.FILES:
            # Xử lý khi input là file
            file = request.FILES['file']
            filename = file.name
            file_size = file.size
            
            # Xác định loại file gốc dựa trên extension
            from .services.file_service import FileService
            original_file_type = FileService.get_file_type(filename)
            if original_file_type == 'other':
                # Kiểm tra nếu là file mã hóa hoặc stego
                if any(ext in filename.lower() for ext in ['.enc', '.crypt', '.aes', '.gpg', '.pgp']):
                    # File mã hóa - không thể xác định loại gốc, dùng 'encrypted'
                    original_file_type = 'encrypted'
                elif any(ext in filename.lower() for ext in ['.stego', '.stg']):
                    # File stego - không thể xác định loại gốc, dùng 'stego'
                    original_file_type = 'stego'
        else:
            # Xử lý khi input là text
            input_data = request.POST.get('input_data', '')
            filename = 'text_input.txt'
            file_size = len(input_data.encode('utf-8'))
            original_file_type = 'document'
        # Xác định loại hoạt động
        activity_type = 'encryption' if action == 'encrypt' else 'decryption'
        
        # Ghi log activity - CHỈ KHI ĐƯỢC BẬT
        if save_activities:
            from .services.activity_service import ActivityService
            activity_log = ActivityService.log_activity(
                user=request.user,
                activity_type=activity_type,
                input_filename=filename,
                file_size=file_size,
                algorithm=algorithm,
                parameters={
                    'action': action,
                    'input_type': input_type,
                    'algorithm': algorithm,
                    'original_file_type': original_file_type,  # Lưu loại file gốc
                    'timestamp': timezone.now().isoformat(),
                    'zke_encryption': True
                },
                request=request
            )
        # Tính toán thời gian thực thi
        execution_time = time.time() - start_time
        
        # Chuẩn bị response
        response_data = {
            'success': True,
            'message': f'{action.title()} thành công',
            'algorithm': algorithm,
            'filename': filename,
            'file_size': file_size,
            'original_file_type': original_file_type,  # Trả về loại file gốc
            'execution_time': round(execution_time, 2),
            'timestamp': timezone.now().isoformat(),
            'zke_encryption': True
        }
        
        # Cập nhật activity log với trạng thái thành công
        if activity_log and save_activities:
            from .services.activity_service import ActivityService
            ActivityService.update_activity(
                activity_log=activity_log,
                status='success',
                execution_time=execution_time
            )
            
            # CHỈ LƯU FILE KHI MÃ HÓA, KHÔNG LƯU FILE GIẢI MÃ
            if save_files and action == 'encrypt':
                from .services.file_service import FileService
                file_source = 'encrypted'
                
                # Sử dụng loại file gốc đã xác định
                file_type = original_file_type
                
                # Tạo bản ghi file trong database
                file_record = FileService.create_file_record(
                    user=request.user,
                    original_filename=filename,
                    stored_filename=f"zke_encrypted_{filename}",
                    file_type=file_type,  # Sử dụng loại file gốc
                    file_source=file_source,
                    file_size=file_size,
                    description=f"File encrypted bằng {algorithm} (ZKE - Zero Knowledge Encryption)",
                    activity_log=activity_log,
                    zke_encryption=True
                )
        return JsonResponse(response_data)
            
    except Exception as e:
        # Xử lý lỗi
        execution_time = time.time() - start_time
        # Cập nhật log với trạng thái thất bại
        if activity_log:
            try:
                from .services.activity_service import ActivityService
                ActivityService.update_activity(
                    activity_log=activity_log,
                    status='failed',
                    error_message=str(e),
                    execution_time=execution_time
                )
            except Exception as update_error:
                print(f"Lỗi khi cập nhật hoạt động: {update_error}")
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def generate_key_pair(request):
    """Tạo cặp khóa cho thuật toán bất đối xứng"""
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Yêu cầu đăng nhập'})
        
        # Lấy thuật toán từ request
        algorithm = request.POST.get('algorithm', 'X25519')
        import secrets # Module tạo số ngẫu nhiên
        
        if algorithm == 'X25519':
            #Tạo khóa - 32 bytes
            public_key = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
            private_key = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
        elif algorithm == 'Kyber1024':
            #Tạo khóa - kích thước chuẩn cho Kyber1024
            public_key = base64.b64encode(secrets.token_bytes(1568)).decode('utf-8')
            private_key = base64.b64encode(secrets.token_bytes(3168)).decode('utf-8')
        else:
            return JsonResponse({'success': False, 'error': 'Thuật toán không được hỗ trợ'})
        return JsonResponse({
            'success': True,
            'algorithm': algorithm,
            'public_key': public_key,
            'private_key': private_key
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def get_encryption_history(request):
    """Lấy lịch sử mã hóa/giải mã của người dùng"""
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Yêu cầu đăng nhập'})
        
        # Lấy số lượng bản ghi tối đa
        limit = int(request.POST.get('limit', 10))
        
        # Truy vấn database lấy hoạt động mã hóa/giải mã
        activities = ActivityLog.objects.filter(
            user=request.user,
            activity_type__in=['encryption', 'decryption']
        ).order_by('-created_at')[:limit]
        
        # Chuẩn bị dữ liệu lịch sử
        history_data = []
        for activity in activities:
            history_data.append({
                'id': activity.id,
                'activity_type': activity.get_activity_type_display(),
                'input_filename': activity.input_filename,
                'algorithm': activity.algorithm,
                'file_size': activity.file_size,
                'status': activity.get_status_display(),
                'execution_time': activity.execution_time,
                'created_at': activity.created_at.strftime('%d/%m/%Y %H:%M'),
                'success': activity.status == 'success',
                'zke_encryption': activity.parameters.get('zke_encryption', False) if activity.parameters else False
            })
        # Trả về dữ liệu lịch sử
        return JsonResponse({
            'success': True,
            'history': history_data
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})