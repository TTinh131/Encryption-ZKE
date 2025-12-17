from steganography_app.models import ActivityLog, UserSettings
from django.db.models import Count, Q, Avg
import json

class ActivityService:
    """Dịch vụ quản lý hoạt động người dùng"""
    
    @staticmethod
    def log_activity(user, activity_type, input_filename, file_size, algorithm=None, 
                    parameters=None, output_filename=None, request=None):
        """Ghi log hoạt động của người dùng với thông tin request - CHỈ LƯU KHI CÀI ĐẶT save_activities ĐƯỢC BẬT"""
        try:
            # Kiểm tra cấu hình lưu activities của người dùng
            user_settings, created = UserSettings.objects.get_or_create(user=user)
            if not user_settings.save_activities:
                return None
        except Exception as e:
            # Tiếp tục lưu nếu có lỗi khi kiểm tra settings
            pass
        
        # Chuẩn bị dữ liệu hoạt động
        activity_data = {
            'user': user,
            'activity_type': activity_type,
            'input_filename': input_filename,
            'output_filename': output_filename,
            'file_size': file_size,
            'algorithm': algorithm,
            'parameters': parameters,
            'status': 'processing'  
        }
        
        # Thêm thông tin request nếu có
        if request:
            activity_data['ip_address'] = ActivityService.get_client_ip(request)
            activity_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')[:500] 
            activity_data['session_key'] = request.session.session_key
        
        try:
            # Tạo bản ghi hoạt động
            activity_log = ActivityLog.objects.create(**activity_data)
            print(f"Nhật ký hoạt động đã được tạo: {activity_log.id} cho {user.username}")
            return activity_log
        except Exception as e:
            print(f"Lỗi khi tạo nhật ký hoạt động: {e}")
            return None

    @staticmethod
    def get_client_ip(request):
        """Lấy địa chỉ IP của client từ request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0] # Lấy IP đầu tiên trong danh sách
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    @staticmethod
    def update_activity(activity_log, status, execution_time=None, error_message=None):
        """Cập nhật trạng thái hoạt động"""
        if activity_log is None:
            print("Lỗi không thể cập nhật nhật ký hoạt động: None")
            return
            
        # Cập nhật thông tin
        activity_log.status = status
        if execution_time is not None:
            activity_log.execution_time = execution_time
        if error_message is not None:
            activity_log.error_message = error_message
        
        try:
            activity_log.save()
        except Exception as e:
            print(f"Lỗi không thể cập nhật nhật ký hoạt động: {e}")

    @staticmethod
    def get_activity_stats(user):
        """Lấy thống kê hoạt động của người dùng"""
        try:
            stats = ActivityLog.objects.filter(user=user).aggregate(
                total=Count('id'),
                success=Count('id', filter=Q(status='success')),
                failed=Count('id', filter=Q(status='failed')),
                encryption=Count('id', filter=Q(activity_type='encryption')),
                decryption=Count('id', filter=Q(activity_type='decryption')),
                hide_data=Count('id', filter=Q(activity_type='hide_data')),
                extract_data=Count('id', filter=Q(activity_type='extract_data')),
            )
            
            # Tính thời gian trung bình cho các hoạt động thành công
            avg_time = ActivityLog.objects.filter(
                user=user, 
                execution_time__isnull=False,
                status='success'
            ).aggregate(avg_time=Avg('execution_time'))
            
            stats['avg_time'] = avg_time['avg_time'] or 0
            return stats
        except Exception as e:
            # Trả về dictionary mặc định nếu có lỗi
            return {
                'total': 0, 'success': 0, 'failed': 0, 'encryption': 0,
                'decryption': 0, 'hide_data': 0, 'extract_data': 0,
                'avg_time': 0  
            }

    @staticmethod
    def get_user_activities(user, limit=None):
        """Lấy danh sách hoạt động của người dùng
        sắp xếp theo thời gian mới nhất"""
        try:
            queryset = ActivityLog.objects.filter(user=user).order_by('-created_at')
            if limit:
                queryset = queryset[:limit]
            return queryset
        except Exception as e:
            return ActivityLog.objects.none() # Trả về queryset rỗng

    @staticmethod
    def delete_activity(user, activity_id):
        """Xóa hoạt động của user"""
        try:
            activity = ActivityLog.objects.get(id=activity_id, user=user)
            activity_id_str = str(activity_id)
            activity.delete()
            print(f"Hoạt động {activity_id_str} đã bị xóa bởi người dùng {user.username}")
            return True
        except ActivityLog.DoesNotExist:
            print(f"Hoạt động {activity_id} không tìm thấy cho người dùng {user.username}")
            return False
        except Exception as e:
            print(f"Lỗi xóa hoạt động: {e}")
            return False

    @staticmethod
    def delete_all_activities(user):
        """Xóa tất cả hoạt động của user"""
        try:
            count = ActivityLog.objects.filter(user=user).count()
            ActivityLog.objects.filter(user=user).delete()
            print(f"Xóa {count} hoạt động của người dùng {user.username}")
            return True
        except Exception as e:
            print(f"Lỗi khi xóa tất cả hoạt động: {e}")
            return False

    @staticmethod
    def clean_sensitive_data(user):
        """Làm sạch dữ liệu nhạy cảm trong tất cả activities của user"""
        try:
            activities = ActivityLog.objects.filter(user=user)
            cleaned_count = 0
            for activity in activities:
                activity.clean_sensitive_data() # Gọi phương thức làm sạch của model
                cleaned_count += 1
            print(f"Đã xóa dữ liệu nhạy cảm cho {cleaned_count} hoạt động")
            return True
        except Exception as e:
            print(f"Lỗi xóa dữ liệu nhạy cảm: {e}")
            return False