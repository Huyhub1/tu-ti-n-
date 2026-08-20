import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { checkCooldown, formatWait, checkBattleReady } from '../../utils/cooldown.js';
import {
  PVP_MIN_BET,
  PVP_MAX_BET,
  PVP_CHALLENGE_TTL_MS,
  checkMatchup,
  getBattlePower,
  getPendingFor,
  lockChallenge
} from '../../services/pvpService.js';

export async function executeKhieuchien(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  // 1. Hồi chiêu (bản cũ chỉ đọc mà không bao giờ ghi nên cooldown vô nghĩa)
  const cd = checkCooldown(user, 'pvp');
  if (!cd.ready) {
    return message.reply({
      content: `⏳ Đạo hữu vừa tỉ võ hao tổn chân khí! Vui lòng điều tức thêm **${formatWait(cd.waitTime)}**.`
    });
  }

  // 2. Chiến thư đang treo
  const myPending = getPendingFor(user.userId);
  if (myPending) {
    return message.reply({
      content: `⚠️ Đạo hữu đang có một chiến thư chưa ngã ngũ! Hãy chờ đối phương trả lời hoặc đợi chiến thư hết hạn (${Math.ceil(PVP_CHALLENGE_TTL_MS / 1000)}s).`
    });
  }

  // 3. Mục tiêu
  const targetMention = message.mentions.users.first();
  if (!targetMention || targetMention.id === message.author.id) {
    return message.reply({
      content: `❌ Hãy tag một tu sĩ khác để tỉ võ quang minh chính đại! (Ví dụ: \`!khieuchien @user 100\`)`
    });
  }
  if (targetMention.bot) {
    return message.reply({ content: `❌ Bot không có linh căn, không thể bước lên lôi đài!` });
  }

  const targetUser = await User.findOne({ userId: targetMention.id });
  if (!targetUser) {
    return message.reply({ content: `❌ Đối thủ chưa bước chân vào tiên đồ!` });
  }

  const targetPending = getPendingFor(targetUser.userId);
  if (targetPending) {
    return message.reply({
      content: `⚠️ **${targetUser.daoName || targetUser.username}** đang bận với một chiến thư khác. Đạo hữu hãy chờ chút!`
    });
  }

  // 4. Chặn kèo đè cảnh giới
  const matchup = checkMatchup(user, targetUser);
  if (!matchup.ok) return message.reply({ content: matchup.reason });

  // 5. Cả hai phải đủ sức khoẻ (dùng chung ngưỡng 20% HP với săn thú / phó bản)
  const myBattle = checkBattleReady(user);
  if (!myBattle.ready) {
    return message.reply({
      content: `🩸 **Trọng thương chưa lành!** Máu hiện tại \`${myBattle.hp}/${myBattle.maxHp}\` — cần tối thiểu \`${myBattle.need}\` HP mới đủ sức lên đài.\n💊 Dùng \`!uongdan hoi_xuan_dan\` hoặc \`!tuluyen\` để dưỡng thương.`
    });
  }
  const foeBattle = checkBattleReady(targetUser);
  if (!foeBattle.ready) {
    return message.reply({
      content: `🩸 **${targetUser.daoName || targetUser.username}** đang trọng thương (\`${foeBattle.hp}/${foeBattle.maxHp}\` HP), chưa thể tiếp chiến. Hãy để đối phương dưỡng thương đã!`
    });
  }

  // 6. Tiền cược
  let betAmount = PVP_MIN_BET;
  if (args.length >= 2) {
    const raw = String(args[1]).replace(/[.,_]/g, '');
    const parsedBet = parseInt(raw, 10);
    if (isNaN(parsedBet)) {
      return message.reply({ content: `❌ Số Linh Thạch cược không hợp lệ! Ví dụ: \`!khieuchien @user 500\`.` });
    }
    betAmount = parsedBet;
  }

  if (betAmount < PVP_MIN_BET) {
    return message.reply({ content: `❌ Cược tối thiểu là **${PVP_MIN_BET.toLocaleString()} Linh Thạch**.` });
  }
  if (betAmount > PVP_MAX_BET) {
    return message.reply({
      content: `❌ Lôi đài giới hạn cược **${PVP_MAX_BET.toLocaleString()} Linh Thạch**/trận để tránh vỡ nợ cả tông môn.`
    });
  }

  if ((user.currencies.linhThach || 0) < betAmount) {
    return message.reply({
      content: `❌ Bạn không đủ **${betAmount.toLocaleString()} Linh Thạch** để đặt cược! (Hiện có: **${(user.currencies.linhThach || 0).toLocaleString()}**)`
    });
  }
  if ((targetUser.currencies.linhThach || 0) < betAmount) {
    return message.reply({
      content: `❌ Đối thủ không đủ **${betAmount.toLocaleString()} Linh Thạch** để tỉ võ! (Đối phương có: **${(targetUser.currencies.linhThach || 0).toLocaleString()}**)`
    });
  }

  // 7. Khoá chiến thư + đóng dấu hồi chiêu ngay lúc gửi, không đợi đối phương
  //    trả lời. Nếu không thì một người có thể rải chiến thư cho cả server.
  const issuedAt = Date.now();
  lockChallenge(user.userId, targetUser.userId, betAmount, issuedAt);
  await User.updateOne({ userId: user.userId }, { $set: { 'cooldowns.pvp': new Date(issuedAt) } }).catch(() => {});

  const challengerName = user.daoName || user.username;
  const targetName = targetUser.daoName || targetUser.username;
  const expireStamp = Math.floor((issuedAt + PVP_CHALLENGE_TTL_MS) / 1000);

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ [CHIẾN THƯ LÔI ĐÀI TỈ VÕ]`)
    .setColor('#FF9800')
    .setDescription(
      `Đạo hữu **${challengerName}** đã phát chiến thư khiêu chiến tới **${targetName}**!\n\n` +
      `💰 Tiền cược lôi đài: **${betAmount.toLocaleString()} Linh Thạch**\n` +
      `⏳ Chiến thư hết hạn <t:${expireStamp}:R>\n\n` +
      `👉 <@${targetUser.userId}>, đạo hữu có dám bước lên đài tỉ thí võ nghệ quang minh chính đại?`
    )
    .addFields(
      {
        name: `🗡️ ${challengerName}`,
        value: `${user.realm?.name || '???'}\n⚡ Lực chiến: **${getBattlePower(user).toLocaleString()}**\n❤️ ${user.stats.hp}/${user.stats.maxHp} HP`,
        inline: true
      },
      {
        name: `🛡️ ${targetName}`,
        value: `${targetUser.realm?.name || '???'}\n⚡ Lực chiến: **${getBattlePower(targetUser).toLocaleString()}**\n❤️ ${targetUser.stats.hp}/${targetUser.stats.maxHp} HP`,
        inline: true
      }
    )
    .setFooter({ text: 'Tỉ võ điểm đáo vi chỉ — chỉ mất Linh Thạch, không mất máu thật.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pvp_accept_${user.userId}_${targetUser.userId}_${betAmount}_${issuedAt}`)
      .setLabel('⚔️ Tiếp Nhận Thách Đấu')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`pvp_decline_${user.userId}_${targetUser.userId}`)
      .setLabel('❌ Từ Chối')
      .setStyle(ButtonStyle.Secondary)
  );

  await message.reply({ embeds: [embed], components: [row] });
}
