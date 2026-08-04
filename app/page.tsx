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

interface ImageValidation {
  isValid: boolean;
  reason?: string;
  hasFace?: boolean;
  faceCount?: number;
  isBlurry?: boolean;
  isTooDark?: boolean;
  isFaceClear?: boolean;
}

// Mosaic ghép từ 5 ảnh nền có sẵn trong /public/background,
// xếp thành 1 khối chữ nhật dọc: 9:16 -> (1:1 + 1:1) -> 16:9 -> 9:16
const MOSAIC_ROWS: { images: string[]; ratio: string }[] = [
  { images: ['/background/9-16-1.png'], ratio: 'aspect-[9/16]' },
  { images: ['/background/1-1-1.png', '/background/1-1-2.png'], ratio: 'aspect-square' },
  { images: ['/background/16-9.png'], ratio: 'aspect-[16/9]' },
  { images: ['/background/9-16-2.png'], ratio: 'aspect-[9/16]' },
];

export default function Home() {
  // ----------------------------------------------------------
  // STATE - Thành phần A (input tên + ảnh)
  // ----------------------------------------------------------
  const [name, setName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'camera'>('idle');
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  const [imageValidation, setImageValidation] = useState<ImageValidation | null>(null);
  const [validating, setValidating] = useState(false);

  const [selectedHero, setSelectedHero] = useState(DEFAULT_HERO_ID);
  const [selectedRatio, setSelectedRatio] = useState(DEFAULT_ASPECT_RATIO);

  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // XỬ LÝ ẢNH - Thành phần A
  // ============================================================

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageValidation(null);

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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMode('camera');
      setShowUploadMenu(false);
    } catch (err) {
      toast.error('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập trình duyệt.');
      console.error(err);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');

    // Lật ngang khi vẽ để ảnh chụp khớp với preview đã mirror (giống camera trước điện thoại thật)
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
    }

    const dataUrl = canvas.toDataURL('image/jpeg');
    setImagePreview(dataUrl);
    const base64 = dataUrl.split(',')[1];
    setImageBase64(base64);
    setImageValidation(null);
    validateImage(base64);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    setMode('idle');
  };

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
  // VALIDATE ẢNH
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

  const resetImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setImageValidation(null);
  };

  // ============================================================
  // THÀNH PHẦN C - Overlay tên lên ảnh kết quả bằng Canvas
  // ============================================================
  const overlayNameOnImage = (base64Image: string, userName: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Image);

        await document.fonts.load('48px "GreatVibes"');

        ctx.drawImage(img, 0, 0);

        const fontSize = Math.floor(img.width * 0.1);

        ctx.font = `${fontSize}px "GreatVibes"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        const textX = img.width / 2;
        const textY = img.height - fontSize * 0.8;

        ctx.lineWidth = fontSize * 0.06;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(userName, textX, textY);

        ctx.fillStyle = '#fff';
        ctx.fillText(userName, textX, textY);

        resolve(canvas.toDataURL('image/png'));
      };

      img.src = `data:image/png;base64,${base64Image}`;
    });
  };

  // ============================================================
  // GHI LOG
  // ============================================================
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
      ...prev,
    ]);
    return id;
  };

  const updateLog = (id: string, updates: Partial<LogEntry>) => {
    setLogs((prev) => prev.map((log) => (log.id === id ? { ...log, ...updates } : log)));
  };

  // ============================================================
  // GỌI API GENERATE
  // ============================================================
  const handleGenerate = async () => {
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

      updateLog(logId, {
        status: 'success',
        httpStatus: data.httpStatus,
        latency,
        requestPayload: data.requestPayload,
      });

      setResultImage(data.resultImageBase64);

      const overlaid = await overlayNameOnImage(data.resultImageBase64, name);
      setFinalImage(overlaid);
      toast.success('Đã tạo ảnh siêu anh hùng thành công!');
    } catch (err: any) {
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

  const canGenerate = !loading && !validating && imageValidation?.isValid !== false;

  const [selectedDemoImage, setSelectedDemoImage] = useState<string | null>(null);

  // ============================================================
  // GIAO DIỆN
  // ============================================================
  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#0B0B0F] text-[#F5F0E6] selection:bg-[#FFC93C] selection:text-black">

      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px]
                  bg-red-600/15 blur-[180px]" />

      <div className="pointer-events-none absolute top-80 right-0 w-[500px] h-[500px]
                  bg-yellow-400/8 blur-[180px]" />
      <div className="pointer-events-none absolute bottom-20 left-0 w-[450px] h-[450px]
                  bg-[#E63946]/10 blur-[160px]" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-comic { font-family: 'Bangers', system-ui, sans-serif; letter-spacing: 0.02em; }
        .font-body { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .halftone-bg {
          background-image:
            radial-gradient(#ffffff18 1px, transparent 1px),
            linear-gradient(
              180deg,
              rgba(230,57,70,.08),
              transparent 30%,
              transparent 70%,
              rgba(255,201,60,.05)
            );

          background-size: 14px 14px, 100% 100%;
        }
        .comic-panel {
          border: 3px solid #1a1a1f;
          box-shadow: 6px 6px 0 #E63946;
        }
        .comic-panel-blue { box-shadow: 6px 6px 0 #1D3E9C; }
        .comic-panel-yellow { box-shadow: 6px 6px 0 #FFC93C; }
        @keyframes shine {
  100% {
    transform: translateX(200%);
  }
}
      `}</style>

      {/* Modal Xem Ảnh Demo / Kết quả Fullsize */}
      {selectedDemoImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedDemoImage(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setSelectedDemoImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-[#FFC93C] font-mono text-sm bg-black/60 px-3 py-1 rounded border border-white/20 transition"
            >
              ✕ Đóng
            </button>
            <img
              src={selectedDemoImage}
              alt="Full view"
              className="max-w-full max-h-[85vh] object-contain rounded-md border-2 border-[#FFC93C] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <div className="halftone-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">
          {/* ---------- TIÊU ĐỀ LỚN ---------- */}
          <header className="text-center space-y-3">
            <p className="mb-4 font-mono text-sm font-bold tracking-[0.3em] text-[#FFC93C] uppercase drop-shadow-[0_0_10px_rgba(255,201,60,0.3)]">
              Hero Studio · phiên bản beta
            </p>
            <h1 className="font-comic text-3xl sm:text-4xl md:text-5xl text-white tracking-wide drop-shadow-[0_4px_12px_rgba(230,57,70,0.5)]">
              Biến thân thành siêu anh hùng mà bạn muốn
            </h1>

            <p className="mt-3 font-body text-xs sm:text-sm text-slate-400 tracking-wide font-sans">
              Tải ảnh cá nhân &gt; Nhập tên &gt; Chọn danh tính &gt; Chọn tỉ lệ ảnh &gt; <span className="text-white font-semibold">⚡BIẾN HÌNH NGAY</span>
            </p>
          </header>

          {/* ---------- KHU VỰC LÀM VIỆC CHÍNH ---------- */}
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-stretch">
            {/* CỘT 1: Ảnh nguồn */}
            <div className="flex flex-col">
              <div className="flex-1 rounded-xl overflow-hidden bg-[#15151b]/80 border border-white/10 backdrop-blur-md aspect-square flex items-center justify-center relative group shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:border-[#FFC93C]/40 transition duration-300">
                {/* Label badge inside */}
                <div className="absolute top-3 left-3 z-30 font-mono text-[10px] uppercase tracking-widest text-[#FFC93C] bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md border border-[#FFC93C]/20">
                  📸 Ảnh của bạn
                </div>
                {mode === 'camera' ? (
                  <div className="w-full h-full flex flex-col">
                    <video ref={videoRef} autoPlay playsInline muted className="flex-1 min-h-0 w-full object-cover -scale-x-100" />
                    <div className="flex-shrink-0 flex gap-2 p-3 bg-[#0B0B0F]/90 backdrop-blur-md">
                      <button
                        onClick={capturePhoto}
                        className="flex-1 bg-[#E63946] hover:bg-[#c92e3a] py-2 rounded-lg font-body font-bold text-sm text-white shadow-lg transition"
                      >
                        📸 Chụp ảnh
                      </button>
                      <button
                        onClick={cancelCamera}
                        className="flex-1 bg-[#2a2a33] hover:bg-[#35353f] py-2 rounded-lg font-body font-bold text-sm text-white transition"
                      >
                        ❌ Hủy
                      </button>
                    </div>
                  </div>
                ) : imagePreview ? (
                  <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-[#0B0B0F]">
                    {/* Blurred Backdrop phủ kín khung */}
                    <div
                      className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-125"
                      style={{ backgroundImage: `url(${imagePreview})` }}
                    />
                    <img src={imagePreview} alt="Preview" className="relative z-10 w-full h-full object-contain p-2" />

                    {validating && (
                      <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                        <p className="text-sm font-body text-[#FFC93C] flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-[#FFC93C] border-t-transparent rounded-full animate-spin" />
                          Đang kiểm tra ảnh...
                        </p>
                      </div>
                    )}
                    <button
                      disabled={loading}
                      onClick={() => setShowUploadMenu(!showUploadMenu)}
                      className="absolute bottom-3 right-3 bg-[#0B0B0F]/80 hover:bg-black border border-white/20 hover:border-[#FFC93C] px-3.5 py-1.5 rounded-lg text-xs font-body font-medium shadow-xl backdrop-blur-md transition disabled:opacity-50 disabled:cursor-not-allowed z-20"
                    >
                      🔄 Chọn lại ảnh khác
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowUploadMenu(!showUploadMenu)}
                    className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition p-6 text-center group"
                  >
                    <span className="text-5xl group-hover:scale-110 transition duration-300 opacity-40">📷</span>
                    <span className="text-xs font-body text-[#F5F0E6]/60 group-hover:text-white transition">
                      Bấm để tải ảnh của bạn
                    </span>
                    <span className="font-body text-xs text-[#F5F0E6]/50 italic">
                      (Chọn ảnh cá nhân, rõ mặt để đảm bảo chất lượng tốt nhất)
                    </span>
                  </button>
                )}

                {showUploadMenu && mode !== 'camera' && (
                  <div className="absolute inset-x-4 bottom-14 bg-[#15151b]/95 border border-white/20 rounded-xl overflow-hidden z-30 shadow-2xl backdrop-blur-xl">
                    <button
                      disabled={loading}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3.5 text-left hover:bg-white/10 flex items-center gap-2.5 font-body text-sm text-white transition disabled:opacity-50"
                    >
                      📁 Tải ảnh từ máy
                    </button>
                    <button
                      disabled={loading}
                      onClick={startCamera}
                      className="w-full px-4 py-3.5 text-left hover:bg-white/10 flex items-center gap-2.5 border-t border-white/10 font-body text-sm text-white transition disabled:opacity-50"
                    >
                      📸 Chụp ảnh bằng Camera
                    </button>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* CỘT 2: Lựa chọn nhân vật + tỉ lệ + nút generate */}
            <div className="space-y-5 lg:w-72 bg-[#15151b]/60 border border-white/10 backdrop-blur-md p-4 rounded-xl shadow-xl">
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-widest text-[#FFC93C] mb-2">
                  ✏️ Tên của bạn
                </label>
                <input
                  type="text"
                  disabled={loading}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="w-full px-4 py-3 rounded-lg bg-[#0B0B0F]/80 border border-white/10 focus:border-[#FFC93C] outline-none font-body text-sm text-white placeholder-white/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-widest text-[#FFC93C] mb-2">
                  🦸 Danh tính
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {HEROES.map((hero: any) => (
                    <button
                      key={hero.id}
                      disabled={loading}
                      onClick={() => setSelectedHero(hero.id)}
                      className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition ${selectedHero === hero.id
                        ? 'border-[#FFC93C] bg-[#FFC93C]/15 shadow-[0_0_15px_rgba(255,201,60,0.2)]'
                        : 'border-white/10 bg-[#0B0B0F]/60 hover:border-white/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="w-full aspect-[4/3] bg-white rounded-md flex items-center justify-center overflow-hidden">
                        <img
                          src={hero.thumbnail}
                          alt={hero.name}
                          className="h-[85%] w-auto object-contain"
                        />
                      </div>

                      <span className="text-[11px] font-body text-white/80 font-medium">
                        {hero.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-widest text-[#FFC93C] mb-2">
                  📐 Tỉ lệ ảnh
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((ratio: any) => (
                    <button
                      key={ratio.id}
                      disabled={loading}
                      onClick={() => setSelectedRatio(ratio.value)}
                      className={`py-2 rounded-lg border text-xs font-body font-bold transition ${selectedRatio === ratio.value
                        ? 'border-[#FFC93C] bg-[#FFC93C]/15 text-[#FFC93C]'
                        : 'border-white/10 bg-[#0B0B0F]/60 text-white/70 hover:border-white/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!canGenerate || loading}
                className="
                  relative w-full overflow-hidden
                  rounded-xl py-4
                  font-comic text-2xl tracking-wider text-white
                  bg-gradient-to-r from-[#E63946] via-[#F04E59] to-[#C92E3A]
                  shadow-[0_8px_30px_rgba(230,57,70,0.45)]
                  hover:scale-[1.02]
                  hover:shadow-[0_10px_40px_rgba(230,57,70,0.65)]
                  active:scale-[0.98]
                  transition-all duration-300
                  disabled:from-[#2a2a33]
                  disabled:via-[#2a2a33]
                  disabled:to-[#2a2a33]
                  disabled:shadow-none
                  disabled:cursor-not-allowed
                "
              >
                {/* ánh sáng chạy */}
                {!loading && (
                  <span
                    className="
                      absolute inset-0
                      -translate-x-full
                      bg-gradient-to-r
                      from-transparent
                      via-white/20
                      to-transparent
                      animate-[shine_2.5s_linear_infinite]
                    "
                  />
                )}

                <span className="relative flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang biến hình...
                    </>
                  ) : (
                    <>
                      <span className="text-2xl -ml-1 relative z-20">⚡</span>
                      <span className="-ml-3 relative z-10">Biến hình ngay</span>
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* CỘT 3: Kết quả */}
            <div className="flex flex-col">
              <div className="flex-1 rounded-xl overflow-hidden bg-[#15151b]/80 border border-white/10 backdrop-blur-md aspect-square flex items-center justify-center relative shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:border-[#FFC93C]/40 transition duration-300">
                {/* Label badge inside */}
                <div className="absolute top-3 left-3 z-30 font-mono text-[10px] uppercase tracking-widest text-[#FFC93C] bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md border border-[#FFC93C]/20">
                  🏆 Kết quả
                </div>
                {finalImage ? (
                  <div
                    onClick={() => setSelectedDemoImage(finalImage)}
                    className="w-full h-full cursor-pointer group relative flex items-center justify-center bg-[#0B0B0F] overflow-hidden"
                  >
                    {/* Blurred Backdrop phủ kín khung kết quả */}
                    <div
                      className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-125"
                      style={{ backgroundImage: `url(${finalImage})` }}
                    />
                    <img
                      src={finalImage}
                      alt="Result"
                      className="relative z-10 w-full h-full object-contain p-2 group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 z-20 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-body text-white font-medium backdrop-blur-[2px]">
                      🔍 Xem ảnh
                    </div>
                    <a
                      href={finalImage}
                      download={`superhero-${name}.png`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-3 right-3 bg-[#0B0B0F]/80 hover:bg-black border border-white/20 hover:border-[#FFC93C] px-3.5 py-1.5 rounded-lg text-xs font-body font-medium text-white flex items-center gap-1.5 shadow-xl backdrop-blur-md transition z-30"
                    >
                      ⬇️ Tải ảnh về
                    </a>
                  </div>
                ) : loading ? (
                  <div className="w-full h-full animate-pulse bg-[#1c1c22]/50 flex items-center justify-center">
                    <span className="font-body text-xs text-[#F5F0E6]/50">Đang tạo ảnh siêu anh hùng...</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <span className="text-5xl opacity-40">🏆</span>
                    <span className="text-xs font-body text-[#F5F0E6]/60">
                      Ảnh siêu anh hùng của bạn sẽ xuất hiện ở đây
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ---------- BỘ SƯU TẬP DEMO + LOG PANEL ---------- */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Bộ sưu tập Demo Gallery (Chiếm 2 cột) */}
            <div className="lg:col-span-2 flex flex-col justify-between">
              <label className="block font-mono text-[11px] uppercase tracking-widest text-[#FFC93C] mb-2 flex-shrink-0">
                🎨 Bộ sưu tập demo (Bấm vào ảnh để xem chi tiết)
              </label>
              <div className="rounded-xl overflow-hidden bg-[#15151b]/80 border border-white/10 backdrop-blur-md p-4 flex-1 flex flex-col justify-center shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_1fr] gap-3.5 items-center">
                  {/* Cột 1: Ảnh 9:16 dọc */}
                  <div
                    onClick={() => setSelectedDemoImage('/background/9-16-1.png')}
                    className="rounded-lg overflow-hidden border border-white/10 hover:border-[#FFC93C]/50 bg-[#0B0B0F] aspect-[9/16] cursor-pointer group relative transition duration-300 shadow-md"
                  >
                    <img
                      src="/background/9-16-1.png"
                      alt="Demo 1"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-body text-white font-medium backdrop-blur-[2px]">
                      🔍 Xem ảnh
                    </div>
                  </div>

                  {/* Cột 2: Ghép 2 ảnh 1:1 vuông + 1 ảnh 16:9 ngang ở dưới */}
                  <div className="flex flex-col gap-3.5 justify-center">
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setSelectedDemoImage('/background/1-1-1.png')}
                        className="rounded-lg overflow-hidden border border-white/10 hover:border-[#FFC93C]/50 bg-[#0B0B0F] aspect-square cursor-pointer group relative transition duration-300 shadow-md"
                      >
                        <img
                          src="/background/1-1-1.png"
                          alt="Demo 2"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] font-body text-white font-medium backdrop-blur-[2px]">
                          🔍 Xem
                        </div>
                      </div>
                      <div
                        onClick={() => setSelectedDemoImage('/background/1-1-2.png')}
                        className="rounded-lg overflow-hidden border border-white/10 hover:border-[#FFC93C]/50 bg-[#0B0B0F] aspect-square cursor-pointer group relative transition duration-300 shadow-md"
                      >
                        <img
                          src="/background/1-1-2.png"
                          alt="Demo 3"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] font-body text-white font-medium backdrop-blur-[2px]">
                          🔍 Xem
                        </div>
                      </div>
                    </div>
                    <div
                      onClick={() => setSelectedDemoImage('/background/16-9.png')}
                      className="rounded-lg overflow-hidden border border-white/10 hover:border-[#FFC93C]/50 bg-[#0B0B0F] aspect-[16/9] cursor-pointer group relative transition duration-300 shadow-md"
                    >
                      <img
                        src="/background/16-9.png"
                        alt="Demo 4"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-body text-white font-medium backdrop-blur-[2px]">
                        🔍 Xem ảnh
                      </div>
                    </div>
                  </div>

                  {/* Cột 3: Ảnh 9:16 dọc */}
                  <div
                    onClick={() => setSelectedDemoImage('/background/9-16-2.png')}
                    className="rounded-lg overflow-hidden border border-white/10 hover:border-[#FFC93C]/50 bg-[#0B0B0F] aspect-[9/16] cursor-pointer group relative transition duration-300 shadow-md"
                  >
                    <img
                      src="/background/9-16-2.png"
                      alt="Demo 5"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-body text-white font-medium backdrop-blur-[2px]">
                      🔍 Xem ảnh
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Log panel (Chiếm 1 cột) */}
            <div className="lg:col-span-1 flex flex-col justify-between">
              <label className="block font-mono text-[11px] uppercase tracking-widest text-[#FFC93C] mb-2 flex-shrink-0">
                ⚙️ Nhật ký hệ thống
              </label>
              <div className="rounded-xl overflow-hidden bg-[#15151b]/80 border border-white/10 backdrop-blur-md flex-1 flex flex-col min-h-[300px] shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                <button
                  onClick={() => setShowLogPanel(!showLogPanel)}
                  className="w-full px-4 py-3.5 flex justify-between items-center font-body text-sm font-bold bg-white/5 hover:bg-white/10 border-b border-white/10 text-white transition"
                >
                  <span>📋 System Log ({logs.length})</span>
                  <span className="text-[#FFC93C]">{showLogPanel ? '▲' : '▼'}</span>
                </button>

                {showLogPanel && (
                  <div className="flex-1 max-h-[380px] overflow-y-auto divide-y divide-white/10">
                    {logs.length === 0 ? (
                      <p className="p-4 text-sm font-body text-white/40">Chưa có log nào.</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="p-3 text-xs font-mono space-y-1">
                          <div className="flex justify-between">
                            <span className="text-white/40">[{log.timestamp}]</span>
                            <span
                              className={
                                log.status === 'success'
                                  ? 'text-green-400 font-bold'
                                  : log.status === 'error'
                                    ? 'text-red-400 font-bold'
                                    : 'text-[#FFC93C] font-bold'
                              }
                            >
                              {log.status === 'success' ? '✓ SUCCESS' : log.status === 'error' ? '✗ ERROR' : '… PENDING'}
                            </span>
                          </div>
                          <div className="text-white/80 font-medium">{log.action}</div>
                          {log.httpStatus && (
                            <div className="text-white/40">HTTP {log.httpStatus} · {log.latency}ms</div>
                          )}
                          {log.errorMessage && (
                            <div className="text-red-400">Error: {log.errorMessage}</div>
                          )}
                          {log.requestPayload && (
                            <details className="text-white/40">
                              <summary className="cursor-pointer hover:text-[#FFC93C] transition">Xem payload</summary>
                              <pre className="whitespace-pre-wrap break-all mt-1 bg-black/40 p-2 rounded border border-white/5">
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
          </section>
        </div>
      </div>
    </main>
  );
}