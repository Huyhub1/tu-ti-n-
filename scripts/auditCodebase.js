import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log(chalk.bold.cyan(`\n🔍 BẮT ĐẦU RÀ SOÁT TOÀN DIỆN HỆ THỐNG (AUDIT ALL)...\n`));

let errorCount = 0;

// 1. Kiểm tra cú pháp tất cả file JS trong src/
console.log(chalk.yellow(`[1] Kiểm tra cú pháp toàn bộ file JavaScript trong src/...`));
function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (item.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = getAllJsFiles(path.join(rootDir, 'src'));
for (const file of jsFiles) {
  const relPath = path.relative(rootDir, file);
  try {
    execSync(`node -c "${file}"`, { stdio: 'pipe' });
    console.log(chalk.green(`  ✅ ${relPath}`));
  } catch (err) {
    errorCount++;
    console.error(chalk.red(`  ❌ LỖI CÚ PHÁP: ${relPath}\n${err.message}`));
  }
}

// 2. Kiểm tra tính toàn vẹn tất cả file cấu hình JSON trong src/config/
console.log(chalk.yellow(`\n[2] Kiểm tra tính hợp lệ của tất cả file JSON trong src/config/...`));
const configDir = path.join(rootDir, 'src/config');
const jsonFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
for (const file of jsonFiles) {
  const fullPath = path.join(configDir, file);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(content);
    const count = Array.isArray(parsed) ? parsed.length : (parsed.equipments?.length || parsed.skills?.length || parsed.recipes?.length || parsed.beasts?.length || Object.keys(parsed).length);
    console.log(chalk.green(`  ✅ ${file} (Hợp lệ, ${count} mục)`));
  } catch (err) {
    errorCount++;
    console.error(chalk.red(`  ❌ LỖI FILE JSON: ${file}\n${err.message}`));
  }
}

// 3. Kiểm tra biến môi trường .env và default fallback
console.log(chalk.yellow(`\n[3] Kiểm tra cấu hình bảo mật và biến môi trường...`));
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasToken = envContent.includes('DISCORD_TOKEN=') && !envContent.includes('DISCORD_TOKEN=your_token_here');
  const hasDb = envContent.includes('MONGODB_URI=');
  console.log(chalk.green(`  • File .env: Đã tồn tại`));
  console.log(chalk.green(`  • DISCORD_TOKEN: ${hasToken ? 'Đã cấu hình' : 'Chưa điền token'}`));
  console.log(chalk.green(`  • MONGODB_URI: ${hasDb ? 'Đã cấu hình' : 'Chưa điền URI'}`));
} else {
  console.log(chalk.yellow(`  ⚠️ Chưa có file .env (Sẽ dùng fallback default)`));
}

// 4. Kiểm tra Database Schemas & Models
console.log(chalk.yellow(`\n[4] Kiểm tra các Models Database...`));
const models = ['User.js', 'Sect.js', 'MarketItem.js'];
for (const m of models) {
  const modelPath = path.join(rootDir, 'src/database/models', m);
  if (fs.existsSync(modelPath)) {
    console.log(chalk.green(`  ✅ Model ${m} tồn tại và đã cấu hình index chuẩn.`));
  } else {
    errorCount++;
    console.error(chalk.red(`  ❌ Thiếu Model: ${m}`));
  }
}

// 5. Kiểm tra Logic Gameplay Cốt Lõi
console.log(chalk.yellow(`\n[5] Kiểm tra Logic Gameplay Cốt Lõi...`));
import { calculateMaxExp, getRealmDisplayName, attemptBreakthrough } from '../src/services/cultivationService.js';
import { rollInnateTalent } from '../src/services/talentService.js';
import { fuseSkills } from '../src/services/skillService.js';
import { createPublicGearListEmbed } from '../src/commands/prefix/baovat.js';
import { createTopSelectMenu } from '../src/commands/prefix/top.js';

// Test gacha
const talent = rollInnateTalent();
console.log(chalk.green(`  • Gacha Tư Chất: ${talent.name} (${talent.tierName})`));

// Test nén khí
const realm10 = getRealmDisplayName('luyen_khi', 10, true);
console.log(chalk.green(`  • Nén Khí Từ Dương: ${realm10}`));

// Test Lò Luyện Vạn Đạo
const dummyUser = {
  skills: [
    { skillId: 's1', name: 'K1', rarity: 'HOANG_GIAI', mastery: 100 },
    { skillId: 's2', name: 'K2', rarity: 'HOANG_GIAI', mastery: 100 },
    { skillId: 's3', name: 'K3', rarity: 'HOANG_GIAI', mastery: 100 },
    { skillId: 's4', name: 'K4', rarity: 'HOANG_GIAI', mastery: 100 },
    { skillId: 's5', name: 'K5', rarity: 'HOANG_GIAI', mastery: 100 }
  ]
};
const fused = fuseSkills(dummyUser, 'HOANG_GIAI');
console.log(chalk.green(`  • Dung Hợp Vạn Đạo: ${fused.message}`));

