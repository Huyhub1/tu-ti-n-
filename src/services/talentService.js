import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const talentsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/talents.json'), 'utf8'));


// Toàn bộ đặc quyền tư chất, mặc định 0 để nơi gọi không phải kiểm tra undefined.
// Trước đây talents.json khai báo hpBonus / dmgBonus / breakDiscount /
// skillMasterySpeed / tribulationResist nhưng không dòng code nào đọc tới,
// nên mô tả linh căn ("tăng 20% lực công kích"...) hoàn toàn là lời hứa suông.
const EMPTY_PERKS = {
  hpBonus: 0,            // % HP tối đa cộng thêm mỗi lần tăng cảnh giới
  dmgBonus: 0,           // % sát thương gây ra (săn thú / phó bản / tỉ võ)
  breakDiscount: 0,      // % giảm vạch tu vi cần để đột phá
  skillMasterySpeed: 1,  // hệ số nhân độ thuần thục mỗi lần !luyencong
  tribulationResist: 0   // % giảm sát thương thiên lôi khi !dokiep
};

export function getTalentPerks(tierKey) {
  const tier = talentsConfig.tiers?.[tierKey];
  if (!tier) return { ...EMPTY_PERKS };
  return {
    ...EMPTY_PERKS,
    ...(tier.hpBonus !== undefined ? { hpBonus: tier.hpBonus } : {}),
    ...(tier.dmgBonus !== undefined ? { dmgBonus: tier.dmgBonus } : {}),
    ...(tier.breakDiscount !== undefined ? { breakDiscount: tier.breakDiscount } : {}),
    ...(tier.skillMasterySpeed !== undefined ? { skillMasterySpeed: tier.skillMasterySpeed } : {}),
    ...(tier.tribulationResist !== undefined ? { tribulationResist: tier.tribulationResist } : {})
  };
}

// Perk của một nhân vật (nhận cả user document lẫn chuỗi tier)
export function getUserTalentPerks(userOrTier) {
  const tierKey = typeof userOrTier === 'string' ? userOrTier : userOrTier?.talent?.tier;
  return getTalentPerks(tierKey);
}

// Dòng mô tả đặc quyền để hiển thị ở !thongtin và lúc bốc linh căn
export function getTalentPerkText(tierKey) {
  const p = getTalentPerks(tierKey);
  const bits = [];
  const mult = talentsConfig.tiers?.[tierKey]?.expMultiplier;
  if (mult && mult !== 1) bits.push(`⚡ Tốc độ tu luyện **x${mult}**`);
  if (p.hpBonus) bits.push(`❤️ HP tăng thêm **+${Math.round(p.hpBonus * 100)}%**`);
  if (p.dmgBonus) bits.push(`🗡️ Sát thương **+${Math.round(p.dmgBonus * 100)}%**`);
  if (p.breakDiscount) bits.push(`📉 Vạch đột phá **-${Math.round(p.breakDiscount * 100)}%**`);
  if (p.skillMasterySpeed > 1) bits.push(`📖 Học công pháp **x${p.skillMasterySpeed}**`);
  if (p.tribulationResist) bits.push(`⛈️ Kháng thiên lôi **${Math.round(p.tribulationResist * 100)}%**`);
  if (talentsConfig.tiers?.[tierKey]?.specialSkill) bits.push(`🌟 Được ban **thần thông bẩm sinh**`);
  return bits.length ? bits.join(' · ') : '⚡ Không có đặc quyền bẩm sinh';
}

export function rollInnateTalent() {
  const rand = Math.random();
  let cumulative = 0;
  let selectedTierKey = 'PHAM_PHAM';

  const tierKeys = ['THAN_PHAM', 'THIEN_PHAM', 'CUC_PHAM', 'LUONG_PHAM', 'PHAM_PHAM'];
  
  // Sắp xếp kiểm tra từ hiếm nhất đến phổ thông
  for (const key of tierKeys) {
    const tier = talentsConfig.tiers[key];
    cumulative += tier.rate;
    if (rand <= cumulative) {
      selectedTierKey = key;
      break;
    }
  }

  const tierData = talentsConfig.tiers[selectedTierKey];
  const item = tierData.items[Math.floor(Math.random() * tierData.items.length)];

  return {
    tier: selectedTierKey,
    tierName: tierData.name,
    color: tierData.color,
    name: item.name,
    desc: item.desc,
    expMultiplier: tierData.expMultiplier || 1.0,
    specialSkill: item.skill || null
  };
}
