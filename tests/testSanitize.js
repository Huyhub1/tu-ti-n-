/**
 * KIỂM THỬ KIỂM DUYỆT TÊN TÔNG MÔN
 *
 * Tên bang là chuỗi tự do duy nhất trong game được hiện lại cho người khác đọc,
 * nên nó cũng là lối vào duy nhất để phá server: `!laptongmon @everyone`, tên
 * dài 2000 ký tự làm vỡ embed, ký tự vô hình tạo hai bang trông y hệt nhau.
 * Bộ kiểm thử này khoá lại từng biến thể để không ai vô tình nới lỏng về sau.
 */

import { validateSectName, exactNameRegex, SECT_NAME_MAX } from '../src/utils/sanitize.js';

const ZWSP = String.fromCharCode(0x200B);   // khoảng trắng độ rộng 0
const RLO = String.fromCharCode(0x202E);    // ký tự lật ngược chiều đọc chữ
const NUL = String.fromCharCode(0x00);

let pass = 0;
let fail = 0;

function reject(input, label) {
  const r = validateSectName(input);
  if (r.ok) {
    fail++;
    console.error(`  ❌ ${label}: lẽ ra phải chặn, nhưng lại nhận "${r.value}"`);
  } else {
    pass++;
    console.log(`  ✅ ${label}`);
  }
}

function accept(input, expected, label) {
  const r = validateSectName(input);
  if (!r.ok) {
    fail++;
    console.error(`  ❌ ${label}: lẽ ra phải nhận, nhưng bị chặn (${r.reason})`);
  } else if (r.value !== expected) {
    fail++;
    console.error(`  ❌ ${label}: chuẩn hoá ra "${r.value}", mong đợi "${expected}"`);
  } else {
    pass++;
    console.log(`  ✅ ${label}`);
  }
}

console.log('\n🛡️  KIỂM THỬ KIỂM DUYỆT TÊN TÔNG MÔN\n');

console.log('[1] Chặn lời gọi toàn server:');
reject('@everyone', '@everyone');
reject('@here', '@here');
reject('@ everyone', '@ everyone (có dấu cách chen giữa)');
reject('@' + ZWSP + 'everyone', '@everyone (có ký tự vô hình chen giữa)');
reject('<@123456789012345678>', 'mention người dùng thô');
reject('<@&987654321098765432>', 'mention role thô');
reject('Ma Cung @everyone', '@everyone nằm cuối tên');

console.log('\n[2] Chặn ký tự phá vỡ định dạng:');
reject('```js', 'khối code');
reject('Thái **Thượng**', 'in đậm');
reject('Ma_Cung_', 'gạch dưới');
reject('Ma~~Cung~~', 'gạch ngang');
reject('Ma|Cung', 'dấu gạch đứng');
reject('# Tiêu Đề', 'dấu thăng đầu dòng');

console.log('\n[3] Chặn ký tự ẩn và ký tự điều khiển:');
reject('Ma' + ZWSP + 'Cung', 'khoảng trắng độ rộng 0');
reject(RLO + 'nuC aM', 'ký tự lật chiều đọc chữ');
reject('Ma' + NUL + 'Cung', 'ký tự điều khiển NUL');

console.log('\n[4] Chặn độ dài không hợp lệ:');
reject('a', 'chỉ 1 ký tự');
reject('   ', 'toàn khoảng trắng');
reject('', 'chuỗi rỗng');
reject(null, 'null');
reject(undefined, 'undefined');
reject('x'.repeat(SECT_NAME_MAX + 1), `dài ${SECT_NAME_MAX + 1} ký tự`);

console.log('\n[5] Nhận tên hợp lệ và chuẩn hoá khoảng trắng:');
accept('Cửu U Ma Cung', 'Cửu U Ma Cung', 'tên tiếng Việt có dấu');
accept('Ma  Cung', 'Ma Cung', 'gộp khoảng trắng thừa');
accept('  Thanh Vân Môn  ', 'Thanh Vân Môn', 'cắt khoảng trắng hai đầu');
accept('Ma\nCung', 'Ma Cung', 'xuống dòng thành dấu cách');
accept('x'.repeat(SECT_NAME_MAX), 'x'.repeat(SECT_NAME_MAX), `đúng ${SECT_NAME_MAX} ký tự (biên trên)`);
accept('Bách Hoa Cốc 108', 'Bách Hoa Cốc 108', 'có chữ số');

console.log('\n[6] So trùng tên không phân biệt hoa thường:');
const dup = [
  [exactNameRegex('ma cung').test('Ma Cung'), true, '"ma cung" khớp "Ma Cung"'],
  [exactNameRegex('Ma Cung').test('Ma Cung Phái'), false, '"Ma Cung" KHÔNG khớp "Ma Cung Phái"'],
  // Nếu quên thoát ký tự đặc biệt thì một cái tên như ".*" sẽ khớp mọi tông môn
  // đang có, và từ đó về sau không ai lập được bang nào nữa.
  [exactNameRegex('.*').test('Bất Kỳ Tên Nào'), false, '".*" KHÔNG khớp mọi tên (đã thoát regex)'],
  [exactNameRegex('a+b').test('aaab'), false, '"a+b" KHÔNG khớp "aaab" (đã thoát regex)']
];
for (const [got, want, label] of dup) {
  if (got === want) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}: nhận ${got}, mong đợi ${want}`); }
}

console.log('\n======================================================');
if (fail === 0) {
  console.log(`🎉 HOÀN TẤT: ${pass}/${pass} phép kiểm duyệt đều đúng.`);
} else {
  console.error(`⚠️ THẤT BẠI: ${fail} phép sai trên tổng ${pass + fail}.`);
}
console.log('======================================================\n');

process.exit(fail === 0 ? 0 : 1);
