/**
 * KIỂM THỬ NGÃ RẼ ĐẠI ĐẠO VÀ CỬA CẢNH BÁO ĐỘT PHÁ
 *
 * File này sinh ra từ một lỗi chặn đứng cả game: hai nút của màn hình ngã rẽ
 * Luyện Khí Đỉnh Phong (`btn_break_trucco_*`, `btn_break_nenkhi_*`) được vẽ ra
 * nhưng KHÔNG có ai xử lý. `!dotpha` ở Đỉnh Phong luôn trả về cái menu ấy, bấm
 * nút thì Discord báo "interaction failed", `attemptBreakthrough` không bao giờ
 * chạy tới, và `isLuyenKhiVanTang` thì chẳng chỗ nào trong `src/` đặt thành
 * true. Nghĩa là không một người chơi nào vượt nổi đại cảnh giới đầu tiên.
 *
 * Ba nhóm phép kiểm ở đây khoá ba thứ dễ vỡ lại:
 *
 *  · [1] `sapDanhCuocDotPha` phải soi ĐÚNG nhánh có tung xúc xắc trong
 *    `attemptBreakthrough`. Doạ nhầm ở một lượt chắc thắng còn hại hơn im lặng:
 *    người chơi sẽ ngồi ôm EXP đầy mà không dám bấm.
 *  · [2] Con số tỉ lệ khoe trên màn hình phải là con số thật sự được tung.
 *    Trước đây hai chỗ chép tay cùng phép tính nên rất dễ lệch.
 *  · [3] Bấm nút xong phải thật sự đi tiếp — cả hai nhánh, cả thắng lẫn bại.
 */

import {
  attemptBreakthrough,
  sapDanhCuocDotPha,
  tiLeDotPhaThucTe,
  calculateUserMaxExp,
  nhanhNenKhiDangMo,
  getRealmById
} from '../src/services/cultivationService.js';
import { dangDungTruocNgaRe, buildNgaReView } from '../src/commands/prefix/cultivate.js';
import { demHoMachDan } from '../src/utils/hoMachDan.js';

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

/** Nhân vật giả lập, không đụng tới MongoDB. */
function fakeUser({ id = 'luyen_khi', layer = 1, day = true, vanTang = false, faction = null, tui = [], buff = 0 } = {}) {
  const u = {
    userId: '123456789012345678',
    username: 'ĐạoHữuThử',
    faction,
    isLuyenKhiVanTang: vanTang,
    breakthroughBuff: buff,
    inventory: tui,
    talent: null,
    stats: { hp: 100, maxHp: 100, mp: 50, maxMp: 50, atk: 10, def: 5, luck: 10, critRate: 0.05 },
    realm: { id, layer, exp: 0, maxExp: 100, name: 'Thử Nghiệm' }
  };
  u.realm.maxExp = calculateUserMaxExp(u, id, layer, vanTang);
  u.realm.exp = day ? u.realm.maxExp : 0;
  return u;
}

const MOT_VIEN = () => [{ itemId: 'ho_mach_dan', name: 'Hộ Mạch Đan', type: 'DAN_DUOC', quantity: 1 }];

/** Ép xúc xắc về một phía rồi trả lại nguyên trạng — tránh test lúc đỏ lúc đen. */
function voiXucXac(giaTri, fn) {
  const goc = Math.random;
  Math.random = () => giaTri;
  try { return fn(); } finally { Math.random = goc; }
}

