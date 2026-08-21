/**
 * TRẦN GIỚI HẠN CỦA DISCORD EMBED / SELECT MENU
 *
 * Vượt bất kỳ con số nào dưới đây thì Discord trả HTTP 400 và người chơi chỉ
 * thấy "This interaction failed" — không có exception nào trong log bot để lần
 * ra. Nguy hiểm nhất là trần **6000 ký tự tổng** của embed: nó không thuộc về
 * một field cụ thể nào, nên cắt từng field riêng lẻ vẫn có thể vỡ khi cộng dồn.
 *
 * Các khung nào liệt kê dữ liệu người chơi sở hữu (túi đồ, pháp bảo, bí kíp)
 * đều phải đi qua `fillFields` thay vì gọi thẳng `embed.addFields`, để số field
 * và tổng ký tự luôn nằm trong ngưỡng dù người chơi có tích bao nhiêu đồ.
 */

export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  footer: 2048,
  authorName: 256,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  total: 6000,
  selectOptions: 25,
  optionLabel: 100,
  optionDescription: 100,
  optionValue: 100,
  rowComponents: 5,
  messageRows: 5
};

/**
 * Kẹp số trang về khoảng hợp lệ 1..totalPages.
 *
 * Viết riêng thành hàm vì kiểu `if (page < 1) page = 1` quen thuộc lại để lọt
 * `NaN`: mọi phép so sánh với NaN đều false nên biến giữ nguyên NaN, `slice`
 * trả mảng rỗng, và select menu không có lựa chọn nào — Discord từ chối luôn.
 */
export function clampPage(page, totalPages) {
  const maxPage = Math.max(1, Math.floor(totalPages) || 1);
  const n = Math.floor(Number(page));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, n), maxPage);
}

/** Cắt chuỗi về đúng độ dài Discord cho phép; `null`/`undefined` thành chuỗi rỗng. */
export function truncate(text, max) {
  return String(text ?? '').slice(0, max);
}

/** Đếm số ký tự Discord tính vào trần 6000 của một embed đã dựng. */
export function embedCharCount(embed) {
  const d = typeof embed.toJSON === 'function' ? embed.toJSON() : embed;
  return (d.title || '').length +
    (d.description || '').length +
    (d.footer?.text || '').length +
    (d.author?.name || '').length +
    (d.fields || []).reduce((sum, f) => sum + (f.name || '').length + (f.value || '').length, 0);
}

/**
 * Nhồi danh sách field vào embed nhưng dừng trước khi chạm trần.
 *
 * `reserve` là số ký tự chừa lại cho những thứ sẽ thêm SAU lời gọi này
 * (footer, khung hướng dẫn cuối embed...). Nếu không chừa thì embed có thể
 * vừa khít lúc thêm field rồi vỡ ngay khi `setFooter`.
 *
 * Trả về số field thực sự thêm được, để nơi gọi biết mà báo cho người chơi.
 */
export function fillFields(embed, fields, { reserve = 0, reserveFields = 0 } = {}) {
  const maxFields = EMBED_LIMITS.fields - Math.max(0, reserveFields);
  let used = embedCharCount(embed);
  let added = 0;

  for (const f of fields) {
    if (added >= maxFields) break;

    const name = truncate(f.name, EMBED_LIMITS.fieldName) || '​';
    const value = truncate(f.value, EMBED_LIMITS.fieldValue) || '​';
    const cost = name.length + value.length;
    if (used + cost + reserve > EMBED_LIMITS.total) break;

    embed.addFields({ name, value, inline: Boolean(f.inline) });
    used += cost;
    added++;
  }

  return added;
}
