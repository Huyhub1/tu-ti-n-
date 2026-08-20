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

export function fuseSkills(user, rarityToFuse = 'HOANG_GIAI') {
  // Tìm các công pháp đã đạt 100% mastery của phẩm cấp này
  const masterSkills = user.skills.filter(s => s.rarity === rarityToFuse && s.mastery >= 100);

  if (masterSkills.length < 5) {
    return {
      success: false,
      message: `Cần ít nhất **5 công pháp phẩm ${rarityToFuse}** đã đạt **100% Viên Mãn** để dung hợp! (Hiện có: ${masterSkills.length}/5)`
    };
  }

  // Chọn 5 công pháp để tiêu hao
  const consumedSkills = masterSkills.slice(0, 5);
  const consumedSkillIds = consumedSkills.map(s => s.skillId);

  // Xác định phẩm cấp mục tiêu
  const rarityProgression = {
    'HOANG_GIAI': 'HUYEN_GIAI',
    'HUYEN_GIAI': 'DIA_GIAI',
    'DIA_GIAI': 'THIEN_GIAI',
    'THIEN_GIAI': 'THAN_GIAI'
  };

  const nextRarity = rarityProgression[rarityToFuse];
  if (!nextRarity) {
    return {
      success: false,
      message: `Phẩm cấp này đã là cực hạn, không thể dung hợp tiếp!`
    };
  }

  // Lọc các công pháp bậc cao hơn mà user chưa học
  const potentialSkills = skillsConfig.skills.filter(s => s.rarity === nextRarity);
  const unlearnedSkills = potentialSkills.filter(s => !user.skills.some(us => us.skillId === s.id));

  const targetSkill = (unlearnedSkills.length > 0)
    ? unlearnedSkills[Math.floor(Math.random() * unlearnedSkills.length)]
    : potentialSkills[Math.floor(Math.random() * potentialSkills.length)];

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
    message: `🔮 **DUNG HỢP THÀNH CÔNG!** Đã tôi luyện 5 công pháp ${rarityToFuse} viên mãn thành bí kíp **[${targetSkill.name}]** (${nextRarity})!`
  };
}
