import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../database/models/User.js';

import { getFactionBuffs, getCritMultiplier } from './factionService.js';
import { getUserTalentPerks } from './talentService.js';
import { battlePower } from '../utils/power.js';
import { dangKyNguonBanRon } from '../utils/banRon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const realmsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/realms.json'), 'utf8'));

// ── Hằng số luật chơi ───────────────────────────────────────────────
export const PVP_MIN_BET = 50;
export const PVP_MAX_BET = 20000;
export const PVP_CHALLENGE_TTL_MS = 90 * 1000; // Chiến thư hết hạn sau 90s
export const PVP_MAX_REALM_GAP = 1;            // Chênh nhau tối đa 1 đại cảnh giới
export const PVP_MAX_ROUNDS = 12;

// ── Tra cứu cảnh giới ───────────────────────────────────────────────
const REALM_LEVEL_BY_ID = {};
for (const key of Object.keys(realmsConfig.realms)) {
  const realm = realmsConfig.realms[key];
  REALM_LEVEL_BY_ID[realm.id] = realm.level;
}

export function getRealmLevel(realmId) {
  return REALM_LEVEL_BY_ID[realmId] ?? 0;
}

/**
 * Điểm lực chiến dùng để so kèo (không phải để tính sát thương).
 *
 * Gọi thẳng utils/power.js chứ không chép lại công thức: trước đây file này
 * giữ một bản sao riêng, chỉ cần một bên đổi trọng số là số trên khung tỉ võ
 * lệch với số trên BXH và người chơi tưởng bot tính sai.
 */
export function getBattlePower(user) {
  return battlePower(user);
}

/**
 * Kiểm tra hai bên có được phép tỉ võ với nhau không.
 * Chặn kèo "Nguyên Anh đè Phàm Nhân" để farm Linh Thạch người mới.
 */
export function checkMatchup(challenger, defender) {
  const lvA = getRealmLevel(challenger.realm?.id);
  const lvB = getRealmLevel(defender.realm?.id);
  const gap = Math.abs(lvA - lvB);

  if (gap > PVP_MAX_REALM_GAP) {
    return {
      ok: false,
      reason:
        `⚖️ **Chênh lệch cảnh giới quá lớn!** ` +
        `**${challenger.realm?.name || '???'}** vs **${defender.realm?.name || '???'}** ` +
        `(cách nhau ${gap} đại cảnh giới, tối đa cho phép ${PVP_MAX_REALM_GAP}).\n` +
        `Lôi đài chỉ nhận kèo quang minh chính đại, không nhận trò đè người.`
    };
  }
  return { ok: true };
}

// ── Khoá chiến thư đang treo (chống spam / cược trùng) ───────────────
// key = userId, value = { challengerId, targetId, betAmount, expiresAt }
const pendingChallenges = new Map();

function purgeExpired(now = Date.now()) {
  for (const [key, value] of pendingChallenges) {
    if (value.expiresAt <= now) pendingChallenges.delete(key);
  }
}

export function getPendingFor(userId) {
  purgeExpired();
  return pendingChallenges.get(userId) || null;
}

export function lockChallenge(challengerId, targetId, betAmount, issuedAt) {
  purgeExpired(issuedAt);
  const record = { challengerId, targetId, betAmount, expiresAt: issuedAt + PVP_CHALLENGE_TTL_MS };
  pendingChallenges.set(challengerId, record);
  pendingChallenges.set(targetId, record);
  return record;
}

export function releaseChallenge(challengerId, targetId) {
  pendingChallenges.delete(challengerId);
  pendingChallenges.delete(targetId);
}

// Dọn rác định kỳ phòng khi cả hai bên bỏ mặc chiến thư
setInterval(() => purgeExpired(), 5 * 60 * 1000).unref?.();

// Chiến thư treo nhẹ hơn một trận đang đánh dở, nhưng vẫn không nên bốc hơi
// giữa lúc hai bên đang cân nhắc mức cược. Đếm theo BẢN GHI chứ không theo số
// khoá: mỗi chiến thư nằm dưới hai khoá (người gửi và người nhận), đếm khoá là
// gấp đôi con số thật. Bản thân sổ này tự hết hạn nên không kẹt được lâu.
dangKyNguonBanRon('chiến thư', () => {
  purgeExpired();
  return new Set(pendingChallenges.values()).size;
});

// ── Mô phỏng giao đấu theo lượt ─────────────────────────────────────

function buildFighter(user) {
  const s = user.stats || {};
  const buffs = getFactionBuffs(user.faction);
  // Chỉ nhân dmgBonus: hpBonus đã được cộng thẳng vào stats.maxHp mỗi lần đột
  // phá nên nhân lại ở đây sẽ tính trùng hai lần.
  const perks = getUserTalentPerks(user);
  return {
    id: user.userId,
    name: user.daoName || user.username,
    hp: Math.max(1, s.maxHp || 100),
    maxHp: Math.max(1, s.maxHp || 100),
    atk: Math.max(1, Math.floor((s.atk || 15) * (1 + (perks.dmgBonus || 0)))),
    def: Math.max(0, s.def || 8),
    critRate: Math.min(0.60, s.critRate || 0.05),
    dodgeRate: Math.min(0.45, (s.dodgeRate || 0.05) + (buffs.dodgeChance || 0)),
    critMult: getCritMultiplier(buffs),
    resist: Math.min(0.50, buffs.damageResist || 0),
    buffs
  };
}

