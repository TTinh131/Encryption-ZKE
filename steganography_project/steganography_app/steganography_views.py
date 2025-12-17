import os
import base64
import tempfile
import numpy as np
import zlib
import secrets
import time 
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from .steganography.base import BaseSteganography
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage 

# Import các processor chuyên biệt
from .steganography.text_processor import TextSteganography
from .steganography.image_processor import ImageSteganography
from .steganography.audio_processor import AudioSteganography
from .services.file_service import FileService
from .models import UserSettings
from .services.activity_service import ActivityService

#Kiểm tra thư viện cần thiết
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import wave
    HAS_WAVE = True
except ImportError:
    HAS_WAVE = False

try:
    import scipy.fftpack as fft #Thư viện chuyển đổi Fourier
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    import pywt #Thư viện biến đổi Wavelet
    HAS_PYWT = True
except ImportError:
    HAS_PYWT = False

# XỬ LÝ STEGANOGRAPHY CHO ẢNH
class ImageSteganography(BaseSteganography):
    """Lớp xử lý giấu tin trong ảnh
    Kế thừa từ BaseSteganography và sử dụng ImageProcessor"""
    def __init__(self, method='LSB'):
        super().__init__()
        self.method = method
    
    def hide_data(self, carrier_data, secret_data, password=None):
        """Giấu dữ liệu vào ảnh
        
        Quy trình:
            1. Nén và mã hóa dữ liệu bí mật 
            2. Thêm delimiter để đánh dấu kết thúc dữ liệu
            3. Sử dụng image_processor để thực hiện giấu tin"""
        if not HAS_PIL:
            raise ImportError("Cần có thư viện PIL/Pillow để thực hiện giấu tin trong ảnh")
        
        try:
            # Bước 1: Xử lý dữ liệu bí mật
            processed_data = self.compress_data(secret_data)
            if password:
                processed_data = self.encrypt_data(processed_data, password)
            
            # Bước 2: Thêm delimiter để đánh dấu kết thúc
            processed_data += self.delimiter
            
            # Bước 3: Sử dụng image_processor để giấu tin
            from .steganography.image_processor import ImageSteganography as ImageProcessor
            processor = ImageProcessor(method=self.method)
            return processor.hide_data(carrier_data, processed_data, password)
            
        except Exception as e:
            raise Exception(f"Lỗi giấu tin ảnh: {str(e)}")
    
    def extract_data(self, carrier_data, password=None):
        """Trích xuất dữ liệu từ ảnh"""
        if not HAS_PIL:
            raise ImportError("Cần có thư viện PIL/Pillow để thực hiện giấu tin trong ảnh")
        
        try:
            # Sử dụng image_processor để trích xuất
            from .steganography.image_processor import ImageSteganography as ImageProcessor
            processor = ImageProcessor(method=self.method)
            return processor.extract_data(carrier_data, password)
            
        except Exception as e:
            raise Exception(f"Lỗi trích xuất ảnh: {str(e)}")

# XỬ LÝ STEGANOGRAPHY CHO AUDIO
class AudioSteganography(BaseSteganography):
    """
    Lớp xử lý giấu tin trong âm thanh
    Kế thừa từ BaseSteganography và sử dụng AudioProcessor
    """
    def hide_data(self, carrier_data, secret_data, password=None):
        """Giấu dữ liệu vào audio"""
        try:
            # Sử dụng audio_processor để giấu tin
            from .steganography.audio_processor import AudioSteganography as AudioProcessor
            processor = AudioProcessor()
            return processor.hide_data(carrier_data, secret_data, password)
            
        except Exception as e:
            raise Exception(f"Lỗi giấu tin audio: {str(e)}")
    
    def extract_data(self, carrier_data, password=None):
        """Trích xuất dữ liệu từ audio"""
        try:
            # Sử dụng audio_processor để trích xuất
            from .steganography.audio_processor import AudioSteganography as AudioProcessor
            processor = AudioProcessor()
            extracted_data = processor.extract_data(carrier_data, password)
            
            # Xử lý trường hợp mật khẩu sai
            if extracted_data == "sai_mat_khau":
                return "SAI_MAT_KHAU"
            return extracted_data
            
        except Exception as e:
            raise Exception(f"Lỗi trích xuất audio: {str(e)}")

