/**
 * THI HÀNH MỘT LẦN CẬP NHẬT — chạy như tiến trình riêng, không phải module.
 *
 * Tách rời khỏi `supervisor.js` vì một lý do rất cụ thể: bản thân mã cập nhật
 * cũng nằm trong kho và cũng bị `git pull` thay đổi. Nếu tiến trình bọc ngoài
 * gọi thẳng `updateService` thì nó vĩnh viễn chạy bản đã nạp lúc khởi động —
 * sửa lỗi trong logic cập nhật xong đẩy lên, chính chỗ sửa đó không bao giờ có
 * hiệu lực. Gọi qua tiến trình con thì mỗi lần đều đọc lại code mới từ đĩa.
 *
 * Mã thoát:  0 = đã cập nhật xong   ·   1 = không cập nhật (có lý do, đã in ra)
 * Dù thoát mã nào, `supervisor.js` cũng bật lại bot — thất bại trong việc cập
 * nhật không phải là lý do để cả server mất bot.
 *
 * Chạy tay được:  node scripts/applyUpdate.js
 */
import 'dotenv/config';
import { keoVeVaKiemTra, che } from '../src/services/updateService.js';

const gio = () => new Date().toLocaleTimeString('vi-VN');
const in_ = (s) => console.log(`[Cập nhật ${gio()}] ${che(s)}`);

try {
  const kq = await keoVeVaKiemTra({ onLog: in_ });

  if (kq.daCapNhat) {
    in_(`✅ Đã lên bản mới: ${kq.tu.slice(0, 7)} → ${kq.den.slice(0, 7)} (${kq.soCommit} commit)`);
    for (const dong of (kq.danhSach || []).slice(0, 10)) in_(`   · ${dong}`);
    process.exit(0);
  }

  if (kq.daQuayLui) {
    in_(`⚠️ ${kq.lyDo}`);
    in_('Bot sẽ chạy tiếp bằng bản cũ. Sửa commit hỏng rồi đẩy lại là nó tự lên.');
  } else {
    in_(kq.lyDo);
  }
  process.exit(1);
} catch (e) {
  // Lỗi ở đây tuyệt đối không được làm sập cả dây chuyền: bọc ngoài đang chờ
  // tiến trình này kết thúc để bật lại bot.
  in_(`❌ Cập nhật gặp lỗi ngoài dự tính: ${e?.message || e}`);
  process.exit(1);
}