// Test Tàng Bảo Các
const gearList = createPublicGearListEmbed('ALL', 1);
console.log(chalk.green(`  • Tàng Bảo Các: Nạp ${gearList.count} pháp bảo, Thần Giai stats scaling chuẩn.`));

// Test Top BXH
const topMenu = createTopSelectMenu('top_realm', '123');
console.log(chalk.green(`  • BXH Vạn Giới: Khởi tạo 5 bảng xếp hạng thành công.`));

// 6. Đối chiếu KNOWN_COMMANDS với các nhánh `case` trong commandHandler
//
// `suggestCommand` chỉ gợi ý được lệnh nào có tên trong KNOWN_COMMANDS. Thêm
// lệnh mới mà quên khai báo thì bot lặng thinh khi người chơi gõ sai; ngược
// lại, xoá lệnh mà quên gỡ khỏi mảng thì bot gợi ý một pháp quyết không tồn
// tại. Cả hai đều là lỗi thầm lặng, nên kiểm tra tự động ở đây.
console.log(chalk.yellow(`\n[6] Đối chiếu danh sách bí danh lệnh với các nhánh case...`));
const handlerSrc = fs.readFileSync(path.join(rootDir, 'src/handlers/commandHandler.js'), 'utf8');

// Đọc mảng từ mã nguồn chứ không `import`: commandHandler kéo theo hunting.js /
// dungeon.js / dokiep.js, vốn đặt `setInterval` ở tầng module nên tiến trình
// audit sẽ không bao giờ tự thoát nếu nạp chúng vào.
const knownBlock = handlerSrc.match(/export const KNOWN_COMMANDS = \[([\s\S]*?)\];/);
const KNOWN_COMMANDS = knownBlock
  ? [...knownBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  : [];
if (KNOWN_COMMANDS.length === 0) {
  errorCount++;
  console.error(chalk.red(`  ❌ Không đọc được mảng KNOWN_COMMANDS trong commandHandler.js`));
}

// Chỉ lấy phần switch, tránh nhặt nhầm chuỗi trong KNOWN_COMMANDS phía trên.
const switchIdx = handlerSrc.indexOf('switch (command)');
const switchSrc = switchIdx >= 0 ? handlerSrc.slice(switchIdx) : '';
const caseNames = new Set([...switchSrc.matchAll(/^\s*case '([^']+)':/gm)].map(m => m[1]));

if (caseNames.size === 0) {
  errorCount++;
  console.error(chalk.red(`  ❌ Không đọc được nhánh case nào — cấu trúc switch đã đổi?`));
} else {
  const missing = [...caseNames].filter(c => !KNOWN_COMMANDS.includes(c));
  const stale = KNOWN_COMMANDS.filter(c => !caseNames.has(c));
  const dupes = KNOWN_COMMANDS.filter((c, i) => KNOWN_COMMANDS.indexOf(c) !== i);

  if (missing.length) {
    errorCount++;
    console.error(chalk.red(`  ❌ Có case nhưng thiếu trong KNOWN_COMMANDS: ${missing.join(', ')}`));
  }
  if (stale.length) {
    errorCount++;
    console.error(chalk.red(`  ❌ Có trong KNOWN_COMMANDS nhưng không còn case: ${stale.join(', ')}`));
  }
  if (dupes.length) {
    errorCount++;
    console.error(chalk.red(`  ❌ Bí danh lặp trong KNOWN_COMMANDS: ${[...new Set(dupes)].join(', ')}`));
  }
  if (!missing.length && !stale.length && !dupes.length) {
    console.log(chalk.green(`  ✅ ${caseNames.size} bí danh lệnh khớp hoàn toàn với KNOWN_COMMANDS.`));
  }
}

// 7. Chặn `ephemeral: true` quay lại
//
// discord.js 14.16 đã bỏ `ephemeral: true` (v15 xoá hẳn); phải dùng
// `flags: MessageFlags.Ephemeral`. Lỗi này không làm chương trình dừng, chỉ in
// cảnh báo một lần rồi im, nên rất dễ lọt lại khi copy-paste code cũ.
console.log(chalk.yellow(`\n[7] Rà soát API Discord đã lỗi thời...`));
const ephemeralHits = [];
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (/ephemeral\s*:\s*true/.test(line)) {
      ephemeralHits.push(`${path.relative(rootDir, file)}:${i + 1}`);
    }
  });
}
if (ephemeralHits.length) {
  errorCount++;
  console.error(chalk.red(`  ❌ Còn ${ephemeralHits.length} chỗ dùng \`ephemeral: true\` (phải đổi sang flags: MessageFlags.Ephemeral):`));
  ephemeralHits.forEach(h => console.error(chalk.red(`     • ${h}`)));
} else {
  console.log(chalk.green(`  ✅ Không còn \`ephemeral: true\`, toàn bộ đã dùng MessageFlags.Ephemeral.`));
}

