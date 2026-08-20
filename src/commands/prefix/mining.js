import { EmbedBuilder } from 'discord.js';

import { User } from '../../database/models/User.js';
import { getFactionBuffs } from '../../services/factionService.js';
import { COOLDOWNS, formatWait } from '../../utils/cooldown.js';

const MINING_COOLDOWN_SECONDS = COOLDOWNS.mining;

export async function executeDaokhoang(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const now = new Date();
  if (user.cooldowns.mining) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.mining)) / 1000);
    if (elapsedSeconds < MINING_COOLDOWN_SECONDS) {

      return message.reply({
        content: `⏳ Đạo hữu vừa khai thác mỏ cạn kiệt thể lực! Vui lòng nghỉ ngơi thêm **${formatWait(MINING_COOLDOWN_SECONDS - elapsedSeconds)}**.`
      });
    }
  }

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
  user.cooldowns.mining = now;

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`⛏️ [KHAI THÁC MỎ NGUYÊN THẠCH]`)
    .setColor('#00E676')
    .setDescription(
      `Đạo hữu cầm cuốc đào sâu vào lòng địa mạch viễn cổ:\n\n` +
      `🔮 Thu hoạch: **+${nguyenThachGained} Nguyên Thạch** ${roll <= 0.10 ? '🔥 **[BẠO KÍCH MỎ THẦN!]**' : ''}\n` +
      `💎 Kèm theo: **+${linhThachGained} Linh Thạch**\n\n` +
      `💰 **Tổng tài sản:** \`${user.currencies.nguyenThach.toLocaleString()} Nguyên Thạch\` | \`${user.currencies.linhThach.toLocaleString()} Linh Thạch\`\n` +

      `⏱️ *Thời gian hồi chiêu: ${MINING_COOLDOWN_SECONDS} giây*`
    );

  await message.reply({ embeds: [embed] });
}
