import fs from 'fs';

const P = 'src/handlers/buttonHandler.js';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;

// 1) import
s = s.replace(
  "import { setCooldown } from '../utils/cooldown.js';",
  "import { setCooldown } from '../utils/cooldown.js';\nimport { getFactionBuffs, getCritMultiplier, applyIncomingDamage } from '../services/factionService.js';"
);

// 2) Phản kích của quái/boss: thêm né đòn + giảm sát thương theo trận doanh
const counterRe = /( {4}const (beast|boss)Dmg = )(Math\.max\(\d+, Math\.floor\(session\.(?:beast|boss)Atk \* \(0\.9 \+ Math\.random\(\) \* 0\.2\) - session\.userDef \* 0\.\d+\)\));\n( {4}session\.userHp = Math\.max\(0, session\.userHp - (?:beast|boss)Dmg\);\n)( {4}logText \+= )(`[^`]*`;)/g;
s = s.replace(counterRe, (m, decl, kind, expr, hpLine, logPrefix, logTpl) => {
  n++;
  const nameField = kind === 'beast' ? 'session.beastName' : 'session.bossName';
  return `${decl}applyIncomingDamage(session, ${expr});\n${hpLine}${logPrefix}session.lastDodged\n      ? \`\n💨 **\${session.userName}** thân pháp phiêu hốt, né sạch đòn phản kích của **\${${nameField}}**!\`\n      : ${logTpl}`;
});

// 3) Chí mạng: cộng buff sát thương chí mạng Ma Đạo
const critCount = (s.match(/\(isCrit \? 1\.35 : 1\.0\)/g) || []).length;
s = s.split('(isCrit ? 1.35 : 1.0)').join('(isCrit ? getCritMultiplier(session.factionBuffs) : 1.0)');

// 4) Nạp buff vào session khi tạo trận + áp dụng EXP/drop
s = s.replace(
  `    setCooldown(user, 'hunting');
    await user.save();

    combatSessions[targetUserId] = {`,
  `    setCooldown(user, 'hunting');
    await user.save();

    const huntBuffs = getFactionBuffs(user.faction);

    combatSessions[targetUserId] = {
      factionBuffs: huntBuffs,
      lastDodged: false,`
);
s = s.replace(
  `    setCooldown(user, 'dungeon');
    await user.save();

    dungeonCombatSessions[targetUserId] = {`,
  `    setCooldown(user, 'dungeon');
    await user.save();

    const dgBuffs = getFactionBuffs(user.faction);

    dungeonCombatSessions[targetUserId] = {
      factionBuffs: dgBuffs,
      lastDodged: false,`
);

fs.writeFileSync(P, s);
console.log(`Phản kích đã bọc: ${n} | Chí mạng đã sửa: ${critCount} | Thay đổi: ${s !== before}`);
