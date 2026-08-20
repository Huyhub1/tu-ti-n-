import { rollInnateTalent } from '../src/services/talentService.js';
import { calculateMaxExp, attemptBreakthrough } from '../src/services/cultivationService.js';
import { getAllSkills, fuseSkills, getSkillById } from '../src/services/skillService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const factionsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/config/factions.json'), 'utf8'));
const dungeonsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/config/dungeons.json'), 'utf8'));
const monstersConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/config/monsters.json'), 'utf8'));
const jobsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/config/jobs.json'), 'utf8'));

console.log(chalk.bold.magenta(`\n======================================================`));
console.log(chalk.bold.cyan(`  🧪 KIỂM TRA TOÀN DIỆN HỆ THỐNG BOT TU TIÊN (E2E)`));
console.log(chalk.bold.magenta(`======================================================\n`));

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(chalk.green(`  ✅ [PASS] ${testName}`));
  } else {
    console.error(chalk.red(`  ❌ [FAIL] ${testName}`));
  }
}

// 1. Test Khởi tạo nhân vật & Tư chất duy nhất
console.log(chalk.yellow(`[1] Kiểm tra Khởi Tạo Nhân Vật & Gacha Tư Chất:`));
const talent = rollInnateTalent();
assert(talent && talent.name && talent.tier, `Quay Tư Chất Bẩm Sinh thành công: [${talent.name}] (${talent.tierName})`);

// 2. Test Chọn Trận Doanh
console.log(chalk.yellow(`\n[2] Kiểm tra Trận Doanh & Bí Kíp Khởi Đầu:`));
const factionChinh = factionsConfig.factions.CHINH_DAO;
const starterSkill = getSkillById(factionChinh.starterSkill);
assert(starterSkill !== undefined, `Trận Doanh Chính Đạo có bí kíp khởi đầu: [${starterSkill?.name}]`);

// 3. Test Tu Luyện & Đột Phá Phàm Nhân -> Luyện Khí Sơ Kỳ
console.log(chalk.yellow(`\n[3] Kiểm tra Tu Luyện & Đột Phá Phàm Nhân -> Luyện Khí Sơ Kỳ:`));
const user = {
  daoName: 'Lạc Vô Tà',
  talent: talent,
  faction: 'CHINH_DAO',
  realm: { id: 'pham_nhan', name: 'Phàm Nhân', layer: 1, exp: 150, maxExp: 150 },
  stats: { hp: 100, maxHp: 100, atk: 15, def: 8, luck: 25 },
  currencies: { linhThach: 100, nguyenThach: 0, congDuc: 20 },
  skills: [{ skillId: starterSkill.id, name: starterSkill.name, category: starterSkill.category, rarity: starterSkill.rarity, mastery: 20, equipped: true }],
  inventory: []
};

const break1 = attemptBreakthrough(user);
assert(break1.success && user.realm.id === 'luyen_khi' && user.realm.layer === 1, `Phàm Nhân đột phá lên Luyện Khí [Sơ Kỳ] thành công!`);

// 4. Test Nhánh Luyện Khí 100k Năm Từ Dương
console.log(chalk.yellow(`\n[4] Kiểm tra Nhánh Luyện Khí 100k Năm (Từ Dương):`));
user.realm.layer = 4; // Luyện Khí Đỉnh Phong
user.realm.exp = calculateMaxExp('luyen_khi', 4);
user.realm.maxExp = user.realm.exp;
user.isLuyenKhiVanTang = true;

const breakNenKhi = attemptBreakthrough(user);
assert(breakNenKhi.success && user.realm.layer === 5, `Luyện Khí Đỉnh Phong nén khí lên Tầng 5 (EXP: ${user.realm.maxExp}) thành công!`);

// 5. Test Config Làm Công (Jobs)
console.log(chalk.yellow(`\n[5] Kiểm tra Hệ Thống Làm Công (Jobs):`));
const jobs = jobsConfig.jobs;
assert(jobs.length >= 4, `Đã nạp ${jobs.length} công việc tạp dịch từ jobs.json`);

// 6. Test Config Yêu Thú (Săn Thú)
console.log(chalk.yellow(`\n[6] Kiểm tra Săn Thú (Beasts):`));
const beasts = monstersConfig.beasts;
assert(beasts.length >= 4 && beasts[0].nguyenThach > 0, `Đã nạp ${beasts.length} loài Yêu Thú săn bắt có rơi Nguyên Thạch`);

// 7. Test Config Phó Bản (Dungeons)
console.log(chalk.yellow(`\n[7] Kiểm tra Phó Bản Bí Cảnh (Dungeons):`));
const dungeons = dungeonsConfig.dungeons;
assert(dungeons.length >= 2 && dungeons[0].boss && dungeons[0].nguyenThachMax >= 4, `Đã nạp ${dungeons.length} Ải Bí Cảnh chiến Boss viễn cổ`);

// 8. Test Tàng Kinh Các & Lò Luyện Dung Hợp
console.log(chalk.yellow(`\n[8] Kiểm tra Tàng Kinh Các & Lò Luyện Vạn Đạo:`));
const allSkills = getAllSkills();
assert(allSkills.length >= 70, `Tàng Kinh Các có ${allSkills.length} bí kíp đầy đủ 4 nhóm`);

user.skills = [
  { skillId: 's1', name: 'Kỹ Năng 1', category: 'tam_phap', rarity: 'HOANG_GIAI', mastery: 100 },
  { skillId: 's2', name: 'Kỹ Năng 2', category: 'tam_phap', rarity: 'HOANG_GIAI', mastery: 100 },
  { skillId: 's3', name: 'Kỹ Năng 3', category: 'quyet_phap', rarity: 'HOANG_GIAI', mastery: 100 },
  { skillId: 's4', name: 'Kỹ Năng 4', category: 'than_phap', rarity: 'HOANG_GIAI', mastery: 100 },
  { skillId: 's5', name: 'Kỹ Năng 5', category: 'bi_thuat', rarity: 'HOANG_GIAI', mastery: 100 }
];

const fuseRes = fuseSkills(user, 'HOANG_GIAI');
assert(fuseRes.success && user.skills.length === 1 && user.skills[0].rarity === 'HUYEN_GIAI', `Lò Luyện Vạn Đạo nấu 5 công pháp Hoàng Giai thành 1 Huyền Giai: [${user.skills[0].name}]`);

console.log(chalk.bold.magenta(`\n======================================================`));
if (passed === total) {
  console.log(chalk.bold.green(`🎉 KẾT QUẢ: ${passed}/${total} BỘ KIỂM THỬ ĐẠT CHUẨN 100% HOÀN HẢO!`));
} else {
  console.log(chalk.bold.red(`❌ KẾT QUẢ: ${passed}/${total} BỘ KIỂM THỬ THÀNH CÔNG.`));
}
console.log(chalk.bold.magenta(`======================================================\n`));
