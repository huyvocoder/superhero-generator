'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  HEROES,
  ASPECT_RATIOS,
  DEFAULT_HERO_ID,
  DEFAULT_ASPECT_RATIO,
} from '@/config/heroes.config';

// ============================================================
// KIỂU DỮ LIỆU
// ============================================================

// Một dòng log hiển thị ở Log Panel (Thành phần D)
interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  status: 'pending' | 'success' | 'error';
  httpStatus?: number;
  latency?: number;
  requestPayload?: any;
  errorMessage?: string;
}

// Kết quả validate ảnh (Thành phần A mở rộng - validate trước khi generate)
interface ImageValidation {
  isValid: boolean;
  reason?: string;
  hasFace?: boolean;
  faceCount?: number;
  isBlurry?: boolean;
  isTooDark?: boolean;
  isFaceClear?: boolean;
}

export default function Home() {
  // ----------------------------------------------------------
  // STATE - Thành phần A (input tên + ảnh)
  // ----------------------------------------------------------
  const [name, setName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null); // ảnh dùng để hiển thị (có prefix data:image/...)
  const [imageBase64, setImageBase64] = useState<string | null>(null); // ảnh base64 thuần, dùng để gửi API
  const [mode, setMode] = useState<'idle' | 'camera'>('idle'); // trạng thái camera đang bật hay không
  const [showUploadMenu, setShowUploadMenu] = useState(false); // hiện menu "Tải từ máy / Chụp ảnh" khi bấm ô upload

  // STATE - validate ảnh đầu vào (có mặt người / có mờ / có tối không...)
  const [imageValidation, setImageValidation] = useState<ImageValidation | null>(null);
  const [validating, setValidating] = useState(false);

  // STATE - lựa chọn nhân vật + tỉ lệ ảnh
  const [selectedHero, setSelectedHero] = useState(DEFAULT_HERO_ID);
  const [selectedRatio, setSelectedRatio] = useState(DEFAULT_ASPECT_RATIO);

  // STATE - Thành phần B (gọi API, loading, kết quả)
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null); // ảnh siêu anh hùng trả về từ Gemini (base64)
  const [finalImage, setFinalImage] = useState<string | null>(null); // ảnh sau khi overlay tên (Thành phần C)

  // STATE - Thành phần D (log)
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(true);

  // Refs cho camera & input file
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // XỬ LÝ ẢNH - Thành phần A
  // ============================================================

  // Upload ảnh từ thiết bị
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setImageValidation(null); // reset kết quả validate cũ trước khi xử lý ảnh mới

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    setImagePreview(result);
    const base64 = result.split(',')[1];
    setImageBase64(base64);
    validateImage(base64);
  };
  reader.readAsDataURL(file);
  setShowUploadMenu(false);
};

  // Bật camera trình duyệt
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
        },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMode('camera');
      setShowUploadMenu(false);
    } catch (err) {
      // Bắt lỗi khi user từ chối quyền camera hoặc thiết bị không hỗ trợ
      toast.error('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập trình duyệt.');
      console.error(err);
    }
  };

  // Chụp ảnh từ luồng camera đang chạy
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg');
    setImagePreview(dataUrl);
    const base64 = dataUrl.split(',')[1];
    setImageBase64(base64);
    setImageValidation(null);
    validateImage(base64);

    // Tắt camera sau khi chụp xong
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setMode('idle');
  };

  // Hủy camera, không chụp
  const cancelCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setMode('idle');
  };

  useEffect(() => {
    if (mode === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play();
    }
  }, [mode]);

  // ============================================================
  // VALIDATE ẢNH - kiểm tra có mặt người, ảnh có mờ/tối không
  // trước khi cho phép Generate (gọi Gemini phân tích ảnh)
  // ============================================================
  const validateImage = async (base64: string) => {
  setValidating(true);

  const logId = addLog({ action: 'Validate ảnh đầu vào', status: 'pending' });
  const startTime = Date.now();

  try {
    const res = await fetch('/api/validate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    const data = await res.json();
    const latency = Date.now() - startTime;

    if (!res.ok || !data.success) {
      updateLog(logId, {
        status: 'error',
        httpStatus: data.httpStatus || res.status,
        latency,
        errorMessage: data.error,
      });
      // Lỗi hệ thống khi validate (network, Gemini lỗi...) -> reset ảnh, không giữ ảnh lỗi trên màn hình
      resetImage();
      toast.error(data.error || 'Không thể kiểm tra ảnh, vui lòng thử lại.');
      return;
    }

    updateLog(logId, {
      status: 'success',
      httpStatus: data.httpStatus,
      latency,
      requestPayload: data.requestPayload,
    });

    if (!data.validation.isValid) {
      // Ảnh không đạt yêu cầu (mờ, tối, sai số mặt...) -> reset về trạng thái chưa có ảnh
      // để người dùng chọn/chụp ảnh khác ngay, thay vì phải tự bấm "Chọn lại ảnh khác"
      resetImage();
      toast.warning(data.validation.reason);
      return;
    }

    setImageValidation(data.validation);
  } catch (err: any) {
    const latency = Date.now() - startTime;
    updateLog(logId, { status: 'error', latency, errorMessage: err.message || 'Lỗi kết nối mạng' });
    resetImage();
    toast.error('Không thể kết nối để kiểm tra ảnh.');
  } finally {
    setValidating(false);
  }
};

// Reset toàn bộ state liên quan đến ảnh, dùng khi ảnh không hợp lệ hoặc người dùng chọn ảnh khác
const resetImage = () => {
  setImagePreview(null);
  setImageBase64(null);
  setImageValidation(null);
};

  // ============================================================
  // THÀNH PHẦN C - Overlay tên lên ảnh kết quả bằng Canvas
  // Input là base64 thuần trả về từ Gemini (không có prefix data:...)
  // ============================================================
  const overlayNameOnImage = (base64Image: string, userName: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Image);

        // Vẽ ảnh gốc lên canvas
        ctx.drawImage(img, 0, 0);

        // Cấu hình chữ: cỡ chữ tỉ lệ theo chiều rộng ảnh để không bị quá to/nhỏ
        const fontSize = Math.floor(img.width * 0.06);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';

        const textX = img.width / 2;
        const textY = img.height - fontSize * 1.2; // đặt tên gần đáy ảnh

        // Viền đen + chữ trắng để tên luôn rõ dù ảnh nền sáng/tối
        ctx.lineWidth = fontSize * 0.08;
        ctx.strokeStyle = 'black';
        ctx.strokeText(userName.toUpperCase(), textX, textY);

        ctx.fillStyle = 'white';
        ctx.fillText(userName.toUpperCase(), textX, textY);

        resolve(canvas.toDataURL('image/png'));
      };
      // Ảnh từ Gemini là base64 thuần, tự thêm prefix để trình duyệt hiểu đúng định dạng
      img.src = `data:image/png;base64,${base64Image}`;
    });
  };

  // ============================================================
  // GHI LOG - Thành phần D
  // ============================================================

  // Thêm 1 log mới, trả về id để update lại sau (khi có kết quả)
  const addLog = (entry: Partial<LogEntry>): string => {
    const id = crypto.randomUUID();
    setLogs((prev) => [
      {
        id,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        action: entry.action || '',
        status: entry.status || 'pending',
        ...entry,
      },
      ...prev, // log mới nhất hiện lên đầu danh sách
    ]);
    return id;
  };

  // Cập nhật lại 1 log đã tồn tại (theo id) khi có kết quả trả về
  const updateLog = (id: string, updates: Partial<LogEntry>) => {
    setLogs((prev) => prev.map((log) => (log.id === id ? { ...log, ...updates } : log)));
  };

  // ============================================================
  // GỌI API GENERATE - Thành phần B
  // ============================================================
  const handleGenerate = async () => {
    // Không disable cứng nút nữa -> validate ở đây và toast rõ ràng đang thiếu gì,
    // để người dùng biết chính xác cần làm gì thay vì đoán vì sao nút không bấm được
    if (!name) {
      toast.warning('Vui lòng nhập tên của bạn.');
      return;
    }
    if (!imageBase64) {
      toast.warning('Vui lòng tải ảnh hoặc chụp ảnh trước khi tiếp tục.');
      return;
    }
    if (validating) {
      toast.info('Đang kiểm tra ảnh, vui lòng đợi trong giây lát.');
      return;
    }
    if (imageValidation?.isValid === false) {
      toast.warning(imageValidation.reason || 'Ảnh chưa hợp lệ, vui lòng chọn ảnh khác.');
      return;
    }

    setLoading(true);
    setResultImage(null);
    setFinalImage(null);

    // Ghi log ngay khi bắt đầu gửi request (trạng thái pending)
    const logId = addLog({
      action: `Generate superhero (${selectedHero}, ${selectedRatio})`,
      status: 'pending',
    });

    const startTime = Date.now();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          heroId: selectedHero,
          aspectRatio: selectedRatio,
        }),
      });

      const data = await res.json();
      const latency = Date.now() - startTime;

      if (!res.ok || !data.success) {
        // Trường hợp lỗi: rate limit, timeout, Gemini từ chối nội dung...
        updateLog(logId, {
          status: 'error',
          httpStatus: data.httpStatus || res.status,
          latency,
          errorMessage: data.error || 'Lỗi không xác định',
          requestPayload: data.requestPayload,
        });
        toast.error(data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
        return;
      }

      // Thành công: cập nhật log + hiển thị ảnh kết quả
      updateLog(logId, {
        status: 'success',
        httpStatus: data.httpStatus,
        latency,
        requestPayload: data.requestPayload,
      });

      setResultImage(data.resultImageBase64);

      // Thành phần C: overlay tên lên ảnh ngay sau khi có ảnh kết quả
      const overlaid = await overlayNameOnImage(data.resultImageBase64, name);
      setFinalImage(overlaid);
      toast.success('Đã tạo ảnh siêu anh hùng thành công!');
    } catch (err: any) {
      // Lỗi network/timeout phía client (không kết nối được server)
      const latency = Date.now() - startTime;
      updateLog(logId, {
        status: 'error',
        latency,
        errorMessage: err.message || 'Lỗi kết nối mạng',
      });
      toast.error('Không thể kết nối tới server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // GIAO DIỆN
  // ============================================================
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">🦸 Superhero Generator</h1>

        {/* ---------- Thành phần A: Input tên ---------- */}
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

        {/* ---------- Thành phần A: Upload / Camera ---------- */}
        <div className="relative">
          <label className="block text-sm mb-2 text-gray-300">Ảnh của bạn</label>

          {mode === 'camera' ? (
            // Đang bật camera: hiện video preview + nút chụp/hủy
            <div className="space-y-3">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
              <div className="flex gap-3">
                <button
                  onClick={capturePhoto}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium"
                >
                  📸 Chụp ảnh
                </button>
                <button
                  onClick={cancelCamera}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : imagePreview ? (
            // Đã có ảnh: hiện preview + nút chọn lại + trạng thái validate
            <div className="space-y-3">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full rounded-lg max-h-72 object-contain border border-gray-700"
              />

              {/* Trạng thái validate ảnh - giữ hiển thị inline vì đây là trạng thái liên tục,
                  không phải sự kiện tức thời như toast */}
              {validating && (
                <p className="text-sm text-yellow-400 flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  Đang kiểm tra ảnh...
                </p>
              )}

              <button
                onClick={resetImage}
                className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium"
              >
                Chọn lại ảnh khác
              </button>
            </div>
          ) : (
            // Chưa có ảnh: hiện 1 ô bấm vào để mở menu Upload / Camera
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* ---------- Chọn nhân vật ---------- */}
        <div>
          <label className="block text-sm mb-2 text-gray-300">Chọn siêu anh hùng</label>
          <div className="grid grid-cols-4 gap-3">
            {HEROES.map((hero) => (
              <button
                key={hero.id}
                onClick={() => setSelectedHero(hero.id)}
                className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition ${
                  selectedHero === hero.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-800'
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

        {/* ---------- Chọn tỉ lệ khung hình ---------- */}
        <div>
          <label className="block text-sm mb-2 text-gray-300">Tỉ lệ ảnh</label>
          <div className="grid grid-cols-3 gap-3">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setSelectedRatio(ratio.value)}
                className={`py-3 rounded-lg border-2 text-sm font-medium transition ${
                  selectedRatio === ratio.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- Nút Generate ----------
            Không disable khi thiếu tên/ảnh nữa (chỉ disable khi đang loading/validating
            hoặc ảnh CHẮC CHẮN không hợp lệ) - các trường hợp thiếu input sẽ được
            handleGenerate chặn và báo rõ bằng toast khi bấm, thay vì im lặng disable nút */}
        <button
          onClick={handleGenerate}
          disabled={loading || validating || imageValidation?.isValid === false}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed py-3 rounded-lg font-bold flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              {/* Spinner loading - yêu cầu UI/UX trong đề bài */}
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Đang biến hình...
            </>
          ) : (
            '⚡ Biến thành Siêu anh hùng'
          )}
        </button>

        {/* ---------- Kết quả ảnh (sau khi overlay tên) ---------- */}
        {finalImage && (
          <div className="space-y-2">
            <label className="block text-sm text-gray-300">Kết quả</label>

            <img
              src={finalImage}
              alt="Result"
              className="w-full rounded-lg border border-gray-700"
            />

            <a
              href={finalImage}
              download={`superhero-${name}.png`}
              className="block text-center bg-green-600 hover:bg-green-700 py-2 rounded-lg font-medium"
            >
              ⬇️ Tải ảnh về
            </a>
          </div>
        )}

        {/* ---------- Thành phần D: Log Panel (giữ nguyên, không đổi sang toast) ---------- */}
        <div className="border border-gray-700 rounded-lg">
          <button
            onClick={() => setShowLogPanel(!showLogPanel)}
            className="w-full px-4 py-3 flex justify-between items-center text-sm font-medium bg-gray-800 rounded-t-lg"
          >
            <span>📋 System Log ({logs.length})</span>
            <span>{showLogPanel ? '▲' : '▼'}</span>
          </button>

          {showLogPanel && (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-800">
              {logs.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Chưa có log nào.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 text-xs font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">[{log.timestamp}]</span>
                      <span
                        className={
                          log.status === 'success'
                            ? 'text-green-400'
                            : log.status === 'error'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }
                      >
                        {log.status === 'success' ? '✓ SUCCESS' : log.status === 'error' ? '✗ ERROR' : '… PENDING'}
                      </span>
                    </div>
                    <div className="text-gray-300">{log.action}</div>
                    {log.httpStatus && (
                      <div className="text-gray-500">HTTP {log.httpStatus} · {log.latency}ms</div>
                    )}
                    {log.errorMessage && (
                      <div className="text-red-400">Error: {log.errorMessage}</div>
                    )}
                    {log.requestPayload && (
                      <details className="text-gray-500">
                        <summary className="cursor-pointer">Xem payload</summary>
                        <pre className="whitespace-pre-wrap break-all mt-1">
                          {JSON.stringify(log.requestPayload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}