/**
 * KIỂM THỬ CƠ CHẾ TỰ CẬP NHẬT
 *
 * Đây là đoạn code nguy hiểm nhất trong cả dự án: nó tải mã nguồn từ Internet
 * về rồi cho máy chủ chạy. Test kiểu "gọi hàm với object giả" không đủ — thứ
 * duy nhất chứng minh được nó an toàn là bắt nó làm việc thật với git thật.
 *
 * Nên bộ này dựng hẳn ba kho git trong thư mục tạm:
 *
 *     goc/  — kho trần, đóng vai GitHub
 *     tho/  — máy của người viết code, nơi đẩy commit lên
 *     may/  — máy chủ đang chạy bot, nơi cơ chế cập nhật làm việc
 *
 * rồi diễn lại đúng những gì sẽ xảy ra ngoài đời: đẩy commit tốt (phải lên
 * được), đẩy commit hỏng (phải quay lui và KHÔNG lặp vô tận), để lại file sửa
 * dở trên máy chủ (phải từ chối, không ghi đè).
 *
 * Không cần mạng, không cần Discord, không cần MongoDB.
 *
 * Chạy:  npm run test:update
 * An toàn: chỉ đụng thư mục tạm của hệ điều hành, xoá sạch khi xong.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import chalk from 'chalk';

import {
  EXIT_UPDATE,
  che,
  docCauHinh,
  docCachLy,
  ghiCachLy,
  xoaCachLy,
  docPhienBan,
  trangThaiKho,
  timCapNhat,
  keoVeVaKiemTra
} from '../src/services/updateService.js';
import { renderCapnhatView, coGiamSat } from '../src/commands/prefix/capnhat.js';
import { EMBED_LIMITS } from '../src/utils/embedLimits.js';

let passed = 0;
let total = 0;

function assert(cond, label) {
  total++;
  if (cond) { passed++; console.log(chalk.green(`  ✅ ${label}`)); }
  else { console.log(chalk.red(`  ❌ ${label}`)); }
}

// ───────────────────────── Dụng cụ dựng kho git ─────────────────────────

/**
 * Cấu hình ép cho mọi lệnh git trong bộ này. Truyền qua `-c` chứ không ghi vào
 * config: máy người chạy test có thể đang bật ký commit bằng GPG, đang đặt tên
 * nhánh mặc định là `main`, hay bật `autocrlf` — cả ba đều đủ để test đỏ vì lý
 * do chẳng liên quan gì tới code đang kiểm.
 */
const CAU_HINH_GIT = [
  '-c', 'user.email=kiemthu@tutien.local',
  '-c', 'user.name=Kiem Thu',
  '-c', 'commit.gpgsign=false',
  '-c', 'core.autocrlf=false',
  '-c', 'init.defaultBranch=master',
  '-c', 'advice.detachedHead=false'
];

