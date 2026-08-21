import { EmbedBuilder } from 'discord.js';

import { User } from '../../database/models/User.js';
import { getFactionBuffs } from '../../services/factionService.js';

import { COOLDOWNS, formatWait, claimCooldown, cooldownLine } from '../../utils/cooldown.js';
import { repeatRow } from '../../utils/repeatButton.js';
import { tutorialNudge } from '../../services/tutorialService.js';

const MINING_COOLDOWN_SECONDS = COOLDOWNS.mining;

/**
 * Chạy một lượt đào khoáng rồi dựng sẵn nguyên gói tin nhắn để hiển thị.
 *
 * Tách khỏi executeDaokhoang để nút 'Đào tiếp' và lệnh gõ tay đi chung một
 * đường, kể cả các nhánh báo lỗi hồi chiêu.
 *
 * Trả { content } khi không chạy được, { embeds, components } khi thành công.
 */
export async function buildDaokhoangView(userId) {
  let user = await User.findOne({ userId });

  if (!user) return { content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` };

  const now = new Date();
  if (user.cooldowns.mining) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.mining)) / 1000);
    if (elapsedSeconds < MINING_COOLDOWN_SECONDS) {

      return {
        content: `⏳ Đạo hữu vừa khai thác mỏ cạn kiệt thể lực! Vui lòng nghỉ ngơi thêm **${formatWait(MINING_COOLDOWN_SECONDS - elapsedSeconds)}**.`
      };
    }
  }

  // Chiếm lượt nguyên tử — chặn spam song song nhân đôi khoáng sản.
  const claimed = await claimCooldown(User, userId, 'mining', {}, { $inc: { 'counters.mining': 1 } });
  if (!claimed) {
    return { content: `⏳ Đạo hữu vung cuốc quá nhanh, địa mạch chưa kịp tụ khoáng! Chờ thêm giây lát.` };
  }
  user = claimed;

  // Khai thác mỏ
  const linhThachGained = Math.floor(Math.random() * 80) + 40;
  
  // Tỉ lệ nhận Nguyên Thạch (70% ra 1-3 viên, 20% ra 4-6 viên, 10% bạo kích 10 viên)
  let nguyenThachGained = 1;
  const roll = Math.random();
  if (roll <= 0.10) {
    nguyenThachGained = Math.floor(Math.random() * 5) + 8; // 8 - 12 viên
  } else if (roll <= 0.30) {
    nguyenThachGained = Math.floor(Math.random() * 3) + 4; // 4 - 6 viên
  } else {
    nguyenThachGained = Math.floor(Math.random() * 3) + 1; // 1 - 3 viên
  }


  // Buff Tán Tu: +20% Nguyên Thạch khai thác
  const miningBonus = getFactionBuffs(user.faction).miningBonus;
  if (miningBonus > 0) {
    nguyenThachGained = Math.max(nguyenThachGained, Math.round(nguyenThachGained * (1 + miningBonus)));
  }

  user.currencies.linhThach += linhThachGained;

  user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + nguyenThachGained;

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`⛏️ [KHAI THÁC MỎ NGUYÊN THẠCH]`)
    .setColor('#00E676')
    .setDescription(
      `Đạo hữu cầm cuốc đào sâu vào lòng địa mạch viễn cổ:\n\n` +
      `🔮 Thu hoạch: **+${nguyenThachGained} Nguyên Thạch** ${roll <= 0.10 ? '🔥 **[BẠO KÍCH MỎ THẦN!]**' : ''}\n` +
      `💎 Kèm theo: **+${linhThachGained} Linh Thạch**\n\n` +
      `💰 **Tổng tài sản:** \`${user.currencies.nguyenThach.toLocaleString()} Nguyên Thạch\` | \`${user.currencies.linhThach.toLocaleString()} Linh Thạch\`\n` +

      cooldownLine('mining', user.cooldowns.mining) +
      tutorialNudge(user)
    );

  return { embeds: [embed], components: repeatRow('daokhoang', userId) };
}

export async function executeDaokhoang(message) {
  await message.reply(await buildDaokhoangView(message.author.id));
}
