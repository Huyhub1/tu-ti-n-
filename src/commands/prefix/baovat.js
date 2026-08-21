import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const equipmentConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/equipment.json'), 'utf8'));

const RARITY_META = {
  ALL: { name: 'Tất Cả Phẩm Cấp', emoji: '🌐', color: '#00BCD4' },
  HOANG_GIAI: { name: 'Hoàng Giai (Bậc 1-3)', emoji: '🟤', color: '#8D6E63' },
  HUYEN_GIAI: { name: 'Huyền Giai (Bậc 4)', emoji: '🔵', color: '#2196F3' },
  DIA_GIAI: { name: 'Địa Giai (Bậc 5)', emoji: '🟣', color: '#9C27B0' },
  THIEN_GIAI: { name: 'Thiên Giai (Bậc 6)', emoji: '🟡', color: '#E91E63' },
  THAN_GIAI: { name: 'Thần Giai / Cực Phẩm (Bậc 7)', emoji: '🔴', color: '#FFD700' }
};

export function createPublicGearListEmbed(rarity = 'ALL', page = 1) {
  let filtered = equipmentConfig.equipments;
  if (rarity && rarity !== 'ALL') {
    filtered = equipmentConfig.equipments.filter(e => e.rarity === rarity);
  }

  const pageSize = 6;
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  const startIdx = (page - 1) * pageSize;
  const currentGears = filtered.slice(startIdx, startIdx + pageSize);
  const meta = RARITY_META[rarity] || RARITY_META.ALL;

  const itemsText = currentGears.map((e, idx) => {
    const stt = startIdx + idx + 1;
    const typeTag = e.slot === 'weapon' ? '⚔️ Binh Khí' : '🔮 Pháp Bảo';
    const skillTag = e.combatSkill && e.combatSkill.name
      ? `🔥 Tuyệt Kỹ: **[${e.combatSkill.name}]** (*${e.combatSkill.desc || ''}*)`
      : `🔥 Tuyệt Kỹ: *Chưa kích hoạt*`;

    return `**${stt}. [${e.name}]** (\`${e.rarityName}\`)\n` +
      `   • Mã tra cứu: \`${e.id}\` | Loại: \`${typeTag}\`\n` +
      `   • Chỉ số: 🗡️ +${e.stats.atk} ATK | 🛡️ +${e.stats.def} DEF | ❤️ +${e.stats.maxHp} HP | 💥 +${(e.stats.critRate * 100).toFixed(0)}% Bạo\n` +
      `   • ${skillTag}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏺 [TÀNG BẢO CÁC] - ${meta.emoji} ${meta.name} (Trang ${page}/${totalPages})`)
    .setColor(meta.color)
    .setDescription(
      `Nơi lưu giữ thông tin của toàn bộ Thần Binh & Bản Mệnh Pháp Bảo trong thiên hạ.\n` +
      `*(Dùng \`!xemphapbao <tên_hoặc_mã_id>\` để xem chi tiết chân dung & nội tại)*\n\n` +
      (itemsText || '*Không có bảo vật nào trong phẩm cấp này.*')
    )
    .setFooter({ text: `Tổng cộng ${filtered.length} pháp bảo | Chọn menu bên dưới để lọc phẩm cấp` });

  return { embed, page, totalPages, count: filtered.length };
}

export function createPublicGearSelectMenu(selectedRarity = 'ALL', userId) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`gear_filter_rarity_${userId}`)
    .setPlaceholder('👉 Bấm vào đây để chọn Phẩm Cấp Bảo Vật...');

  for (const [key, meta] of Object.entries(RARITY_META)) {
    const count = key === 'ALL'
      ? equipmentConfig.equipments.length
      : equipmentConfig.equipments.filter(e => e.rarity === key).length;

    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${meta.name} (${count} món)`)
        .setValue(key)
        .setEmoji(meta.emoji)
        .setDefault(key === selectedRarity)
    );
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

export function createPublicGearButtons(rarity, page, totalPages, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_public_gear_prev_${rarity}_${page}_${userId}`)
      .setLabel('◀️ Trang Trước')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`btn_public_gear_info_${rarity}_${page}_${userId}`)
      .setLabel(`Trang ${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`btn_public_gear_next_${rarity}_${page}_${userId}`)
      .setLabel('Trang Sau ▶️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages)
  );
}

export function createGearDetailEmbed(gear) {
  const embed = new EmbedBuilder()
    .setTitle(`🛡️ [CHI TIẾT BẢO VẬT] - ${gear.name}`)
    .setColor(gear.color || '#9C27B0')
    .setDescription(
      `**Mã ID Tra Cứu:** \`${gear.id}\`\n` +
      `**Phân Loại:** \`${gear.type}\` (${gear.slot === 'weapon' ? '⚔️ Binh Khí Chính' : '🔮 Bản Mệnh Pháp Bảo'})\n` +
      `**Phẩm Cấp:** ✨ **\`${gear.rarityName}\`**\n` +
      `📖 **Điển Tích:** *${gear.lore || 'Cổ vật viễn cổ hàm chứa uy năng kinh thiên động địa.'}*\n\n` +
      `📊 **Thuộc Tính Cơ Bản:**\n` +
      `🗡️ **Công Kích (ATK):** \`+${gear.stats.atk}\`\n` +
      `🛡️ **Phòng Ngự (DEF):** \`+${gear.stats.def}\`\n` +
      `❤️ **Sinh Mệnh (HP):** \`+${gear.stats.maxHp}\`\n` +
      `💥 **Tỉ Lệ Bạo Kích:** \`+${(gear.stats.critRate * 100).toFixed(0)}%\`\n\n` +
      `🌟 **Hiệu Ứng Bị Động (Nội Tại Buff):**\n` +
      `• ${gear.passives ? gear.passives.desc : '*Không có*'}\n\n` +
      `🔥 **Kỹ Năng Chiến Đấu (Tuyệt Kỹ):**\n` +
      `• **[${gear.combatSkill ? gear.combatSkill.name : 'Vô'}]**\n` +
      `• *${gear.combatSkill ? gear.combatSkill.desc : 'Không có'}*`
    );

  // Ảnh trang bị lấy thẳng từ link, không đính kèm file từ đĩa nữa. Đính file
  // buộc bot phải mang theo cả thư mục ảnh 27 MB và phải tìm đúng thư mục đó
  // trên mọi máy — lệch đường dẫn một cái là mất ảnh mà không kêu tiếng nào.
  // Link thì máy nào cũng như nhau, và Discord tự nhớ ảnh nên lần hiện sau
  // còn nhanh hơn.
  if (gear.imageUrl) embed.setImage(gear.imageUrl);

  return embed;
}

