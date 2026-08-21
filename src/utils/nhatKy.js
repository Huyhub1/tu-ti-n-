/**
 * Ghi nhật ký ra file — để khi bot giở chứng trên Discord thật còn có cái mà lần.
 *
 * Cách làm: BỌC `console.log/warn/error` lại chứ không đi sửa 56 chỗ gọi.
 * Đổi lấy hai thứ đáng giá:
 *   1. Diff nhỏ, không đụng vào logic nghiệp vụ nào cả.
 *   2. Bắt được cả tiếng kêu của thư viện bên thứ ba (discord.js, mongoose) —
 *      thứ mà đi sửa từng chỗ gọi trong `src/` sẽ không bao giờ tóm được.
 *
 * Ghi bằng `appendFileSync` là CỐ Ý. Nhật ký này sinh ra để khám nghiệm tử thi;
 * gom vào bộ đệm rồi xả sau nghĩa là đúng những dòng cuối trước khi sập — thứ
 * duy nhất đáng đọc — sẽ bay mất. Lưu lượng ở đây chỉ vài chục dòng mỗi phiên
 * nên chặn luồng không đáng kể. Có ngày nào log phình lên thì xem `NGUONG_...`.
 */
import fs from 'fs';
import path from 'path';

const THU_MUC = process.env.LOG_DIR || 'logs';
const GIU_NGAY = Math.max(1, parseInt(process.env.LOG_KEEP_DAYS || '14', 10) || 14);

// Một dòng dài bất thường gần như luôn là ai đó lỡ đổ nguyên object khổng lồ
// vào log. Cắt bớt để một sự cố không nuốt sạch ổ đĩa của người ta.
const NGUONG_DAI_DONG = 8000;

/**
 * Che bí mật TRƯỚC KHI chạm đĩa.
 *
 * Terminal thì trôi đi, còn file thì nằm lại — rồi bị đính vào issue, bị zip
 * gửi cho người khác, bị commit nhầm. Chỗ rò rỉ token nguy hiểm nhất chính là
 * file log, nên khâu che phải nằm ở đây chứ không phải trông vào người dùng.
 */
const LUOI_CHE = [
  // Token bot Discord: 3 khúc ngăn bởi dấu chấm. Khúc đầu là userId mã base64.
  [/\b[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,}\b/g, '<token-discord-da-che>'],
  // Chuỗi kết nối MongoDB — che cả cụm vì chính hostname cũng là thông tin riêng.
  [/mongodb(\+srv)?:\/\/\S+/gi, '<mongo-uri-da-che>'],
  // user:pass@host trong bất kỳ URL nào còn lại.
  [/\/\/[^/\s:@]+:[^/\s@]+@/g, '//<thong-tin-dang-nhap-da-che>@'],
  // Token GitHub, cả dạng cũ lẫn dạng fine-grained.
  [/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, '<token-github-da-che>'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '<token-github-da-che>'],
  // Dạng KHOA=giá-trị in ra từ việc đổ nguyên process.env.
  [/\b(DISCORD_TOKEN|MONGO_URI|MONGODB_URI|CLIENT_SECRET|GITHUB_TOKEN|GH_TOKEN)\s*[=:]\s*\S+/gi, '$1=<da-che>'],
];

