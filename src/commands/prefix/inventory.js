import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';

export async function executeTuido(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const embed = new EmbedBuilder()
    .setTitle(`🎒 [TÚI TRỮ VẬT / CÀN KHÔN BAO] - ${user.daoName || user.username}`)
    .setColor('#FF9800')
    .setDescription(
      `**Chủ nhân:** \`${user.daoName || user.username}\`\n` +
      `💎 **Linh Thạch:** \`${user.currencies.linhThach.toLocaleString()}\` | 🔮 **Nguyên Thạch:** \`${(user.currencies.nguyenThach || 0).toLocaleString()}\`\n` +
      `❤️ **Máu hiện tại:** \`${user.stats.hp}/${user.stats.maxHp}\`\n\n` +
      `📦 **Danh sách vật phẩm trong túi (\`${user.inventory.length}\` loại):**\n`
    );

  if (user.inventory.length === 0) {
    embed.addFields({
      name: `Túi đồ rỗng`,
      value: `*Chưa có đan dược hay yêu đan nào. Hãy đi \`!santhu\` hoặc \`!phoban\` để thu thập vật phẩm!*`
    });
    return message.reply({ embeds: [embed] });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`inv_select_item_${userId}`)
    .setPlaceholder('👉 Chọn vật phẩm muốn xem & sử dụng...');

  user.inventory.forEach((item, idx) => {
    embed.addFields({
      name: `${idx + 1}. **${item.name}** [x${item.quantity}]`,
      value: `📂 Loại: \`${item.type}\` | *${item.desc || 'Vật phẩm tu chân'}*`,
      inline: false
    });

    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${idx + 1}. ${item.name} (x${item.quantity})`)
        .setDescription(`Loại: ${item.type}`)
        .setValue(`item_${item.itemId}_${idx}`)
        .setEmoji('💊')
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await message.reply({ embeds: [embed], components: [row] });
}
