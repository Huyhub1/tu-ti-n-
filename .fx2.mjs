import fs from 'fs';
const P = 'src/handlers/buttonHandler.js';
let s = fs.readFileSync(P, 'utf8');
let ok = [];

function rep(find, repl, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) { console.error(`❌ ${label}: khớp ${c} lần`); process.exit(1); }
  s = s.replace(find, repl);
  ok.push(label);
}

// EXP săn thú + tỉ lệ rơi bảo vật theo trận doanh
rep(
`      exp: beast.exp,
      linhThach: beast.linhThach,
      nguyenThach: beast.nguyenThach,`,
`      exp: Math.floor(beast.exp * (1 + huntBuffs.expKillBonus)),
      linhThach: beast.linhThach,
      nguyenThach: beast.nguyenThach,
      gearDropRate: Math.min(0.60, 0.15 * (1 + huntBuffs.dropRateBonus)),`,
  'session săn thú');

rep(
`      exp: dungeon.exp,
      linhThach: dungeon.linhThach,
      nguyenThachMin: dungeon.nguyenThachMin,
      nguyenThachMax: dungeon.nguyenThachMax,
      rareDropRate: dungeon.rareDropRate,`,
`      exp: Math.floor(dungeon.exp * (1 + dgBuffs.expKillBonus)),
      linhThach: dungeon.linhThach,
      nguyenThachMin: dungeon.nguyenThachMin,
      nguyenThachMax: dungeon.nguyenThachMax,
      rareDropRate: Math.min(0.80, (dungeon.rareDropRate || 0) * (1 + dgBuffs.dropRateBonus)),
      gearDropRate: Math.min(0.75, 0.30 * (1 + dgBuffs.dropRateBonus)),`,
  'session phó bản');

// Dùng tỉ lệ rơi đã cộng buff thay vì số cứng
const c15 = s.split('checkHuyenGiaiDrop(user, 0.15)').length - 1;
const c30 = s.split('checkHuyenGiaiDrop(user, 0.30)').length - 1;
s = s.split('checkHuyenGiaiDrop(user, 0.15)').join('checkHuyenGiaiDrop(user, session.gearDropRate ?? 0.15)');
s = s.split('checkHuyenGiaiDrop(user, 0.30)').join('checkHuyenGiaiDrop(user, session.gearDropRate ?? 0.30)');
ok.push(`checkHuyenGiaiDrop: ${c15} chỗ 0.15 + ${c30} chỗ 0.30`);

fs.writeFileSync(P, s);
console.log('✅ ' + ok.join('\n✅ '));