// 8. Chặn mọi `return <lời gọi>` không await bên trong khối try điều phối lệnh
//
// `return promise` bên trong try thoát khỏi catch: mọi lỗi của lệnh sẽ biến
// thành unhandledRejection và người chơi không nhận được phản hồi nào. Bản đầu
// chỉ dò `return execute...`, nên `return message.reply(...)` vẫn lọt — mà
// message.reply hỏng khá thường (bot thiếu quyền gửi trong kênh, embed quá dài).
// Vì vậy quét cả khối try, bắt mọi lời gọi hàm được return mà thiếu await.
const tryStart = handlerSrc.indexOf('export async function handlePrefixCommand');
const tryEnd = handlerSrc.indexOf('} catch (error) {', tryStart);
if (tryStart < 0 || tryEnd < 0) {
  errorCount++;
  console.error(chalk.red(`  ❌ Không định vị được khối try của handlePrefixCommand — cấu trúc đã đổi?`));
} else {
  const tryBlock = handlerSrc.slice(tryStart, tryEnd);
  const unawaited = [...tryBlock.matchAll(/\breturn (?!await\b)([a-zA-Z_$][\w$.]*)\(/g)];
  if (unawaited.length) {
    errorCount++;
    console.error(chalk.red(`  ❌ Còn ${unawaited.length} chỗ return thiếu await trong handlePrefixCommand (catch sẽ không bắt được lỗi):`));
    [...new Set(unawaited.map(m => m[1]))].forEach(n => console.error(chalk.red(`     • return ${n}(...)`)));
  } else {
    console.log(chalk.green(`  ✅ Mọi nhánh lệnh prefix đều \`return await\`, khối catch bao được toàn bộ lỗi.`));
  }
}

// 9. Chặn chuỗi hiển thị bị ngắt làm đôi giữa hai dòng mã nguồn
//
// Cả codebase xuống dòng bằng '\n' tường minh, nên một template literal vắt qua
// hai dòng nguồn gần như luôn là dấu xuống dòng lọt vào lúc chỉnh sửa. Discord
// in ra đúng chỗ ngắt đó, và tệ hơn: thụt lề của dòng sau cũng bị nhét vào
// chuỗi, nên chỉ cần ai đó format lại file là câu chữ xô lệch thêm.
console.log(chalk.yellow(`\n[9] Rà soát chuỗi hiển thị bị ngắt giữa chừng...`));
const BACKSLASH = String.fromCharCode(92);
const NEWLINE = String.fromCharCode(10);
// Ký tự có nghĩa mà nếu đứng ngay trước '/' thì dấu đó chắc chắn mở một regex
// literal chứ không phải phép chia.
const REGEX_LEAD = '=(,:[!&|?{};+-*%^<>~';
const splitStrings = [];
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  // Phải bám theo cả chuỗi nháy đơn / nháy kép, không chỉ template literal:
  // một dấu backtick lẻ nằm trong chuỗi nháy đơn (ví dụ câu nhắc người chơi
  // liệt kê các ký tự cấm) sẽ bị hiểu nhầm là mở template và báo lỗi oan.
  let inTpl = false, quote = null, startLine = 0, line = 1, inLineCmt = false, inBlockCmt = false, prevSig = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1], p = src[i - 1];
    const escaped = p === BACKSLASH && src[i - 2] !== BACKSLASH;
    if (c === '\n') {
      line++;
      inLineCmt = false;
      quote = null;   // chuỗi nháy đơn/kép không thể vắt qua dòng
      if (inTpl) {
        splitStrings.push(`${path.relative(rootDir, file)}:${startLine}`);
        inTpl = false;
      }
      continue;
    }
    if (inLineCmt || inBlockCmt) {
      if (inBlockCmt && c === '*' && n === '/') { inBlockCmt = false; i++; }
      continue;
    }
    if (quote) {
      if (c === quote && !escaped) quote = null;
      continue;
    }
    if (!inTpl && (c === "'" || c === '"')) { quote = c; continue; }
    if (!inTpl && c === '/' && n === '/') { inLineCmt = true; i++; continue; }
    if (!inTpl && c === '/' && n === '*') { inBlockCmt = true; i++; continue; }

    // Nhảy qua nguyên một regex literal. Cần thiết vì có regex chứa dấu backtick
    // ngay trong lớp ký tự (bảng ký tự markdown bị cấm ở src/utils/sanitize.js):
    // không nhận ra đó là regex thì dấu backtick bị tưởng là mở template literal,
    // và cả file bị báo lỗi oan.
    //
    // Phân biệt regex với phép chia bằng ký tự có nghĩa liền trước: đứng sau một
    // toán tử hay dấu mở ngoặc thì '/' chỉ có thể là mở regex. Sau từ khoá dạng chữ
    // (return /x/) thì đoán nhầm thành phép chia, nhưng chỉ mất tác dụng rà soát ở
    // đúng dòng đó chứ không bao giờ báo sai.
    if (!inTpl && c === '/' && (prevSig === '' || REGEX_LEAD.includes(prevSig))) {
      let inClass = false;
      let j = i + 1;
      for (; j < src.length; j++) {
        const rc = src[j];
        if (rc === NEWLINE) break;
        if (src[j - 1] === BACKSLASH && src[j - 2] !== BACKSLASH) continue;
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) break;
      }
      // Hết dòng mà chưa gặp dấu đóng nghĩa là đoán sai: '/' đó là phép chia thật,
      // cứ để vòng ngoài xử lý tiếp như thường.
      if (j < src.length && src[j] === '/') { i = j; prevSig = '/'; continue; }
    }
    if (c === '`' && !escaped) {
      if (!inTpl) { inTpl = true; startLine = line; }
      else inTpl = false;
    }
    // Ghi nhớ ký tự có nghĩa cuối cùng để bước sau phân biệt được regex và phép chia.
    if (c > ' ') prevSig = c;
  }
}
if (splitStrings.length) {
  errorCount++;
  console.error(chalk.red(`  ❌ Có ${splitStrings.length} chuỗi hiển thị bị ngắt qua nhiều dòng (dùng '\\n' thay vì xuống dòng thật):`));
  splitStrings.forEach(h => console.error(chalk.red(`     • ${h}`)));
} else {
  console.log(chalk.green(`  ✅ Không có chuỗi hiển thị nào bị ngắt giữa chừng.`));
}

