/**
 * TỰ CẬP NHẬT MÃ NGUỒN TỪ GIT
 *
 * Bài toán: bot chạy trên máy chủ thuê, còn code thì sửa ở máy nhà. Trước đây
 * muốn cập nhật phải vào panel tải từng file lên tay. Giờ chỉ cần đẩy commit
 * lên GitHub — bot tự thấy, tự kéo về, tự bật lại. Máy nào cũng vậy, khỏi nhớ.
 *
 * Chỗ nguy hiểm của mọi cơ chế kiểu này là nó THI HÀNH MÃ TẢI TỪ MẠNG. Nên ở
 * đây dựng sẵn bốn hàng rào, và không hàng rào nào được phép tắt:
 *
 *  1. Chỉ tua nhanh (`--ff-only`). Không bao giờ tự trộn nhánh, không bao giờ
 *     tự giải xung đột. Có xung đột thì dừng lại và kêu người.
 *  2. Cây làm việc phải sạch. Ai đó sửa tay ngay trên máy chủ mà ta `pull` đè
 *     lên là mất trắng công họ — thà không cập nhật còn hơn.
 *  3. Kéo về xong phải qua được `npm run audit` mới cho chạy. Đây là chốt đáng
 *     giá nhất: đẩy nhầm một commit hỏng cũng không giết được bot.
 *  4. Không qua được thì `git reset --hard` về đúng commit cũ rồi chạy lại bản
 *     cũ. Bot sống sót qua một lần đẩy hỏng mà không cần ai đụng tay.
 *
 * Việc KÉO VỀ cố tình không chạy trong tiến trình bot. Bot chỉ phát hiện rồi
 * thoát với mã `EXIT_UPDATE`; `scripts/supervisor.js` mới là chỗ chạy git và
 * npm — lúc đó code cũ đã ngừng hẳn, không có cảnh vừa ghi đè file vừa chạy nó.
 *
 * Mọi hàm đều nhận `{ cwd }` thay vì khoá cứng vào thư mục dự án. Không phải
 * để linh hoạt — mà vì mã tự tải code lạ về rồi chạy thì bắt buộc phải kiểm thử
 * được, và cách duy nhất kiểm cho thật là dựng kho git thật trong thư mục tạm
 * rồi cho nó chạy trọn vẹn ở đó (xem `tests/testUpdateService.js`).
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Thư mục gốc dự án — mặc định của mọi lệnh git, không phụ thuộc cwd tiến trình. */
export const ROOT_DIR = path.join(__dirname, '../..');

/**
 * Mã thoát bot dùng để ra hiệu cho tiến trình bọc ngoài: "có bản mới, kéo về
 * rồi bật lại tôi". Chọn số lạ để không đụng mã thoát thông thường (0 = tắt
 * sạch, 1 = lỗi) — bọc ngoài phân biệt được ba trường hợp này là đủ.
 *
 * `scripts/supervisor.js` giữ một bản sao hằng số này (nó cố ý không import gì
 * từ src/ để luôn chạy được kể cả khi src/ hỏng). `tests/testUpdateService.js`
 * đối chiếu hai bên, vì lệch nhau một con số là cả cơ chế chết câm.
 */
export const EXIT_UPDATE = 42;

const BAT = /^(1|true|on|yes|bat|bật|co|có)$/i;
const TAT = /^(0|false|off|no|tat|tắt)$/i;

/**
 * Đọc cấu hình từ biến môi trường mỗi lần gọi chứ không chốt lúc nạp module.
 * Lý do thực tế: bộ kiểm thử cần đổi env rồi xem hàm phản ứng ra sao, mà nếu
 * chốt sẵn lúc import thì không đổi được nữa.
 */
