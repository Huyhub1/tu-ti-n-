/**
 * KIỂM THỬ LỰC CHIẾN, NÚT LÀM LẠI VÀ NHÃN HỒI CHIÊU
 *
 * Ba thứ mới của bản phát hành đầu, gom chung vì đều là loại lỗi không làm bot
 * sập mà chỉ làm người chơi mất niềm tin:
 *
 *  · Lực Chiến — giờ là con số xếp hạng chính ở !top. Cái bẫy đã từng sập là
 *    cộng chỉ số pháp bảo hai lần: trang bị lúc mặc đã cộng thẳng vào
 *    user.stats, nên nếu bảng xếp hạng còn duyệt equipments cộng thêm lần nữa
 *    thì ai đeo đồ cũng leo hạng ảo. Phép [1.3] khoá đúng chỗ đó.
 *  · Nút làm lại — customId sai một ký tự là nút chết câm, không báo lỗi.
 *  · Nhãn hồi chiêu — mốc thời gian hỏng sẽ in ra `<t:NaN:R>`, Discord hiện
 *    thành chuỗi thô ngay giữa embed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { battlePower } from '../src/utils/power.js';
import { getBattlePower } from '../src/services/pvpService.js';
import {
  REPEAT_ACTIONS,
  REPEAT_ID_PREFIX,
  repeatCustomId,
  parseRepeatId,
  repeatRow
} from '../src/utils/repeatButton.js';
import { COOLDOWNS, readyAtTag, cooldownLine } from '../src/utils/cooldown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

function eq(got, want, label) {
  if (got === want) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label} — nhận ${JSON.stringify(got)}, mong đợi ${JSON.stringify(want)}`); }
}

function fakeUser(stats = {}, over = {}) {
  return {
    userId: '123456789012345678',
    stats: { atk: 15, def: 8, maxHp: 100, critRate: 0.05, ...stats },
    equipments: [],
    ...over
  };
}

console.log('\n⚡ KIỂM THỬ LỰC CHIẾN / NÚT LÀM LẠI / NHÃN HỒI CHIÊU\n');

// ── [1] Lực Chiến ───────────────────────────────────────────────────────────
console.log('[1] battlePower:');

// 15*4 + 8*3 + 100*0.5 + 0.05*1000 = 60 + 24 + 50 + 50 = 184
eq(battlePower(fakeUser()), 184, 'tu sĩ khởi đầu ra đúng 184 điểm theo trọng số công bố');
eq(battlePower({}), 0, 'tu sĩ không có stats ra 0 chứ không phải NaN');
eq(battlePower(null), 0, 'null ra 0 chứ không ném lỗi');
eq(battlePower({ stats: {} }), 0, 'stats rỗng ra 0');
ok(Number.isInteger(battlePower(fakeUser({ maxHp: 101 }))), 'luôn trả về số nguyên (không có phần thập phân lọt ra bảng xếp hạng)');

// [1.3] Chốt chặn quan trọng nhất của cả file này.
const gearStats = { atk: 500, def: 300, maxHp: 2000, critRate: 0.2 };
const trangTay = fakeUser({ atk: 515, def: 308, maxHp: 2100, critRate: 0.25 });
const deoDo = fakeUser({ atk: 515, def: 308, maxHp: 2100, critRate: 0.25 }, {
  equipments: [
    { gearId: 'g1', equipped: true, stats: gearStats },
    { gearId: 'g2', equipped: true, stats: gearStats }
  ]
});
eq(battlePower(deoDo), battlePower(trangTay),
   'hai tu sĩ cùng user.stats thì cùng Lực Chiến, dù một người đeo 2 pháp bảo (không cộng đồ hai lần)');

const chuaMac = fakeUser({}, { equipments: [{ gearId: 'g1', equipped: false, stats: gearStats }] });
eq(battlePower(chuaMac), battlePower(fakeUser()), 'pháp bảo để trong kho không làm đổi Lực Chiến');

// Đơn điệu: mạnh hơn ở bất kỳ chỉ số nào cũng phải xếp trên.
ok(battlePower(fakeUser({ atk: 16 })) > battlePower(fakeUser()), 'thêm ATK thì Lực Chiến tăng');
ok(battlePower(fakeUser({ def: 9 })) > battlePower(fakeUser()), 'thêm DEF thì Lực Chiến tăng');
ok(battlePower(fakeUser({ maxHp: 102 })) > battlePower(fakeUser()), 'thêm Máu thì Lực Chiến tăng');
ok(battlePower(fakeUser({ critRate: 0.06 })) > battlePower(fakeUser()), 'thêm Bạo Kích thì Lực Chiến tăng');

// Trọng số phải xếp công > thủ: đây là điều người chơi ngầm hiểu khi nhìn số.
const themCong = battlePower(fakeUser({ atk: 115 })) - battlePower(fakeUser());
const themThu = battlePower(fakeUser({ def: 108 })) - battlePower(fakeUser());
ok(themCong > themThu, `100 ATK (+${themCong}) đáng giá hơn 100 DEF (+${themThu})`);

// [1.4] Khung tỉ võ và bảng xếp hạng phải đọc chung một công thức. Trước đây
// pvpService giữ một bản sao riêng, chỉ cần một bên đổi trọng số là hai màn
// hình hiện hai con số khác nhau cho cùng một người.
const mau = [
  fakeUser(),
  fakeUser({ atk: 900, def: 400, maxHp: 12000, critRate: 0.33 }),
  fakeUser({ atk: 0, def: 0, maxHp: 1, critRate: 0 })
];
eq(mau.filter(u => getBattlePower(u) !== battlePower(u)).length, 0,
   'pvpService.getBattlePower cho cùng kết quả với utils/power.js trên mọi mẫu');

// ── [2] Nút làm lại ─────────────────────────────────────────────────────────
console.log('\n[2] repeatButton:');
const ACTIONS = Object.keys(REPEAT_ACTIONS);
eq(ACTIONS.length, 4, `có đủ 4 hành động lặp (${ACTIONS.join(', ')})`);

const SNOWFLAKE = '123456789012345678';
for (const a of ACTIONS) {
  const id = repeatCustomId(a, SNOWFLAKE);
  const parsed = parseRepeatId(id);
  ok(parsed && parsed.action === a && parsed.userId === SNOWFLAKE, `[${a}] customId đi và về nguyên vẹn`);
  // Discord cắt cụt customId dài quá 100 ký tự -> nút chết câm không báo lỗi.
  ok(id.length <= 100, `[${a}] customId dài ${id.length} ký tự, dưới trần 100 của Discord`);
}

eq(parseRepeatId('btn_start_hunt_123'), null, 'customId của nút khác không bị nhận nhầm');
eq(parseRepeatId(REPEAT_ID_PREFIX + 'khong_co_that::' + SNOWFLAKE), null, 'hành động không có trong bảng thì từ chối');
eq(parseRepeatId(REPEAT_ID_PREFIX + 'tuluyen'), null, 'thiếu userId thì từ chối');
eq(parseRepeatId(REPEAT_ID_PREFIX + 'tuluyen::a::b'), null, 'thừa đoạn thì từ chối');
eq(parseRepeatId(''), null, 'chuỗi rỗng thì từ chối');
eq(parseRepeatId(null), null, 'null thì từ chối chứ không ném lỗi');
eq(parseRepeatId(undefined), null, 'undefined thì từ chối chứ không ném lỗi');

eq(repeatRow('khong_co_that', SNOWFLAKE).length, 0, 'hành động lạ thì không dựng hàng nút nào');
eq(repeatRow('tuluyen', '').length, 0, 'thiếu userId thì không dựng hàng nút nào');
eq(repeatRow('tuluyen', SNOWFLAKE).length, 1, 'hành động hợp lệ dựng đúng 1 hàng nút');
eq(repeatRow('tuluyen', SNOWFLAKE)[0].components.length, 1, 'hàng đó có đúng 1 nút');

// Mỗi hành động có nút thì phải có hàm dựng màn hình tương ứng, nếu không thì
// bấm vào chỉ nhận được "Nút đã cũ" — lỗi câm, không log, không ai biết.
const handlerSrc = fs.readFileSync(path.join(__dirname, '../src/handlers/buttonHandler.js'), 'utf8');
const builderBlock = handlerSrc.slice(handlerSrc.indexOf('const REPEAT_BUILDERS'), handlerSrc.indexOf('const REPEAT_BUILDERS') + 400);
const thieuBuilder = ACTIONS.filter(a => !new RegExp(`\\b${a}\\s*:`).test(builderBlock));
eq(thieuBuilder.length, 0, `mọi hành động đều có hàm dựng màn hình trong REPEAT_BUILDERS${thieuBuilder.length ? ` (thiếu: ${thieuBuilder})` : ''}`);

// ── [3] Nhãn hồi chiêu ──────────────────────────────────────────────────────
console.log('\n[3] readyAtTag / cooldownLine:');
const TAG = /^<t:(\d+):R>$/;
const moc = new Date('2026-01-01T00:00:00Z');
const mocSec = Math.floor(moc.getTime() / 1000);

const tag = readyAtTag('cultivate', moc);
ok(TAG.test(tag), `sinh đúng định dạng mốc thời gian động của Discord (${tag})`);
eq(Number(tag.match(TAG)[1]), mocSec + COOLDOWNS.cultivate, 'giây trong nhãn = mốc bắt đầu + đúng thời gian hồi chiêu');

// Document .lean() hoặc dữ liệu cũ trả về chuỗi thay vì Date.
ok(TAG.test(readyAtTag('cultivate', '2026-01-01T00:00:00Z')), 'mốc dạng chuỗi vẫn ra nhãn hợp lệ');
ok(TAG.test(readyAtTag('cultivate', new Date('khong-phai-ngay'))), 'mốc hỏng vẫn ra nhãn hợp lệ, không lọt <t:NaN:R>');
ok(TAG.test(readyAtTag('cultivate', null)), 'mốc null vẫn ra nhãn hợp lệ');
ok(TAG.test(readyAtTag('khong_co_khoa_nay', moc)), 'khoá hồi chiêu lạ vẫn ra nhãn hợp lệ');

const xau = ['<t:NaN:R>', 'NaN', 'undefined', 'Invalid Date'];
const khoaLoi = Object.keys(COOLDOWNS).filter(k => {
  const line = cooldownLine(k, moc);
  return !TAG.test(line.match(/<t:\d+:R>/) || '') || xau.some(x => line.includes(x));
});
eq(khoaLoi.length, 0, `cả ${Object.keys(COOLDOWNS).length} khoá hồi chiêu đều in ra dòng sạch, không có NaN`);

const line = cooldownLine('mining', moc, 'Cược tối đa 1.000 LT');
ok(line.includes('Hồi chiêu'), 'dòng hồi chiêu có chữ dẫn');
ok(line.includes(`<t:${mocSec + COOLDOWNS.mining}:R>`), 'dòng hồi chiêu nhúng đúng mốc sẵn sàng');
ok(line.includes('Cược tối đa 1.000 LT'), 'phần chú thích thêm được giữ nguyên');
ok(!cooldownLine('mining', moc).endsWith('· '), 'không có chú thích thì không để lại dấu chấm giữa lủng lẳng');

console.log('\n======================================================');
if (fail === 0) {
  console.log(`🎉 HOÀN TẤT: ${pass}/${pass} phép kiểm thử đều đúng.`);
} else {
  console.error(`⚠️ THẤT BẠI: ${fail} phép sai trên tổng ${pass + fail}.`);
}
console.log('======================================================\n');

process.exit(fail === 0 ? 0 : 1);
