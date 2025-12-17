import random
import hashlib
from .base import BaseSteganography

class TextSteganography(BaseSteganography):
    def __init__(self):
        """Khởi tạo - Mã hóa sẽ được thực hiện trên client"""
        super().__init__()
        self.ZERO_WIDTH_SPACE = '\u200b'      # Bit 1
        self.ZERO_WIDTH_NON_JOINER = '\u200c' # Bit 0
        
    def _generate_position_seed(self, text, secret_data):
        """Tạo seed từ text và secret data"""
        combined = text.encode('utf-8') + secret_data
        return int(hashlib.sha256(combined).hexdigest()[:8], 16)
    
    def _find_optimal_positions(self, text, num_positions_needed):
        """Tìm vị trí tối ưu để chèn ZWC"""
        positions = []
        for i, char in enumerate(text):
            if char not in ['\n', '\t', '\r']: 
                positions.append(i)
            if len(positions) >= num_positions_needed:
                break
        
        # sử dụng mọi vị trí nếu không đủ
        if len(positions) < num_positions_needed:
            positions = list(range(len(text)))
        
        return positions[:num_positions_needed]
    
    def _select_random_positions(self, positions, num_needed, seed):
        """Chọn vị trí ngẫu nhiên có thể tái lập"""
        if len(positions) < num_needed:
            return positions[:num_needed]
        random.seed(seed)
        return sorted(random.sample(positions, num_needed))
    
    def hide_data(self, cover_text, secret_data, password=None):
        """Giấu tin - Dữ liệu đã được mã hóa trên client"""
        try:
            # Kiểm tra văn bản không chứa ZWC
            if any(c in [self.ZERO_WIDTH_SPACE, self.ZERO_WIDTH_NON_JOINER] for c in cover_text):
                raise ValueError("Văn bản gốc đã chứa ký tự ZWC. Hãy sử dụng văn bản khác.")
            
            # Dữ liệu đã được mã hóa trên client, chỉ cần thêm delimiter
            processed_data = secret_data + self.delimiter
            
            # Chuyển sang chuỗi bit
            secret_bits = ''.join(format(byte, '08b') for byte in processed_data)
            num_bits_needed = len(secret_bits)
            
            # Kiểm tra dung lượng
            if num_bits_needed > len(cover_text):
                required_chars = num_bits_needed
                raise ValueError(f"Văn bản quá ngắn. Cần ít nhất {required_chars} ký tự, hiện có {len(cover_text)}")
            
            # Tìm và chọn vị trí
            all_positions = self._find_optimal_positions(cover_text, num_bits_needed)
            seed = self._generate_position_seed(cover_text, secret_data)
            selected_positions = self._select_random_positions(all_positions, num_bits_needed, seed)
            
            # sử dụng vị trí tuần tự nếu không đủ
            if len(selected_positions) < num_bits_needed:
                selected_positions = list(range(num_bits_needed))
            
            # Giấu tin bằng cách chèn ZWC
            stego_chars = list(cover_text)
            offset = 0
            
            for i, bit in enumerate(secret_bits):
                if i < len(selected_positions):
                    insert_pos = selected_positions[i] + offset
                    if bit == '1':
                        stego_chars.insert(insert_pos, self.ZERO_WIDTH_SPACE)
                    else:
                        stego_chars.insert(insert_pos, self.ZERO_WIDTH_NON_JOINER)
                    offset += 1
            
            return ''.join(stego_chars)
            
        except Exception as e:
            raise Exception(f"Lỗi giấu tin: {str(e)}")
    
    def extract_data(self, stego_text, password=None):
        """Trích xuất tin - Trả về dữ liệu đã mã hóa để client giải mã"""
        try:
            # Trích xuất các bit từ ký tự ZWC
            extracted_bits = []
            for char in stego_text:
                if char == self.ZERO_WIDTH_SPACE:
                    extracted_bits.append('1')
                elif char == self.ZERO_WIDTH_NON_JOINER:
                    extracted_bits.append('0')
            
            if not extracted_bits:
                raise ValueError("Không tìm thấy dữ liệu ẩn")
            
            # Ghép các bit thành chuỗi
            bit_string = ''.join(extracted_bits)
            
            # Chuyển thành bytes
            bytes_data = bytearray()
            for i in range(0, len(bit_string), 8):
                if i + 8 <= len(bit_string):
                    byte_val = int(bit_string[i:i+8], 2)
                    bytes_data.append(byte_val)
            
            # Tìm delimiter để tách dữ liệu
            delimiter_index = bytes_data.find(self.delimiter)
            if delimiter_index == -1:
                raise ValueError("Không tìm thấy dấu kết thúc dữ liệu")
            
            # Trả về dữ liệu đã mã hóa (client sẽ giải mã)
            encrypted_data = bytes_data[:delimiter_index]
            return bytes(encrypted_data)
            
        except Exception as e:
            raise Exception(f"Lỗi trích xuất: {str(e)}")