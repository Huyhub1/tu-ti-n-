import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';
import { getAllSkills } from '../../services/skillService.js';
import { COOLDOWNS, formatWait, cooldownLine } from '../../utils/cooldown.js';

const DOTHACH_COOLDOWN_SECONDS = COOLDOWNS.dothach;

// Giới hạn cược: chặn việc nạp toàn bộ gia sản vào một nhát cắt
export const DOTHACH_MIN_BET = 50;
export const DOTHACH_MAX_BET = 50000;

/**
 * Bảng tỉ lệ đã cân bằng lại (bản cũ có EV = +12%/lượt nên đây là máy in tiền).
 *   46% mất trắng | 30% x1.25 | 18% x1.9 | 6% x3.5
 *   EV Linh Thạch  = 0.30*1.25 + 0.18*1.9 + 0.06*3.5 = 0.927 -> nhà cái ăn 7.3%
 *   EV Nguyên Thạch = 0.18*3 + 0.06*11.5 = 1.23 viên/lượt (bản cũ: 6.23 viên/lượt)
 */
const OUTCOMES = [
  { p: 0.46, mult: 0,    ntMin: 0, ntMax: 0 },
  { p: 0.30, mult: 1.25, ntMin: 0, ntMax: 0 },
  { p: 0.18, mult: 1.9,  ntMin: 2, ntMax: 4 },
  { p: 0.06, mult: 3.5,  ntMin: 8, ntMax: 15 }
];

// Xác suất nhặt được tàn thư khi nổ hũ (0.06 * 0.20 = 1.2% tổng thể)
const JACKPOT_SKILL_CHANCE = 0.20;

function rollOutcome() {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < OUTCOMES.length; i++) {
    acc += OUTCOMES[i].p;
    if (r < acc) return i;
  }
  return OUTCOMES.length - 1;
}