function strike(attacker, defender) {
  if (Math.random() < defender.dodgeRate) {
    return { dodged: true, crit: false, dmg: 0 };
  }
  const crit = Math.random() < attacker.critRate;
  const swing = 0.88 + Math.random() * 0.24; // ±12% dao động
  const raw = attacker.atk * swing * (crit ? attacker.critMult : 1) - defender.def * 0.45;
  const dmg = Math.max(
    Math.ceil(attacker.atk * 0.08),           // luôn xuyên tối thiểu 8% ATK
    Math.floor(raw * (1 - defender.resist))
  );
  return { dodged: false, crit, dmg };
}

/**
 * Đấu tối đa PVP_MAX_ROUNDS hiệp. Ai hết máu trước thì thua.
 * Hết hiệp mà cả hai còn sống -> so % máu còn lại, hoà tuyệt đối thì
 * người bị thách đấu thắng (lợi thế chủ nhà, tránh việc random 50/50).
 */
export function simulateDuel(challengerDoc, defenderDoc) {
  const a = buildFighter(challengerDoc);
  const b = buildFighter(defenderDoc);

  // Ai nhanh tay hơn đi trước: so tốc độ tạm tính bằng dodgeRate + chút may rủi
  const aFirst = (a.dodgeRate + Math.random() * 0.15) >= (b.dodgeRate + Math.random() * 0.15);
  const log = [];
  let round = 0;
  let winner = null;
  let reason = 'ko';

  while (round < PVP_MAX_ROUNDS && a.hp > 0 && b.hp > 0) {
    round++;
    const order = aFirst ? [[a, b], [b, a]] : [[b, a], [a, b]];
    const lines = [];

    for (const [atkSide, defSide] of order) {
      if (atkSide.hp <= 0 || defSide.hp <= 0) break;
      const hit = strike(atkSide, defSide);
      if (hit.dodged) {
        lines.push(`💨 **${defSide.name}** thân pháp như mây trôi, né sạch đòn của **${atkSide.name}**!`);
        continue;
      }
      defSide.hp = Math.max(0, defSide.hp - hit.dmg);
      lines.push(
        hit.crit
          ? `💥 **${atkSide.name}** đánh trúng tử huyệt — **${hit.dmg}** sát thương! (${defSide.name}: ${defSide.hp}/${defSide.maxHp} HP)`
          : `⚔️ **${atkSide.name}** ra chiêu, gây **${hit.dmg}** sát thương. (${defSide.name}: ${defSide.hp}/${defSide.maxHp} HP)`
      );
    }

    log.push({ round, lines });
  }

  if (a.hp <= 0 && b.hp <= 0) {
    winner = 'defender';
    reason = 'doubleKo';
  } else if (b.hp <= 0) {
    winner = 'challenger';
  } else if (a.hp <= 0) {
    winner = 'defender';
  } else {
    reason = 'timeout';
    const ratioA = a.hp / a.maxHp;
    const ratioB = b.hp / b.maxHp;
    winner = ratioA > ratioB ? 'challenger' : 'defender';
  }

  return {
    winner,
    reason,
    rounds: round,
    log,
    challengerHp: a.hp,
    challengerMaxHp: a.maxHp,
    defenderHp: b.hp,
    defenderMaxHp: b.maxHp
  };
}

/**
 * Chuyển tiền cược nguyên tử.
 * Trừ tiền kẻ thua trước (có guard $gte), thành công mới cộng cho kẻ thắng.
 * Nếu bước cộng lỗi thì hoàn lại ngay để không đốt Linh Thạch của người chơi.
 */
export async function settleWager(winnerId, loserId, amount, stampCooldownAt) {
  // Mongo ném lỗi nếu $set rỗng nên phải gắn có điều kiện
  const withCooldown = (update) =>
    stampCooldownAt ? { ...update, $set: { 'cooldowns.pvp': stampCooldownAt } } : update;

  const debited = await User.findOneAndUpdate(
    { userId: loserId, 'currencies.linhThach': { $gte: amount } },
    withCooldown({ $inc: { 'currencies.linhThach': -amount } }),
    { new: true }
  );

  if (!debited) {
    // Kẻ thua đã tiêu sạch tiền giữa lúc chờ bấm nút -> huỷ kèo, không ai mất gì
    if (stampCooldownAt) {
      const stamp = { $set: { 'cooldowns.pvp': stampCooldownAt } };
      await User.updateOne({ userId: loserId }, stamp).catch(() => {});
      await User.updateOne({ userId: winnerId }, stamp).catch(() => {});
    }
    return { ok: false, reason: 'INSUFFICIENT_LOSER' };
  }

  try {
    const credited = await User.findOneAndUpdate(
      { userId: winnerId },
      withCooldown({ $inc: { 'currencies.linhThach': amount } }),
      { new: true }
    );
    if (!credited) throw new Error('Không tìm thấy hồ sơ người thắng');
    return { ok: true, winner: credited, loser: debited };
  } catch (err) {
    console.error('[pvpService] Lỗi cộng tiền cho người thắng, đang hoàn cược:', err);
    await User.updateOne({ userId: loserId }, { $inc: { 'currencies.linhThach': amount } }).catch(() => {});
    return { ok: false, reason: 'CREDIT_FAILED' };
  }
}
