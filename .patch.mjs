// Công cụ vá nội bộ — xóa sau khi hoàn tất.
import fs from 'fs';
const raw = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const blocks = raw.split('@@@BLOCK\n').slice(1);
let ok = 0, fail = 0;
for (const b of blocks) {
  const mFile = b.match(/^@@@FILE (.+)\n/);
  const iFind = b.indexOf('@@@FIND\n');
  const iRep  = b.indexOf('\n@@@REPLACE\n');
  const iEnd  = b.indexOf('\n@@@END');
  if (!mFile || iFind < 0 || iRep < 0 || iEnd < 0) { console.error('❌ Khối sai định dạng'); fail++; continue; }
  const file = mFile[1].trim();
  const find = b.slice(iFind + 8, iRep);
  const replace = b.slice(iRep + 11, iEnd);
  const src = fs.readFileSync(file, 'utf8');
  const nl = src.includes('\r\n');
  const norm = nl ? src.replace(/\r\n/g, '\n') : src;
  const parts = norm.split(find);
  if (parts.length - 1 !== 1) {
    console.error(`❌ ${file}: khớp ${parts.length - 1} lần (cần đúng 1)`);
    console.error(`   "${find.slice(0, 100).replace(/\n/g, '⏎')}"`);
    fail++; continue;
  }
  let out = parts.join(replace);
  if (nl) out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, out, 'utf8');
  console.log(`✅ ${file}`);
  ok++;
}
console.log(`── ${ok} OK / ${fail} lỗi ──`);
process.exit(fail ? 1 : 0);