// Lệnh chính: !baovat / !traphapbao
export async function executeBaovat(message, args) {
  let initialRarity = 'ALL';
  if (args.length > 0) {
    const query = args[0].toUpperCase();
    if (RARITY_META[query]) {
      initialRarity = query;
    }
  }

  const { embed, page, totalPages } = createPublicGearListEmbed(initialRarity, 1);
  const menuRow = createPublicGearSelectMenu(initialRarity, message.author.id);
  const buttonsRow = createPublicGearButtons(initialRarity, page, totalPages, message.author.id);

  await message.reply({ embeds: [embed], components: [menuRow, buttonsRow] });
}

// Lệnh xem chi tiết bảo vật bằng Tên hoặc ID: !xemphapbao <tên_hoặc_id>
export async function executeXemphapbao(message, args) {
  const query = args.join(' ').trim().toLowerCase();
  if (!query) {
    return message.reply({
      content: `❌ Cú pháp đúng: \`!xemphapbao <tên_hoặc_mã_id>\`\nVí dụ: \`!xemphapbao Chuông Hỗn Độn\` hoặc \`!xemphapbao chuong_hon_don\``
    });
  }

  const gear = equipmentConfig.equipments.find(e =>
    e.id.toLowerCase() === query ||
    e.name.toLowerCase() === query ||
    e.name.toLowerCase().includes(query)
  );

  if (!gear) {
    return message.reply({
      content: `❌ Không tìm thấy bảo vật nào có tên hoặc mã khớp với **"${query}"**! Dùng \`!baovat\` để xem danh mục toàn bộ bảo vật.`
    });
  }

  const embed = createGearDetailEmbed(gear);
  await message.reply({ embeds: [embed] });
}