export function docCauHinh(env = process.env) {
  const phut = Number(env.AUTO_UPDATE_INTERVAL_MINUTES);
  return {
    bat: BAT.test(String(env.AUTO_UPDATE || '').trim()),
    remote: String(env.AUTO_UPDATE_REMOTE || 'origin').trim() || 'origin',
    // Rỗng = dùng đúng nhánh đang đứng. Đỡ phải khai lại khi đổi nhánh.
    nhanh: String(env.AUTO_UPDATE_BRANCH || '').trim(),
    // Kẹp lại trong khoảng hợp lý: dưới 1 phút là tự quấy GitHub, trên 1 ngày
    // thì gọi là tự cập nhật cũng bằng thừa.
    phutMoiLan: Math.min(Math.max(Number.isFinite(phut) && phut > 0 ? phut : 5, 1), 1440),
    kenhBaoTin: String(env.AUTO_UPDATE_CHANNEL_ID || '').trim(),
    // Cho phép tắt cửa nghiệm thu sau khi kéo về, nhưng phải khai rõ ràng.
    kiemTraSauKhiKeo: !TAT.test(String(env.AUTO_UPDATE_VERIFY || '').trim())
  };
}

/**
 * Xoá dấu vết bí mật trước khi in ra log hay gửi vào Discord.
 *
 * Bắt buộc phải có: kho riêng tư thì URL remote mang sẵn mã truy cập cá nhân
 * dạng `https://tên:ghp_xxx@github.com/...`. Chỉ cần một lần lỡ in nguyên URL
 * đó vào kênh chat là mã đó coi như mất, và nó mở được cả kho.
 */
export function che(text) {
  return String(text ?? '')
    .replace(/(https?:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, '$1***@')
    .replace(/gh[pousr]_[A-Za-z0-9]{16,}/g, 'gh*_***')
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, 'github_pat_***');
}

/**
 * Tên file ghi nhớ commit đã thử và trượt vòng nghiệm thu.
 *
 * Không có nó thì cơ chế này tự đá vào chân mình: đẩy nhầm một commit hỏng,
 * bot kéo về → rà soát trượt → quay lui → năm phút sau lại thấy "có bản mới"
 * → kéo tiếp. Cứ thế bot khởi động lại mỗi năm phút cho tới khi có người để ý.
 *
 * Ghi lại đúng mã commit đã hỏng và bỏ qua riêng nó. Đẩy commit sửa lỗi lên là
 * đỉnh kho đổi mã, không còn khớp, bot tự thử lại ngay — không cần ai đụng tay.
 */
const TEN_FILE_CACH_LY = '.update-quarantine';

/** Đọc bản ghi cách ly; không có hoặc hỏng thì coi như chưa cách ly gì. */
export function docCachLy(cwd = ROOT_DIR) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(cwd, TEN_FILE_CACH_LY), 'utf8'));
    return j && typeof j.commit === 'string' && j.commit ? j : null;
  } catch {
    return null;
  }
}

export function ghiCachLy(commit, lyDo, cwd = ROOT_DIR) {
  try {
    fs.writeFileSync(path.join(cwd, TEN_FILE_CACH_LY),
      JSON.stringify({ commit, lyDo: che(lyDo), luc: new Date().toISOString() }, null, 2));
    return true;
  } catch {
    // Không ghi được thì thôi — mất khả năng chống lặp, nhưng không đáng để
    // làm hỏng cả lần cập nhật.
    return false;
  }
}

export function xoaCachLy(cwd = ROOT_DIR) {
  try {
    fs.rmSync(path.join(cwd, TEN_FILE_CACH_LY), { force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gọi git một lần. Không dùng shell: tham số truyền thành mảng nên một nhánh
 * tên quái đản cũng không chen được lệnh khác vào.
 */
export function chayGit(args, { timeout = 60_000, cwd = ROOT_DIR } = {}) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          ma: err ? (err.code ?? 1) : 0,
          out: String(stdout || '').trim(),
          err: che(String(stderr || err?.message || '').trim())
        });
      });
  });
}

/** Đọc phiên bản trong package.json; hỏng thì trả chuỗi rỗng chứ không ném. */
export function docPhienBan(cwd = ROOT_DIR) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).version || '';
  } catch {
    return '';
  }
}

/**
 * Chụp trạng thái kho hiện tại: có phải kho git không, đang đứng ở đâu, cây có
 * sạch không, remote đã khai chưa. Mọi thứ khác đều dựa trên kết quả này.
 */
