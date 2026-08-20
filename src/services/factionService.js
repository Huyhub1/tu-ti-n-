import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const factionsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/factions.json'), 'utf8'));

// Mọi buff đều mặc định 0 để code gọi không cần kiểm tra undefined
const EMPTY_BUFFS = {
  breakSuccessBonus: 0,
  luckBonus: 0,
  damageResist: 0,
  potionEffectBonus: 0,
  expKillBonus: 0,
  cultivateExpBonus: 0,
  critDmgBonus: 0,
  dropRateBonus: 0,
  moneyWorkBonus: 0,
  marketTaxExempt: 0,
  dodgeChance: 0,
  miningBonus: 0
};

export function getFactionData(faction) {
  return factionsConfig.factions[faction] || factionsConfig.factions.TAN_TU;
}

/** Trả về đầy đủ bảng buff của trận doanh (thiếu key nào thì bằng 0). */
export function getFactionBuffs(faction) {
  const data = factionsConfig.factions[faction];
  return { ...EMPTY_BUFFS, ...((data && data.buffs) || {}) };
}

/** Hệ số nhân sát thương chí mạng, đã cộng buff Ma Đạo. */
export function getCritMultiplier(buffs, base = 1.35) {
  return base + (buffs?.critDmgBonus || 0);
}

/**
 * Áp dụng né đòn + giảm sát thương của trận doanh lên đòn đánh nhận vào.
 * Ghi cờ session.lastDodged để log chiến đấu hiển thị đúng.
 */
export function applyIncomingDamage(session, rawDmg) {
  const buffs = session?.factionBuffs || EMPTY_BUFFS;

  if (buffs.dodgeChance > 0 && Math.random() < buffs.dodgeChance) {
    if (session) session.lastDodged = true;
    return 0;
  }

  if (session) session.lastDodged = false;
  const reduced = Math.floor(rawDmg * (1 - (buffs.damageResist || 0)));
  return Math.max(1, reduced);
}
