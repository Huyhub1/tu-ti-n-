/**
 * NÚT LÀM LẠI CHO CÁC LỆNH HÀNH ĐỘNG
 *
 * Bốn lệnh cày cuốc chính (tu luyện, làm công, đào khoáng, săn thú) có chu kỳ
 * hồi chiêu 10-45 giây. Bắt người chơi gõ lại nguyên câu lệnh sau mỗi lượt là
 * ma sát vô nghĩa, nhất là trên điện thoại. Một nút bấm ngay dưới kết quả rút
 * cả vòng lặp xuống còn một chạm.
 *
 * Quy ước customId: 'btn_again::<hành động>::<userId>'. Dùng '::' làm dấu tách
 * giống các nút đời mới khác trong buttonHandler, vì tên hành động và userId
 * đều không bao giờ chứa chuỗi này — tách bằng '_' thì 'btn_start_hunt_' từng
 * vỡ khi id có dấu gạch dưới.
 *
 * Nút luôn gắn userId của chủ nhân: người khác bấm sẽ bị chặn ở handler, nếu
 * không thì cả kênh chung nhau cày trên một tin nhắn.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const REPEAT_ID_PREFIX = 'btn_again::';

export const REPEAT_ACTIONS = {
  tuluyen:   { label: 'Tu luyện tiếp', emoji: '🧘', style: ButtonStyle.Success },
  lamcong:   { label: 'Làm tiếp',      emoji: '🔨', style: ButtonStyle.Primary },
  daokhoang: { label: 'Đào tiếp',      emoji: '⛏️', style: ButtonStyle.Primary },
  santhu:    { label: 'Săn tiếp',      emoji: '🦁', style: ButtonStyle.Danger }
};

export function repeatCustomId(action, userId) {
  return REPEAT_ID_PREFIX + action + '::' + userId;
}

/** Trả về { action, userId } nếu đúng là nút làm lại hợp lệ, ngược lại null. */
export function parseRepeatId(customId) {
  if (typeof customId !== 'string' || !customId.startsWith(REPEAT_ID_PREFIX)) return null;
  const parts = customId.split('::');
  if (parts.length !== 3) return null;
  const action = parts[1];
  const userId = parts[2];
  if (!REPEAT_ACTIONS[action] || !userId) return null;
  return { action, userId };
}

/**
 * Hàng nút đặt dưới kết quả. Trả về MẢNG hàng (rỗng nếu hành động lạ) để chỗ
 * gọi truyền thẳng vào components mà không cần bọc thêm.
 */
export function repeatRow(action, userId, extraButtons = []) {
  const cfg = REPEAT_ACTIONS[action];
  if (!cfg || !userId) return [];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(repeatCustomId(action, userId))
      .setLabel(cfg.label)
      .setEmoji(cfg.emoji)
      .setStyle(cfg.style),
    ...extraButtons
  );
  return [row];
}
