import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';

export async function executePhapbao(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const equippedWeapon = user.equipments.find(e => e.equipped && e.slot === 'weapon');
  const equippedAccessory = user.equipments.find(e => e.equipped && e.slot === 'accessory');

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ [PHÁP BẢO & TRANG BỊ CÁ NHÂN] - ${user.daoName || user.username}`)
    .setColor('#9C27B0')
    .setDescription(
      `**Trạng Thái Trang Bị Hiện Tại:**\n\n` +
      `⚔️ **Binh Khí Chính:** ${equippedWeapon ? `**[${equippedWeapon.name}]** ${equippedWeapon.enhanceLevel > 0 ? `\`+${equippedWeapon.enhanceLevel}\`` : ''} (*${equippedWeapon.rarityName}*)` : `*Chưa trang bị binh khí*`}\n` +
      `🔮 **Bản Mệnh Pháp Bảo:** ${equippedAccessory ? `**[${equippedAccessory.name}]** ${equippedAccessory.enhanceLevel > 0 ? `\`+${equippedAccessory.enhanceLevel}\`` : ''} (*${equippedAccessory.rarityName}*)` : `*Chưa trang bị pháp bảo*`}\n\n` +
      `📦 **Kho Binh Khí & Pháp Bảo Sở Hữu (\`${user.equipments.length}\` món):**\n`
    );

  if (user.equipments.length === 0) {
    embed.addFields({
      name: `Kho trang bị trống`,
      value: `*Đạo hữu chưa sở hữu pháp bảo nào! Hãy gõ \`!ducphapbao\` để rèn vũ khí từ Nguyên Thạch & Yêu Đan.*`
    });
    return message.reply({ embeds: [embed] });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`gear_select_action_${userId}`)
    .setPlaceholder('👉 Chọn món đồ để Mặc / Tháo / Cường Hóa...');

  user.equipments.forEach((gear, idx) => {
    const equipTag = gear.equipped ? `✅ [ĐANG ĐEO]` : `⭕`;
    const enhanceTag = gear.enhanceLevel > 0 ? `(+${gear.enhanceLevel})` : '';

    embed.addFields({
      name: `${idx + 1}. ${equipTag} **[${gear.name}]** ${enhanceTag} - \`${gear.rarityName}\``,
      value: `🗡️ ATK: \`+${gear.stats.atk}\` | 🛡️ DEF: \`+${gear.stats.def}\` | ❤️ HP: \`+${gear.stats.maxHp}\`\n🔥 Tuyệt Kỹ: **${gear.combatSkill ? gear.combatSkill.name : 'Vô'}** (*${gear.combatSkill ? gear.combatSkill.desc : ''}*)`,
      inline: false
    });

    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${idx + 1}. ${gear.name} ${enhanceTag} ${gear.equipped ? '[Đang Đeo]' : ''}`)
        .setDescription(`Phẩm: ${gear.rarityName}`)
        .setValue(`gear_${gear.gearId}_${idx}`)
        .setEmoji(gear.slot === 'weapon' ? '⚔️' : '🔮')
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await message.reply({ embeds: [embed], components: [row] });
}
