Hướng dẫn chạy ứng dụng

1. Cài đặt dependencies:
pip install -r requirements.txt

2. Thiết lập database:
python manage.py migrate

3. Tạo superuser:
python manage.py createsuperuser

4. Chạy server: python manage.py runserver 9999

5. Truy cập ứng dụng: http://localhost:9999

Xóa user google: 
DELETE FROM socialaccount_socialaccount WHERE user_id = 9;
DELETE FROM users WHERE id = 9;
