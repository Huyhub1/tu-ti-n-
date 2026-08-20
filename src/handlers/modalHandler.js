import { User } from '../database/models/User.js';
import { Sect } from '../database/models/Sect.js';
import { listSkillForSale } from '../commands/prefix/market.js';
import { donateToSect } from '../commands/prefix/sect.js';

/**
 * Đọc chỉ số công pháp từ customId của modal đăng bán.
 * Có hai định dạng lịch sử: `modal_sell_submit::skill_0::<userId>` (mới) và
 * `modal_sell_submit_0_<userId>` (cũ, vẫn còn nút đang treo trong lịch sử chat).
 */
function parseSellCustomId(customId) {
  if (customId.includes('::')) {
    const parts = customId.split('::');
    return {
      skillIdx: parseInt(String(parts[1]).replace('skill_', ''), 10),
      targetUserId: parts[2]
    };
  }

  const parts = customId.split('_');
  return {
    skillIdx: parseInt(parts[parts.length - 2], 10),
    targetUserId: parts[parts.length - 1]
  };
}

/**
 * Toàn bộ modal của bot.
 *
 * Tách khỏi `src/index.js` vì file khởi động không nên chứa nghiệp vụ game:
 * hai modal nằm lẫn trong đó đã âm thầm trôi xa khỏi lệnh gõ tay tương ứng —
 * modal bán bí kíp bỏ qua giá trần/sàn, bỏ qua giới hạn 10 gian hàng, xóa bí
 * kíp trước khi tạo gian hàng và làm rơi mất phẩm cấp; modal cống hiến thì trừ
 * tiền không atomic. Nay cả hai gọi đúng hàm mà `!ban` và `!conghien` dùng.
 */
export async function handleModalSubmit(interaction) {
  const customId = interaction.customId;

  // 1. Modal Đăng Bán Bí Kíp (từ !tangkinhcac)
  if (customId.startsWith('modal_sell_submit::') || customId.startsWith('modal_sell_submit_')) {
    const { skillIdx, targetUserId } = parseSellCustomId(customId);

    if (interaction.user.id !== targetUserId) {
      return interaction.reply({ content: `⚠️ Thao tác này không thuộc về bạn!`, ephemeral: true });
    }

    const price = parseInt(String(interaction.fields.getTextInputValue('sell_price_input')).replace(/[.,_\s]/g, ''), 10);

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!`, ephemeral: true });

    const result = await listSkillForSale(user, skillIdx, price);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });

    return interaction.reply({ embeds: [result.embed] });
  }

  // 2. Modal Cống Hiến Ngân Khố (từ !tongmon)
  if (customId.startsWith('modal_sect_donate::')) {
    const [, sectId, targetUserId] = customId.split('::');

    if (interaction.user.id !== targetUserId) {
      return interaction.reply({ content: `⚠️ Thao tác này không thuộc về bạn!`, ephemeral: true });
    }

    const amount = parseInt(String(interaction.fields.getTextInputValue('sect_donate_amount_input')).replace(/[.,_\s]/g, ''), 10);

    const user = await User.findOne({ userId: targetUserId });
    const sect = await Sect.findById(sectId).catch(() => null);

    if (!user || !sect) {
      return interaction.reply({ content: `❌ Dữ liệu người chơi hoặc môn phái không tồn tại!`, ephemeral: true });
    }

    // Không cho cống hiến vào bang mình không thuộc về.
    if (String(user.sectId || '') !== String(sect._id)) {
      return interaction.reply({ content: `❌ Đạo hữu không phải đệ tử của **[${sect.name}]**!`, ephemeral: true });
    }

    const result = await donateToSect(user, sect, amount);
    if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true });

    return interaction.reply({ embeds: [result.embed] });
  }
}