function randInt(min, max) {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function executeDothach(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });

  const now = new Date();
  if (user.cooldowns?.dothach) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.dothach)) / 1000);
    if (elapsedSeconds < DOTHACH_COOLDOWN_SECONDS) {
      return message.reply({
        content: `⏳ Đạo hữu đang quan sát mạch đá, vui lòng chờ **${formatWait(DOTHACH_COOLDOWN_SECONDS - elapsedSeconds)}** trước khi cắt viên tiếp theo!`
      });
    }
  }

  let betAmount = 100;
  if (args.length > 0) {
    const raw = String(args[0]).replace(/[.,_]/g, '').toLowerCase();
    if (raw === 'max' || raw === 'all') {
      betAmount = Math.min(DOTHACH_MAX_BET, user.currencies.linhThach || 0);
    } else {
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed)) {
        return message.reply({
          content: `❌ Số Linh Thạch không hợp lệ! Ví dụ: \`!dothach 500\` hoặc \`!dothach max\`.`
        });
      }
      betAmount = parsed;
    }
  }

  if (betAmount < DOTHACH_MIN_BET) {
    return message.reply({
      content: `❌ Cược tối thiểu là **${DOTHACH_MIN_BET.toLocaleString()} Linh Thạch**.`
    });
  }
  if (betAmount > DOTHACH_MAX_BET) {
    return message.reply({
      content: `❌ Phôi đá lớn nhất mà Thạch Phường dám bán chỉ **${DOTHACH_MAX_BET.toLocaleString()} Linh Thạch**/viên. Đạo hữu cắt từ từ thôi!`
    });
  }

  // ── TRỪ TIỀN NGUYÊN TỬ ──
  // Vừa chặn âm tiền vừa chặn spam song song (nhiều lệnh gửi cùng lúc) bằng
  // chính điều kiện cooldown trong query, nên chỉ đúng 1 lượt lọt qua.
  const cutoff = new Date(now.getTime() - DOTHACH_COOLDOWN_SECONDS * 1000);
  const locked = await User.findOneAndUpdate(
    {
      userId,
      'currencies.linhThach': { $gte: betAmount },
      $or: [
        { 'cooldowns.dothach': null },
        { 'cooldowns.dothach': { $exists: false } },
        { 'cooldowns.dothach': { $lte: cutoff } }
      ]
    },
    {
      $inc: { 'currencies.linhThach': -betAmount },
      $set: { 'cooldowns.dothach': now }
    },
    { new: true }
  );

  if (!locked) {
    const fresh = await User.findOne({ userId });
    if (fresh && (fresh.currencies.linhThach || 0) < betAmount) {
      return message.reply({
        content: `❌ Không đủ Linh Thạch để mua phôi đá! Cần **${betAmount.toLocaleString()} Linh Thạch** (Hiện có: **${(fresh.currencies.linhThach || 0).toLocaleString()}**).`
      });
    }
    return message.reply({ content: `⏳ Đạo hữu bấm quá nhanh, mạch đá chưa kịp lộ vân! Thử lại sau giây lát.` });
  }

  // ── QUAY KẾT QUẢ ──
  const idx = rollOutcome();
  const outcome = OUTCOMES[idx];
  const refundLinhThach = Math.floor(betAmount * outcome.mult);
  const nguyenThachEarned = randInt(outcome.ntMin, outcome.ntMax);

  let embedColor = '#757575';
  let title = '';
  let desc = '';

  if (idx === 0) {
    title = `🪨 [ĐỔ THẠCH] - Phế Thạch Rỗng Ruột`;
    desc = `Nhát dao hạ xuống, lớp đá vỡ vụn chỉ toàn đất cát! Đạo hữu mất **${betAmount.toLocaleString()} Linh Thạch**. Hãy kiên nhẫn thử lại!`;
  } else if (idx === 1) {
    embedColor = '#4CAF50';
    title = `🟢 [ĐỔ THẠCH] - Bạch Ngọc Nguyên Thạch`;
    desc = `Vết cắt phát ra ánh sáng dịu nhẹ, vừa đủ gỡ vốn và dư chút đỉnh:\n\n` +
      `💎 Thu về: **+${refundLinhThach.toLocaleString()} Linh Thạch** (lãi **${(refundLinhThach - betAmount).toLocaleString()} LT**)`;
  } else if (idx === 2) {
    embedColor = '#2196F3';
    title = `🔵 [ĐỔ THẠCH] - Thượng Phẩm Cổ Nguyên Thạch`;
    desc = `Lớp vỏ đá nứt toác, hào quang lam sắc ngút trời!\n\n` +
      `🔮 **+${nguyenThachEarned} Nguyên Thạch**\n` +
      `💎 Thu về: **+${refundLinhThach.toLocaleString()} Linh Thạch** (lãi **${(refundLinhThach - betAmount).toLocaleString()} LT**)`;
  } else {
    embedColor = '#FFD700';
    title = `✨ [ĐỔ THẠCH BẠO PHÁT] - CỔ THẦN BẢO THẠCH!`;
    desc = `Thiên địa dị tượng bùng nổ, khí tức hồng mông tràn ngập gian phòng!\n\n` +
      `🔮 **+${nguyenThachEarned} Nguyên Thạch Thần Bí**\n` +
      `💎 Thu về: **+${refundLinhThach.toLocaleString()} Linh Thạch** (x${outcome.mult} vốn)`;
  }

  // ── TRẢ THƯỞNG NGUYÊN TỬ ──
  const inc = {};
  if (refundLinhThach > 0) inc['currencies.linhThach'] = refundLinhThach;
  if (nguyenThachEarned > 0) inc['currencies.nguyenThach'] = nguyenThachEarned;

  let updated = locked;
  if (Object.keys(inc).length > 0) {
    updated = (await User.findOneAndUpdate({ userId }, { $inc: inc }, { new: true })) || locked;
  }

  // Tàn thư phong ấn: chỉ rơi khi nổ hũ, và chỉ 20% trong số đó
  if (idx === 3 && Math.random() < JACKPOT_SKILL_CHANCE) {
    const owned = new Set((updated.skills || []).map(s => s.skillId));
    const pool = getAllSkills().filter(s => s.rarity === 'HUYEN_GIAI' && !owned.has(s.id));
    if (pool.length > 0) {
      const luckySkill = pool[Math.floor(Math.random() * pool.length)];
      const pushed = await User.findOneAndUpdate(
        { userId, 'skills.skillId': { $ne: luckySkill.id } },
        {
          $push: {
            skills: {
              skillId: luckySkill.id,
              name: luckySkill.name,
              category: luckySkill.category,
              rarity: luckySkill.rarity,
              mastery: 10,
              equipped: false
            }
          }
        },
        { new: true }
      );
      if (pushed) {
        updated = pushed;
        desc += `\n📜 Nhặt được tàn thư phong ấn trong khối đá: **[${luckySkill.name}]** (${luckySkill.rarity})!`;
      }
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(embedColor)
    .setDescription(
      `${desc}\n\n` +
      `💰 **Tài sản hiện tại:** \`${(updated.currencies.nguyenThach || 0).toLocaleString()} Nguyên Thạch\` | \`${(updated.currencies.linhThach || 0).toLocaleString()} Linh Thạch\`\n` +
      cooldownLine('dothach', updated.cooldowns.dothach, 'Cược tối đa ' + DOTHACH_MAX_BET.toLocaleString() + ' LT')
    );

  await message.reply({ embeds: [embed] });
}
