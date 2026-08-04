# 🦸 Hero Studio — Superhero Generator

Web app biến ảnh chân dung của người dùng thành ảnh siêu anh hùng bằng AI (Gemini 3.1 Flash Image): upload/chụp ảnh + nhập tên -> validate ảnh -> generate ảnh siêu anh hùng -> overlay tên lên ảnh kết quả. Có hệ thống log real-time hiển thị request/response tới Gemini API.

Demo trực tuyến: https://superhero-generator-lemon.vercel.app/

## 🚀 Hướng dẫn chạy dự án ở local

### 1. Yêu cầu

- Node.js >= 18
- Một Gemini API Key từ [Google AI Studio](https://aistudio.google.com/apikey)

> ⚠️ **Lưu ý về chi phí**: tính năng generate ảnh dùng model `gemini-3.1-flash-image`, đây là model **trả phí** (không nằm trong gói free tier của Gemini). Bạn cần bật billing cho project Google Cloud gắn với API key thì mới generate ảnh được — nếu dùng key chưa bật billing, các request tới `/api/generate` sẽ báo lỗi từ Gemini (billing/quota). Model validate ảnh (`gemini-3.1-flash-lite`) có free tier nên không yêu cầu billing.

### 2. Cài đặt

```bash
git clone https://github.com/huyvocoder/superhero-generator.git
cd superhero-generator
npm install
```

### 3. Cấu hình biến môi trường

Tạo file `.env` ở thư mục gốc (copy từ `.env.example`):

```bash
cp .env.example .env
```

Mở `.env` và điền API key của bạn:

```
GEMINI_API_KEY=your_api_key_here
```

### 4. Chạy dev server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem kết quả.

### 5. Build production (tuỳ chọn)

```bash
npm run build
npm run start
```
