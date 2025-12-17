from steganography_app.models import UserFile, UserSettings
from django.db.models import Count, Q, Sum
import os
import re
from django.conf import settings
from django.utils import timezone
from steganography_app.models import UserFile, UserSettings
from django.db.models import Count, Q, Sum
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

class FileService:
    """Dịch vụ quản lý file
    
    Mục đích: Quản lý an toàn các file metadata trong hệ thống ZKE
    
    Đặc điểm:
    1. Không lưu trữ file thực tế (plaintext) trên server
    2. Chỉ lưu metadata và các file đã mã hóa/stego
    3. Người dùng tự quản lý khóa giải mã trên client
    4. Server không thể truy cập nội dung file gốc
    """
    @staticmethod
    def create_file_record(user, original_filename, stored_filename, file_type, file_source, file_size, description=None, activity_log=None, zke_encryption=False):
        """Tạo bản ghi file mới
        
        Logic:
        1. Chỉ lưu file encrypted/stego
        2. Không lưu file decrypted/extracted/original
        3. Kiểm tra cài đặt người dùng (save_files)
        """
        try:
            # Kiểm tra loại file - không lưu trữ các file nguy hiểm
            insecure_sources = ['decrypted', 'extracted', 'original']
            if file_source in insecure_sources:
                return None
            
            # Kiểm tra cấu hình lưu files (cài đặt người dùng)
            user_settings, created = UserSettings.objects.get_or_create(user=user)
            if not user_settings.save_files:
                return None
        except Exception as e:
            return None
        
        # Mã hóa tên file lưu trữ 
        secure_stored_filename = FileService.secure_filename(stored_filename, file_source)
        # Kiểm tra và làm sạch mô tả để tránh thông tin nhạy cảm
        safe_description = FileService.sanitize_description(description)
        
        try:
            # Tạo bản ghi trong database
            file_record = UserFile.objects.create(
                user=user,
                name_original=original_filename,
                name_stored=secure_stored_filename,
                file_type=file_type,
                file_source=file_source,
                file_size=file_size,
                description=safe_description,
                activity_log=activity_log
            )
            print(f"Đã tạo bản lưu file!")
            return file_record
        except Exception as e:
            print(f"Lỗi tạo bản lưu file: {e}")
            import traceback
            print(f"Lỗi: {traceback.format_exc()}")
            return None

    @staticmethod
    def save_actual_file(user, file_data, filename, file_source):
        """Lưu file vào hệ thống file"""
        try:
            # Kiểm tra import tránh lỗi phát sinh
            import os
            import base64
            
            # Tạo đường dẫn cho user
            user_dir = f"user_files/{user.id}"
            safe_filename = FileService.secure_filename(filename, file_source)
            file_path = os.path.join(user_dir, safe_filename)
            
            # Xử lý dữ liệu file (base64 → bytes)
            if isinstance(file_data, str):
                file_data = base64.b64decode(file_data)
            
            # Lưu file vào storage system
            saved_path = default_storage.save(file_path, ContentFile(file_data))
            
            print(f"File đã được lưu: {saved_path}")
            return saved_path
            
        except Exception as e:
            print(f"Lỗi lưu file: {e}")
            return None

    @staticmethod
    def secure_filename(filename, file_source):
        """Bảo mật tên file - Thêm prefix"""
        # Xác định prefix dựa trên file source
        source_prefix_map = {
            'encrypted': 'enc',
            'stego': 'stg'
        }
        prefix = source_prefix_map.get(file_source, 'sec')
        # Tạo tên file bảo mật
        secure_name = f"{prefix}_{filename}"
        return secure_name

    @staticmethod
    def sanitize_description(description):
        """Làm sạch mô tả để loại bỏ thông tin nhạy cảm"""
        if not description:
            return description
            
        # Loại bỏ các từ khóa nhạy cảm có thể chứa thông tin bí mật
        sensitive_keywords = ['password=', 'secret=', 'key=', 'private_key=', 'decrypted', 'plaintext']
        safe_description = description
        for keyword in sensitive_keywords:
            if keyword in safe_description.lower():
                #Thay thế thông tin nhạy cảm bằng [REDACTED]
                safe_description = re.sub(f'{keyword}[^\\s]*', f'{keyword}[REDACTED]', safe_description, flags=re.IGNORECASE)
                
        return safe_description

    @staticmethod
    def get_file_type(filename):
        """Xác định loại file dựa trên extension"""
        _, ext = os.path.splitext(filename.lower())
        
        # Mapping extension sang loại file theo model
        extension_map = {
            # Img
            '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.ico': 'image',
            
            # Audio
            '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.wma': 'audio', 
            
            # Documents
            '.txt': 'document', '.pdf': 'document', '.doc': 'document', '.docx': 'document',
            '.xls': 'document', '.ppt': 'document', '.pptx': 'document',
            
            # file khác
            '.enc': 'other', '.crypt': 'other', '.aes': 'other',
            
            # file giấu tin
            '.stego': 'other', '.stg': 'other',
            
            # file nén
            '.zip': 'document', '.rar': 'document', '.7z': 'document', 
        }
        
        # Ưu tiên xác định loại file gốc
        file_type = extension_map.get(ext, 'other')
        return file_type

    @staticmethod
    def get_file_stats(user):
        """Lấy thống kê file của người dùng"""
        try:
            # CHỈ đếm các file an toàn (encrypted và stego)
            safe_sources = ['encrypted', 'stego']
            stats = UserFile.objects.filter(user=user, is_active=True, file_source__in=safe_sources).aggregate(
                # Tổng số file
                total=Count('id'),
                total_size=Sum('file_size'),
                # Phân loại theo source
                encrypted=Count('id', filter=Q(file_source='encrypted')),
                stego=Count('id', filter=Q(file_source='stego')),
                # Phân loại theo type
                images=Count('id', filter=Q(file_type='image')),
                audio=Count('id', filter=Q(file_type='audio')),
                documents=Count('id', filter=Q(file_type='document')),
                encrypted_files=Count('id', filter=Q(file_type='encrypted')),
                stego_files=Count('id', filter=Q(file_type='stego')),
                other=Count('id', filter=Q(file_type='other'))
            )
            
            # Tính toán thêm các chỉ số
            stats['total_size_mb'] = (stats['total_size'] or 0) / (1024 * 1024)
            stats['safe_files'] = stats['encrypted'] + stats['stego']
            
            # Tổng hợp theo loại
            stats['total_by_type'] = {
                'images': stats['images'] or 0,
                'audio': stats['audio'] or 0,
                'documents': stats['documents'] or 0,
                'encrypted': stats['encrypted_files'] or 0,
                'stego': stats['stego_files'] or 0,
                'other': stats['other'] or 0
            }
            return stats
        except Exception as e:
            print(f"Lỗi trong việc thống kê tệp: {e}")
            return {
                'total': 0, 'total_size': 0, 'total_size_mb': 0,
                'encrypted': 0, 'stego': 0, 'safe_files': 0,
                'images': 0, 'audio': 0, 'documents': 0,
                'encrypted_files': 0, 'stego_files': 0, 'other': 0,
                'total_by_type': {}
            }

    @staticmethod
    def get_user_files(user):
        """Lấy danh sách file của người dùng"""
        try:
            # Chỉ hiển thị các file an toàn
            safe_sources = ['encrypted', 'stego']
            files = UserFile.objects.filter(
                user=user, 
                is_active=True, 
                file_source__in=safe_sources
            ).order_by('-uploaded_at')
            return files
        except Exception as e:
            print(f"Lỗi khi lấy file: {e}")
            return UserFile.objects.none()

    @staticmethod
    def delete_file(user, file_id):
        """Xóa file (cả bản ghi và file vật lý) - kiểm tra quyền sở hữu
        
        Quy trình:
        1. Kiểm tra user sở hữu file
        2. Xóa file vật lý (nếu tồn tại)
        3. Xóa bản ghi database
        """
        try:
            # Kiểm tra quyền sở hữu trước khi xóa
            user_file = UserFile.objects.get(id=file_id, user=user)
            
            # Xóa file vật lý (nếu tồn tại)
            file_path = FileService.get_file_path(user_file)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Lỗi xóa file vật lý: {e}")
            # Xóa bản ghi trong db
            user_file.delete()
            return True
        except UserFile.DoesNotExist:
            return False
        except Exception as e:
            print(f"Lỗi xóa file: {e}")
            return False

    @staticmethod
    def delete_all_files(user):
        """Xóa tất cả file của user - chỉ thuộc quyền sở hữu của user đó"""
        try:
            user_files = UserFile.objects.filter(user=user)
            count = user_files.count()
            
            deleted_count = 0
            for user_file in user_files:
                if FileService.delete_file(user, user_file.id):
                    deleted_count += 1
            print(f"Đã xóa {deleted_count}/{count} file của user {user.username}")
            return True
        except Exception as e:
            print(f"Lỗi khi xóa tất cả file: {e}")
            return False

    @staticmethod
    def get_file_path(user_file):
        """Lấy đường dẫn file"""
        # Trong ZKE, không thực sự lưu file vật lý, chỉ metadata
        # Nhưng vẫn trả về đường dẫn giả định để tương thích
        file_path = os.path.join(settings.MEDIA_ROOT, user_file.name_stored)
        print(f"Đường dẫn của {user_file.name_original}: {file_path}")
        return file_path

    @staticmethod
    def validate_file_security(user_file):
        """Xác thực tính bảo mật của file
        
        1. File source có an toàn không?
        2. Tên file có chứa thông tin nhạy cảm không?
        """
        try:
            # Kiểm tra file source
            safe_sources = ['encrypted', 'stego']
            if user_file.file_source not in safe_sources:
                print(f"File {user_file.id} không hợp lệ: {user_file.file_source}")
                return False
            
            # Kiểm tra tên file có chứa thông tin nhạy cảm không
            sensitive_patterns = ['decrypted', 'plaintext', 'original', 'extracted']
            original_name = user_file.name_original.lower()
            stored_name = user_file.name_stored.lower()
            
            for pattern in sensitive_patterns:
                if pattern in original_name or pattern in stored_name:
                    print(f"File {user_file.id} chứa thông tin nhậy cảm: {pattern}")
                    return False
            return True
        except Exception as e:
            print(f"Lỗi xác định file an toàn: {e}")
            return False

    @staticmethod
    def cleanup_insecure_files(user):
        """Dọn dẹp các file không an toàn của user"""
        try:
            # Xác định các file source không an toàn
            insecure_sources = ['decrypted', 'extracted', 'original']
            insecure_files = UserFile.objects.filter(user=user, file_source__in=insecure_sources)
            count = insecure_files.count()
            
            cleaned_count = 0
            for insecure_file in insecure_files:
                if FileService.delete_file(user, insecure_file.id):
                    cleaned_count += 1
            return cleaned_count
        except Exception as e:
            print(f"Lỗi dọn dẹp file không an toàn: {e}")
            return 0

    @staticmethod
    def get_file_download_content(user_file):
        """Tạo nội dung download an toàn cho file"""
        try:
            # Kiểm tra bảo mật trước khi cho phép download
            if not FileService.validate_file_security(user_file):
                return None, "File không an toàn để tải về"
            
            # Trong ZKE, chúng ta không thực sự lưu file vật lý
            # Tạo nội dung mô tả thay vì nội dung thực tế
            content = f"""
    SECUREMEDIA - FILE DOWNLOAD
File: {user_file.name_original}
Type: {user_file.get_file_type_display()}
Source: {user_file.get_file_source_display()}
Size: {user_file.file_size} bytes
Uploaded: {user_file.uploaded_at}
Mô tả: {user_file.description or 'Không có Mô tả'}

LƯU Ý BẢO MẬT:
- Đây là file metadata, không phải file thực tế
- File thực tế được xử lý cục bộ trên trình duyệt của bạn
- Không có dữ liệu plaintext nào được lưu trên server
- Tính năng ZKE (Zero Knowledge Encryption) đảm bảo bí mật
- Để khôi phục file hãy sử dụng lại file mã hóa/giải mã, phương thức và mật khẩu tương ứng

Trân trọng,
Hệ thống SecureMedia
"""
            filename = f"metadata_{user_file.name_original}.txt"
            return content, filename
            
        except Exception as e:
            print(f"Lỗi khi tạo nội dung download: {e}")
            return None, "Lỗi khi tạo nội dung download"