/** Bỏ mã màu ANSI của chalk — trong file chúng chỉ là rác khó đọc. */
const MA_MAU = /\[[0-9;]*m/g;

export function cheBiMat(chuoi) {
  let s = String(chuoi);
  for (const [mau, thay] of LUOI_CHE) s = s.replace(mau, thay);
  return s;
}

/** Tên file theo ngày địa phương: logs/2026-08-21.log */
export function tenFileTheoNgay(luc = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${luc.getFullYear()}-${p(luc.getMonth() + 1)}-${p(luc.getDate())}.log`;
}

/**
 * Gộp tham số của console thành một dòng, giống cách console tự làm.
 * Object thì tự tay JSON hoá, còn Error thì phải lấy `.stack` — `String(err)`
 * chỉ cho mỗi dòng tiêu đề, mất sạch phần đáng giá nhất.
 */
export function ghepThamSo(args) {
  return args.map(a => {
    if (a instanceof Error) return a.stack || `${a.name}: ${a.message}`;
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

function dinhDangDong(muc, args) {
  const tho = `[${new Date().toISOString()}] [${muc}] ${ghepThamSo(args)}`;
  const sach = cheBiMat(tho).replace(MA_MAU, '');
  return (sach.length > NGUONG_DAI_DONG
    ? `${sach.slice(0, NGUONG_DAI_DONG)}… <cắt bớt ${sach.length - NGUONG_DAI_DONG} ký tự>`
    : sach) + '\n';
}

/** Xoá nhật ký quá hạn. Lỗi ở đây tuyệt đối không được làm phiền bot. */
export function donNhatKyCu(thuMuc = THU_MUC, giuNgay = GIU_NGAY) {
  try {
    const han = Date.now() - giuNgay * 86400_000;
    for (const ten of fs.readdirSync(thuMuc)) {
      if (!/^\d{4}-\d{2}-\d{2}\.log$/.test(ten)) continue;
      const duongDan = path.join(thuMuc, ten);
      if (fs.statSync(duongDan).mtimeMs < han) fs.unlinkSync(duongDan);
    }
  } catch { /* không dọn được thì thôi, không đáng để bot dừng */ }
}

let dangBat = false;
let daCanhBaoHong = false;

/**
 * Bật ghi nhật ký. Gọi lại nhiều lần cũng không bọc chồng lên nhau.
 *
 * Trả về hàm gỡ bọc để kiểm thử còn trả lại `console` như cũ.
 */
export function batGhiNhatKy({ thuMuc = THU_MUC, giuNgay = GIU_NGAY } = {}) {
  if (dangBat) return () => {};
  dangBat = true;

  try {
    fs.mkdirSync(thuMuc, { recursive: true });
  } catch (e) {
    // Không tạo nổi thư mục (ổ đĩa chỉ đọc, thiếu quyền) thì bot vẫn phải chạy.
    // In ra một lần rồi thôi, chứ không phải mỗi dòng log lại kêu một tiếng.
    console.error(`[Nhật Ký] Không tạo được thư mục "${thuMuc}", chỉ in ra màn hình: ${e.message}`);
    dangBat = false;
    return () => {};
  }

  donNhatKyCu(thuMuc, giuNgay);

  const goc = { log: console.log, warn: console.warn, error: console.error };

  const boc = (muc, ham) => (...args) => {
    ham(...args);                       // màn hình vẫn nguyên màu mè như cũ
    try {
      fs.appendFileSync(path.join(thuMuc, tenFileTheoNgay()), dinhDangDong(muc, args), 'utf8');
    } catch (e) {
      // Ghi hỏng thì báo đúng MỘT lần qua hàm gốc. Gọi console.error đã bọc ở
      // đây sẽ lại ghi hỏng, lại báo lỗi — vòng lặp vô tận nuốt cả tiến trình.
      if (!daCanhBaoHong) {
        daCanhBaoHong = true;
        goc.error(`[Nhật Ký] Ghi file hỏng, từ giờ chỉ in ra màn hình: ${e.message}`);
      }
    }
  };

  console.log = boc('INFO', goc.log);
  console.warn = boc('WARN', goc.warn);
  console.error = boc('LỖI', goc.error);

  goc.log(`[Nhật Ký] Đang ghi vào ${path.resolve(thuMuc)} (giữ ${giuNgay} ngày).`);

  return () => {
    console.log = goc.log;
    console.warn = goc.warn;
    console.error = goc.error;
    dangBat = false;
    daCanhBaoHong = false;
  };
}
