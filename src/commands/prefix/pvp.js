import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';

const PVP_COOLDOWN_SECONDS = 20; // 20s delay giữa các lần tỉ võ lôi đài

export async function executeKhieuchien(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const now = new Date();
  if (user.cooldowns.pvp) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.pvp)) / 1000);
    if (elapsedSeconds < PVP_COOLDOWN_SECONDS) {
      const waitTime = PVP_COOLDOWN_SECONDS - elapsedSeconds;
      return message.reply({
        content: `⏳ Đạo hữu vừa tỉ võ hao tổn chân khí! Vui lòng điều tức thêm **${waitTime}s**.`
      });
    }
  }

  const targetMention = message.mentions.users.first();
  if (!targetMention || targetMention.id === message.author.id) {
    return message.reply({ content: `❌ Hãy tag một tu sĩ khác để tỉ võ quang minh chính đại! (Ví dụ: \`!khieuchien @user 100\`)` });
  }

  const targetUser = await User.findOne({ userId: targetMention.id });
  if (!targetUser) {
    return message.reply({ content: `❌ Đối thủ chưa bước chân vào tiên đồ!` });
  }

  let betAmount = 50;
  if (args.length >= 2) {
    const parsedBet = parseInt(args[1], 10);
    if (!isNaN(parsedBet) && parsedBet > 0) betAmount = parsedBet;
  }

  if (user.currencies.linhThach < betAmount) {
    return message.reply({ content: `❌ Bạn không đủ ${betAmount} Linh Thạch để đặt cược!` });
  }
  if (targetUser.currencies.linhThach < betAmount) {
    return message.reply({ content: `❌ Đối thủ không đủ ${betAmount} Linh Thạch để tỉ võ!` });
  }

  // Tạo Embed thư khiêu chiến và nút bấm xác nhận cho đối thủ
  const challengerName = user.daoName || user.username;
  const targetName = targetUser.daoName || targetUser.username;

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ [CHIẾN THƯ LÔI ĐÀI TỈ VÕ]`)
    .setColor('#FF9800')
    .setDescription(
      `Đạo hữu **${challengerName}** đã phát chiến thư khiêu chiến tới **${targetName}**!\n\n` +
      `💰 Tiền cược lôi đài: **${betAmount.toLocaleString()} Linh Thạch**\n\n` +
      `👉 <@${targetUser.userId}>, đạo hữu có dám bước lên đài tỉ thí võ nghệ quang minh chính đại?`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pvp_accept_${user.userId}_${targetUser.userId}_${betAmount}`)
      .setLabel('⚔️ Tiếp Nhận Thách Đấu')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`pvp_decline_${user.userId}_${targetUser.userId}`)
      .setLabel('❌ Từ Chối')
      .setStyle(ButtonStyle.Secondary)
  );

  await message.reply({ embeds: [embed], components: [row] });
}