console.log('\n[1] sapDanhCuocDotPha — chỉ bật đúng lượt có tung xúc xắc:');
ok(sapDanhCuocDotPha(fakeUser({ layer: 1 })) === false, 'Luyện Khí tầng 1 đầy EXP → chỉ lên tiểu cảnh giới, KHÔNG cược');
ok(sapDanhCuocDotPha(fakeUser({ layer: 3 })) === false, 'Luyện Khí tầng 3 đầy EXP → KHÔNG cược');
ok(sapDanhCuocDotPha(fakeUser({ layer: 4, day: false })) === false, 'Đỉnh Phong nhưng chưa đầy EXP → KHÔNG cược');
ok(sapDanhCuocDotPha(fakeUser({ layer: 4 })) === true, 'Luyện Khí Đỉnh Phong đầy EXP → CÓ cược');
ok(sapDanhCuocDotPha(fakeUser({ layer: 7, vanTang: true })) === false, 'Nén Khí Vạn Tầng → chắc thắng, KHÔNG cược');
ok(sapDanhCuocDotPha(fakeUser({ id: 'truc_co', layer: 4 })) === true, 'Trúc Cơ Đỉnh Phong → CÓ cược');
ok(sapDanhCuocDotPha(fakeUser({ id: 'kim_dan', layer: 4 })) === false, 'Kim Đan Đỉnh Phong → bị đá sang !dokiep, !dotpha KHÔNG cược');
ok(sapDanhCuocDotPha(fakeUser({ id: 'nguyen_anh', layer: 4 })) === false, 'Nguyên Anh Đỉnh Phong → hết nội dung bản này, KHÔNG cược');
ok(sapDanhCuocDotPha(fakeUser({ id: 'pham_nhan', layer: 1 })) === false, 'Phàm Nhân → tỉ lệ 1.0, chắc thắng, KHÔNG cược');
ok(sapDanhCuocDotPha({}) === false, 'Nhân vật rỗng không làm hàm nổ');

console.log('\n[2] tiLeDotPhaThucTe — số khoe ra phải là số thật:');
eq(Math.round(tiLeDotPhaThucTe(fakeUser({ layer: 4 })) * 100), 60, 'Luyện Khí trần trụi = 60%');
eq(Math.round(tiLeDotPhaThucTe(fakeUser({ layer: 4, faction: 'CHINH_DAO' })) * 100), 75, 'Chính Đạo (+25% tương đối) = 75%');
eq(Math.round(tiLeDotPhaThucTe(fakeUser({ id: 'nguyen_anh', layer: 4 })) * 100), 25, 'Nguyên Anh = 25%');
eq(Math.round(tiLeDotPhaThucTe(fakeUser({ layer: 4, buff: 0.5 })) * 100), 90, 'Trúc Cơ Đan (+50% tương đối) = 90%');
ok(tiLeDotPhaThucTe(fakeUser({ id: 'truc_co', layer: 4, faction: 'CHINH_DAO', buff: 1 })) <= 0.95, 'Trần 95% chặn được buff chồng buff');
// Config ghi 1.0 là cố ý cho chắc thắng. Kẹp xuống 0.95 nghĩa là tân thủ có 5%
// ăn nguyên thông báo "BỊ CẮN TRẢ TỤT TU VI" ngay lần đột phá đầu đời.
eq(tiLeDotPhaThucTe(fakeUser({ id: 'pham_nhan', layer: 1 })), 1, 'Phàm Nhân giữ đúng 1.0, không bị trần 0.95 kẹp xuống');
{
  const u = fakeUser({ layer: 4, buff: 0.5 });
  const lan1 = tiLeDotPhaThucTe(u);
  const lan2 = tiLeDotPhaThucTe(u);
  ok(lan1 === lan2 && u.breakthroughBuff === 0.5, 'Xem tỉ lệ KHÔNG tiêu mất Trúc Cơ Đan');
}
{
  // Chốt chặn quan trọng nhất: số hiển thị và số được tung phải là một.
  const u = fakeUser({ layer: 4, faction: 'CHINH_DAO' });
  const khoe = tiLeDotPhaThucTe(u);
  ok(voiXucXac(khoe - 0.001, () => attemptBreakthrough(fakeUser({ layer: 4, faction: 'CHINH_DAO' })).success) === true,
    'Tung ngay dưới ngưỡng khoe ra → thắng');
  ok(voiXucXac(khoe + 0.001, () => attemptBreakthrough(fakeUser({ layer: 4, faction: 'CHINH_DAO' })).success) === false,
    'Tung ngay trên ngưỡng khoe ra → thua');
}
{
  const u = fakeUser({ layer: 4, buff: 0.5 });
  voiXucXac(0, () => attemptBreakthrough(u));
  eq(u.breakthroughBuff, 0, 'Trúc Cơ Đan bị tiêu ngay cả khi đột phá THÀNH CÔNG');
}

/**
 * Tạm mở/đóng nhánh Nén Khí rồi trả lại nguyên trạng.
 *
 * `getRealmsConfig` trả về đúng đối tượng đã nạp một lần lúc import, nên sửa
 * thẳng trên đó là đủ — không cần ghi đè file config rồi lo dọn.
 */
