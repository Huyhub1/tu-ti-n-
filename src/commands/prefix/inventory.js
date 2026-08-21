import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { EMBED_LIMITS, clampPage, truncate, fillFields } from '../../utils/embedLimits.js';

// Discord chặn cứng 25 field mỗi embed và 25 lựa chọn mỗi select menu. Túi đồ
// thì phình theo thời gian chơi — riêng Yêu Đan đã có 20 loại, cộng 10 phương
// đan và nguyên liệu là vượt trần. Bản cũ đổ thẳng cả túi vào một embed nên
// người chơi càng tiến xa càng chắc chắn gặp "interaction failed".
const PAGE_SIZE = 10;

// Chừa sẵn ngần này ký tự cho footer đặt sau khi đã nhồi field. Xem embedLimits.js.
const FOOTER_RESERVE = 200;

export function createInventoryView(user, page = 1) {
  const items = user.inventory || [];
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = clampPage(page, totalPages);

  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageItems = items.slice(startIdx, startIdx + PAGE_SIZE);
  const owner = truncate(user.daoName || user.username || 'Vô Danh Tu Sĩ', 64);

  const embed = new EmbedBuilder()
    .setTitle(truncate(`🎒 [TÚI TRỮ VẬT / CÀN KHÔN BAO] - ${owner}`, EMBED_LIMITS.title))
    .setColor('#FF9800')
    .setDescription(
      `**Chủ nhân:** \`${owner}\`\n` +
      `💎 **Linh Thạch:** \`${(user.currencies?.linhThach || 0).toLocaleString()}\` | 🔮 **Nguyên Thạch:** \`${(user.currencies?.nguyenThach || 0).toLocaleString()}\`\n` +
      `❤️ **Máu hiện tại:** \`${user.stats?.hp ?? 0}/${user.stats?.maxHp ?? 0}\`\n\n` +
      `📦 **Danh sách vật phẩm trong túi (\`${items.length}\` loại):**\n`
    );

  if (items.length === 0) {
    embed.addFields({
      name: `Túi đồ rỗng`,
      value: `*Chưa có đan dược hay yêu đan nào. Hãy đi \`!santhu\` hoặc \`!phoban\` để thu thập vật phẩm!*`
    });
    return { embed, components: [], page: 1, totalPages: 1 };
  }

  // Giữ chỉ số toàn cục: trình xử lý select tra thẳng user.inventory[idx], nên
  // đánh số lại theo từng trang là dùng nhầm vật phẩm.
  const rows = pageItems.map((item, offset) => ({ item, idx: startIdx + offset }));

  const added = fillFields(embed, rows.map(({ item, idx }) => ({
    name: `${idx + 1}. **${item.name}** [x${item.quantity}]`,
    value: `📂 Loại: \`${item.type}\` | *${item.desc || 'Vật phẩm tu chân'}*`,
    inline: false
  })), { reserve: FOOTER_RESERVE });

  // Chỉ chào bán trong menu đúng những món đã hiện trong embed, tránh cảnh
  // người chơi chọn được món không nhìn thấy mô tả.
  const shown = rows.slice(0, added);

  embed.setFooter({
    text: `Trang ${safePage}/${totalPages} · tổng ${items.length} loại vật phẩm` +
      (added < rows.length ? ` · ẩn ${rows.length - added} món quá dài` : '')
  });

  const components = [];
  if (shown.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`inv_select_item_${user.userId}`)
      .setPlaceholder(truncate(`👉 Chọn vật phẩm muốn xem & sử dụng (trang ${safePage}/${totalPages})...`, 150));

    for (const { item, idx } of shown) {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(`${idx + 1}. ${item.name} (x${item.quantity})`, EMBED_LIMITS.optionLabel))
          .setDescription(truncate(`Loại: ${item.type}`, EMBED_LIMITS.optionDescription))
          .setValue(truncate(`item_${item.itemId}_${idx}`, EMBED_LIMITS.optionValue))
          .setEmoji('💊')
      );
    }
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  if (totalPages > 1) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_inv_page::${safePage - 1}::${user.userId}`)
        .setLabel('◀️ Trang Trước')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage <= 1),
      new ButtonBuilder()
        .setCustomId(`btn_inv_page_info::${safePage}::${user.userId}`)
        .setLabel(`Trang ${safePage}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`btn_inv_page::${safePage + 1}::${user.userId}`)
        .setLabel('Trang Sau ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage >= totalPages)
    ));
  }

  return { embed, components, page: safePage, totalPages };
}

export async function executeTuido(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });

  const { embed, components } = createInventoryView(user, 1);
  await message.reply({ embeds: [embed], components });
}
