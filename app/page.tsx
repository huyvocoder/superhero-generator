'use client';

import { useState, useRef } from 'react';
import { HEROES, ASPECT_RATIOS, DEFAULT_HERO_ID, DEFAULT_ASPECT_RATIO } from '@/config/heroes.config';

export default function Home() {
  const [name, setName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'camera'>('idle');
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [selectedHero, setSelectedHero] = useState(DEFAULT_HERO_ID);
  const [selectedRatio, setSelectedRatio] = useState(DEFAULT_ASPECT_RATIO);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
    setShowUploadMenu(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMode('camera');
      setShowUploadMenu(false);
    } catch (err) {
      alert('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
      console.error(err);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setImagePreview(dataUrl);
    setImageBase64(dataUrl.split(',')[1]);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setMode('idle');
  };

  const cancelCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setMode('idle');
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">🦸 Superhero Generator</h1>

        {/* Tên */}
        <div>
          <label className="block text-sm mb-2 text-gray-300">Tên của bạn</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên..."
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Ô upload ảnh — click hiện menu chọn upload/camera */}
        <div className="relative">
          <label className="block text-sm mb-2 text-gray-300">Ảnh của bạn</label>

          {mode === 'camera' ? (
            <div className="space-y-3">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
              <div className="flex gap-3">
                <button onClick={capturePhoto} className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium">
                  📸 Chụp ảnh
                </button>
                <button onClick={cancelCamera} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium">
                  Hủy
                </button>
              </div>
            </div>
          ) : imagePreview ? (
            <div className="space-y-3">
              <img src={imagePreview} alt="Preview" className="w-full rounded-lg max-h-72 object-contain border border-gray-700" />
              <button
                onClick={() => { setImagePreview(null); setImageBase64(null); }}
                className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium"
              >
                Chọn lại ảnh khác
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                className="w-full bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg py-10 flex flex-col items-center gap-2"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm text-gray-300">Bấm để tải ảnh của bạn</span>
              </button>

              {showUploadMenu && (
                <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-2"
                  >
                    📁 Tải ảnh từ máy
                  </button>
                  <button
                    onClick={startCamera}
                    className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-2 border-t border-gray-700"
                  >
                    📸 Chụp ảnh bằng Camera
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          )}
        </div>

        {/* Chọn nhân vật */}
        <div>
          <label className="block text-sm mb-2 text-gray-300">Chọn siêu anh hùng</label>
          <div className="grid grid-cols-4 gap-3">
            {HEROES.map((hero) => (
              <button
                key={hero.id}
                onClick={() => setSelectedHero(hero.id)}
                className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition ${
                  selectedHero === hero.id ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800'
                }`}
              >
                  <img
                    src={hero.thumbnail}
                    alt={hero.name}
                    className="w-full aspect-square rounded-lg object-cover"
                  />
                <span className="text-xs text-gray-300">{hero.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chọn tỉ lệ khung hình */}
        <div>
          <label className="block text-sm mb-2 text-gray-300">Tỉ lệ ảnh</label>
          <div className="grid grid-cols-3 gap-3">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setSelectedRatio(ratio.value)}
                className={`py-3 rounded-lg border-2 text-sm font-medium transition ${
                  selectedRatio === ratio.value ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800'
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nút Generate */}
        <button
          disabled={!name || !imageBase64}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed py-3 rounded-lg font-bold"
        >
          ⚡ Biến thành Siêu anh hùng
        </button>
      </div>
    </main>
  );
}