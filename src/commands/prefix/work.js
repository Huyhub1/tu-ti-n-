import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';

import { getAllSkills } from '../../services/skillService.js';
import { getFactionBuffs } from '../../services/factionService.js';

import { COOLDOWNS, formatWait, claimCooldown, cooldownLine } from '../../utils/cooldown.js';
import { repeatRow } from '../../utils/repeatButton.js';
import { tutorialNudge } from '../../services/tutorialService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jobsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/jobs.json'), 'utf8'));


const WORK_COOLDOWN_SECONDS = COOLDOWNS.work;

/**
 * Chạy một lượt làm công rồi dựng sẵn nguyên gói tin nhắn để hiển thị.
 *
 * Tách khỏi executeLamcong để nút 'Làm tiếp' và lệnh gõ tay dùng chung đúng
 * một đường đi — kể cả các nhánh báo lỗi hồi chiêu.
 *
 * Trả { content } khi không chạy được, { embeds, components } khi thành công.
 */
export async function buildLamcongView(userId) {
  let user = await User.findOne({ userId });

  if (!user) return { content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` };

  const now = new Date();
  if (user.cooldowns.work) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.work)) / 1000);
    if (elapsedSeconds < WORK_COOLDOWN_SECONDS) {
      const waitTime = WORK_COOLDOWN_SECONDS - elapsedSeconds;
      return {
        content: `⏳ Đạo hữu vừa làm việc vất vả, hãy nghỉ ngơi dưỡng sức thêm **${formatWait(waitTime)}** rồi hẵng tiếp tục!`
      };
    }
  }

  // Chiếm lượt bằng một câu lệnh nguyên tử: gửi 5 lệnh cùng lúc thì chỉ 1 lệnh
  // đi tiếp, tránh nhân tiền công lên nhiều lần cho cùng một lượt hồi chiêu.
  const claimed = await claimCooldown(User, userId, 'work', {}, { $inc: { 'counters.work': 1 } });
  if (!claimed) {
    return { content: `⏳ Đạo hữu gõ quá nhanh, thân thể chưa kịp hồi sức! Chờ thêm giây lát rồi thử lại.` };
  }
  user = claimed;

  // Lấy danh sách công việc từ config JSON
  const jobs = jobsConfig.jobs;
  const job = jobs[Math.floor(Math.random() * jobs.length)];
  let moneyEarned = Math.floor(Math.random() * (job.maxMoney - job.minMoney + 1)) + job.minMoney;


  // Buff Tán Tu: +20% Linh Thạch (đọc từ config)
  const moneyBonus = getFactionBuffs(user.faction).moneyWorkBonus;
  if (moneyBonus > 0) moneyEarned = Math.floor(moneyEarned * (1 + moneyBonus));


  user.currencies.linhThach += moneyEarned;

  let extraMsg = '';

  // 15% Tỉ lệ nhặt được 1 Bí Kíp Hoàng Giai khi làm công
  if (Math.random() <= 0.15) {
    const allSkills = getAllSkills();
    const commonSkills = allSkills.filter(s => s.rarity === 'HOANG_GIAI');
    const droppedSkill = commonSkills[Math.floor(Math.random() * commonSkills.length)];

    const alreadyHas = user.skills.some(s => s.skillId === droppedSkill.id);
    if (!alreadyHas) {
      user.skills.push({
        skillId: droppedSkill.id,
        name: droppedSkill.name,
        category: droppedSkill.category,
        rarity: droppedSkill.rarity,
        mastery: 10,
        equipped: false
      });
      extraMsg = `\n🎁 **CƠ DUYÊN BẤT NGỜ!** Trong lúc làm việc, đạo hữu tình cờ nhặt được tàn diệp bí kíp **[${droppedSkill.name}]** (${droppedSkill.rarity})!`;
    }
  }

  // Thu hái Linh Thảo (50% tỉ lệ hái được 1-3 nhánh)
  let herbMsg = '';
  if (Math.random() <= 0.50) {
    const herbCount = 1 + Math.floor(Math.random() * 2);
    const existingHerb = (user.inventory || []).find(i => i.itemId === 'linh_thao');
    if (existingHerb) {
      existingHerb.quantity += herbCount;
    } else {
      user.inventory.push({
        itemId: 'linh_thao',
        name: 'Linh Thảo',
        type: 'NGUYEN_LIEU',
        quantity: herbCount,
        desc: 'Dược thảo tươi chứa linh khí dùng trong Lò Luyện Đan.'
      });
    }
    herbMsg = `\n🌿 **Thu hái dược liệu:** Nhặt được **+${herbCount} Linh Thảo** (Dùng cho \`!luyendan\`)`;
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`🔨 [LÀM CÔNG TÍCH LŨY] - ${job.title}`)
    .setColor('#FF9800')
    .setDescription(
      `${job.desc}\n\n` +
      `💰 Nhận được: **+${moneyEarned.toLocaleString()} Linh Thạch**\n` +
      `💎 Tổng tài sản hiện có: **${user.currencies.linhThach.toLocaleString()} Linh Thạch**${extraMsg}${herbMsg}\n\n` +

      cooldownLine('work', user.cooldowns.work) +
      tutorialNudge(user)
    );

  return { embeds: [embed], components: repeatRow('lamcong', userId) };
}

export async function executeLamcong(message) {
  await message.reply(await buildLamcongView(message.author.id));
}
