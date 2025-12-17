import numpy as np
from PIL import Image
from io import BytesIO
import scipy.fftpack as fft
from .base import BaseSteganography

class ImageSteganography(BaseSteganography):
    def __init__(self, method='LSB'):
        super().__init__()
        self.method = method
        self.actual_method_used = method # Theo dõi phương pháp thực tế được sử dụng
    
    def hide_data(self, carrier_data, secret_data, password=None):
        """Giấu dữ liệu vào ảnh - Dữ liệu đã được mã hóa trên client"""
        try:
            # Dữ liệu secret_data đã được mã hóa trên client
            # Chỉ cần thêm delimiter và giấu
            processed_data = secret_data + self.delimiter
            
            if self.method == 'LSB':
                result = self._hide_lsb_color(carrier_data, processed_data)
                self.actual_method_used = 'LSB'
                return result
            elif self.method == 'DCT':
                result = self._hide_dct_color(carrier_data, processed_data)
                self.actual_method_used = 'DCT'
                return result
            else:
                raise ValueError(f"Phương pháp {self.method} không được hỗ trợ")
                
        except Exception as e:
            raise Exception(f"Lỗi giấu tin ảnh bằng {self.method}: {str(e)}")
    
    def extract_data(self, carrier_data, password=None):
        """Trích xuất dữ liệu từ ảnh - Trả về dữ liệu đã mã hóa để client giải mã"""
        try:
            if self.method == 'LSB':
                extracted_bytes = self._extract_lsb_color(carrier_data)
            elif self.method == 'DCT':
                extracted_bytes = self._extract_dct_color(carrier_data)
            else:
                raise ValueError(f"Phương pháp {self.method} không được hỗ trợ")
            
            # Tìm delimiter để tách dữ liệu
            delimiter_index = extracted_bytes.find(self.delimiter)
            if delimiter_index == -1:
                raise ValueError("Không tìm thấy dấu kết thúc dữ liệu")
            
            # Trả về dữ liệu đã mã hóa (client sẽ giải mã)
            encrypted_data = extracted_bytes[:delimiter_index]
            return encrypted_data
                
        except Exception as e:
            raise Exception(f"Lỗi trích xuất ảnh bằng {self.method}: {str(e)}")


    # LSB 
    def _hide_lsb_color(self, carrier_data, secret_data):
        """Giấu tin LSB """
        img = Image.open(BytesIO(carrier_data))
        
        # Giữ nguyên định dạng ảnh gốc
        original_mode = img.mode
        if original_mode not in ['RGB', 'RGBA']:
            img = img.convert('RGB')
            original_mode = 'RGB'
        
        # Chuyển ảnh thành mảng numpy để xử lý
        img_array = np.array(img)
        # Chuyển dữ liệu bí mật thành chuỗi bit
        secret_bits = ''.join(format(byte, '08b') for byte in secret_data)
        
        # Tính toán dung lượng tối đa
        height, width, channels = img_array.shape
        total_bits_capacity = height * width * channels
        
        if len(secret_bits) > total_bits_capacity:
            raise ValueError(f"Dữ liệu quá lớn cho LSB. Tối đa: {total_bits_capacity//8} bytes")
        # Giấu bit vào LSB của tất cả các pixel
        flat_array = img_array.reshape(-1)
        for i in range(len(secret_bits)):
            if i < len(flat_array):
                if secret_bits[i] == '1':
                    flat_array[i] |= 1 # Set LSB thành 1
                else:
                    flat_array[i] &= 0xFE # Set LSB thành 0
        
        # Khôi phục hình dạng mảng ảnh
        stego_array = flat_array.reshape(img_array.shape)
        # Tạo ảnh từ mảng đã giấu tin
        stego_img = Image.fromarray(stego_array.astype(np.uint8), mode=original_mode)
        # Lưu ảnh kết quả vào buffer
        output_buffer = BytesIO()
        stego_img.save(output_buffer, format='PNG')
        result = output_buffer.getvalue()
        return result

    def _extract_lsb_color(self, carrier_data):
        """Trích xuất LSB """
        img = Image.open(BytesIO(carrier_data))
        
        if img.mode not in ['RGB', 'RGBA']:
            img = img.convert('RGB')
        # Chuyển ảnh thành mảng numpy
        img_array = np.array(img)
        
        # Làm phẳng mảng và trích xuất LSB của từng pixel
        flat_array = img_array.reshape(-1)
        bits = [str(pixel & 1) for pixel in flat_array] # Lấy bit cuối cùng
        bit_string = ''.join(bits)
        
        # Chuyển chuỗi bit thành bytes
        bytes_data = bytearray()
        for i in range(0, len(bit_string), 8):
            if i + 8 <= len(bit_string):
                byte_val = int(bit_string[i:i+8], 2)
                bytes_data.append(byte_val)
        
        return bytes(bytes_data)

    # DCT
    def _hide_dct_color(self, carrier_data, secret_data):
        """Giấu tin DCT"""
        try:
            img = Image.open(BytesIO(carrier_data))
            
            # Giữ nguyên ảnh màu
            original_mode = img.mode
            if original_mode not in ['RGB', 'RGBA']:
                img = img.convert('RGB')
                original_mode = 'RGB'
            
            img_array = np.array(img, dtype=np.float32)
            
            # Chuyển ảnh thành mảng float để tính toán DCT
            data_length = len(secret_data)
            # Thêm độ dài dữ liệu vào đầu để dễ trích xuất
            length_bytes = data_length.to_bytes(4, byteorder='big')
            secret_data_with_length = length_bytes + secret_data + self.delimiter
            
            # Chuyển dữ liệu thành chuỗi bit
            secret_bits = ''.join(format(byte, '08b') for byte in secret_data_with_length)
            
            # Tính dung lượng khả dụng 
            height, width, channels = img_array.shape
            available_blocks = (height // 8) * (width // 8) # Số khối 8x8
            bits_per_block = 8  # Số bit giấu trên mỗi khối
            max_bits = available_blocks * bits_per_block * channels
            
            if len(secret_bits) > max_bits:
                raise ValueError(f"Dung lượng DCT không đủ. Cần {len(secret_bits)} bits, tối đa: {max_bits} bits")
            
            # Giấu tin vào tất cả các kênh màu
            bit_index = 0
            quant_step = 12.0  # Bước lượng tử hóa - ảnh hưởng đến độ bền và chất lượng
            
            for channel in range(channels):
                # Duyệt qua các khối 8x8
                for i in range(0, height - 7, 8):
                    for j in range(0, width - 7, 8):
                        if bit_index >= len(secret_bits):
                            break
                        
                        # Lấy khối 8x8 hiện tại
                        block = img_array[i:i+8, j:j+8, channel]
                        # Áp dụng biến đổi DCT 2 chiều
                        dct_block = fft.dct(fft.dct(block.T, norm='ortho').T, norm='ortho')
                        
                        # Danh sách các hệ số DCT được sử dụng để giấu tin
                        coefficients = [(1,1), (1,2), (2,1), (2,2), (1,3), (3,1), (2,3), (3,2), (3,3),
                                        (1,4), (4,1), (2,4), (4,2), (3,4), (4,3), (4,4),
                                        (1,5), (5,1), (2,5), (5,2), (3,5), (5,3), (4,5), (5,4), (5,5)]
                        # Giấu bit vào các hệ số DCT
                        for x, y in coefficients:
                            if bit_index < len(secret_bits):
                                current_val = dct_block[x, y]
                                quantized = round(current_val / quant_step) * quant_step
                                
                                # Giấu bit bằng điều chỉnh lượng tử hóa
                                if secret_bits[bit_index] == '1':
                                    # Đảm bảo giá trị dương và lớn hơn 0
                                    if quantized <= 0:
                                        quantized = quant_step
                                    elif int(quantized / quant_step) % 2 == 0:
                                        quantized += quant_step
                                else:
                                    if quantized <= 0:
                                        quantized = 0
                                    elif int(quantized / quant_step) % 2 == 1:
                                        quantized -= quant_step
                                
                                dct_block[x, y] = quantized
                                bit_index += 1
                        
                        # Biến đổi DCT ngược để khôi phục ảnh
                        idct_block = fft.idct(fft.idct(dct_block.T, norm='ortho').T, norm='ortho')
                        img_array[i:i+8, j:j+8, channel] = idct_block
            
            # Đảm bảo giá trị pixel nằm trong khoảng hợp lệ [0, 255]
            img_array = np.clip(img_array, 0, 255).astype(np.uint8)
            # Tạo ảnh kết quả
            stego_img = Image.fromarray(img_array, mode=original_mode)
            
            # Lưu ảnh kết quả
            output_buffer = BytesIO()
            stego_img.save(output_buffer, format='PNG')
            result = output_buffer.getvalue()
            return result
            
        except Exception as e:
            raise Exception(f"Lỗi giấu tin DCT")

    def _process_dct_channel(self, channel_data, secret_bits):
        """Xử lý DCT cho một kênh màu"""
        height, width = channel_data.shape
        processed_channel = np.copy(channel_data)
        bit_index = 0
        quant_step = 8.0
        
        # Các hệ số DCT được sử dụng
        coefficients = [(1,1), (1,2), (2,1), (2,2), (1,3), (3,1), (2,3), (3,2), (3,3),
                        (1,4), (4,1), (2,4), (4,2), (3,4), (4,3), (4,4),
                        (1,5), (5,1), (2,5), (5,2), (3,5), (5,3), (4,5), (5,4), (5,5)]
        
        # Duyệt qua các khối 8x8
        for i in range(0, height - 7, 8):
            for j in range(0, width - 7, 8):
                if bit_index >= len(secret_bits):
                    break
                
                block = channel_data[i:i+8, j:j+8]
                dct_block = fft.dct(fft.dct(block.T, norm='ortho').T, norm='ortho')
                
                # Giấu bit vào các hệ số
                for x, y in coefficients:
                    if bit_index < len(secret_bits):
                        current_val = dct_block[x, y]
                        quantized = round(current_val / quant_step) * quant_step
                        
                        # Điều chỉnh giá trị lượng tử hóa để giấu bit
                        if secret_bits[bit_index] == '1':
                            if (quantized / quant_step) % 2 == 0:
                                adjusted = quantized + quant_step
                            else:
                                adjusted = quantized
                        else:
                            if (quantized / quant_step) % 2 == 1:
                                adjusted = quantized - quant_step
                            else:
                                adjusted = quantized
                        
                        dct_block[x, y] = adjusted
                        bit_index += 1
                
                # Biến đổi ngược
                idct_block = fft.idct(fft.idct(dct_block.T, norm='ortho').T, norm='ortho')
                processed_channel[i:i+8, j:j+8] = idct_block
        
        return processed_channel

    def _extract_dct_color(self, carrier_data):
        """Trích xuất DCT"""
        try:
            img = Image.open(BytesIO(carrier_data))
            
            if img.mode not in ['RGB', 'RGBA']:
                img = img.convert('RGB')
            
            # Chuyển ảnh thành mảng float
            img_array = np.array(img, dtype=np.float32)
            height, width, channels = img_array.shape
            
            bits = [] # Danh sách các bit trích xuất
            quant_step = 12.0
            coefficients = [(1,1), (1,2), (2,1), (2,2), (1,3), (3,1), (2,3), (3,2), (3,3),
                    (1,4), (4,1), (2,4), (4,2), (3,4), (4,3), (4,4),
                    (1,5), (5,1), (2,5), (5,2), (3,5), (5,3), (4,5), (5,4), (5,5)]
            
            # Trích xuất từ tất cả các kênh
            for channel in range(channels):
                for i in range(0, height - 7, 8):
                    for j in range(0, width - 7, 8):
                        block = img_array[i:i+8, j:j+8, channel]
                        dct_block = fft.dct(fft.dct(block.T, norm='ortho').T, norm='ortho')
                        
                        # Trích xuất bit từ các hệ số DCT
                        for x, y in coefficients:
                            current_val = dct_block[x, y]
                            quantized = round(current_val / quant_step) * quant_step
                            
                            # Trích xuất bit dựa trên tính chẵn/lẻ của giá trị lượng tử
                            if quantized <= 0:
                                bits.append('0')
                            elif int(quantized / quant_step) % 2 == 1:
                                bits.append('1')
                            else:
                                bits.append('0')
            # Chuyển chuỗi bit thành bytes
            bit_string = ''.join(bits)
            
            # Chuyển thành bytes
            bytes_data = bytearray()
            for i in range(0, len(bit_string), 8):
                if i + 8 <= len(bit_string):
                    byte_val = int(bit_string[i:i+8], 2)
                    bytes_data.append(byte_val)
            
            # Xác định độ dài dữ liệu từ 4 byte đầu
            if len(bytes_data) < 4:
                raise ValueError("Không đủ dữ liệu để xác định độ dài")
            
            data_length = int.from_bytes(bytes_data[:4], byteorder='big')
            expected_total_length = 4 + data_length + len(self.delimiter)
            
            if len(bytes_data) < expected_total_length:
                raise ValueError(f"Dữ liệu không đủ. Cần {expected_total_length} bytes, có {len(bytes_data)}")
            
            # Trích xuất dữ liệu thực (bỏ qua 4 byte độ dài)
            actual_data = bytes_data[4:4 + data_length]
            delimiter_start = 4 + data_length
            
            # Kiểm tra delimiter để xác nhận trích xuất thành công
            if bytes_data[delimiter_start:delimiter_start + len(self.delimiter)] != self.delimiter:
                raise ValueError("Không tìm thấy delimiter đúng vị trí")
            return bytes(actual_data)
                
        except Exception as e:
            raise Exception(f"Lỗi trích xuất DCT")