function voiNhanhNenKhi(mo, fn) {
  const luyenKhi = getRealmById('luyen_khi');
  const goc = luyenKhi.compressBranchOpen;
  luyenKhi.compressBranchOpen = mo;
  try { return fn(); } finally { luyenKhi.compressBranchOpen = goc; }
}

console.log('\n[3] Ngã rẽ Luyện Khí Đỉnh Phong — v1.0 ĐÓNG nhánh Nén Khí:');
// Nhánh Nén Khí khoá vĩnh viễn nhân vật vào `realm.id = 'luyen_khi'`, mà cả
// `powerRank` lẫn `baseExpGain` đều tra theo id đó — lý do đầy đủ ghi ở
// `nhanhNenKhiDangMo`. v1.0 đóng cửa vào; mấy phép thử dưới đây canh cho nó
// đóng thật, và canh cho người đã trót ở trong vẫn đi tiếp được.
ok(nhanhNenKhiDangMo() === false, 'Cấu hình phát hành: nhánh Nén Khí đang ĐÓNG');
ok(dangDungTruocNgaRe(fakeUser({ layer: 4 })) === false, 'Đỉnh Phong đầy EXP → KHÔNG hiện màn hình chọn nhánh nữa');
ok(sapDanhCuocDotPha(fakeUser({ layer: 4 })) === true, 'Thay vào đó `!dotpha` đi thẳng vào cửa đánh cược Trúc Cơ');

{
  // Đóng cửa vào mà làm kẹt luôn người đang ở trong nhánh thì còn tệ hơn.
  const u = fakeUser({ layer: 10, vanTang: true });
  ok(sapDanhCuocDotPha(u) === false, 'Người đã ở trong nhánh Nén Khí: vẫn KHÔNG bị bắt đánh cược');
  const r = attemptBreakthrough(u);
  ok(r.success === true, 'Người đã ở trong nhánh Nén Khí: vẫn đột phá tiếp được');
  eq(u.realm.layer, 11, 'Người đã ở trong nhánh Nén Khí: vẫn lên tầng bình thường');
}

// Thiếu cờ trong config (bản cũ, hoặc ai đó xoá tay) thì phải coi như MỞ —
// mặc định im lặng đóng một nhánh nội dung là kiểu hỏng khó lần ra nhất.
ok(voiNhanhNenKhi(undefined, () => nhanhNenKhiDangMo()) === true, 'Config thiếu cờ → mặc định coi như mở');
ok(voiNhanhNenKhi(true, () => nhanhNenKhiDangMo()) === true, 'Đổi cờ thành true → mở lại được (đường ra cho v1.1)');

console.log('\n[3b] Màn hình ngã rẽ vẫn đúng cho ngày v1.1 mở lại:');
// Màn hình bị treo lại suốt một phiên bản là thứ dễ mục nhất: không ai nhìn
// thấy nên không ai phát hiện nó hỏng. Mấy phép thử này giữ nó sống.
voiNhanhNenKhi(true, () => {
  ok(dangDungTruocNgaRe(fakeUser({ layer: 4 })) === true, 'Mở lại → Đỉnh Phong đầy EXP hiện ngã rẽ');
  ok(dangDungTruocNgaRe(fakeUser({ layer: 4, vanTang: true })) === false, 'Đã chọn Nén Khí → không hiện lại');
  ok(dangDungTruocNgaRe(fakeUser({ layer: 4, day: false })) === false, 'Chưa đầy EXP → không hiện');
  ok(dangDungTruocNgaRe(fakeUser({ id: 'truc_co', layer: 4 })) === false, 'Trúc Cơ → không có ngã rẽ');
  ok(dangDungTruocNgaRe({}) === false, 'Nhân vật rỗng không làm hàm nổ');

  const v = buildNgaReView(fakeUser({ layer: 4 }));
  const ids = v.components[0].components.map(c => c.data.custom_id);
  // Sai một ký tự trong customId là nút chết câm mà không báo lỗi gì cả.
  ok(ids.includes('btn_break_trucco_123456789012345678'), 'Nút Trúc Cơ đúng customId');
  ok(ids.includes('btn_break_nenkhi_123456789012345678'), 'Nút Nén Khí đúng customId');
  const moTa = v.embeds[0].data.description;
  ok(moTa.includes('60%'), 'Có in tỉ lệ thành công thật của nhánh Trúc Cơ');
  ok(moTa.includes('VĨNH VIỄN'), 'Có nói rõ chọn Nén Khí là một chiều');
  const oCanhBao = (v.embeds[0].data.fields || []).map(f => f.name).join('|');
  ok(oCanhBao.includes('Hộ Mạch Đan'), 'Tay không → có ô cảnh báo Hộ Mạch Đan');

  const v2 = buildNgaReView(fakeUser({ layer: 4, tui: MOT_VIEN() }));
  eq((v2.embeds[0].data.fields || []).length, 0, 'Có đan trong túi → không cằn nhằn nữa');

  const v3 = buildNgaReView(fakeUser({ layer: 4, faction: 'CHINH_DAO' }));
  ok(v3.embeds[0].data.description.includes('75%'), 'Buff trận doanh được phản ánh vào màn hình ngã rẽ');
});

