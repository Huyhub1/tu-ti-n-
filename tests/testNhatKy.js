/**
 * Kiểm thử ghi nhật ký ra file.
 *
 * Trọng tâm không phải "có ghi được không" — mà là hai thứ dễ hỏng âm thầm:
 *
 *   1. CHE BÍ MẬT. File log nằm lại trên đĩa rồi bị zip gửi đi, bị đính vào
 *      issue, bị commit nhầm. Một token lọt vào đây là mất bot. Lưới che sai
 *      một dấu là không ai biết cho tới lúc quá muộn.
 *   2. KHÔNG BAO GIỜ LÀM SẬP BOT. Logger là thứ phụ trợ; nó mà nổ hay quay vòng
 *      vô tận thì thiệt hại lớn hơn hẳn cái lợi nó mang lại.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  batGhiNhatKy,
  cheBiMat,
  tenFileTheoNgay,
  ghepThamSo,
  donNhatKyCu
} from '../src/utils/nhatKy.js';

let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

function eq(got, want, label) {
  ok(Object.is(got, want), `${label}${Object.is(got, want) ? '' : ` (nhận ${JSON.stringify(got)}, mong ${JSON.stringify(want)})`}`);
}

/** Thư mục tạm riêng cho mỗi lượt chạy, dọn sạch khi xong. */
function trongThuMucTam(fn) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nhatky-'));
  try { return fn(d); } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

/** Đọc toàn bộ nội dung nhật ký hôm nay trong một thư mục. */
function docNhatKy(d) {
  const f = path.join(d, tenFileTheoNgay());
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
}

console.log('\n[1] Che bí mật — mấy chuỗi này TUYỆT ĐỐI không được chạm đĩa:');
{
  // Token giả nhưng đúng hình dạng thật: 3 khúc ngăn bởi dấu chấm.
  const token = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.Gh4Ky9.abcdefghijklmnopqrstuvwxyz123456789';
  const che = cheBiMat(`Đăng nhập bằng ${token} xong`);
  ok(!che.includes(token), 'Token Discord bị che');
  ok(che.includes('<token-discord-da-che>'), 'Có để lại dấu vết cho biết chỗ nào bị che');

  const uri = 'mongodb+srv://admin:MatKhauSieuBiMat@cum0.abcde.mongodb.net/tutien';
  const che2 = cheBiMat(`Kết nối tới ${uri}`);
  ok(!che2.includes('MatKhauSieuBiMat'), 'Mật khẩu trong Mongo URI bị che');
  ok(!che2.includes('cum0.abcde.mongodb.net'), 'Cả hostname Mongo cũng bị che — nó cũng là thông tin riêng');

  ok(!cheBiMat('token ghp_0123456789abcdefghijklmnopqrstuvwx rồi').includes('ghp_0123'), 'Token GitHub cổ điển bị che');
  ok(!cheBiMat('github_pat_11ABCDEFG0abcdefghij_klmnopqrstuvwxyz').includes('11ABCDEFG'), 'Token GitHub fine-grained bị che');
  ok(!cheBiMat('DISCORD_TOKEN=xyzXYZ123 và tiếp').includes('xyzXYZ123'), 'Dạng DISCORD_TOKEN=... bị che');
  ok(!cheBiMat('https://ten:matkhau@vidu.com/hook').includes('matkhau'), 'user:pass@ trong URL bất kỳ bị che');

  // Che quá tay cũng là hỏng: log mà mất hết thông tin thì vô dụng.
  eq(cheBiMat('Người chơi 123456789012345678 đột phá Trúc Cơ thành công'),
     'Người chơi 123456789012345678 đột phá Trúc Cơ thành công',
     'Dòng log bình thường KHÔNG bị đụng vào');
}

console.log('\n[2] Che thật sự chạy trên đường ghi file (không chỉ ở hàm rời):');
trongThuMucTam(d => {
  const token = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.Gh4Ky9.abcdefghijklmnopqrstuvwxyz123456789';
  const thoi = batGhiNhatKy({ thuMuc: d });
  console.log(`Bot đăng nhập với token ${token}`);
  console.error('Mongo hỏng:', 'mongodb+srv://u:p@host.mongodb.net/db');
  thoi();

  const noiDung = docNhatKy(d);
  ok(noiDung.length > 0, 'Có ghi được ra file');
  ok(!noiDung.includes(token), 'Token KHÔNG lọt vào file');
  ok(!noiDung.includes('u:p@host'), 'Mongo URI KHÔNG lọt vào file');
  ok(noiDung.includes('[INFO]') && noiDung.includes('[LỖI]'), 'Có phân biệt mức INFO / LỖI');
});

