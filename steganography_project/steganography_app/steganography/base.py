import os
import zlib
import secrets
import hmac
import hashlib
from abc import ABC, abstractmethod

class BaseSteganography(ABC):
    def __init__(self):
        # Sử dụng delimiter ngắn hơn
        self.delimiter = b'B2203743'
        self.compression_header = b'COMPRESSED:'
    
    def compress_data(self, data):
        """Nén dữ liệu trước khi giấu - chỉ nén khi dữ liệu đủ lớn"""
        # Không nén nếu dữ liệu nhỏ hơn 50 byte
        if len(data) < 50:
            return data
            
        try:
            compressed = zlib.compress(data, level=9)
            # Chỉ trả về nén nếu thực sự tiết kiệm được không gian
            if len(compressed) < len(data) - 10:  # Ít nhất tiết kiệm 10 byte
                return self.compression_header + compressed
            return data
        except:
            return data
    
    def decompress_data(self, data):
        """Giải nén dữ liệu sau khi trích xuất"""
        try:
            if data.startswith(self.compression_header):
                return zlib.decompress(data[len(self.compression_header):])
            return data
        except:
            return data

    @abstractmethod
    def hide_data(self, carrier_data, secret_data, **kwargs):
        pass
    
    @abstractmethod
    def extract_data(self, carrier_data, **kwargs):
        pass