console.log('\n[4] Bấm nút xong có thật sự đi tiếp không:');
{
  // Nhánh Nén Khí — đúng thứ tự mà buttonHandler làm: đặt cờ rồi đột phá.
  const u = fakeUser({ layer: 4 });
  u.isLuyenKhiVanTang = true;
  const r = attemptBreakthrough(u);
  ok(r.success === true, 'Nén Khí: đột phá thành công');
  eq(u.realm.layer, 5, 'Nén Khí: lên Luyện Khí Tầng 5');
  ok(u.realm.maxExp > 0 && u.realm.exp === 0, 'Nén Khí: vạch tu vi mới được tính lại');
  ok(dangDungTruocNgaRe(u) === false, 'Nén Khí: ngã rẽ đóng lại vĩnh viễn');
}
{
  const u = voiXucXac(0, () => { const x = fakeUser({ layer: 4 }); attemptBreakthrough(x); return x; });
  eq(u.realm.id, 'truc_co', 'Trúc Cơ (thắng): sang Trúc Cơ Sơ Kỳ');
  eq(u.realm.layer, 1, 'Trúc Cơ (thắng): về tầng 1 của cảnh giới mới');
}
{
  const u = voiXucXac(0.999, () => { const x = fakeUser({ layer: 4 }); attemptBreakthrough(x); return x; });
  eq(u.realm.id, 'luyen_khi', 'Trúc Cơ (thua tay không): vẫn ở Luyện Khí');
  eq(u.realm.layer, 3, 'Trúc Cơ (thua tay không): tụt xuống tầng 3');
}
{
  const u = voiXucXac(0.999, () => {
    const x = fakeUser({ layer: 4, tui: [{ itemId: 'ho_mach_dan', name: 'Hộ Mạch Đan', type: 'DAN_DUOC', quantity: 2 }] });
    attemptBreakthrough(x);
    return x;
  });
  eq(demHoMachDan(u), 1, 'Trúc Cơ (thua có đan): tiêu đúng 1 viên');
  eq(u.realm.layer, 4, 'Trúc Cơ (thua có đan): giữ nguyên Đỉnh Phong');
}
{
  // Ô còn nằm lại với số lượng 0 là chuyện có thật trong dữ liệu cũ.
  const u = fakeUser({ layer: 4, tui: [{ itemId: 'ho_mach_dan', name: 'Hộ Mạch Đan', type: 'DAN_DUOC', quantity: 0 }] });
  eq(demHoMachDan(u), 0, 'Ô rỗng số lượng 0 vẫn tính là KHÔNG có đan');
  ok((buildNgaReView(u).embeds[0].data.fields || []).length === 1, 'Ô rỗng vẫn được cảnh báo');
}
{
  // Tân thủ xui nhất vẫn phải vào được Luyện Khí, không thì ngay bài học đầu
  // tiên đã ăn một thông báo đỏ lòm chẳng hiểu vì sao.
  const u = voiXucXac(0.999, () => { const x = fakeUser({ id: 'pham_nhan', layer: 1 }); attemptBreakthrough(x); return x; });
  eq(u.realm.id, 'luyen_khi', 'Tân thủ xui nhất vẫn vào được Luyện Khí');
}

console.log('\n======================================================');
if (fail === 0) {
  console.log(`🎉 HOÀN TẤT: ${pass}/${pass} phép kiểm thử đều đúng.`);
} else {
  console.error(`⚠️ THẤT BẠI: ${fail} phép sai trên tổng ${pass + fail}.`);
}
console.log('======================================================\n');

process.exit(fail === 0 ? 0 : 1);
