/**
 * KIỂM DUYỆT CHUỖI DO NGƯỜI CHƠI TỰ ĐẶT
 *
 * Trong cả game chỉ có đúng một chỗ người chơi được gõ tự do rồi chuỗi đó hiện
 * lại cho người khác đọc: tên Tông Môn. Nhưng một chỗ là đủ để phá cả server —
 * `!laptongmon @everyone` khiến mọi thông báo về sau ping toàn bộ thành viên,
 * còn tên dài 2000 ký tự hay chứa dấu ` * _ ~ | sẽ làm vỡ định dạng embed.
 *
 * Chốt chặn thứ hai nằm ở `allowedMentions` khi khởi tạo Client (src/index.js):
 * kể cả có chuỗi độc nào lọt qua đây thì Discord cũng không cho phép ping
 * @everyone / @here / role. Hai lớp độc lập, vì lớp này chỉ bảo vệ đúng những
 * nơi ta nhớ gọi tới nó.
 */

export const SECT_NAME_MIN = 2;
export const SECT_NAME_MAX = 32;

// Ký tự điều khiển định dạng của Discord. Để lọt thì tên bang có thể in đậm,
// gạch ngang hoặc mở khối code, kéo lệch toàn bộ phần chữ hiển thị sau nó.
const MARKDOWN_CHARS = /[`*_~|\\<>#]/;

// Chặn thẳng mọi dấu @ thay vì cố dò đúng dạng "@everyone". Dò theo mẫu luôn
// hụt một biến thể nào đó — "@ everyone" từng lọt qua vì có dấu cách chen giữa
// — mà tên môn phái tu tiên thì chẳng bao giờ cần tới ký tự này.
const MENTION_LIKE = /@/;

// Ký tự điều khiển (Cc) và ký tự định dạng vô hình (Cf: khoảng trắng độ rộng 0,
// dấu nối vô hình, ký tự đảo chiều đọc chữ). Mắt thường không thấy nhưng đủ để
// tạo hai tên bang "khác nhau" mà hiển thị y hệt, hoặc lật ngược chiều hiển thị
// của cả dòng chữ phía sau.
const INVISIBLE = /[\p{Cc}\p{Cf}]/u;

/**
 * Kiểm duyệt tên Tông Môn.
 *
 * Trả về `{ ok: true, value }` với chuỗi đã chuẩn hoá khoảng trắng, hoặc
 * `{ ok: false, reason }` kèm câu giải thích viết sẵn cho người chơi đọc.
 */
export function validateSectName(raw) {
  // Gộp mọi loại khoảng trắng (kể cả xuống dòng và tab) thành một dấu cách:
  // nếu không, hai bang tên "Ma Cung" và "Ma  Cung" trông giống hệt nhau trên
  // màn hình mà lại là hai bản ghi khác nhau trong cơ sở dữ liệu.
  const value = String(raw ?? '').replace(/\s+/g, ' ').trim();

  if (value.length < SECT_NAME_MIN) {
    return { ok: false, reason: `Tên Tông Môn phải có ít nhất **${SECT_NAME_MIN} ký tự**.` };
  }
  if (value.length > SECT_NAME_MAX) {
    return { ok: false, reason: `Tên Tông Môn không được dài quá **${SECT_NAME_MAX} ký tự** (đạo hữu vừa gõ ${value.length}).` };
  }
  // Kiểm ký tự ẩn TRƯỚC khi dò mention: nếu không thì "@<ký tự ẩn>everyone"
  // lọt qua bước dò mention rồi mới bị chặn, và thông báo trả về sai lý do.
  if (INVISIBLE.test(value)) {
    return { ok: false, reason: `Tên Tông Môn chứa ký tự ẩn không hợp lệ.` };
  }
  if (MENTION_LIKE.test(value)) {
    return { ok: false, reason: `Tên Tông Môn không được chứa dấu **@** hay lời gọi thành viên.` };
  }
  if (MARKDOWN_CHARS.test(value)) {
    return { ok: false, reason: 'Tên Tông Môn không được chứa các ký tự định dạng: ` * _ ~ | \\ < > #' };
  }

  return { ok: true, value };
}

/**
 * Biểu thức tìm tên bang không phân biệt hoa thường, dùng cho truy vấn trùng tên.
 *
 * Dùng `findOne({ name })` thuần thì "Ma Cung" và "ma cung" là hai bang khác
 * nhau — người chơi nhìn bảng xếp hạng sẽ tưởng bot hiển thị lặp. Phải thoát
 * ký tự đặc biệt trước khi ghép vào regex, nếu không một cái tên như ".*" sẽ
 * khớp với mọi tông môn đang có và không ai lập được bang nữa.
 */
export function exactNameRegex(name) {
  return new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}
