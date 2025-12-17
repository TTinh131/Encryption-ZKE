import wave
import numpy as np
import tempfile
import os
import io
from .base import BaseSteganography

class AudioSteganography(BaseSteganography):
    def __init__(self):
        super().__init__()
    
    def hide_data(self, carrier_data, secret_data, password=None):
        """Giấu dữ liệu vào file WAV - Dữ liệu đã được mã hóa trên client"""
        try:
            if not self._is_valid_wav(carrier_data):
                raise ValueError("File không phải định dạng WAV hợp lệ")
            
            # Dữ liệu đã được mã hóa trên client, chỉ cần thêm delimiter
            processed_data = secret_data + self.delimiter
            
            # Kiểm tra dung lượng file
            capacity = self._calculate_capacity(carrier_data)
            if len(processed_data) > capacity:
                raise ValueError(f"Dung lượng không đủ. Cần {len(processed_data)} bytes, chỉ có {capacity} bytes")
            
            return self._hide_lsb_improved(carrier_data, processed_data)
            
        except Exception as e:
            raise Exception(f"Lỗi giấu tin audio: {str(e)}")

    def extract_data(self, carrier_data, password=None):
        """Trích xuất dữ liệu từ file WAV - Trả về dữ liệu đã mã hóa để client giải mã"""
        try:
            if not self._is_valid_wav(carrier_data):
                raise ValueError("File không phải định dạng WAV hợp lệ")
            
            extracted_bytes = self._extract_lsb_improved(carrier_data)
            
            if not extracted_bytes:
                raise ValueError("Không tìm thấy dữ liệu đã giấu")

            # Tìm delimiter để tách dữ liệu
            delimiter_index = extracted_bytes.find(self.delimiter)
            if delimiter_index == -1:
                raise ValueError("Không tìm thấy dấu kết thúc dữ liệu")
            
            # Trả về dữ liệu đã mã hóa (client sẽ giải mã)
            encrypted_data = extracted_bytes[:delimiter_index]
            return encrypted_data
            
        except Exception as e:
            raise Exception(f"Lỗi trích xuất audio: {str(e)}")

    def _hide_lsb_improved(self, carrier_data, secret_data):
        """Giấu tin LSB - sử dụng uint16 để tránh lỗi out of bounds"""
        try:
            # Ghi carrier data vào file tạm
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(carrier_data)
                tmp_path = tmp_file.name
            
            output_path = None
            try:
                # Đọc file WAV
                with wave.open(tmp_path, 'rb') as audio:
                    params = audio.getparams()
                    
                    if params.sampwidth != 2:
                        raise ValueError("Chỉ hỗ trợ file WAV 16-bit")
                    
                    frames = audio.readframes(audio.getnframes())
                # Chuyển thành numpy array với uint16 để xử lý bit an toàn
                frames_array = np.frombuffer(frames, dtype=np.uint16).copy()
                
                # Chuyển dữ liệu bí mật thành chuỗi bit
                secret_bits = ''.join(format(byte, '08b') for byte in secret_data)
                total_bits = len(secret_bits)
                
                # Kiểm tra dung lượng
                available_capacity = len(frames_array)
                if total_bits > available_capacity:
                    raise ValueError(f"Dung lượng không đủ: cần {total_bits} bits, có {available_capacity} bits")
                # Giấu bit vào các sample
                for i in range(total_bits):
                    current_value = frames_array[i]
                    
                    if secret_bits[i] == '1':
                        # Set LSB thành 1
                        new_value = current_value | 1
                    else:
                        # Set LSB thành 0  
                        new_value = current_value & 0xFFFE
                    
                    frames_array[i] = new_value
                
                # Lưu file kết quả
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as output_file:
                    output_path = output_file.name
                
                with wave.open(output_path, 'wb') as stego_audio:
                    stego_audio.setparams(params)
                    stego_audio.writeframes(frames_array.tobytes())
                
                # Đọc kết quả
                with open(output_path, 'rb') as f:
                    result = f.read()
                return result
                
            finally:
                # Dọn dẹp file tạm
                for path in [tmp_path, output_path]:
                    if path and os.path.exists(path):
                        try:
                            os.unlink(path)
                        except:
                            pass
                    
        except Exception as e:
            raise Exception(f"Lỗi giấu tin LSB")

    def _extract_lsb_improved(self, carrier_data):
        """Trích xuất tin LSB"""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(carrier_data)
                tmp_path = tmp_file.name
            
            try:
                # Đọc file WAV
                with wave.open(tmp_path, 'rb') as audio:
                    params = audio.getparams()
                    frames = audio.readframes(audio.getnframes())
                # Chuyển thành numpy array với uint16
                frames_array = np.frombuffer(frames, dtype=np.uint16)
                
                # Trích xuất tất cả các bit LSB
                bits = [str(sample & 1) for sample in frames_array]
                bit_string = ''.join(bits)
                
                # Chuyển chuỗi bit thành bytes
                bytes_data = bytearray()
                for i in range(0, len(bit_string), 8):
                    if i + 8 <= len(bit_string):
                        byte_val = int(bit_string[i:i+8], 2)
                        bytes_data.append(byte_val)
                
                return bytes(bytes_data)
                
            finally:
                try:
                    os.unlink(tmp_path)
                except:
                    pass
                    
        except Exception as e:
            raise Exception(f"Lỗi trích xuất LSB")

    def _is_valid_wav(self, audio_data):
        """Kiểm tra xem dữ liệu có phải là file WAV hợp lệ không"""
        if len(audio_data) < 12:
            return False
        
        # Kiểm tra header WAV
        try:
            if audio_data[:4] != b'RIFF' or audio_data[8:12] != b'WAVE':
                return False
            
            # Thử mở bằng wave module
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name
            
            try:
                with wave.open(tmp_path, 'rb') as audio:
                    params = audio.getparams()
                    # Chỉ hỗ trợ 16-bit
                    if params.sampwidth != 2:
                        return False
                    # Đọc thử một frame
                    audio.readframes(1)
                    return True
            except Exception as e:
                return False
            finally:
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        except Exception as e:
            return False

    def _calculate_capacity(self, audio_data):
        """Tính dung lượng tối đa có thể giấu trong file WAV"""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name
            
            try:
                with wave.open(tmp_path, 'rb') as audio:
                    if audio.getsampwidth() != 2:
                        return 0
                    
                    n_frames = audio.getnframes()
                    n_channels = audio.getnchannels()
                    frames = audio.readframes(n_frames)
                
                frames_array = np.frombuffer(frames, dtype=np.uint16)
                
                # Mỗi sample chứa 1 bit
                total_samples = len(frames_array)
                max_bytes = total_samples // 8
                
                # Trừ đi overhead
                available_bytes = max(0, max_bytes - 100)  # Dự phòng cho header và delimiter
                return available_bytes
                
            finally:
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        except Exception as e:
            return 0