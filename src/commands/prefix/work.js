import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';
import { getAllSkills } from '../../services/skillService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jobsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/jobs.json'), 'utf8'));

const WORK_COOLDOWN_SECONDS = 30; // 30s mỗi lần làm việc

export async function executeLamcong(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const now = new Date();
  if (user.cooldowns.work) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.work)) / 1000);
    if (elapsedSeconds < WORK_COOLDOWN_SECONDS) {
      const waitTime = WORK_COOLDOWN_SECONDS - elapsedSeconds;
      return message.reply({
        content: `⏳ Đạo hữu vừa làm việc vất vả, hãy nghỉ ngơi dưỡng sức thêm **${waitTime}s** rồi hẵng tiếp tục!`
      });
    }
  }

  // Lấy danh sách công việc từ config JSON
  const jobs = jobsConfig.jobs;
  const job = jobs[Math.floor(Math.random() * jobs.length)];
  let moneyEarned = Math.floor(Math.random() * (job.maxMoney - job.minMoney + 1)) + job.minMoney;

  // Buff Tán Tu (+20% tiền)
  if (user.faction === 'TAN_TU') {
    moneyEarned = Math.floor(moneyEarned * 1.20);
  }

  user.currencies.linhThach += moneyEarned;
  user.cooldowns.work = now;

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
      `⏱️ *Thời gian hồi chiêu: 30 giây*`
    );

  await message.reply({ embeds: [embed] });
}