export async function trangThaiKho(cauHinh = docCauHinh(), { cwd = ROOT_DIR } = {}) {
  const laKho = await chayGit(['rev-parse', '--is-inside-work-tree'], { cwd, timeout: 10_000 });
  if (!laKho.ok || laKho.out !== 'true') {
    return { laKho: false, lyDo: 'Thư mục này không phải kho git (chưa `git init` hoặc chưa clone về).' };
  }

  const [nhanh, commit, ngan, banGhi, trang, danhSachRemote] = await Promise.all([
    chayGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeout: 10_000 }),
    chayGit(['rev-parse', 'HEAD'], { cwd, timeout: 10_000 }),
    chayGit(['rev-parse', '--short', 'HEAD'], { cwd, timeout: 10_000 }),
    chayGit(['log', '-1', '--pretty=%s|%an|%cI'], { cwd, timeout: 10_000 }),
    chayGit(['status', '--porcelain'], { cwd, timeout: 20_000 }),
    chayGit(['remote'], { cwd, timeout: 10_000 })
  ]);

  const [chuThich = '', nguoi = '', luc = ''] = (banGhi.out || '').split('|');
  const banBan = (trang.out || '').split('\n').map(s => s.trim()).filter(Boolean);

  return {
    laKho: true,
    nhanh: nhanh.out || '',
    commit: commit.out || '',
    ngan: ngan.out || '',
    chuThich,
    nguoi,
    luc,
    sach: banBan.length === 0,
    banBan,
    coRemote: (danhSachRemote.out || '').split('\n').map(s => s.trim()).filter(Boolean).includes(cauHinh.remote)
  };
}

/**
 * Hỏi kho xem có gì mới không. Chỉ ĐỌC — `fetch` không đụng gì tới file đang
 * chạy, nên gọi hàm này định kỳ hoàn toàn an toàn.
 *
 * Trả về `coMoi: false` kèm `lyDo` cho mọi trường hợp không cập nhật được, thay
 * vì ném lỗi: đây là việc chạy nền mỗi vài phút, một lần mạng chập không đáng
 * để đổ stack trace ra log rồi lặp lại mãi.
 */
