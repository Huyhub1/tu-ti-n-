import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Bảng hướng dẫn cách chơi toàn diện & tra cứu hệ thống Tu Tiên');

export function createHelpOverviewEmbed() {
  return new EmbedBuilder()
    .setTitle(`📜 [CẨM NANG TU TIÊN] - Hướng Dẫn Sandbox Toàn Tập`)
    .setColor('#9C27B0')
    .setDescription(
      `Chào mừng chư vị đạo hữu đến với **Thế Giới Tu Tiên Sandbox**!\n` +
      `Thế giới mở hoàn toàn do chính người chơi tự tay tạo dựng ân oán, lập phái, luyện đan và xưng bá.\n\n` +
      `💡 **Cách sử dụng:**\n` +
      `• Tạo nhân vật khởi đầu: \`/khoi-dau\`\n` +
      `• Toàn bộ tính năng còn lại dùng lệnh Prefix (Mặc định: \`!\` hoặc \`m\` theo cấu hình bot).\n\n` +
      `👉 **Hãy chọn chuyên mục cần tra cứu ở Menu bên dưới:**`
    );
}

export function createHelpSelectMenuRow() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_select_category')
    .setPlaceholder('👉 Chọn Chuyên Mục Cần Tra Cứu...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('1. Khởi Đầu & Tư Chất Bẩm Sinh')
        .setDescription('Chi tiết 5 bậc Linh Căn & Thần Thể (Chí Tôn Cốt, Trọng Đồng...)')
        .setValue('help_talent')
        .setEmoji('🧬'),
      new StringSelectMenuOptionBuilder()
        .setLabel('2. Trận Doanh Chính - Ma - Tán Tu')
        .setDescription('Phân tích Buff Nội Tại & đặc quyền từng phe phái')
        .setValue('help_faction')
        .setEmoji('⚖️'),
      new StringSelectMenuOptionBuilder()
        .setLabel('3. Tu Luyện & Nén Khí 100k Năm')
        .setDescription('Cơ chế EXP, Lôi kiếp an toàn và nén Khí Hải Từ Dương')
        .setValue('help_cultivation')
        .setEmoji('🧘'),
      new StringSelectMenuOptionBuilder()
        .setLabel('4. Lò Luyện Đan & Chợ Trời Đan Dược')
        .setDescription('Thu hái Linh Thảo, luyện 6 phương thuốc & đăng bán đan dược')
        .setValue('help_alchemy_market')
        .setEmoji('🔮'),
      new StringSelectMenuOptionBuilder()
        .setLabel('5. Tàng Bảo Các & 60 Pháp Bảo Thần Giai')
        .setDescription('Tra cứu 60 bảo vật, Tuyệt Kỹ chiến đấu & Lò Đúc Thần Binh')
        .setValue('help_gears')
        .setEmoji('🛡️'),
      new StringSelectMenuOptionBuilder()
        .setLabel('6. Tàng Kinh Các & Lò Vạn Đạo Dung Hợp')
        .setDescription('100+ công pháp, rèn luyện thuần thục & hợp 5 bí kíp lên phẩm cao')
        .setValue('help_skills')
        .setEmoji('📜'),
      new StringSelectMenuOptionBuilder()
        .setLabel('7. Săn Thú, Khai Khoáng & Đổ Thạch')
        .setDescription('Khai thác mỏ, săn yêu thú, đổ thạch và vượt ải phó bản')
        .setValue('help_economy')
        .setEmoji('💰'),
      new StringSelectMenuOptionBuilder()
        .setLabel('8. Tông Môn 2.0 & Bảng Xếp Hạng Vạn Giới')
        .setDescription('Khai sơn lập phái, Buff Sơn Môn 5 cấp độ & 5 Bảng Top !top')
        .setValue('help_sect_top')
        .setEmoji('👑'),
      new StringSelectMenuOptionBuilder()
        .setLabel('9. Bảng Tổng Hợp Tất Cả Lệnh')
        .setDescription('Danh sách đầy đủ tất cả cú pháp lệnh trong game')
        .setValue('help_commands_list')
        .setEmoji('⚡')
    );

  return new ActionRowBuilder().addComponents(selectMenu);
}

export async function execute(interaction) {
  const embed = createHelpOverviewEmbed();
  const row = createHelpSelectMenuRow();
  await interaction.reply({ embeds: [embed], components: [row] });
}
