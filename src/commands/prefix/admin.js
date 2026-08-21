import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { User } from '../../database/models/User.js';
import { grantCurrencies } from '../../services/economyService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const equipmentConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/equipment.json'), 'utf8'));


// Tài khoản có quyền Quản Trị Thiên Đạo.
// KHÔNG hardcode ID mặc định: bot phát hành công khai mà để sẵn ID thì
// người đó thành admin trên MỌI server cài bot. Bắt buộc khai trong .env.
export const ADMIN_ID = process.env.ADMIN_ID || '';

const ADMIN_LIST = ADMIN_ID.split(',').map(id => id.trim()).filter(Boolean);

if (ADMIN_LIST.length === 0) {
  console.warn('[Admin] ⚠️ Chưa cấu hình ADMIN_ID trong .env — lệnh !admin sẽ bị khóa hoàn toàn.');
}

export function isAdmin(userId) {
  if (ADMIN_LIST.length === 0) return false;
  return ADMIN_LIST.includes(userId);
}

// Xác nhận cho lệnh hủy diệt: Map<adminId, { userId, expiresAt }>
const pendingResets = new Map();
const RESET_CONFIRM_WINDOW_MS = 60 * 1000;

export function createGearListEmbed(page = 1) {
  const pageSize = 10;
  const totalPages = Math.ceil(equipmentConfig.equipments.length / pageSize) || 1;

  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  const startIdx = (page - 1) * pageSize;
  const currentGears = equipmentConfig.equipments.slice(startIdx, startIdx + pageSize);

  const itemsText = currentGears.map((e, idx) => {
    const stt = startIdx + idx + 1;
    return `**${stt}. [${e.name}]** (\`${e.rarityName}\`)\n` +
      `   • Mã ID: \`${e.id}\` | Loại: \`${e.slot === 'weapon' ? '⚔️ Binh Khí' : '🔮 Pháp Bảo'}\`\n` +
      `   • Chỉ số: 🗡️ +${e.stats.atk} | 🛡️ +${e.stats.def} | ❤️ +${e.stats.maxHp}\n` +
      `   • Tuyệt Kỹ: *[${e.combatSkill ? e.combatSkill.name : 'Vô'}]*`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`📜 [DANH SÁCH PHÁP BẢO & BINH KHÍ] (Trang ${page}/${totalPages})`)
    .setColor('#00BCD4')
    .setDescription(itemsText)
    .setFooter({ text: `Tổng cộng ${equipmentConfig.equipments.length} pháp bảo | Bấm nút bên dưới để chuyển trang` });

  return { embed, page, totalPages };
}

export function createGearListButtons(page, totalPages, userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_listgear_prev_${page}_${userId}`)
        .setLabel('◀️ Trang Trước')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`btn_listgear_info_${page}_${userId}`)
        .setLabel(`Trang ${page}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`btn_listgear_next_${page}_${userId}`)
        .setLabel('Trang Sau ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages)
    )
  ];
}

