import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { rollInnateTalent } from '../../services/talentService.js';

export const data = new SlashCommandBuilder()
  .setName('khoi-dau')
  .setDescription('Bắt đầu hành trình tu tiên: Thức tỉnh Tư Chất Bẩm Sinh & Chọn Trận Doanh!');

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Kiểm tra nếu đã có tài khoản
  let existingUser = await User.findOne({ userId });
  if (existingUser) {
    return interaction.reply({
      content: `⚠️ Đạo hữu **${existingUser.daoName || username}** đã bước chân vào tiên đồ rồi! Hãy gõ \`!tupan\` để xem bảng thông tin tu chân.`,
      ephemeral: true
    });
  }

  // Quay tư chất bẩm sinh (Duy nhất 1 lần khi sinh ra)
  const talent = rollInnateTalent();

  // Tạo tài khoản sơ khởi
  const newUser = new User({
    userId,
    username,
    daoName: username,
    talent: {
      tier: talent.tier,
      tierName: talent.tierName,
      name: talent.name,
      desc: talent.desc,
      expMultiplier: talent.expMultiplier,
      specialSkill: talent.specialSkill
    },
    rerollsLeft: 0
  });

  await newUser.save();

  // Tạo Embed hiển thị Tư Chất Bẩm Sinh
  const embed = new EmbedBuilder()
    .setTitle(`🌌 [KHỞI ĐẦU TIÊN ĐỒ] - Thức Tỉnh Tư Chất Bẩm Sinh`)
    .setColor(talent.color || '#9C27B0')
    .setDescription(`Chúc mừng đạo hữu **${username}** đã dẫn động thiên địa dị tượng, cảm ứng linh căn bẩm sinh!`)
    .addFields(
      { name: `🔮 Phẩm Cấp Tư Chất`, value: `**${talent.tierName}** (Hệ số EXP: **x${talent.expMultiplier}**)`, inline: true },
      { name: `🧬 Linh Căn / Thể Chất`, value: `**${talent.name}**`, inline: true },
      { name: `📜 Miêu Tả`, value: `${talent.desc}`, inline: false }
    );

  if (talent.specialSkill) {
    embed.addFields({ name: `⚡ Thần Thông Bẩm Sinh`, value: `✨ **[${talent.specialSkill}]**`, inline: true });
  }

  embed.addFields(
    { name: `⚖️ BƯỚC TIẾP THEO: Hãy Chọn Lối Đi Đạo Tâm Phía Dưới`, value: `Bấm vào 1 trong các nút bên dưới để chọn Trận Doanh và nhận Buff Khởi Đầu:`, inline: false }
  );

  // Chỉ còn các nút chọn phe (Đã bỏ hoàn toàn nút Tẩy Tủy)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`choose_faction_CHINH_DAO_${userId}`)
      .setLabel('☀️ Chọn CHÍNH ĐẠO')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`choose_faction_MA_DAO_${userId}`)
      .setLabel('🌘 Chọn MA ĐẠO')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`choose_faction_TAN_TU_${userId}`)
      .setLabel('🎭 Chọn TÁN TU')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}
