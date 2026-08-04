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
      'Transform this person into Superman, keeping their exact facial features and identity fully recognizable, photorealistic style. Classic blue suit, red cape, red boots, with the iconic red and yellow "S" shield emblem clearly visible on the chest. Dynamic fighting pose — mid-punch or mid-flight combat stance, muscles tense, cape flowing dramatically from motion. Anatomically correct human body: exactly two arms, two hands, five fingers per hand, two legs — no extra or duplicated limbs. Only this single character alone in the frame, no other people present. City skyline with battle damage in the background, realistic lighting, ultra-detailed, cinematic photography style, shot on DSLR.',
  },
  {
    id: 'spiderman',
    name: 'Spider-Man',
    thumbnail: '/heroes/spiderman.jpg',
    prompt:
      'Transform this person into a photorealistic spider-themed superhero while preserving their exact facial features and identity.The character wears a sleek red and blue tactical suit with intricate web-inspired textures and an original spider-inspired chest symbol.The mask is pulled back to fully reveal the person real face.Dynamic web-swinging action pose above a modern city, one hand firmly gripping a single web line, the other hand free and open. Anatomically correct human body: exactly two arms, two hands, five fingers per hand, two legs — no extra or duplicated limbs.Ultra detailed, cinematic lighting, realistic photography, DSLR quality.Create an original superhero design inspired by classic comic book heroes. Do not recreate copyrighted characters or logos.',
  },
  {
    id: 'ironman',
    name: 'Iron Man',
    thumbnail: '/heroes/ironman.jpg',
    prompt:
      'Create a completely new photorealistic image of the same person shown in the reference photo. Use the uploaded photo only to recognize the person identity. Generate a brand-new realistic athletic human body with natural anatomy and seamlessly recreated facial features. The superhero wears a luxurious red and gold powered exosuit with advanced metallic plating, glowing blue energy lines, articulated mechanical joints, armored gauntlets, reinforced boots and a bright circular energy core on the chest. The head remains uncovered so the person natural face and hairstyle are fully visible. Dynamic flying combat pose while firing powerful energy blasts from both hands above a futuristic city skyline. Anatomically correct human body: exactly two arms, two hands, five fingers per hand, two legs — no extra or duplicated limbs. Realistic metal reflections, cinematic lighting, volumetric atmosphere, ultra realistic, highly detailed DSLR photography. Generate a completely new image instead of editing the uploaded photo. Create a completely original armored superhero. Do not reproduce copyrighted characters, armor designs or logos.',
  },
];

// Danh sách prompt cho option "Bí ẩn" — hệ thống sẽ random 1 cái mỗi lần generate
export const MYSTERY_PROMPTS: string[] = [
  `Create a completely new photorealistic image of the same person shown in the reference photo. Use the uploaded photo only to recognize the person's identity. Generate a brand-new realistic human from head to toe with natural anatomy, realistic body proportions, and a naturally recreated face, neck and shoulders. The superhero wears a sleek blue and silver energy bodysuit with glowing cyan energy lines, hexagonal armor texture, metallic shoulder armor, armored gloves, reinforced boots and a bright triangular energy core on the chest. Dynamic flying attack while charging a massive blue energy sphere between both hands. Battle-damaged modern city with explosions, smoke, flying debris and dramatic volumetric lighting. Anatomically correct human body: exactly two arms, two hands, five fingers per hand, two legs — no extra or duplicated limbs. Cinematic movie still, ultra realistic, highly detailed DSLR photography. Generate a completely new image instead of editing the uploaded photo.`,

  `Create a completely new photorealistic image of the same person shown in the reference photo. Use the uploaded photo only to recognize the person's identity. Generate a brand-new athletic human body with realistic anatomy and naturally matching facial features. The superhero wears a premium black titanium exosuit with dark graphite armor plates, glowing blue energy strips, illuminated circular chest reactor, mechanical gauntlets and armored boots. Powerful combat stance on a rain-soaked futuristic rooftop overlooking a cyberpunk city at night. Anatomically correct human body: exactly two arms, two hands, five fingers per hand, two legs — no extra or duplicated limbs. Wet metallic reflections, cinematic rim lighting, realistic atmosphere, ultra detailed DSLR photography. Generate a completely new image instead of editing the uploaded photo.`,

  `Create a completely new photorealistic image of the same person shown in the reference photo. Use the uploaded photo only to recognize the person's identity. Generate a brand-new realistic athletic body with seamless anatomy and naturally recreated facial features. The superhero wears a modern black tactical stealth suit with carbon-fiber armor panels, blue illuminated accents, lightweight armored shoulder pads, utility belt, tactical gloves, reinforced boots and a long flowing cape. Dynamic rooftop leap during combat with sparks, smoke and burning buildings in the background. Anatomically correct human body: exactly two arms, two hands, five fingers per hand, two legs — no extra or duplicated limbs. Cinematic action scene, dramatic lighting, ultra realistic, highly detailed DSLR photography. Generate a completely new image instead of editing the uploaded photo.`,

  `Create a completely new photorealistic image of the same person shown in the reference photo. Use the uploaded photo only to recognize the person's identity. Generate a brand-new realistic human body with perfectly natural anatomy and seamless facial integration. The superhero wears luxurious blue and purple biomechanical cosmic armor with glowing nebula textures, metallic shoulder armor, luminous gauntlets, armored boots and a radiant crystal energy core on the chest. Powerful flying pose surrounded by swirling cosmic energy and glowing particles above a destroyed city while a gigantic galaxy portal fills the sky. Anatomically correct human body: exactly two arms, two hands, five fingers per hand, two legs — no extra or duplicated limbs. Epic cinematic composition, volumetric lighting, ultra realistic, highly detailed DSLR photography. Generate a completely new image instead of editing the uploaded photo.`
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