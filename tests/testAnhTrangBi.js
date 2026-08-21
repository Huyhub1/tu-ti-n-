/**
 * Kiểm thử ảnh trang bị — chế độ CHỈ DÙNG LINK.
 *
 * Bot không còn đính file ảnh từ đĩa nữa; mọi ảnh trang bị đi bằng `imageUrl`.
 * Đổi như vậy thì máy chủ nào cũng hiện ảnh như nhau, nhưng nó dời điểm gãy
 * sang chỗ khác: một món thiếu `imageUrl` là món đó vĩnh viễn không có ảnh, và
 * Discord không báo lỗi, log không ghi gì, chỉ có cái khung mô tả trống hình.
 *
 * Hỏng kiểu im lặng thì mắt người không canh nổi, nên để máy canh.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGearDetailEmbed } from '../src/commands/prefix/baovat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const doc = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const config = JSON.parse(doc('../src/config/equipment.json'));
const ds = config.equipments || [];

let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

// Món đã biết là chưa có link, chấp nhận tạm để còn phát hành.
//
// Viết tên ra đây chứ không nới lỏng phép kiểm: món nào KHÔNG nằm trong danh
// sách này mà thiếu link thì vẫn đỏ ngay. Cái thiếu hôm nay có chỗ nằm đàng
// hoàng, còn cái thiếu mai sau vẫn bị chặn.
const CHUA_CO_LINK = new Set(['an_tu_phuong_can_khon']);

console.log('\n[1] Mọi món trang bị đều phải có link ảnh:');
{
  ok(ds.length > 0, `Đọc được danh sách trang bị (${ds.length} món)`);

  const ngoaiDuKien = ds.filter(g => !g.imageUrl && !CHUA_CO_LINK.has(g.id));
  ok(ngoaiDuKien.length === 0, ngoaiDuKien.length === 0
    ? 'Không món nào thiếu link ngoài dự kiến'
    : `${ngoaiDuKien.length} món THIẾU LINK nên sẽ không bao giờ hiện ảnh: ${ngoaiDuKien.map(g => g.name || g.id).join(' | ')}`);

  // Danh sách ngoại lệ mà không ai dọn thì chính nó thành chỗ giấu lỗi.
  const daBu = [...CHUA_CO_LINK].filter(id => ds.find(g => g.id === id)?.imageUrl);
  ok(daBu.length === 0, daBu.length === 0
    ? 'Danh sách ngoại lệ không có mục thừa'
    : `${daBu.length} món đã có link rồi, hãy xoá khỏi CHUA_CO_LINK: ${daBu.join(' | ')}`);

  const khongCon = [...CHUA_CO_LINK].filter(id => !ds.find(g => g.id === id));
  ok(khongCon.length === 0, khongCon.length === 0
    ? 'Danh sách ngoại lệ không trỏ vào món đã bị xoá'
    : `Mã món không còn tồn tại: ${khongCon.join(' | ')}`);

  const conThieu = ds.filter(g => !g.imageUrl);
  if (conThieu.length) {
    console.log(`  ⚠️  NỢ LẠI: ${conThieu.length} món chưa có ảnh, chờ up bù — ${conThieu.map(g => g.name).join(' | ')}`);
  }
}

console.log('\n[2] Link phải dùng được với Discord:');
{
  const coLink = ds.filter(g => g.imageUrl);
  const khongHttps = coLink.filter(g => !/^https:\/\//.test(g.imageUrl));
  ok(khongHttps.length === 0, khongHttps.length === 0
    ? 'Mọi link đều là https (Discord từ chối http)'
    : `${khongHttps.length} link không phải https: ${khongHttps.map(g => g.id).join(' | ')}`);

  // Link trang xem ảnh (ibb.co/xxx) khác link ảnh trực tiếp (i.ibb.co/.../x.jpg).
  // Dán nhầm loại đầu vào embed thì Discord không hiện gì cả.
  const trangXem = coLink.filter(g => /^https:\/\/ibb\.co\//.test(g.imageUrl));
  ok(trangXem.length === 0, trangXem.length === 0
    ? 'Không món nào dán nhầm link trang xem thay vì link ảnh trực tiếp'
    : `${trangXem.length} món dán nhầm link trang xem: ${trangXem.map(g => g.id).join(' | ')}`);

  const khongDuoiAnh = coLink.filter(g => !/\.(jpg|jpeg|png|gif|webp)$/i.test(g.imageUrl));
  ok(khongDuoiAnh.length === 0, khongDuoiAnh.length === 0
    ? 'Mọi link đều kết thúc bằng đuôi ảnh'
    : `${khongDuoiAnh.length} link không có đuôi ảnh: ${khongDuoiAnh.map(g => g.id).join(' | ')}`);
}

console.log('\n[3] Không mã nguồn nào còn đính file ảnh từ đĩa:');
{
  for (const f of ['../src/commands/prefix/baovat.js', '../src/commands/prefix/admin.js']) {
    const s = doc(f);
    const ten = path.basename(f);
    ok(!s.includes('AttachmentBuilder'), `${ten} không còn đính file`);
    ok(!s.includes('imageFile'), `${ten} không còn đọc tên file ảnh`);
  }
}

console.log('\n[4] Link thật sự được gắn vào khung hiển thị:');
{
  const mau = ds.find(g => g.imageUrl);
  const embed = createGearDetailEmbed(mau);
  ok(embed?.data?.image?.url === mau.imageUrl, `Ảnh của "${mau.name}" trỏ đúng link trong cấu hình`);
  ok(!JSON.stringify(embed.data).includes('attachment://'), 'Không còn dùng lược đồ attachment://');
}

console.log('\n[5] Món thiếu link thì bỏ trống ảnh chứ không được nổ:');
{
  let no = false;
  let embed = null;
  try { embed = createGearDetailEmbed({ ...ds[0], imageUrl: undefined }); } catch { no = true; }
  ok(!no, 'Không ném lỗi');
  ok(embed && !embed.data.image, 'Khung vẫn dựng được, chỉ là không có ảnh');
}

console.log('\n======================================================');
if (fail === 0) console.log(`🎉 HOÀN TẤT: ${pass}/${pass} phép kiểm thử đều đúng.`);
else console.error(`❌ ${fail} phép kiểm thử THẤT BẠI (${pass} đạt).`);
console.log('======================================================\n');
process.exit(fail === 0 ? 0 : 1);