function git(cwd, ...args) {
  return execFileSync('git', [...CAU_HINH_GIT, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

const SAN = path.join(os.tmpdir(), `tutien-kiemthu-capnhat-${process.pid}`);
const GOC = path.join(SAN, 'goc');
const THO = path.join(SAN, 'tho');
const MAY = path.join(SAN, 'may');

/** Đường dẫn cho git: dấu gạch chéo ngược trên Windows dễ bị hiểu nhầm. */
const nhuUrl = (p) => p.split(path.sep).join('/');

/**
 * package.json của kho thử. Phải GIỮ NGUYÊN TỪNG BYTE qua mọi commit — hàm
 * `goiCoDoi` thấy file này đổi là gọi `npm install`, và test sẽ ngồi chờ vài
 * phút tải thư viện chẳng để làm gì.
 */
const PACKAGE_JSON = JSON.stringify({
  name: 'kho-thu-cap-nhat',
  version: '1.0.0',
  private: true,
  type: 'commonjs',
  scripts: { audit: 'node check.js' }
}, null, 2) + '\n';

/**
 * `.gitignore` của kho thử. Dòng `.update-quarantine` KHÔNG phải cho đẹp: cơ
 * chế cách ly ghi file đó ngay trong thư mục kho, mà `keoVeVaKiemTra` lại từ
 * chối chạy khi cây bẩn. Thiếu dòng này thì một lần cập nhật hỏng là khoá cứng
 * tự cập nhật vĩnh viễn. Test [7] kiểm đúng chỗ đó.
 */
const GITIGNORE = '.update-quarantine\nnode_modules/\n';

function ghi(dir, tep, noiDung) {
  fs.writeFileSync(path.join(dir, tep), noiDung);
}

/** Đẩy một commit từ máy thợ lên kho gốc, trả về mã commit đầy đủ. */
function day(tep, noiDung, chuThich) {
  ghi(THO, tep, noiDung);
  git(THO, 'add', '-A');
  git(THO, 'commit', '-m', chuThich);
  git(THO, 'push', 'origin', 'master');
  return git(THO, 'rev-parse', 'HEAD');
}

function dungSan() {
  fs.rmSync(SAN, { recursive: true, force: true, maxRetries: 5 });
  fs.mkdirSync(SAN, { recursive: true });

  git(SAN, 'init', '--bare', 'goc');

  git(SAN, 'init', 'tho');
  ghi(THO, 'package.json', PACKAGE_JSON);
  ghi(THO, '.gitignore', GITIGNORE);
  ghi(THO, 'check.js', 'process.exit(0);\n');
  ghi(THO, 'noidung.txt', 'ban dau\n');
  git(THO, 'add', '-A');
  git(THO, 'commit', '-m', 'Khai son lap phai');
  git(THO, 'remote', 'add', 'origin', nhuUrl(GOC));
  git(THO, 'push', '-u', 'origin', 'master');

  git(SAN, 'clone', nhuUrl(GOC), 'may');
}

function donSan() {
  try { fs.rmSync(SAN, { recursive: true, force: true, maxRetries: 5 }); } catch { /* Windows giữ handle, kệ */ }
}

/** Cấu hình như khi người dùng bật AUTO_UPDATE trong .env. */
const CH = docCauHinh({ AUTO_UPDATE: 'true', AUTO_UPDATE_REMOTE: 'origin' });

const im = () => {};

// ───────────────────────────────── Chạy ─────────────────────────────────

async function main() {
  console.log(chalk.bold.magenta(`\n======================================================`));
  console.log(chalk.bold.magenta(`  🔄 KIỂM THỬ CƠ CHẾ TỰ CẬP NHẬT`));
  console.log(chalk.bold.magenta(`======================================================\n`));

  // ── [1] Che thông tin nhạy cảm ──
  // Kho riêng tư thì URL remote mang sẵn mã truy cập GitHub. Mọi chuỗi lấy từ
  // git đều có thể chứa nó, và chỗ đến của những chuỗi đó là log máy chủ và
  // khung chat Discord. Lọt một lần là mất kho.
  console.log(chalk.yellow(`[1] Che mã truy cập trong mọi chuỗi lấy từ git:`));
  {
    const url = 'https://huy:ghp_AbCdEfGhIjKlMnOpQrStUvWxYz012345@github.com/huy/tutien.git';
    const cheUrl = che(url);
    assert(!cheUrl.includes('ghp_AbCdEfGhIjKlMnOpQrStUvWxYz012345'), 'URL kho riêng tư không lộ mã truy cập');
    assert(cheUrl.includes('***@github.com'), 'phần còn lại của URL vẫn đọc được để biết đang nói kho nào');

    const roi = che('fatal: cannot access, token ghp_0123456789abcdefghijklmn expired');
    assert(!roi.includes('ghp_0123456789abcdefghijklmn'), 'mã ghp_ trôi nổi trong thông báo lỗi cũng bị che');

    const pat = che('dùng github_pat_11ABCDEFG0123456789_abcdefghijklmnop nhé');
    assert(!pat.includes('github_pat_11ABCDEFG0123456789_abcdefghijklmnop'), 'mã fine-grained github_pat_ cũng bị che');

    assert(che(null) === '' && che(undefined) === '', 'null/undefined ra chuỗi rỗng, không ném lỗi');
    assert(che('git pull --ff-only origin master') === 'git pull --ff-only origin master',
      'chuỗi sạch đi qua nguyên vẹn, không bị che nhầm');
  }

  // ── [2] Đọc cấu hình từ .env ──
  console.log(chalk.yellow(`\n[2] Đọc cấu hình từ .env:`));
  {
    const rong = docCauHinh({});
    assert(rong.bat === false, 'mặc định TẮT — không ai vô tình bật cơ chế tự tải mã về');
    assert(rong.remote === 'origin' && rong.phutMoiLan === 5, 'mặc định origin, soát mỗi 5 phút');
    assert(rong.kiemTraSauKhiKeo === true, 'mặc định BẬT vòng nghiệm thu sau khi kéo');

    assert(docCauHinh({ AUTO_UPDATE: 'bật' }).bat === true, 'viết "bật" tiếng Việt cũng hiểu');
    assert(docCauHinh({ AUTO_UPDATE: 'TRUE' }).bat === true, 'không phân biệt hoa thường');
    assert(docCauHinh({ AUTO_UPDATE: 'có lẽ' }).bat === false, 'giá trị lạ thì coi như tắt, không đoán bừa');

    assert(docCauHinh({ AUTO_UPDATE_INTERVAL_MINUTES: '99999' }).phutMoiLan === 1440,
      'chu kỳ quá dài bị kẹp về 1 ngày');
    assert(docCauHinh({ AUTO_UPDATE_INTERVAL_MINUTES: '0.1' }).phutMoiLan === 1,
      'chu kỳ quá ngắn bị kẹp về 1 phút, khỏi hỏi kho liên tục tới mức bị chặn');
    assert(docCauHinh({ AUTO_UPDATE_INTERVAL_MINUTES: 'abc' }).phutMoiLan === 5,
      'giá trị không phải số thì về mặc định');

    assert(docCauHinh({ AUTO_UPDATE_REMOTE: '   ' }).remote === 'origin', 'remote toàn khoảng trắng về origin');
    assert(docCauHinh({ AUTO_UPDATE_VERIFY: 'off' }).kiemTraSauKhiKeo === false,
      'tắt được vòng nghiệm thu khi cần');
  }

  // ── [3] Dựng ba kho git thật ──
  console.log(chalk.yellow(`\n[3] Dựng kho git thật trong thư mục tạm:`));
  dungSan();
  {
    const kho = await trangThaiKho(CH, { cwd: MAY });
    assert(kho.laKho === true, 'nhận ra máy chủ đang đứng trong một kho git');
    assert(kho.nhanh === 'master', 'đọc đúng tên nhánh');
    assert(kho.sach === true, 'kho vừa clone thì cây sạch');
    assert(kho.coRemote === true, 'thấy remote "origin"');
    assert(kho.chuThich === 'Khai son lap phai', 'đọc được chú thích của commit đang chạy');
    assert(docPhienBan(MAY) === '1.0.0', 'đọc được phiên bản trong package.json');

    const khongPhaiKho = await trangThaiKho(CH, { cwd: SAN });
    assert(khongPhaiKho.laKho === false, 'thư mục thường thì báo không phải kho, không ném lỗi');
  }

  // ── [4] Hỏi kho xem có gì mới ──
  console.log(chalk.yellow(`\n[4] Hỏi kho xem có gì mới:`));
  {
    const chuaCo = await timCapNhat(CH, { cwd: MAY });
    assert(chuaCo.ok && chuaCo.coMoi === false, 'vừa clone xong thì báo đã là bản mới nhất');

    day('noidung.txt', 'sua lan 1\n', 'Chinh lai cong thuc sat thuong');
    day('noidung.txt', 'sua lan 2\n', 'Them vat pham moi');

    const coMoi = await timCapNhat(CH, { cwd: MAY });
    assert(coMoi.coMoi === true, 'đẩy 2 commit lên là máy chủ thấy ngay');
    assert(coMoi.soCommit === 2, 'đếm đúng 2 commit mới');
    assert((coMoi.danhSach || []).length === 2, 'liệt kê được cả 2 chú thích để báo lên Discord');
    assert(coMoi.danhSach.some(d => d.includes('Them vat pham moi')), 'chú thích đọc đúng nội dung');
    assert(coMoi.diTruoc === 0, 'máy chủ không có commit riêng nào');

    // Kho chưa khai remote — lỗi thường gặp nhất khi mới dựng máy chủ.
    const leLoi = path.join(SAN, 'leloi');
    git(SAN, 'init', 'leloi');
    ghi(leLoi, 'a.txt', 'x');
    git(leLoi, 'add', '-A');
    git(leLoi, 'commit', '-m', 'mot minh');
    const khongRemote = await timCapNhat(CH, { cwd: leLoi });
    assert(khongRemote.coMoi === false && /remote/i.test(khongRemote.lyDo),
      'kho chưa khai remote thì chỉ luôn câu lệnh phải chạy, không ném lỗi');

    const khongKho = await timCapNhat(CH, { cwd: SAN });
    assert(khongKho.ok === false && khongKho.coMoi === false, 'thư mục không phải kho thì báo hiền, không sập vòng dò');
  }

  // ── [5] Kéo về suôn sẻ ──
  console.log(chalk.yellow(`\n[5] Kéo bản mới về (đường thuận):`));
  {
    const truoc = git(MAY, 'rev-parse', 'HEAD');
    const kq = await keoVeVaKiemTra({ onLog: im, cwd: MAY, cauHinh: CH });

    assert(kq.daCapNhat === true, 'kéo về thành công');
    assert(kq.tu === truoc, 'ghi lại đúng commit xuất phát (cần cho việc quay lui)');
    assert(kq.den === git(MAY, 'rev-parse', 'HEAD'), 'ghi lại đúng commit đích');
    assert(kq.soCommit === 2, 'báo đúng số commit đã nuốt');
    assert(fs.readFileSync(path.join(MAY, 'noidung.txt'), 'utf8').trim() === 'sua lan 2',
      'file trên đĩa đúng là nội dung mới nhất — code thật sự đã đổi');

    const lai = await keoVeVaKiemTra({ onLog: im, cwd: MAY, cauHinh: CH });
    assert(lai.daCapNhat === false, 'gọi lại ngay sau đó thì không làm gì nữa');
  }

  // ── [6] Có người sửa file trên máy chủ ──
  // Panel của nhà cung cấp cho sửa file trực tiếp. Ai đó vá nóng một dòng rồi
  // quên mất; `git pull` sẽ ghi đè hoặc xung đột. Phải từ chối chứ không ủi qua.
  console.log(chalk.yellow(`\n[6] Máy chủ đang có file sửa dở:`));
  {
    day('noidung.txt', 'sua lan 3\n', 'Can bang lai kinh te');
    ghi(MAY, 'noidung.txt', 'ai do va nong tren panel\n');

    const kq = await keoVeVaKiemTra({ onLog: im, cwd: MAY, cauHinh: CH });
    assert(kq.daCapNhat === false, 'từ chối cập nhật khi cây bẩn');
    assert(/sửa dở/i.test(kq.lyDo || ''), 'nói rõ lý do là có file sửa dở');
    assert(fs.readFileSync(path.join(MAY, 'noidung.txt'), 'utf8').includes('va nong'),
      'công sửa tay của người ta còn nguyên, không bị ghi đè');

    git(MAY, 'checkout', '--', 'noidung.txt');
    const sauKhiDon = await keoVeVaKiemTra({ onLog: im, cwd: MAY, cauHinh: CH });
    assert(sauKhiDon.daCapNhat === true, 'dọn cây sạch xong thì cập nhật chạy bình thường trở lại');
  }

  // ── [7] Đẩy nhầm một commit hỏng ──
  console.log(chalk.yellow(`\n[7] Đẩy nhầm commit hỏng — phải quay lui:`));
  let commitHong = '';
  {
    const truoc = git(MAY, 'rev-parse', 'HEAD');
    commitHong = day('check.js', 'process.exit(1);\n', 'Commit hong: audit truot');

    const kq = await keoVeVaKiemTra({ onLog: im, cwd: MAY, cauHinh: CH });
    assert(kq.daCapNhat === false, 'bản không qua được rà soát thì không được nhận');
    assert(kq.daQuayLui === true, 'có quay lui');
    assert(git(MAY, 'rev-parse', 'HEAD') === truoc, 'kho đã về đúng commit cũ');
    assert(fs.readFileSync(path.join(MAY, 'check.js'), 'utf8').trim() === 'process.exit(0);',
      'file trên đĩa cũng về bản cũ, không sót lại nửa nạc nửa mỡ');

    const cachLy = docCachLy(MAY);
    assert(cachLy?.commit === commitHong, 'ghi nhớ đúng commit đã hỏng');
    assert(/audit/i.test(cachLy?.lyDo || ''), 'ghi lại lý do hỏng để còn báo lên Discord');

    // Dòng `.update-quarantine` trong .gitignore là thứ giữ cho khẳng định này
    // đúng. Mất nó thì cây bẩn vĩnh viễn và hàng rào [6] tự khoá luôn cập nhật.
    assert((await trangThaiKho(CH, { cwd: MAY })).sach === true,
      'file cách ly bị .gitignore bỏ qua — cây vẫn sạch, cập nhật sau này không bị tự khoá');
  }

  // ── [8] Không được lặp vô tận ──
  // Đây là tình huống dễ giết máy chủ nhất: kéo → trượt → quay lui → 5 phút sau
  // lại thấy "có bản mới" → restart. Cứ 5 phút một lần cho tới khi có người để ý.
  console.log(chalk.yellow(`\n[8] Cách ly chặn vòng lặp restart:`));
  {
    const tin = await timCapNhat(CH, { cwd: MAY });
    assert(tin.coMoi === false, 'lượt dò tiếp theo KHÔNG báo có bản mới nữa');
    assert(tin.biCachLy?.commit === commitHong, 'kèm theo thông tin cách ly để lệnh !capnhat hiển thị');
    assert(tin.soCommit === 1, 'vẫn biết kho có 1 commit mới, chỉ là cố tình không đụng vào');

    const truoc = git(MAY, 'rev-parse', 'HEAD');
    const kq = await keoVeVaKiemTra({ onLog: im, cwd: MAY, cauHinh: CH });
    assert(kq.daCapNhat === false && git(MAY, 'rev-parse', 'HEAD') === truoc,
      'gọi lại cũng không kéo — bot không bị tắt đi tắt lại');

    // Đúng việc mà `!capnhat thulai` làm.
    xoaCachLy(MAY);
    assert(docCachLy(MAY) === null, 'xoá được dấu cách ly');
    assert((await timCapNhat(CH, { cwd: MAY })).coMoi === true,
      'gỡ cách ly xong thì thấy bản mới trở lại — !capnhat thulai ép thử lại được');

    // Người viết code sửa lỗi rồi đẩy lên: bot phải tự lên, không cần ai đụng tay.
    ghiCachLy(commitHong, 'không qua được npm run audit', MAY);
    day('check.js', 'process.exit(0);\n', 'Sua lai commit hong');
    const sauKhiSua = await timCapNhat(CH, { cwd: MAY });
    assert(sauKhiSua.coMoi === true, 'đỉnh kho đổi mã thì cách ly hết hiệu lực, tự thử lại ngay');

    const len = await keoVeVaKiemTra({ onLog: im, cwd: MAY, cauHinh: CH });
    assert(len.daCapNhat === true, 'lên được bản đã sửa');
    assert(docCachLy(MAY) === null, 'cập nhật trót lọt thì dấu cách ly bị dọn sạch');
    assert(fs.readFileSync(path.join(MAY, 'check.js'), 'utf8').trim() === 'process.exit(0);',
      'code trên máy chủ đúng là bản đã sửa');
  }

  // ── [9] Hai đầu dây phải khớp nhau ──
  // Mã thoát là toàn bộ giao ước giữa bot và tiến trình bọc ngoài. Lệch số thì
  // bot vẫn tắt, bọc ngoài vẫn bật lại, nhưng bản mới không bao giờ được kéo —
  // hỏng hoàn toàn im lặng, không log, không lỗi. Phải chốt bằng test.
  console.log(chalk.yellow(`\n[9] Giao ước giữa bot và tiến trình giám sát:`));
  {
    const nguon = fs.readFileSync(new URL('../scripts/supervisor.js', import.meta.url), 'utf8');
    const khop = nguon.match(/MA_CAP_NHAT\s*=\s*(\d+)/);
    assert(!!khop, 'đọc được mã cập nhật khai trong scripts/supervisor.js');
    assert(Number(khop?.[1]) === EXIT_UPDATE,
      `mã thoát khớp hai đầu (supervisor=${khop?.[1]}, updateService=${EXIT_UPDATE})`);
    assert(EXIT_UPDATE !== 0 && EXIT_UPDATE !== 1,
      'mã thoát không đụng 0/1 — nếu không, bot sập bình thường sẽ bị hiểu nhầm là đòi cập nhật');

    assert(/BOT_SUPERVISED:\s*'1'/.test(nguon), 'bọc ngoài có gắn dấu BOT_SUPERVISED cho tiến trình con');
    assert(coGiamSat({ BOT_SUPERVISED: '1' }) === true, 'bot nhận ra dấu đó');
    assert(coGiamSat({}) === false,
      'không có dấu thì coi như không ai giám sát — bot sẽ từ chối tự tắt, khỏi biến mất luôn');

    const capnhat = fs.readFileSync(new URL('../src/commands/prefix/capnhat.js', import.meta.url), 'utf8');
    assert(/isAdmin\(message\.author\.id\)/.test(capnhat),
      'lệnh !capnhat có khoá quyền quản trị — người lạ không tắt được bot');
  }

  // ── [10] Màn hình !capnhat ──
  console.log(chalk.yellow(`\n[10] Màn hình !capnhat không vỡ và không lộ mã truy cập:`));
  {
    const MA = 'ghp_ZzYyXxWwVvUuTtSsRrQqPpOoNnMm0099';
    const dai = 'X'.repeat(3000);

    const khoDay = {
      laKho: true,
      nhanh: 'master',
      commit: 'a'.repeat(40),
      ngan: 'aaaaaaa',
      chuThich: `Sửa lỗi rất dài ${dai} (đẩy từ https://huy:${MA}@github.com/huy/tutien.git)`,
      nguoi: `Người Có Tên Dài ${dai}`,
      luc: new Date().toISOString(),
      sach: false,
      banBan: Array.from({ length: 40 }, (_, i) => ` M src/rat/nhieu/file/so-${i}-${dai}.js`)
    };
    const tinDay = {
      coMoi: true,
      soCommit: 30,
      dich: `origin/master`,
      danhSach: Array.from({ length: 30 }, (_, i) => `abc123${i} Commit dài ${dai}`),
      biCachLy: { commit: 'b'.repeat(40), lyDo: `không qua được npm run audit ${dai}`, luc: new Date().toISOString() }
    };
    const chDay = { bat: true, phutMoiLan: 5, remote: 'origin', nhanh: `master-${dai}` };

    let payload;
    let neLoi = null;
    try {
      payload = renderCapnhatView(khoDay, tinDay, chDay, { daRaHieu: false, giamSat: true, daXoaCachLy: true });
    } catch (e) { neLoi = e; }

    assert(neLoi === null, `dựng được embed với dữ liệu dài quá cỡ (${neLoi?.message || 'không lỗi'})`);

    const d = payload?.embeds?.[0]?.data || {};
    assert((d.title || '').length <= EMBED_LIMITS.title, `tiêu đề ≤ ${EMBED_LIMITS.title}`);
    assert((d.description || '').length <= EMBED_LIMITS.description, `mô tả ≤ ${EMBED_LIMITS.description}`);
    assert((d.footer?.text || '').length <= EMBED_LIMITS.footer, `chân trang ≤ ${EMBED_LIMITS.footer}`);
    assert((d.fields || []).every(f => f.value.length <= EMBED_LIMITS.fieldValue),
      `mọi ô nội dung ≤ ${EMBED_LIMITS.fieldValue}`);
    assert((d.fields || []).length <= 25, 'không quá 25 ô');

    const tong = (d.title || '').length + (d.description || '').length + (d.footer?.text || '').length +
      (d.fields || []).reduce((s, f) => s + f.name.length + f.value.length, 0);
    assert(tong <= 6000, `tổng ký tự cả embed ≤ 6000 (đang ${tong})`);

    // payload có thể là undefined nếu khẳng định đầu tiên đã đỏ; đừng để nó
    // kéo sập cả phần còn lại của mục này.
    const toanBo = JSON.stringify(payload || {});
    assert(!toanBo.includes(MA), 'mã truy cập GitHub không lọt ra khung chat Discord');

    assert((d.fields || []).some(f => f.name.includes('cách ly')), 'có báo bản mới đang bị cách ly');
    assert((d.fields || []).some(f => f.name.includes('gỡ cách ly')), 'có báo vừa gỡ cách ly');
    assert((d.fields || []).some(f => f.name.includes('sửa dở')), 'có cảnh báo cây bẩn');

    // Chạy không giám sát: phải nói thẳng là bấm cũng không lên được.
    const khongGiamSat = renderCapnhatView(
      { ...khoDay, sach: true }, { ...tinDay, biCachLy: null }, chDay, { giamSat: false });
    assert(/npm start/.test(khongGiamSat.embeds[0].data.description || ''),
      'chạy không có giám sát thì chỉ luôn cách khởi động đúng');

    const khongPhaiKho = renderCapnhatView({ laKho: false, lyDo: `hỏng vì ${MA}` }, null, chDay, {});
    assert(!!khongPhaiKho.content && !khongPhaiKho.content.includes(MA),
      'thư mục không phải kho git thì trả lời gọn, vẫn che mã truy cập');
  }

  console.log(chalk.bold.magenta(`\n======================================================`));
  if (passed === total) {
    console.log(chalk.bold.green(`🎉 KẾT QUẢ: ${passed}/${total} PHÉP THỬ ĐẠT — cơ chế tự cập nhật chạy đúng trên git thật!`));
  } else {
    console.log(chalk.bold.red(`⚠️ KẾT QUẢ: ${passed}/${total} đạt — còn ${total - passed} chỗ hỏng.`));
  }
  console.log(chalk.bold.magenta(`======================================================\n`));

  return passed === total ? 0 : 1;
}

let ma = 1;
try {
  ma = await main();
} catch (e) {
  console.error(chalk.red(`\n💥 Lỗi khi chạy: ${che(e?.stack || e?.message || e)}`));
  ma = 1;
} finally {
  donSan();
}
process.exit(ma);