export async function timCapNhat(cauHinh = docCauHinh(), { cwd = ROOT_DIR } = {}) {
  const kho = await trangThaiKho(cauHinh, { cwd });
  if (!kho.laKho) return { ok: false, coMoi: false, lyDo: kho.lyDo, kho };
  if (!kho.coRemote) {
    return {
      ok: false,
      coMoi: false,
      lyDo: `Chưa khai remote "${cauHinh.remote}". Chạy: git remote add ${cauHinh.remote} <URL kho>`,
      kho
    };
  }

  const nhanh = cauHinh.nhanh || kho.nhanh;
  if (!nhanh || nhanh === 'HEAD') {
    return { ok: false, coMoi: false, lyDo: 'Đang ở trạng thái tách rời HEAD, không biết theo nhánh nào.', kho };
  }

  const lay = await chayGit(['fetch', '--quiet', cauHinh.remote, nhanh], { cwd, timeout: 120_000 });
  if (!lay.ok) {
    return { ok: false, coMoi: false, lyDo: `Không lấy được tin từ kho: ${lay.err || 'không rõ nguyên nhân'}`, kho };
  }

  const dich = `${cauHinh.remote}/${nhanh}`;
  const dem = await chayGit(['rev-list', '--left-right', '--count', `HEAD...${dich}`], { cwd, timeout: 30_000 });
  if (!dem.ok) {
    return { ok: false, coMoi: false, lyDo: `Không so được với ${dich}: ${dem.err}`, kho };
  }

  const [truoc, sau] = (dem.out || '0\t0').split(/\s+/).map(n => Number(n) || 0);

  // Đi trước remote nghĩa là máy này có commit chưa đẩy. `--ff-only` sẽ từ chối,
  // nên báo thẳng ra thay vì để nó thất bại khó hiểu ở bước sau.
  if (truoc > 0 && sau > 0) {
    return {
      ok: true, coMoi: false, nhanh, dich, diTruoc: truoc, soCommit: sau,
      lyDo: `Nhánh đã rẽ đôi: máy này có ${truoc} commit chưa đẩy, kho có ${sau} commit mới. Phải gộp bằng tay.`,
      kho
    };
  }
  if (sau === 0) {
    return { ok: true, coMoi: false, nhanh, dich, diTruoc: truoc, soCommit: 0, lyDo: 'Đã là bản mới nhất.', kho };
  }

  // Đỉnh kho có đúng là cái đã thử và hỏng lần trước không.
  const dinhKho = await chayGit(['rev-parse', dich], { cwd, timeout: 10_000 });
  const cachLy = docCachLy(cwd);
  if (cachLy && dinhKho.ok && dinhKho.out && cachLy.commit === dinhKho.out) {
    return {
      ok: true, coMoi: false, nhanh, dich, diTruoc: truoc, soCommit: sau, biCachLy: cachLy,
      lyDo: `Bản mới nhất (${dinhKho.out.slice(0, 7)}) đã thử một lần và không qua được vòng nghiệm thu: ` +
        `${cachLy.lyDo}. Đẩy commit sửa lỗi lên là bot tự thử lại, hoặc gõ ` + '`!capnhat thulai`' + ` để ép thử ngay.`,
      kho
    };
  }

  const nhatKy = await chayGit(['log', '--no-merges', '--pretty=%h %s', `HEAD..${dich}`], { cwd, timeout: 30_000 });

  return {
    ok: true,
    coMoi: true,
    nhanh,
    dich,
    diTruoc: truoc,
    soCommit: sau,
    danhSach: (nhatKy.out || '').split('\n').map(s => s.trim()).filter(Boolean),
    kho
  };
}

/** Lockfile có đổi giữa hai commit không — chỉ khi đổi mới cần cài lại gói. */
async function goiCoDoi(tu, den, cwd) {
  const doi = await chayGit(['diff', '--name-only', tu, den, '--', 'package.json', 'package-lock.json'],
    { cwd, timeout: 30_000 });
  return doi.ok && (doi.out || '').length > 0;
}

function chayLenh(lenh, args, { timeout, onLog, cwd }) {
  return new Promise((resolve) => {
    execFile(lenh, args, {
      cwd,
      timeout,
      windowsHide: true,
      // npm trên Windows là file .cmd, không phải chương trình thật, nên không
      // gọi thẳng được. Tham số vẫn đi theo mảng nên không có chuyện chèn lệnh.
      shell: process.platform === 'win32',
      maxBuffer: 8 * 1024 * 1024
    }, (err, stdout, stderr) => {
      const out = che(String(stdout || '') + String(stderr || ''));
      if (onLog && out.trim()) onLog(out.trim().split('\n').slice(-6).join('\n'));
      resolve({ ok: !err, out });
    });
  });
}

function npmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function caiGoi(onLog, cwd) {
  // `npm ci` dựng lại đúng theo lockfile — sạch hơn `install`, nhưng nó đòi
  // lockfile phải khớp package.json, và nó xoá sạch node_modules trước. Không
  // có lockfile thì đành `install`.
  const coLock = fs.existsSync(path.join(cwd, 'package-lock.json'));
  const thu = await chayLenh(npmCmd(), coLock ? ['ci', '--omit=dev'] : ['install', '--omit=dev'],
    { timeout: 600_000, onLog, cwd });
  if (thu.ok || !coLock) return thu;

  // `npm ci` kén: lockfile lệch một chút là nó bỏ cuộc. Lùi về `install` thay
  // vì để cả lần cập nhật hỏng chỉ vì chuyện đó.
  onLog('npm ci không xong, thử lại bằng npm install...');
  return chayLenh(npmCmd(), ['install', '--omit=dev'], { timeout: 600_000, onLog, cwd });
}

