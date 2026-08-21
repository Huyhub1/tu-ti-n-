/**
 * CẢNH BÁO TRƯỚC KHI ĐÁNH CƯỢC CẢNH GIỚI.
 *
 * Hai lệnh có thể làm người chơi tụt tu vi: `!dotpha` (mọi cảnh giới) và
 * `!dokiep` (Kim Đan Đỉnh Phong lên Nguyên Anh). Cả hai đều có cùng một tấm
 * lưới an toàn là Hộ Mạch Đan, và trước bản này cả hai đều lao thẳng vào canh
 * bạc mà không nói một lời.
 *
 * Con số cụ thể:
 *   · `!dotpha` trượt  → tụt 1 tầng, EXP còn 40% của tầng mới
 *   · `!dokiep` trượt  → tụt thẳng từ Đỉnh Phong về Trung Kỳ, EXP về 0
 *   · Có Hộ Mạch Đan   → giữ nguyên cảnh giới, chỉ hao 15% tu vi
 *
 * Tỉ lệ thành công: Luyện Khí 60%, Trúc Cơ 45%, Kim Đan 35%, Nguyên Anh 25%.
 * Tức là ở nửa sau của game, THUA mới là kết quả thường gặp.
 *
 * Hộ Mạch Đan không hề khó kiếm — luyện được từ Luyện Khí tầng 2, nguyên liệu
 * rẻ, `!diemdanh` cũng rơi. Chuyện người chơi mất hàng giờ cày không phải vì
 * đan hiếm, mà vì không ai bảo họ rằng cần nó trước khi bấm. Đó là lỗi của
 * bot, không phải của người chơi.
 *
 * Có đan thì không hỏi han gì cả: họ đã mua bảo hiểm rồi, chặn lại chỉ tổ phiền.
 */
import { EmbedBuilder } from 'discord.js';

import { truncate, EMBED_LIMITS } from './embedLimits.js';

/** Các chữ được tính là "tôi hiểu rủi ro, cứ làm đi". */
const TU_XAC_NHAN = ['xacnhan', 'xac-nhan', 'xn', 'confirm', 'lieu', 'liều', 'ok', 'y'];

export function laXacNhan(args = []) {
  return TU_XAC_NHAN.includes(String(args?.[0] || '').toLowerCase());
}

/**
 * Đếm Hộ Mạch Đan trong túi.
 *
 * Cộng dồn qua mọi ô chứ không lấy ô đầu tiên: dữ liệu cũ có thể để cùng một
 * vật phẩm ở hai ô khác nhau. Và phải tính theo `quantity`, vì ô còn nằm đó
 * với số lượng 0 là chuyện có thật — vài đường code trừ số lượng rồi mới xoá ô.
 */
export function demHoMachDan(user) {
  return (user?.inventory || [])
    .filter(i => i?.itemId === 'ho_mach_dan')
    .reduce((tong, i) => tong + (Number(i?.quantity) || 0), 0);
}

/**
 * Dựng lời cảnh báo, hoặc `null` nếu không cần cảnh báo (đã có đan trong túi).
 *
 * @param {object} user Tài liệu người chơi
 * @param {object} opts
 * @param {string} opts.tieuDe Tiêu đề embed
 * @param {number} opts.tiLe Tỉ lệ thành công, 0..1
 * @param {string} opts.hauQua Mô tả hậu quả khi trượt mà tay không
 * @param {string} opts.lenhLieu Lệnh cần gõ để bỏ qua cảnh báo
 * @returns {import('discord.js').EmbedBuilder | null}
 */
export function canhBaoThieuHoMach(user, { tieuDe, tiLe, hauQua, lenhLieu }) {
  if (demHoMachDan(user) > 0) return null;

  const phanTram = Math.round(Math.max(0, Math.min(1, Number(tiLe) || 0)) * 100);

  return new EmbedBuilder()
    .setTitle(truncate(tieuDe, EMBED_LIMITS.title))
    .setColor('#FF9800')
    .setDescription(truncate(
      `Trong túi đạo hữu **không còn viên Hộ Mạch Đan nào**. Tỉ lệ thành công lần này chỉ **${phanTram}%**.\n\n` +
      `💀 **Trượt mà tay không:** ${hauQua}\n` +
      `🛡️ **Trượt mà có Hộ Mạch Đan:** đan tự vỡ che chở kinh mạch — **giữ nguyên cảnh giới**, chỉ hao **15% tu vi**.\n\n` +
      `**Kiếm Hộ Mạch Đan ở đâu:**\n` +
      `• \`!luyendan ho_mach_dan\` — luyện được từ Luyện Khí tầng 2, nguyên liệu rẻ\n` +
      `• \`!diemdanh\` — điểm danh hằng ngày có cơ hội rơi ra\n` +
      `• \`!chotroi\` — mua lại của đạo hữu khác\n\n` +
      `👉 **Vẫn muốn liều?** Gõ \`${lenhLieu}\`.`,
      EMBED_LIMITS.description
    ))
    .setFooter({ text: truncate('Cảnh báo này tự tắt ngay khi trong túi có Hộ Mạch Đan.', EMBED_LIMITS.footer) });
}