export function createGearDetailEmbed(gear) {
  const embed = new EmbedBuilder()
    .setTitle(`🛡️ [THÔNG TIN CHI TIẾT PHÁP BẢO] - ${gear.name}`)
    .setColor(gear.color || '#9C27B0')
    .setDescription(
      `**Mã ID:** \`${gear.id}\`\n` +
      `**Phân Loại:** \`${gear.type}\` (${gear.slot === 'weapon' ? '⚔️ Binh Khí Chính' : '🔮 Bản Mệnh Pháp Bảo'})\n` +
      `**Phẩm Cấp:** ✨ **\`${gear.rarityName}\`**\n` +
      `📖 **Điển Tích:** *${gear.lore || 'Cổ vật tu chân viễn cổ.'}*\n\n` +
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

export async function executeAdmin(message, args) {

  if (!isAdmin(message.author.id)) {
    if (ADMIN_LIST.length === 0) {
      return message.reply({ content: `❌ Bot chưa cấu hình \`ADMIN_ID\` trong file \`.env\` nên toàn bộ lệnh quản trị đang bị khóa.` });
    }
    return message.reply({ content: `❌ **CẢNH BÁO THIÊN ĐẠO:** Bạn không có quyền Admin để thực thi lệnh này!` });
  }

  const subCommand = args[0]?.toLowerCase();

  if (!subCommand || subCommand === 'help') {
    const embed = new EmbedBuilder()
      .setTitle(`👑 [BẢNG LỆNH ADMIN / QUẢN TRỊ THIÊN ĐẠO]`)
      .setColor('#FFD700')
      .setDescription(

        `Dành riêng cho Admin ${ADMIN_LIST.map(id => `<@${id}>`).join(', ')} can thiệp dữ liệu tu tiên của người chơi:\n\n` +
        `• \`!admin listgear [trang]\` : Xem danh sách 60 pháp bảo có nút bấm qua lại.\n` +
        `• \`!admin viewgear <id_pháp_bảo>\` : Xem chi tiết toàn bộ chỉ số, nội tại & ảnh của pháp bảo.\n` +
        `• \`!admin addgear @user <id_pháp_bảo>\` : Tặng thẳng Pháp Bảo/Thần Binh cho mem.\n` +
        `• \`!admin addexp @user <số_exp>\` : Cộng thẳng Tu Vi EXP cho mem.\n` +
        `• \`!admin addmoney @user <linh_thạch> [nguyên_thạch]\` : Cộng tiền cho mem.\n` +

        `• \`!admin reset @user\` : Xóa dữ liệu tu tiên của 1 người chơi (phải gõ 2 lần để xác nhận).\n\n` +

        `**⚙️ Thiên Cơ Các — vận hành máy chủ:**\n` +
        `• \`!capnhat\` : Xem bản đang chạy; có bản mới trên git thì kéo về luôn.\n` +
        `• \`!capnhat xem\` : Chỉ xem, không kéo về.\n` +
        `• \`!capnhat thulai\` : Gỡ cách ly, ép thử lại bản mới đã trượt vòng nghiệm thu.\n\n` +

        `*Ví dụ:* \`!admin listgear\` | \`!admin viewgear chuong_hon_don\` | \`!admin addgear @Lieu chuong_hon_don\``
      );
    return message.reply({ embeds: [embed] });
  }

  // 1. Lệnh xem danh sách mã ID pháp bảo có nút bấm: !admin listgear [trang]
  if (subCommand === 'listgear' || subCommand === 'list') {
    let page = parseInt(args[1], 10) || 1;
    const { embed, totalPages } = createGearListEmbed(page);
    const buttons = createGearListButtons(page, totalPages, message.author.id);

    return message.reply({ embeds: [embed], components: buttons });
  }

  // 2. Lệnh xem chi tiết chỉ số và buff của 1 item: !admin viewgear <gearId>
  if (subCommand === 'viewgear' || subCommand === 'view' || subCommand === 'item') {
    const gearQuery = args.slice(1).join(' ').toLowerCase();
    if (!gearQuery) {
      return message.reply({ content: `❌ Vui lòng nhập mã ID hoặc tên pháp bảo cần xem! Ví dụ: \`!admin viewgear chuong_hon_don\`` });
    }

    const gear = equipmentConfig.equipments.find(e =>
      e.id.toLowerCase() === gearQuery ||
      e.name.toLowerCase() === gearQuery ||
      e.name.toLowerCase().includes(gearQuery)
    );

    if (!gear) {
      return message.reply({ content: `❌ Không tìm thấy pháp bảo nào khớp với: \`${gearQuery}\`! Hãy gõ \`!admin listgear\` để xem danh sách.` });
    }

    const embed = createGearDetailEmbed(gear);
    return message.reply({ embeds: [embed] });
  }

  // Lấy target user cho các lệnh can thiệp
  const targetMember = message.mentions.users.first();
  const targetUserId = targetMember ? targetMember.id : args[1];

  if (!targetUserId) {
    return message.reply({ content: `❌ Hãy tag người chơi cần can thiệp! Ví dụ: \`!admin ${subCommand} @user ...\`` });
  }

  const user = await User.findOne({ userId: targetUserId });
  if (!user) {
    return message.reply({ content: `❌ Người chơi này chưa tạo nhân vật trong game!` });
  }

  // 3. Cộng Tu Vi EXP: !admin addexp @user <amount>
  if (subCommand === 'addexp') {
    const amount = parseInt(args[2], 10);
    if (isNaN(amount) || amount <= 0) {
      return message.reply({ content: `❌ Vui lòng nhập số EXP hợp lệ! Ví dụ: \`!admin addexp @user 5000\`` });
    }

    user.realm.exp += amount;
    await user.save();

    return message.reply({
      content: `✅ **THIÊN ĐẠO BAN PHÚC:** Đã cộng **+${amount.toLocaleString()} EXP** Tu Vi cho đạo hữu **${user.daoName || user.username}**! (EXP hiện tại: \`${user.realm.exp}/${user.realm.maxExp}\`)`
    });
  }

  // 4. Cộng Tiền: !admin addmoney @user <linhThach> [nguyenThach]
  if (subCommand === 'addmoney') {
    const linhThach = parseInt(args[2], 10) || 0;
    const nguyenThach = parseInt(args[3], 10) || 0;


    // Cộng bằng $inc thay vì save() cả document: người chơi có thể đang đi săn
    // hay đào khoáng ngay lúc admin ban thưởng, ghi đè nguyên document sẽ nuốt
    // mất phần thưởng họ vừa kiếm được.
    const granted = await grantCurrencies(user.userId, { linhThach, nguyenThach });
    if (!granted) {
      return message.reply({ content: `❌ Không cộng được tài nguyên cho đạo hữu này (không tìm thấy nhân vật).` });
    }

    return message.reply({
      content: `✅ **THIÊN ĐẠO BAN PHƯỚC:** Đã cộng **+${linhThach.toLocaleString()} Linh Thạch** & **+${nguyenThach.toLocaleString()} Nguyên Thạch** cho đạo hữu **${granted.daoName || granted.username}**! ` +
        `(Hiện có: \`${(granted.currencies.linhThach || 0).toLocaleString()} LT\` | \`${(granted.currencies.nguyenThach || 0).toLocaleString()} NT\`)`
    });
  }

  // 5. Tặng Pháp Bảo: !admin addgear @user <gearId>
  if (subCommand === 'addgear') {
    const gearId = args.slice(2).join(' ').toLowerCase();
    const gearConfig = equipmentConfig.equipments.find(e =>
      e.id === gearId ||
      e.name.toLowerCase() === gearId ||
      e.name.toLowerCase().includes(gearId)
    );

    if (!gearConfig) {
      return message.reply({ content: `❌ Không tìm thấy pháp bảo có mã ID: \`${gearId}\`! Hãy gõ \`!admin listgear\` để xem toàn bộ mã ID.` });
    }

    user.equipments = user.equipments || [];
    const newGear = {
      gearId: gearConfig.id,
      name: gearConfig.name,
      type: gearConfig.type,
      slot: gearConfig.slot,
      rarity: gearConfig.rarity,
      rarityName: gearConfig.rarityName,
      enhanceLevel: 0,
      stats: { ...gearConfig.stats },
      combatSkill: { ...gearConfig.combatSkill },
      imageUrl: gearConfig.imageUrl || '',
      equipped: false
    };

    user.equipments.push(newGear);
    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`🎁 [THIÊN THẦN BAN BẢO VẬT]`)
      .setColor('#FFD700')
      .setDescription(
        `Admin đã ban tặng thần binh cho **${user.daoName || user.username}**:\n\n` +
        `✨ **Trang Bị:** **[${newGear.name}]** (\`${newGear.rarityName}\`)\n` +
        `📊 **Chỉ số:** 🗡️ ATK: \`+${newGear.stats.atk}\` | 🛡️ DEF: \`+${newGear.stats.def}\` | ❤️ HP: \`+${newGear.stats.maxHp}\`\n` +
        `🔥 **Tuyệt Kỹ:** **[${newGear.combatSkill.name}]** (*${newGear.combatSkill.desc}*)`
      );

    if (newGear.imageUrl) {
      embed.setImage(newGear.imageUrl);
    }

    return message.reply({ embeds: [embed] });
  }


  // 6. Reset nhân vật: !admin reset @user  (yêu cầu xác nhận 2 bước)
  if (subCommand === 'reset') {
    const adminId = message.author.id;
    const pending = pendingResets.get(adminId);
    const now = Date.now();

    if (!pending || pending.userId !== targetUserId || pending.expiresAt < now) {
      pendingResets.set(adminId, { userId: targetUserId, expiresAt: now + RESET_CONFIRM_WINDOW_MS });

      const victim = await User.findOne({ userId: targetUserId }).lean();
      if (!victim) {
        pendingResets.delete(adminId);
        return message.reply({ content: `❌ <@${targetUserId}> chưa có dữ liệu tu tiên nào để xóa.` });
      }

      return message.reply({
        content:
          `⚠️ **XÁC NHẬN XÓA VĨNH VIỄN** — hành động này KHÔNG THỂ hoàn tác!\n` +
          `👤 Mục tiêu: <@${targetUserId}> (\`${victim.daoName || victim.username}\`)\n` +
          `🏵️ Cảnh giới: \`${victim.realm?.name || '?'}\` | 💎 \`${(victim.currencies?.linhThach || 0).toLocaleString()} LT\` | 🔮 \`${(victim.currencies?.nguyenThach || 0).toLocaleString()} NT\`\n` +
          `📜 \`${(victim.skills || []).length}\` công pháp | ⚔️ \`${(victim.equipments || []).length}\` pháp bảo\n\n` +
          `👉 Gõ lại **\`!admin reset @user\`** trong vòng **60 giây** để xác nhận.`
      });
    }

    pendingResets.delete(adminId);
    const result = await User.deleteOne({ userId: targetUserId });
    if (result.deletedCount === 0) {
      return message.reply({ content: `❌ Không tìm thấy dữ liệu của <@${targetUserId}> (có thể đã bị xóa trước đó).` });
    }

    console.warn(`[Admin] ${adminId} đã xóa dữ liệu của ${targetUserId}`);
    return message.reply({ content: `🗑️ **ĐÃ XÓA DỮ LIỆU!** Nhân vật của <@${targetUserId}> đã bị xóa khỏi hệ thống.` });
  }

  return message.reply({ content: `❌ Lệnh không hợp lệ! Gõ \`!admin help\` để xem hướng dẫn.` });
}

// Lệnh công khai cho tất cả người chơi tra cứu thông tin món đồ: !xemphapbao <id / tên>
export async function executeXemphapbao(message, args) {
  const gearQuery = args.join(' ').toLowerCase();
  if (!gearQuery) {
    return message.reply({ content: `❌ Vui lòng nhập tên hoặc mã ID pháp bảo cần tra cứu! Ví dụ: \`!xemphapbao Chuông Hỗn Độn\`` });
  }

  const gear = equipmentConfig.equipments.find(e =>
    e.id.toLowerCase() === gearQuery ||
    e.name.toLowerCase() === gearQuery ||
    e.name.toLowerCase().includes(gearQuery)
  );

  if (!gear) {
    return message.reply({ content: `❌ Không tìm thấy pháp bảo nào có tên hoặc mã: \`${gearQuery}\`!` });
  }

  const embed = createGearDetailEmbed(gear);
  return message.reply({ embeds: [embed] });
}