def handle_hide_operation(carrier_type, method, carrier_file, secret_file, secret_data, password):
    """ Xử lý operation giấu tin
    
    Quy trình:
        1. Khởi tạo processor phù hợp
        2. Đọc và xử lý dữ liệu bí mật (đã mã hóa trên client)
        3. Kiểm tra dung lượng carrier
        4. Thực hiện giấu tin
        5. Trả về kết quả dưới dạng base64
    """
    
    # 1. Khởi tạo processor phù hợp
    processor = get_processor(carrier_type, method)
    
    # 2. Đọc dữ liệu bí mật (đã được mã hóa trên client)
    if secret_file:
        secret_data_bytes = secret_file.read()
    else:
        # Dữ liệu text đã được mã hóa và chuyển thành base64 trên client
        secret_data_bytes = base64.b64decode(secret_data)
    
    # 3. Kiểm tra dung lượng carrier có đủ chứa dữ liệu bí mật không
    carrier_size = carrier_file.size
    capacity_check = check_capacity(processor, carrier_type, method, carrier_size, len(secret_data_bytes))
    if not capacity_check['success']:
        return capacity_check
    
    #4. Đọc carrier data
    carrier_data = carrier_file.read()
    
    # 5. Thực hiện giấu tin
    try:
        if carrier_type == 'text':
            # Chuyển carrier data thành text
            carrier_text = carrier_data.decode('utf-8')
            result_data = processor.hide_data(carrier_text, secret_data_bytes, password)
            result_bytes = result_data.encode('utf-8')
        else:
            # Xử lý binary data (image, audio)
            result_bytes = processor.hide_data(carrier_data, secret_data_bytes, password)
        
        # 6. Trả về kết quả dưới dạng base64
        return {
            'success': True,
            'stego_data': base64.b64encode(result_bytes).decode('utf-8'),
            'filename': f'stego_{carrier_file.name}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def handle_extract_operation(carrier_type, method, carrier_file, password):
    """Xử lý operation trích xuất tin
    
    Quy trình:
        1. Khởi tạo processor phù hợp
        2. Đọc carrier data
        3. Trích xuất dữ liệu (đã mã hóa)
        4. Trả về dữ liệu đã mã hóa dưới dạng base64 để client giải mã
    """
    
    # 1. Đọc carrier data
    processor = get_processor(carrier_type, method)
    
    # 2. Đọc carrier data
    carrier_data = carrier_file.read()
    
    # 3. Thực hiện trích xuất
    try:
        if carrier_type == 'text':
            # Carrier là text, chuyển sang string
            carrier_text = carrier_data.decode('utf-8')
            extracted_data = processor.extract_data(carrier_text, password)
        else:
            # Carrier là binary data
            extracted_data = processor.extract_data(carrier_data, password)
        
        #4. Trả về dữ liệu đã mã hóa dưới dạng base64. Client sẽ sử dụng mật khẩu để giải mã
        return {
            'success': True,
            'secret_data': base64.b64encode(extracted_data).decode('utf-8'),
            'is_encrypted': True  # Flag để client biết cần giải mã
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def get_processor(carrier_type, method):
    """Khởi tạo processor phù hợp"""
    if carrier_type == 'text':
        return TextSteganography()
    elif carrier_type == 'image':
        return ImageSteganography(method)
    elif carrier_type == 'audio':
        return AudioSteganography()
    else:
        raise ValueError(f"Loại carrier không được hỗ trợ: {carrier_type}")

def check_capacity(processor, carrier_type, method, carrier_size, secret_size):
    """Kiểm tra dung lượng carrier có đủ chứa secret data không
    
    Tính toán dựa trên:
        - Loại carrier (text, image, audio)
        - Phương pháp giấu tin (LSB, DCT, ZWC)
        - Kích thước thực tế của carrier và secret data
    """
    try:
        # Tính dung lượng tối đa có thể giấu
        max_capacity = 0
        
        if carrier_type == 'text':
            if method == 'ZWC':
                # ZWC: mỗi ký tự có thể chứa 2 bit
                max_capacity = carrier_size * 2
                
        elif carrier_type == 'image':
            if method == 'LSB':
                # LSB: mỗi pixel RGB có thể chứa 3 bit (1 bit mỗi channel (RGB))
                max_capacity = carrier_size * 3
            elif method == 'DCT':
                # DCT: dung lượng thấp hơn do chỉ sử dụng hệ số tần số
                max_capacity = carrier_size * 0.7   # Ước lượng
        
        elif carrier_type == 'audio':
            # Audio LSB: mỗi sample 16-bit có thể chứa 1 bit
            # File WAV 16-bit mono: mỗi sample 2 bytes
            if method == 'LSB':
                max_capacity = (carrier_size // 2) // 8 # Ước lượng
        
        # Chuyển sang bytes
        max_capacity_bytes = max_capacity
        
        # Thêm buffer cho delimiter và overhead
        overhead = len(processor.delimiter) + 50  # Giảm overhead
        secret_size_with_overhead = secret_size + overhead
        
        # Kiểm tra điều kiện dung lượng
        if max_capacity_bytes <= 0:
            return {
                'success': False,
                'error': f'File carrier không có dung lượng khả dụng để giấu tin'
            }
            
        if secret_size_with_overhead > max_capacity_bytes:
            return {
                'success': False,
                'error': f'Dung lượng tin giấu quá lớn. Tối đa: {format_file_size(max_capacity_bytes)}, Hiện tại: {format_file_size(secret_size_with_overhead)}'
            }
        return {'success': True}
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Lỗi kiểm tra dung lượng: {str(e)}'
        }

def format_file_size(size_bytes):
    """Định dạng kích thước file thành chuỗi """
    if size_bytes == 0:
        return "0 Bytes"
    size_names = ["Bytes", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names)-1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.2f} {size_names[i]}"

# DJANGO VIEWS
def hide_data_view(request):
    """Trang giấu tin"""
    return render(request, 'operations/hide.html', {
        'page_title': 'SecureMedia - Giấu Tin'
    })

def extract_data_view(request):
    """Trang trích xuất tin"""
    return render(request, 'operations/extract.html', {
        'page_title': 'SecureMedia - Trích Xuất Tin'
    })

@require_http_methods(["POST"])
@csrf_exempt
def process_steganography(request):
    """
    API xử lý steganography (giấu tin và trích xuất tin)
    
    Quy trình:
        1. Lấy và xác thực tham số
        2. Kiểm tra cấu hình user
        3. Ghi log activity (nếu user đã đăng nhập và bật tính năng)
        4. Xử lý operation (hide/extract)
        5. Lưu file và cập nhật log (nếu thành công)
    """
    start_time = time.time()
    activity_log = None
    file_record = None
    
    try:
        # 1. Lấy dữ liệu từ request
        data = request.POST
        operation = data.get('operation')
        carrier_type = data.get('carrier_type')
        method = data.get('method')
        password = data.get('password', '')
        
        # Lấy file từ request
        carrier_file = request.FILES.get('carrier_file')
        secret_file = request.FILES.get('secret_file')
        secret_data = data.get('secret_data', '')
        
        # 2. Xác định loại file carrier
        if carrier_file:
            from .services.file_service import FileService
            original_file_type = FileService.get_file_type(carrier_file.name)
            if original_file_type == 'other':
                # Kiểm tra nếu là file stego
                if any(ext in carrier_file.name.lower() for ext in ['.stego', '.stg']):
                    original_file_type = 'stego'
                else:
                    original_file_type = carrier_type  # Dùng carrier_type nếu không xác định được
        else:
            # Carrier là text
            original_file_type = 'document'
        
        # 3. Khởi tạo các biến cho log và file
        save_activities = False
        save_files = False
        
        # CHỈ LẤY CẤU HÌNH USER NẾU ĐÃ ĐĂNG NHẬP
        if request.user.is_authenticated:
            user_settings, created = UserSettings.objects.get_or_create(user=request.user)
            save_activities = user_settings.save_activities
            save_files = user_settings.save_files
            
        # 4. GHI LOG ACTIVITY - CHỈ KHI ĐƯỢC BẬT VÀ USER ĐÃ ĐĂNG NHẬP
        if request.user.is_authenticated and save_activities:
            activity_type = 'hide_data' if operation == 'hide' else 'extract_data'
            filename = carrier_file.name if carrier_file else 'text_data'
            file_size = carrier_file.size if carrier_file else len(secret_data)
            
            from .services.activity_service import ActivityService
            activity_log = ActivityService.log_activity(
                user=request.user,
                activity_type=activity_type,
                input_filename=filename,
                file_size=file_size,
                algorithm=method,
                parameters={
                    'operation': operation,
                    'carrier_type': carrier_type,
                    'original_file_type': original_file_type,  # Lưu loại file carrier
                    'method': method,
                    'timestamp': timezone.now().isoformat()
                },
                request=request
            )
        # 5. Phân loại và xử lý operation
        if operation == 'hide':
            result = handle_hide_operation(carrier_type, method, carrier_file, secret_file, secret_data, password)
        else:
            result = handle_extract_operation(carrier_type, method, carrier_file, password)
        execution_time = time.time() - start_time
        
        # 6. CẬP NHẬT ACTIVITY LOG THÀNH CÔNG
        if request.user.is_authenticated and activity_log and save_activities and result.get('success'):
            from .services.activity_service import ActivityService
            ActivityService.update_activity(
                activity_log=activity_log,
                status='success',
                execution_time=execution_time
            )
            
            # CHỈ LƯU FILE STEGO KHI GIẤU TIN, KHÔNG LƯU FILE TRÍCH XUẤT VÀ USER CÓ CÀI ĐẶT LƯU FILE
            if save_files and operation == 'hide' and result.get('success'):
                from .services.file_service import FileService
                file_source = 'stego'
                
                # Sử dụng loại file carrier đã xác định
                file_type = original_file_type
                
                # Tính kích thước file kết quả
                stego_data = result.get('stego_data', '')
                file_size = len(base64.b64decode(stego_data)) if stego_data else 0
                
                # Tạo file record trong database
                file_record = FileService.create_file_record(
                    user=request.user,
                    original_filename=carrier_file.name if carrier_file else 'stego_file',
                    stored_filename=f"stego_{int(time.time())}_{carrier_file.name if carrier_file else 'file'}",
                    file_type=file_type,  # Sử dụng loại file carrier
                    file_source=file_source,
                    file_size=file_size,
                    description=f"File chứa tin ẩn bằng {method}",
                    activity_log=activity_log
                )
                # Lưu file thực tế nếu có dữ liệu stego
                if stego_data and file_record:
                    # Tạo đường dẫn lưu file
                    user_dir = f"user_files/{request.user.id}"
                    file_path = os.path.join(user_dir, f"stego_{carrier_file.name if carrier_file else 'file'}")
                    
                    # Decode base64 và lưu file
                    stego_bytes = base64.b64decode(stego_data)
                    saved_path = default_storage.save(file_path, ContentFile(stego_bytes))
                    
                    # Cập nhật file record với đường dẫn thực
                    file_record.name_stored = saved_path
                    file_record.save()
        # 7. Trả kết quả             
        return JsonResponse(result)
        
    except Exception as e:
        # Xử lý lỗi
        execution_time = time.time() - start_time
        print(f"Lỗi trong quá trình xử lý steganography: {str(e)}")
        
        # Cập nhật log với trạng thái thất bại
        if request.user.is_authenticated and activity_log:
            try:
                from .services.activity_service import ActivityService
                ActivityService.update_activity(
                    activity_log=activity_log,
                    status='failed',
                    error_message=str(e),# Lưu thông báo lỗi
                    execution_time=execution_time
                )
            except Exception as update_error:
                print(f"Lỗi khi cập nhật hoạt động: {update_error}")
        
        return JsonResponse({
            'success': False,
            'error': str(e)
        })