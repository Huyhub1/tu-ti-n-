import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { EMBED_LIMITS, clampPage, truncate, fillFields } from '../../utils/embedLimits.js';

// Cùng lý do với túi đồ: 25 field / 25 lựa chọn là trần cứng của Discord, mà
// kho pháp bảo thì tích luỹ mãi (60 món trong game, rơi từ mọi lượt săn).
const PAGE_SIZE = 8;

// Chừa sẵn ngần này ký tự cho footer đặt sau khi đã nhồi field. Xem embedLimits.js.
const FOOTER_RESERVE = 200;

export function createGearView(user, page = 1) {
  const gears = user.equipments || [];
  const totalPages = Math.max(1, Math.ceil(gears.length / PAGE_SIZE));
  const safePage = clampPage(page, totalPages);

  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageGears = gears.slice(startIdx, startIdx + PAGE_SIZE);
  const owner = truncate(user.daoName || user.username || 'Vô Danh Tu Sĩ', 64);

  const equippedWeapon = gears.find(e => e.equipped && e.slot === 'weapon');
  const equippedAccessory = gears.find(e => e.equipped && e.slot === 'accessory');
  const wornLabel = (gear) => gear
    ? truncate(`**[${gear.name}]** ${gear.enhanceLevel > 0 ? `\`+${gear.enhanceLevel}\`` : ''} (*${gear.rarityName}*)`, 200)
    : null;

  const embed = new EmbedBuilder()
    .setTitle(truncate(`🛡️ [PHÁP BẢO & TRANG BỊ CÁ NHÂN] - ${owner}`, EMBED_LIMITS.title))
    .setColor('#9C27B0')
    .setDescription(
      `**Trạng Thái Trang Bị Hiện Tại:**\n\n` +
      `⚔️ **Binh Khí Chính:** ${wornLabel(equippedWeapon) || `*Chưa trang bị binh khí*`}\n` +
      `🔮 **Bản Mệnh Pháp Bảo:** ${wornLabel(equippedAccessory) || `*Chưa trang bị pháp bảo*`}\n\n` +
      `📦 **Kho Binh Khí & Pháp Bảo Sở Hữu (\`${gears.length}\` món):**\n`
    );

  if (gears.length === 0) {
    embed.addFields({
      name: `Kho trang bị trống`,
      value: `*Đạo hữu chưa sở hữu pháp bảo nào! Hãy gõ \`!ducphapbao\` để rèn vũ khí từ Nguyên Thạch & Yêu Đan.*`
    });
    return { embed, components: [], page: 1, totalPages: 1 };
  }

  // Giữ chỉ số toàn cục: trình xử lý select tra thẳng user.equipments[idx].
  const rows = pageGears.map((gear, offset) => ({ gear, idx: startIdx + offset }));

  const added = fillFields(embed, rows.map(({ gear, idx }) => {
    const equipTag = gear.equipped ? `✅ [ĐANG ĐEO]` : `⭕`;
    const enhanceTag = gear.enhanceLevel > 0 ? `(+${gear.enhanceLevel})` : '';
    return {
      name: `${idx + 1}. ${equipTag} **[${gear.name}]** ${enhanceTag} - \`${gear.rarityName}\``,
      value: `🗡️ ATK: \`+${gear.stats.atk}\` | 🛡️ DEF: \`+${gear.stats.def}\` | ❤️ HP: \`+${gear.stats.maxHp}\`\n` +
        `🔥 Tuyệt Kỹ: **${gear.combatSkill ? gear.combatSkill.name : 'Vô'}** (*${gear.combatSkill ? gear.combatSkill.desc : ''}*)`,
      inline: false
    };
  }), { reserve: FOOTER_RESERVE });

  // Chỉ đưa vào menu những món đã hiện trong embed, tránh cho người chơi chọn
  // được món mà họ không nhìn thấy chỉ số.
  const shown = rows.slice(0, added);

  embed.setFooter({
    text: `Trang ${safePage}/${totalPages} · tổng ${gears.length} món` +
      (added < rows.length ? ` · ẩn ${rows.length - added} món quá dài` : '')
  });

  const components = [];
  if (shown.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`gear_select_action_${user.userId}`)
      .setPlaceholder(truncate(`👉 Chọn món đồ để Mặc / Tháo / Cường Hóa (trang ${safePage}/${totalPages})...`, 150));

    for (const { gear, idx } of shown) {
      const enhanceTag = gear.enhanceLevel > 0 ? `(+${gear.enhanceLevel})` : '';
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(`${idx + 1}. ${gear.name} ${enhanceTag} ${gear.equipped ? '[Đang Đeo]' : ''}`, EMBED_LIMITS.optionLabel))
          .setDescription(truncate(`Phẩm: ${gear.rarityName}`, EMBED_LIMITS.optionDescription))
          .setValue(truncate(`gear_${gear.gearId}_${idx}`, EMBED_LIMITS.optionValue))
          .setEmoji(gear.slot === 'weapon' ? '⚔️' : '🔮')
      );
    }
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  if (totalPages > 1) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_gear_page::${safePage - 1}::${user.userId}`)
        .setLabel('◀️ Trang Trước')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage <= 1),
      new ButtonBuilder()
        .setCustomId(`btn_gear_page_info::${safePage}::${user.userId}`)
        .setLabel(`Trang ${safePage}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`btn_gear_page::${safePage + 1}::${user.userId}`)
        .setLabel('Trang Sau ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage >= totalPages)
    ));
  }

  return { embed, components, page: safePage, totalPages };
}

export async function executePhapbao(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });

  const { embed, components } = createGearView(user, 1);
  await message.reply({ embeds: [embed], components });
}
