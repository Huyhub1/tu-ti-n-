/**
 * TIẾN TRÌNH BỌC NGOÀI — điểm khởi động thật sự của bot.
 *
 * Panel của nhà cung cấp (PikaMC, pm2, systemd, hay file .bat ở nhà) chạy đúng
 * một tiến trình: cái này. Nó sinh ra bot làm tiến trình con rồi trông chừng:
 *
 *   · bot thoát mã 42  → có bản mới. Chạy `scripts/applyUpdate.js` để kéo về,
 *                        rồi sinh lại bot bằng code vừa cập nhật.
 *   · bot thoát mã 0   → tắt có chủ đích. Bọc ngoài tắt theo.
 *   · bot chết bất ngờ → bật lại, giãn dần thời gian chờ. Sập liên tiếp quá
 *                        nhiều lần thì mới chịu thua, để khỏi quay vòng vô tận
 *                        ăn hết tài nguyên máy chủ.
 *
 * Cố ý viết mỏng và không phụ thuộc thư viện ngoài. File này là thứ DUY NHẤT
 * không tự cập nhật được — nó đã nằm trong bộ nhớ từ lúc bật, nên `git pull`
 * đổi nó thì phải khởi động lại từ panel mới có hiệu lực. Càng ít lý do phải
 * sửa nó càng tốt, nên mọi logic thật đều nằm chỗ khác.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FILE_BOT = path.join(ROOT, 'src', 'index.js');
const FILE_CAP_NHAT = path.join(__dirname, 'applyUpdate.js');

const MA_CAP_NHAT = 42;

/** Chạy được liên tục ngần này thì coi như lần bật đó thành công, xoá bộ đếm sập. */
const NGUONG_ON_DINH_MS = 60_000;
const SO_LAN_SAP_TOI_DA = 10;

const gio = () => new Date().toLocaleTimeString('vi-VN');
const in_ = (s) => console.log(`\x1b[35m[Giám sát ${gio()}]\x1b[0m ${s}`);

let conHienTai = null;
let dangTatTheoLenh = false;

/** Sinh một tiến trình con, chờ nó kết thúc, trả về mã thoát. */
function chay(file, nhan, themEnv = {}) {
  return new Promise((resolve) => {
    const con = spawn(process.execPath, [file], {
      cwd: ROOT,
      // Cho con dùng chung màn hình: log của bot hiện thẳng trên panel, không
      // qua tay ai chép lại. Panel nào cũng chỉ đọc được stdout của tiến trình
      // gốc, nên đây là cách duy nhất để không mất log.
      stdio: 'inherit',
      env: { ...process.env, ...themEnv }
    });

    conHienTai = con;

    con.on('exit', (ma, tinHieu) => {
      conHienTai = null;
      if (tinHieu) {
        in_(`${nhan} dừng vì tín hiệu ${tinHieu}.`);
        resolve(dangTatTheoLenh ? 0 : 1);
      } else {
        resolve(ma ?? 1);
      }
    });

    con.on('error', (e) => {
      conHienTai = null;
      in_(`\x1b[31mKhông chạy nổi ${nhan}: ${e.message}\x1b[0m`);
      resolve(1);
    });
  });
}

const cho = (ms) => new Promise(r => setTimeout(r, ms));

async function vongDoi() {
  in_('Khởi động vòng giám sát. Bot sẽ tự bật lại nếu sập hoặc khi có bản cập nhật.');

  let lanSapLienTiep = 0;

  while (!dangTatTheoLenh) {
    const batLuc = Date.now();
    // Dấu hiệu để bot biết có người bật lại mình. Không có nó thì bot từ
    // chối tự thoát đi cập nhật — thoát ra mà không ai bật lại là mất bot.
    const ma = await chay(FILE_BOT, 'Bot', { BOT_SUPERVISED: '1' });
    const chayDuoc = Date.now() - batLuc;

    if (dangTatTheoLenh) break;

    if (ma === MA_CAP_NHAT) {
      in_('Bot báo có bản mới — bắt đầu kéo về.');
      // Cố tình bỏ qua mã thoát: cập nhật hỏng cũng phải bật lại bot bằng bản
      // đang có. `applyUpdate.js` đã tự quay lui và tự in lý do rồi.
      await chay(FILE_CAP_NHAT, 'Trình cập nhật');
      lanSapLienTiep = 0;
      in_('Bật lại bot...');
      continue;
    }

    if (ma === 0) {
      in_('Bot tắt sạch. Vòng giám sát dừng theo.');
      return 0;
    }

    // Chạy được một lúc lâu rồi mới sập thì đó là sự cố lẻ, không phải lỗi khởi
    // động lặp lại — không nên tính dồn vào bộ đếm bỏ cuộc.
    if (chayDuoc >= NGUONG_ON_DINH_MS) lanSapLienTiep = 0;
    lanSapLienTiep++;

    if (lanSapLienTiep > SO_LAN_SAP_TOI_DA) {
      in_(`\x1b[31mBot sập ${lanSapLienTiep} lần liên tiếp mà không trụ nổi ${NGUONG_ON_DINH_MS / 1000}s.\x1b[0m`);
      in_('\x1b[31mDừng bật lại để khỏi quay vòng vô tận. Xem log phía trên để tìm nguyên nhân.\x1b[0m');
      return 1;
    }

    const doi = Math.min(2000 * 2 ** (lanSapLienTiep - 1), 60_000);
    in_(`Bot thoát với mã ${ma}. Bật lại sau ${Math.round(doi / 1000)}s (lần ${lanSapLienTiep}/${SO_LAN_SAP_TOI_DA}).`);
    await cho(doi);
  }

  return 0;
}

// Panel bấm Stop, Ctrl+C ở nhà, hay systemd tắt máy — đều tới đây. Chuyển tín
// hiệu xuống cho bot tự dọn (ngắt phiên Discord, đóng MongoDB) rồi mới đi.
for (const tinHieu of ['SIGINT', 'SIGTERM']) {
  process.once(tinHieu, () => {
    dangTatTheoLenh = true;
    in_(`Nhận ${tinHieu} — chuyển xuống cho bot rồi dừng giám sát.`);
    if (conHienTai) {
      conHienTai.kill(tinHieu);
      // Bot nào chây ì quá lâu thì cắt hẳn, đừng để panel treo ở trạng thái
      // "đang dừng" rồi tự nó giết cả container.
      setTimeout(() => { try { conHienTai?.kill('SIGKILL'); } catch { /* đã đi rồi */ } }, 10_000).unref();
    }
  });
}

process.exitCode = await vongDoi();
