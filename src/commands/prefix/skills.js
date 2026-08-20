import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { fuseSkills } from '../../services/skillService.js';

const TRAIN_COOLDOWN_SECONDS = 10;

export async function executeTangkinhcac(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) {
    return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` để tạo nhân vật trước!` });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏴‍☠️ [CHỢ ĐEN & KHO BÍ KÍP CÁ NHÂN] - ${user.daoName || user.username}`)
    .setColor('#37474F')
    .setDescription(
      `Danh sách tất cả các công pháp đạo hữu đã thu thập (\`${user.skills.length}\` bí kíp):\n` +
      `*(Tối đa kích hoạt 4 công pháp khi giao chiến)*\n\n`
    );

  if (user.skills.length === 0) {
    embed.setDescription(`*Kho của bạn đang trống! Hãy bấm nút [Vào Sàn Giao Dịch Chợ Đen] để mua bí kíp.*`);
  } else {
    user.skills.forEach((s, idx) => {
      const equipTag = s.equipped ? `✅ [ĐANG DÙNG]` : `⭕`;
      const masteryTag = s.mastery >= 100 ? `🔥 VIÊN MÃN (100%)` : `Thuần thục: \`${s.mastery}%\``;
      embed.addFields({
        name: `${idx + 1}. ${equipTag} **[${s.name}]** - Phẩm: \`${s.rarity}\``,
        value: `📂 Loại: \`${s.category}\` | ${masteryTag}`,
        inline: false
      });
    });
  }

  embed.addFields(
    {
      name: `💡 Lệnh Rèn Luyện & Nấu Chảy:`,
      value: `• \`!luyencong <stt>\` : Bế quan luyện thuần thục công pháp (+15% Mastery, Delay 10s).\n• \`!dunghop\` : Nấu chảy 5 công pháp Viên Mãn thành 1 bí kíp phẩm cao hơn!`,
      inline: false
    }
  );

  // 2 nút giao dịch Chợ Đen
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`btn_open_sell_menu_${user.userId}`).setLabel('💰 Bán Đồ Lên Chợ Đen').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`btn_open_market_${user.userId}`).setLabel('🏪 Vào Sàn Giao Dịch Chợ Đen').setStyle(ButtonStyle.Primary)
  );

  await message.reply({ embeds: [embed], components: [row] });
}

export async function executeLuyencong(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (user.skills.length === 0) {
    return message.reply({ content: `❌ Đạo hữu chưa có công pháp nào trong kho!` });
  }

  const now = new Date();
  if (user.cooldowns.skillTrain) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.skillTrain)) / 1000);
    if (elapsedSeconds < TRAIN_COOLDOWN_SECONDS) {
      const waitTime = TRAIN_COOLDOWN_SECONDS - elapsedSeconds;
      return message.reply({
        content: `⏳ Đạo hữu đang điều tức kinh mạch sau khi luyện võ! Vui lòng chờ thêm **${waitTime}s**.`
      });
    }
  }

  let skillIndex = 0;
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10) - 1;
    if (!isNaN(parsed) && parsed >= 0 && parsed < user.skills.length) {
      skillIndex = parsed;
    }
  }

  const skill = user.skills[skillIndex];
  if (skill.mastery >= 100) {
    return message.reply({
      content: `🔥 Công pháp **[${skill.name}]** đã đạt tới cảnh giới **VIÊN MÃN (100%)**, không thể luyện thêm! Hãy thu thập đủ 5 bí kíp viên mãn để dùng \`!dunghop\`!`
    });
  }

  skill.mastery = Math.min(100, skill.mastery + 15);
  user.cooldowns.skillTrain = now;
  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`🧘 [BẾ QUAN LUYỆN VÕ]`)
    .setColor('#4CAF50')
    .setDescription(
      `Đạo hữu diễn luyện chiêu thức của **[${skill.name}]**:\n\n` +
      `✨ Độ thuần thục tăng lên: **\`${skill.mastery}%\`** ${skill.mastery >= 100 ? '🔥 **VIÊN MÃN!**' : ''}\n` +
      `⏱️ *Thời gian hồi chiêu: 10 giây*`
    );

  await message.reply({ embeds: [embed] });
}

export async function executeDunghop(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const result = fuseSkills(user, 'HOANG_GIAI');
  if (!result.success) {
    return message.reply({ content: `❌ ${result.message}` });
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`🔮 [LÒ LUYỆN VẠN ĐẠO - DUNG HỢP]`)
    .setColor('#FFD700')
    .setDescription(result.message);

  await message.reply({ embeds: [embed] });
}
