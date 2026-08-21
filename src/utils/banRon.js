/**
 * SỔ ĐẾM NGƯỜI CHƠI ĐANG BẬN.
 *
 * Bot giữ trận đấu trong RAM (`combatSessions`, `dungeonCombatSessions`,
 * `dokiepSessions`, chiến thư PvP đang treo). Tắt bot là mất sạch: người chơi
 * đã bị trừ hồi chiêu — săn thú 30 giây, phó bản 120 giây — rồi chỉ nhận được
 * dòng "Trận chiến đã kết thúc!" mà không hiểu vì sao.
 *
 * Khi khởi động lại là chuyện hiếm và làm tay thì còn chịu được. Nhưng từ lúc
 * có cơ chế tự cập nhật, cứ đẩy một commit lên git là bot tắt — và nó tắt đúng
 * vào lúc đông người chơi nhất, vì đó cũng là lúc người ta hay sửa bot. Sổ này
 * để `capnhat.js` hỏi "còn ai đang giữa trận không?" trước khi ra hiệu tắt.
 *
 * VÌ SAO LÀ SỔ ĐĂNG KÝ CHỨ KHÔNG IMPORT THẲNG:
 * `capnhat.js` mà import `hunting.js` / `dungeon.js` / `dokiep.js` /
 * `pvpService.js` là bắc cầu vòng tròn — mấy file kia đã nằm trong chuỗi import
 * của `buttonHandler.js`, thứ mà `commandHandler.js` nạp. File này cố tình
 * KHÔNG import gì cả, nên không thể là một mắt xích trong vòng tròn nào.
 *
 * MẶC ĐỊNH LÀ CHO PHÉP TẮT: chưa ai đăng ký thì `demBanRon()` trả về 0 và bản
 * cập nhật đi tiếp như cũ. Đăng ký hỏng thì tệ nhất cũng chỉ quay về đúng hành
 * vi hiện tại, chứ không chặn cứng đường cập nhật.
 */

/** @type {Array<{ ten: string, lay: () => number }>} */
const nguon = [];

/**
 * Khai báo một nguồn "đang bận". Gọi ngay lúc nạp module.
 *
 * @param {string} ten Tên hiển thị trong log, ví dụ 'săn thú'
 * @param {() => number} lay Hàm trả về số người đang bận ở nguồn này
 */
export function dangKyNguonBanRon(ten, lay) {
  if (typeof lay !== 'function') return;
  // Nạp lại module (test hay hot-reload) không được nhân đôi con số.
  const cu = nguon.findIndex(n => n.ten === ten);
  if (cu >= 0) nguon[cu] = { ten, lay };
  else nguon.push({ ten, lay });
}

/** Xoá sạch sổ. Chỉ dùng trong kiểm thử. */
export function xoaSoBanRon() {
  nguon.length = 0;
}

/**
 * Đếm tổng số người đang giữa chừng một việc không được cắt ngang.
 *
 * @returns {{ tong: number, chiTiet: Array<{ ten: string, so: number }> }}
 */
export function demBanRon() {
  const chiTiet = [];
  let tong = 0;

  for (const n of nguon) {
    let so = 0;
    try {
      so = Number(n.lay()) || 0;
    } catch {
      // Một nguồn hỏng không được kéo theo cả vòng cập nhật. Coi như rỗng.
      so = 0;
    }
    if (so > 0) {
      chiTiet.push({ ten: n.ten, so });
      tong += so;
    }
  }

  return { tong, chiTiet };
}

/** Mô tả gọn để nhét vào log hoặc embed: "săn thú 2, phó bản 1". */
export function moTaBanRon(ban = demBanRon()) {
  if (!ban.tong) return 'không còn ai';
  return ban.chiTiet.map(c => `${c.ten} ${c.so}`).join(', ');
}
