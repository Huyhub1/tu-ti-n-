import fs from 'fs';
const f = 'src/handlers/buttonHandler.js';
let src = fs.readFileSync(f, 'utf8');
const crlf = src.includes('\r\n');
let lines = src.replace(/\r\n/g, '\n').split('\n');

// Đồng bộ HP/MP về nhân vật ở các nhánh GIẾT ĐƯỢC QUÁI (trước await user.save())
// Xử lý từ dưới lên để số dòng không bị lệch.
const sync = [
  `        u_syncCombatStats(user, session);`,
];
const targets = [773, 694, 441, 362, 270].map(n => n + 1); // dòng "await user.save();"
for (const ln of targets) {
  if (!/await user\.save\(\);/.test(lines[ln - 1])) {
    console.error(`❌ dòng ${ln} không phải user.save(): ${lines[ln-1].trim()}`); process.exit(1);
  }
  lines.splice(ln - 1, 0, ...sync);
}
// Ải phó bản (dòng 600) có cấu trúc khác: tìm user.save() gần nhất sau đó
let k = 600;
while (k < lines.length && !/await user\.save\(\);/.test(lines[k])) k++;
if (k >= lines.length) { console.error('❌ không thấy save của khối 600'); process.exit(1); }
lines.splice(k, 0, ...sync);

const helper = `// Đồng bộ HP/MP còn lại sau trận về nhân vật (dùng ở nhánh thắng trận)
function u_syncCombatStats(user, session) {
  if (!user || !session) return;
  user.stats.maxHp = user.stats.maxHp || 100;
  user.stats.maxMp = user.stats.maxMp || 100;
  user.stats.hp = Math.max(1, Math.min(user.stats.maxHp, session.userHp ?? user.stats.hp));
  user.stats.mp = Math.max(0, Math.min(user.stats.maxMp, session.userMp ?? user.stats.mp));
}

`;
const anchor = lines.findIndex(l => l.startsWith('// Ghi trạng thái chiến đấu'));
lines.splice(anchor, 0, ...helper.split('\n').slice(0, -1));

let out = lines.join('\n');
if (crlf) out = out.replace(/\n/g, '\r\n');
fs.writeFileSync(f, out, 'utf8');
console.log('✅ Đã đồng bộ HP/MP ở 6 nhánh thắng trận');