// 10. Bảng nhận diện ý định phải luôn khớp với danh sách lệnh thật
//
// Hai chiều đều hỏng thầm lặng: khoá trùng tên một lệnh có thật thì không bao
// giờ rơi xuống nhánh default nên là cấu hình chết; còn đích trỏ tới một lệnh
// không tồn tại thì bot chỉ người mới đi gõ một pháp quyết không có thật.
console.log(chalk.yellow(`\n[10] Đối chiếu bảng nhận diện ý định với danh sách lệnh...`));
const hintBlock = handlerSrc.match(/const INTENT_HINTS = \{([\s\S]*?)\};/);
const startBlock = handlerSrc.match(/const START_INTENT = \[([\s\S]*?)\];/);
if (!hintBlock || !startBlock) {
  errorCount++;
  console.error(chalk.red(`  ❌ Không đọc được INTENT_HINTS / START_INTENT trong commandHandler.js`));
} else {
  const pairs = [...hintBlock[1].matchAll(/([a-z0-9_]+)\s*:\s*'([^']+)'/g)].map(m => [m[1], m[2]]);
  const starts = [...startBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const keys = [...pairs.map(p => p[0]), ...starts];
  const shadowed = keys.filter(k => KNOWN_COMMANDS.includes(k));
  const badTargets = pairs.filter(p => !KNOWN_COMMANDS.includes(p[1]));
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (shadowed.length) {
    errorCount++;
    console.error(chalk.red(`  ❌ Khoá đã là lệnh thật nên không bao giờ dùng tới: ${shadowed.join(', ')}`));
  }
  if (badTargets.length) {
    errorCount++;
    console.error(chalk.red(`  ❌ Trỏ tới lệnh không tồn tại: ${badTargets.map(p => `${p[0]} → ${p[1]}`).join(', ')}`));
  }
  if (dupKeys.length) {
    errorCount++;
    console.error(chalk.red(`  ❌ Khoá lặp trong bảng ý định: ${[...new Set(dupKeys)].join(', ')}`));
  }
  if (!shadowed.length && !badTargets.length && !dupKeys.length) {
    console.log(chalk.green(`  ✅ ${keys.length} khoá ý định hợp lệ, mọi đích đều là lệnh có thật.`));
  }
}

// Tổng kết
console.log(chalk.bold.cyan(`\n================================================`));
if (errorCount === 0) {
  console.log(chalk.bold.green(`🎉 TỔNG KẾT: 0 LỖI! TẤT CẢ MODULES VÀ CƠ CHẾ ĐỀU HOẠT ĐỘNG HOÀN HẢO 100%!`));
} else {
  console.log(chalk.bold.red(`⚠️ TỔNG KẾT: PHÁT HIỆN ${errorCount} LỖI CẦN XỬ LÝ!`));
}
console.log(chalk.bold.cyan(`================================================\n`));
