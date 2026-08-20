import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/skills.json'), 'utf8'));

export function getSkillById(id) {
  return skillsConfig.skills.find(s => s.id === id);
}

export function getAllSkills() {
  return skillsConfig.skills;
}


export function getSkillsByRarity(rarity) {
  return skillsConfig.skills.filter(s => s.rarity === rarity);
}

// Bậc phẩm cấp xếp theo `level` trong skills.json thay vì bảng cứng.
// Quan trọng: bỏ qua các bậc chưa có bí kíp nào (hiện THAN_GIAI đang rỗng),
// nếu không thì dung hợp Thiên Giai sẽ bốc trúng mảng rỗng và ném lỗi.
export const RARITY_ORDER = Object.entries(skillsConfig.rarities || {})
  .sort((a, b) => (a[1].level || 0) - (b[1].level || 0))
  .map(([key]) => key);

export function getRarityName(rarity) {
  return skillsConfig.rarities?.[rarity]?.name || rarity;
}

export function getNextFusableRarity(rarity) {
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0) return null;
  for (let i = idx + 1; i < RARITY_ORDER.length; i++) {
    if (getSkillsByRarity(RARITY_ORDER[i]).length > 0) return RARITY_ORDER[i];
  }
  return null;
}

/**
 * Phẩm cấp cao nhất mà người chơi đủ 5 bí kíp viên mãn để dung hợp.
 * Dùng cho `!dunghop` khi không truyền tham số.
 */
export function findBestFusableRarity(user) {
  for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
    const rarity = RARITY_ORDER[i];
    if (!getNextFusableRarity(rarity)) continue;
    const ready = (user.skills || []).filter(s => s.rarity === rarity && s.mastery >= 100).length;
    if (ready >= 5) return rarity;
  }
  return null;
}

export function fuseSkills(user, rarityToFuse = 'HOANG_GIAI') {
  // Tìm các công pháp đã đạt 100% mastery của phẩm cấp này
  const masterSkills = user.skills.filter(s => s.rarity === rarityToFuse && s.mastery >= 100);


  if (masterSkills.length < 5) {
    return {
      success: false,
      message: `Cần ít nhất **5 công pháp phẩm ${getRarityName(rarityToFuse)}** đã đạt **100% Viên Mãn** để dung hợp! (Hiện có: ${masterSkills.length}/5)`
    };
  }

  // Chọn 5 công pháp để tiêu hao
  const consumedSkills = masterSkills.slice(0, 5);
  const consumedSkillIds = consumedSkills.map(s => s.skillId);

  const nextRarity = getNextFusableRarity(rarityToFuse);
  if (!nextRarity) {
    return {
      success: false,
      message: `**${getRarityName(rarityToFuse)}** đã là cực hạn của phiên bản này, không thể dung hợp tiếp!`
    };
  }

  // Lọc các công pháp bậc cao hơn mà user chưa học
  const potentialSkills = getSkillsByRarity(nextRarity);
  const unlearnedSkills = potentialSkills.filter(s => !user.skills.some(us => us.skillId === s.id));

  if (unlearnedSkills.length === 0) {
    return {
      success: false,
      message: `Đạo hữu đã sưu tầm trọn bộ bí kíp **${getRarityName(nextRarity)}** rồi! Dung hợp thêm chỉ phí công pháp, hãy để dành 5 bí kíp viên mãn này.`
    };
  }

  const targetSkill = unlearnedSkills[Math.floor(Math.random() * unlearnedSkills.length)];

  // Xóa 5 skill cũ
  user.skills = user.skills.filter(s => !consumedSkillIds.includes(s.skillId));

  // Thêm skill mới
  user.skills.push({
    skillId: targetSkill.id,
    name: targetSkill.name,
    category: targetSkill.category,
    rarity: targetSkill.rarity,
    mastery: 10,
    equipped: false
  });

  return {
    success: true,
    skill: targetSkill,

    message: `🔮 **DUNG HỢP THÀNH CÔNG!**\n🔥 Đã tôi luyện 5 công pháp **${getRarityName(rarityToFuse)}** viên mãn thành bí kíp **[${targetSkill.name}]** — phẩm **${getRarityName(nextRarity)}**!\n\n📉 *Tiêu hao:* ${consumedSkills.map(s => `[${s.name}]`).join(', ')}`
  };
}
