// config/heroes.config.ts
// File cấu hình trung tâm cho các nhân vật siêu anh hùng.
// Muốn thêm/sửa nhân vật hoặc prompt, chỉ cần chỉnh trong file này.

export interface HeroOption {
  id: string;
  name: string;
  thumbnail: string; // đường dẫn ảnh trong thư mục public/heroes/
  prompt: string;     // prompt gửi tới Gemini API
  isMystery?: boolean; // đánh dấu option "Bí ẩn" (random hero)
}

export const HEROES: HeroOption[] = [
   {
    id: 'mystery',
    name: 'Bí ẩn',
    thumbnail: '/heroes/mystery.jpg', // có thể để ảnh dấu chấm hỏi hoặc bỏ trống dùng icon
    isMystery: true,
    // Khi random, hệ thống sẽ chọn ngẫu nhiên 1 prompt trong danh sách bên dưới
    prompt: '',
  },
  {
    id: 'superman',
    name: 'Superman',
    thumbnail: '/heroes/superman.jpg',
    prompt:
      'Transform this person into Superman, keeping their exact facial features and identity fully recognizable, photorealistic style. Classic blue suit, red cape, red boots, with the iconic red and yellow "S" shield emblem clearly visible on the chest. Dynamic fighting pose — mid-punch or mid-flight combat stance, muscles tense, cape flowing dramatically from motion. Only this single character alone in the frame, no other people present. City skyline with battle damage in the background, realistic lighting, ultra-detailed, cinematic photography style, shot on DSLR.',
  },
  {
    id: 'spiderman',
    name: 'Spider-Man',
    thumbnail: '/heroes/spiderman.jpg',
    prompt:
      'Transform this person into a photorealistic spider-themed superhero while preserving their exact facial features and identity.The character wears a sleek red and blue tactical suit with intricate web-inspired textures and an original spider-inspired chest symbol.The mask is pulled back to fully reveal the person real face.Dynamic web-swinging action pose above a modern city.Ultra detailed, cinematic lighting, realistic photography, DSLR quality.Create an original superhero design inspired by classic comic book heroes. Do not recreate copyrighted characters or logos.',
  },
  {
    id: 'ironman',
    name: 'Iron Man',
    thumbnail: '/heroes/ironman.jpg',
    prompt:
      'Transform this person into a photorealistic futuristic armored superhero while preserving their exact facial features.The character wears a luxurious red and gold powered exosuit with advanced metallic plating and a glowing circular energy core on the chest.The helmet is fully opened to reveal the person real face.Dynamic flying combat pose with glowing energy blasts fired from both hands.Ultra detailed, cinematic photography, realistic metal reflections, DSLR quality.Create a completely original armored superhero. Do not reproduce copyrighted characters, armor designs or logos.',
  },
];

// Danh sách prompt cho option "Bí ẩn" — hệ thống sẽ random 1 cái mỗi lần generate
export const MYSTERY_PROMPTS: string[] = [
  'Transform this person into an energy-based superhero, keeping their exact facial features fully recognizable, photorealistic style. Glowing blue energy suit. Dynamic combat pose — mid-air strike or energy blast release, body in powerful motion. Only this single character alone in the frame, no other people present. City street with debris flying from the impact, realistic lighting and textures, cinematic photography style.',
  'Transform this person into a dark tech-armored superhero, keeping their exact facial features fully recognizable, photorealistic style. Black and silver metallic suit. Dynamic fighting stance — mid-combat lunge or defensive block pose, dramatic tension in the body. Only this single character alone in the frame, no other people present. Rooftop overlooking a rain-soaked city at night, neon reflections, realistic cinematic lighting, ultra-detailed, shot on DSLR.',
  'Transform this person into a stealth ninja-style superhero, keeping their real facial features fully intact and recognizable, photorealistic style. Dark tactical suit with a flowing cape. Dynamic combat pose — mid-leap attack or crouched strike stance. Only this single character alone in the frame, no other people present. Building rooftop overlooking a city under attack, smoke and fire in the background, dramatic low-angle shot, cinematic photography style.',
  'Transform this person into a cosmic superhero, preserving their exact face and identity from the photo, photorealistic style. Starry galaxy-patterned suit. Dynamic combat pose — mid-flight attack with cosmic energy trailing behind. Only this single character alone in the frame, no other people present. Battle-torn city below with a portal to space opening in the sky, epic scale, vibrant purple and blue color palette, cinematic photography style.',
];

// Cấu hình tỉ lệ khung hình
export interface AspectRatioOption {
  id: string;
  label: string;
  value: '1:1' | '16:9' | '9:16';
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: 'portrait', label: '9:16 (Dọc)', value: '9:16' },
  { id: 'square', label: '1:1 (Vuông)', value: '1:1' },
  { id: 'landscape', label: '16:9 (Ngang)', value: '16:9' },
];

// Giá trị mặc định theo yêu cầu
export const DEFAULT_HERO_ID = 'mystery';
export const DEFAULT_ASPECT_RATIO = '9:16';