/**
 * KÉO VỀ THẬT SỰ. Chỉ `scripts/applyUpdate.js` được gọi hàm này, và chỉ khi bot
 * đã tắt hẳn — đang chạy mà ghi đè file nguồn thì nửa nạc nửa mỡ, module nào
 * nạp rồi thì giữ bản cũ, module nào nạp sau thì bản mới.
 *
 * `onLog` để bọc ngoài in tiến độ ra console; hàm này không tự in gì cả.
 */
export async function keoVeVaKiemTra({ onLog = () => {}, cwd = ROOT_DIR, cauHinh = docCauHinh() } = {}) {
  const tin = await timCapNhat(cauHinh, { cwd });

  if (!tin.coMoi) {
    return { ok: false, daCapNhat: false, lyDo: tin.lyDo || 'Không có gì mới.' };
  }

  // Hàng rào 2: cây phải sạch. Kiểm lại ở đây chứ không tin kết quả lúc nãy —
  // giữa hai lần gọi có thể có người vừa sửa file qua panel của nhà cung cấp.
  const kho = await trangThaiKho(cauHinh, { cwd });
  if (!kho.sach) {
    return {
      ok: false,
      daCapNhat: false,
      lyDo: `Có ${kho.banBan.length} file đang sửa dở trên máy chủ, không dám ghi đè:\n` +
        kho.banBan.slice(0, 10).join('\n')
    };
  }

  const truoc = kho.commit;
  onLog(`Đang kéo ${tin.soCommit} commit mới từ ${tin.dich}...`);

  // Hàng rào 1: chỉ tua nhanh.
  const keo = await chayGit(['pull', '--ff-only', cauHinh.remote, tin.nhanh], { cwd, timeout: 180_000 });
  if (!keo.ok) {
    return { ok: false, daCapNhat: false, lyDo: `Kéo về thất bại: ${keo.err || 'không rõ nguyên nhân'}` };
  }

  const sauKhiKeo = await trangThaiKho(cauHinh, { cwd });
  const den = sauKhiKeo.commit;

  /** Trả kho về đúng commit cũ, kèm cài lại gói nếu lúc nãy đã đụng vào. */
  const quayLui = async (daCaiGoi) => {
    onLog(`Đang quay về commit cũ ${truoc.slice(0, 7)}...`);
    await chayGit(['reset', '--hard', truoc], { cwd, timeout: 60_000 });
    if (daCaiGoi) await caiGoi(onLog, cwd);
  };

  let daCaiGoi = false;
  if (await goiCoDoi(truoc, den, cwd)) {
    onLog('package.json đổi — cài lại thư viện...');
    daCaiGoi = true;
    const cai = await caiGoi(onLog, cwd);
    if (!cai.ok) {
      await quayLui(true);
      ghiCachLy(den, 'cài thư viện thất bại', cwd);
      return {
        ok: false, daCapNhat: false, daQuayLui: true, tu: truoc, den,
        lyDo: 'Cài thư viện thất bại, đã quay về bản cũ.'
      };
    }
  }

  // Hàng rào 3: bản mới phải tự chứng minh nó chạy được.
  if (cauHinh.kiemTraSauKhiKeo) {
    onLog('Đang rà soát bản mới (npm run audit)...');
    const soat = await chayLenh(npmCmd(), ['run', '--silent', 'audit'], { timeout: 300_000, onLog, cwd });
    if (!soat.ok) {
      await quayLui(daCaiGoi);
      ghiCachLy(den, 'không qua được npm run audit', cwd);
      return {
        ok: false, daCapNhat: false, daQuayLui: true, tu: truoc, den,
        lyDo: 'Bản mới không qua được vòng rà soát — đã quay về bản cũ và chạy tiếp bằng nó.'
      };
    }
  }

  // Lên bản mới trót lọt thì bản ghi cách ly cũ (nếu có) hết ý nghĩa.
  xoaCachLy(cwd);

  return {
    ok: true,
    daCapNhat: true,
    tu: truoc,
    den,
    soCommit: tin.soCommit,
    danhSach: tin.danhSach || [],
    chuThich: sauKhiKeo.chuThich
  };
}
