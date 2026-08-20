import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const talentsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/talents.json'), 'utf8'));

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