console.log('\n[3] Nội dung ghi ra có dùng được không:');
trongThuMucTam(d => {
  const thoi = batGhiNhatKy({ thuMuc: d });
  console.error('Sập:', new Error('đan lô phát nổ'));
  console.warn('Cảnh báo', { userId: '42', canhGioi: 'kim_dan' });
  thoi();

  const n = docNhatKy(d);
  ok(n.includes('đan lô phát nổ'), 'Thông điệp lỗi được ghi');
  ok(n.includes('at '), 'Ghi cả stack trace, không chỉ mỗi dòng tiêu đề');
  ok(n.includes('"canhGioi":"kim_dan"'), 'Object được JSON hoá thay vì thành [object Object]');
  ok(/^\[\d{4}-\d{2}-\d{2}T/.test(n), 'Mỗi dòng mở đầu bằng mốc thời gian ISO');
  ok(!n.includes('['), 'Mã màu ANSI của chalk bị lột khỏi file');
});

console.log('\n[4] Logger tuyệt đối không được làm sập bot:');
trongThuMucTam(d => {
  // Object có vòng tự tham chiếu làm JSON.stringify ném lỗi — kiểu dữ liệu này
  // xuất hiện đầy trong discord.js (client ↔ guild ↔ channel trỏ vòng nhau).
  const vong = { ten: 'vòng' }; vong.tu = vong;
  const thoi = batGhiNhatKy({ thuMuc: d });
  let no = false;
  try { console.log('Object vòng:', vong); } catch { no = true; }
  thoi();
  ok(!no, 'Object tự tham chiếu không làm nổ console.log');
  ok(docNhatKy(d).includes('Object vòng:'), 'Vẫn ghi được dòng đó ra file');
});

{
  // Thư mục không tạo nổi thì phải chịu thua êm, không được ném lỗi lên.
  const chan = path.join(os.tmpdir(), `nhatky-chan-${process.pid}`);
  fs.writeFileSync(chan, 'tôi là file, không phải thư mục');
  let no = false;
  let thoi = () => {};
  try { thoi = batGhiNhatKy({ thuMuc: path.join(chan, 'con') }); } catch { no = true; }
  thoi();
  fs.rmSync(chan, { force: true });
  ok(!no, 'Không tạo được thư mục → chịu thua êm, không ném lỗi');
}

{
  const thoi = batGhiNhatKy({ thuMuc: path.join(os.tmpdir(), `nhatky-x-${process.pid}`) });
  const truoc = console.log;
  const thoi2 = batGhiNhatKy({ thuMuc: path.join(os.tmpdir(), `nhatky-y-${process.pid}`) });
  ok(console.log === truoc, 'Gọi bật lần hai không bọc chồng lên nhau');
  thoi2(); thoi();
  fs.rmSync(path.join(os.tmpdir(), `nhatky-x-${process.pid}`), { recursive: true, force: true });
  fs.rmSync(path.join(os.tmpdir(), `nhatky-y-${process.pid}`), { recursive: true, force: true });
}

trongThuMucTam(d => {
  const goc = console.log;
  const thoi = batGhiNhatKy({ thuMuc: d });
  ok(console.log !== goc, 'Đang bật thì console.log đã bị bọc');
  thoi();
  ok(console.log === goc, 'Gỡ bọc trả lại console.log nguyên bản');
});

console.log('\n[5] Xoay vòng theo ngày và dọn file quá hạn:');
trongThuMucTam(d => {
  eq(tenFileTheoNgay(new Date(2026, 7, 21)), '2026-08-21.log', 'Tên file theo ngày địa phương, có đệm số 0');
  eq(tenFileTheoNgay(new Date(2026, 0, 5)), '2026-01-05.log', 'Tháng và ngày một chữ số vẫn đúng định dạng');

  const cu = path.join(d, '2020-01-01.log');
  const moi = path.join(d, tenFileTheoNgay());
  const khac = path.join(d, 'ghi-chu.txt');
  fs.writeFileSync(cu, 'cũ'); fs.writeFileSync(moi, 'mới'); fs.writeFileSync(khac, 'đừng đụng');
  fs.utimesSync(cu, new Date(2020, 0, 1), new Date(2020, 0, 1));

  donNhatKyCu(d, 14);
  ok(!fs.existsSync(cu), 'File quá hạn bị xoá');
  ok(fs.existsSync(moi), 'File hôm nay được giữ');
  ok(fs.existsSync(khac), 'File không phải nhật ký KHÔNG bị đụng tới');

  let no = false;
  try { donNhatKyCu(path.join(d, 'khong-ton-tai'), 14); } catch { no = true; }
  ok(!no, 'Dọn thư mục không tồn tại cũng không ném lỗi');
});

console.log('\n[6] Ghép tham số:');
eq(ghepThamSo(['a', 'b']), 'a b', 'Nhiều chuỗi được nối bằng dấu cách');
eq(ghepThamSo([1, true, null]), '1 true null', 'Số, boolean, null đều ra chuỗi');
ok(ghepThamSo([new Error('nổ')]).includes('at '), 'Error trả về stack chứ không phải mỗi tiêu đề');

console.log('\n======================================================');
if (fail === 0) console.log(`🎉 HOÀN TẤT: ${pass}/${pass} phép kiểm thử đều đúng.`);
else console.error(`❌ ${fail} phép kiểm thử THẤT BẠI (${pass} đạt).`);
console.log('======================================================\n');
process.exit(fail === 0 ? 0 : 1);
