import fs from 'fs';
const f = 'src/handlers/buttonHandler.js';
let src = fs.readFileSync(f, 'utf8');
const crlf = src.includes('\r\n');
let lines = src.replace(/\r\n/g, '\n').split('\n');

// (dòng 1-based, biến-user, có-phải-thua)
const sites = [
  [758, 'user',         false], [753, 'user',         true],
  [681, 'user',         false], [676, 'user',         true],
  [591, 'targetUserId', false], [586, 'targetUserId', true],
  [432, 'user',         false], [427, 'user',         true],
  [355, 'user',         false], [350, 'user',         true],
  [265, 'targetUserId', false], [260, 'targetUserId', true],
];

for (const [ln, who, defeated] of sites) {
  const cur = lines[ln - 1];
  if (!/session\.lastLog = /.test(cur)) {
    console.error(`❌ dòng ${ln} không phải session.lastLog: ${cur.trim().slice(0,60)}`);
    process.exit(1);
  }
  const call = defeated
    ? `    await persistCombatState(${who}, session, { defeated: true });`
    : `    await persistCombatState(${who}, session);`;
  lines.splice(ln - 1, 0, call);
}

// Chèn hàm hỗ trợ ngay trước checkHuyenGiaiDrop
const helper = `// Ghi trạng thái chiến đấu (HP/MP/thuần thục) từ RAM về CSDL.
// Nếu thua trận: hồi tỉnh với 20% HP và chịu phạt 10% EXP tầng hiện tại.
async function persistCombatState(userOrId, session, { defeated = false } = {}) {
  try {
    const u = typeof userOrId === 'string' ? await User.findOne({ userId: userOrId }) : userOrId;
    if (!u || !session) return null;

    u.stats.maxHp = u.stats.maxHp || 100;
    u.stats.maxMp = u.stats.maxMp || 100;
    u.stats.hp = Math.max(0, Math.min(u.stats.maxHp, session.userHp ?? u.stats.hp));
    u.stats.mp = Math.max(0, Math.min(u.stats.maxMp, session.userMp ?? u.stats.mp));

    if (defeated) {
      u.stats.hp = Math.max(1, Math.floor(u.stats.maxHp * 0.20));
      u.realm.exp = Math.max(0, Math.floor((u.realm.exp || 0) * 0.90));
    }

    await u.save();
    return u;
  } catch (err) {
    console.error('[persistCombatState] Lỗi ghi trạng thái chiến đấu:', err);
    return null;
  }
}

`;
const anchor = lines.findIndex(l => l.startsWith('// Hàm hỗ trợ thưởng rớt trang bị'));
if (anchor < 0) { console.error('❌ Không tìm thấy mốc chèn hàm'); process.exit(1); }
lines.splice(anchor, 0, ...helper.split('\n').slice(0, -1));

let out = lines.join('\n');
if (crlf) out = out.replace(/\n/g, '\r\n');
fs.writeFileSync(f, out, 'utf8');
console.log(`✅ Đã chèn 12 điểm lưu trạng thái + hàm persistCombatState`);
