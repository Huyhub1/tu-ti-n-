import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { User } from '../../database/models/User.js';
import { checkCooldown, formatWait, checkBattleReady } from '../../utils/cooldown.js';
import { dungeonCombatSessions } from './dungeon.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monstersConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/monsters.json'), 'utf8'));

// Lưu trạng thái trận đánh đang diễn ra trong RAM: combatSessions[userId]
export const combatSessions = {};

// Tự động dọn dẹp các phiên chiến đấu không tương tác quá 10 phút (giải phóng RAM)
setInterval(() => {
  const now = Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  for (const userId in combatSessions) {
    if (combatSessions[userId] && combatSessions[userId].lastActionTime) {
      if (now - combatSessions[userId].lastActionTime > TEN_MINUTES_MS) {
        delete combatSessions[userId];
      }
    }
  }
}, 60 * 1000);

export async function executeSanthu(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });


  if (combatSessions[userId]) {
    return message.reply({
      content: `⚔️ Đạo hữu đang trong trận chiến với **[${combatSessions[userId].beastName}]**! Hãy hoàn thành trận đấu hiện tại trước khi bắt đầu cuộc đi săn mới.`
    });
  }

  const cd = checkCooldown(user, 'hunting');
  if (!cd.ready) {
    return message.reply({
      content: `⏳ Đạo hữu vừa đi săn về, khí huyết chưa ổn định! Vui lòng nghỉ thêm **${formatWait(cd.waitTime)}**.`
    });
  }

  const battle = checkBattleReady(user);
  if (!battle.ready) {
    return message.reply({
      content: `🩸 **Trọng thương chưa lành!** Máu hiện tại \`${battle.hp}/${battle.maxHp}\` — cần tối thiểu \`${battle.need}\` HP mới đủ sức xông trận.\n` +
        `💊 Hãy dùng \`!uongdan hoi_xuan_dan\` để hồi phục, hoặc \`!tuluyen\` để vận công dưỡng thương.`
    });
  }
  if (dungeonCombatSessions && dungeonCombatSessions[userId]) {
    return message.reply({
      content: `⛩️ Đạo hữu đang khiêu chiến Boss **[${dungeonCombatSessions[userId].bossName}]** trong bí cảnh! Hãy hoàn thành hoặc rút lui trước khi săn thú.`
    });
  }

  const beasts = monstersConfig.beasts;

  const embed = new EmbedBuilder()
    .setTitle(`🦁 [SĂN BẮT YÊU THÚ NGOẠI MÔN]`)
    .setColor('#4CAF50')
    .setDescription(
      `Khu rừng rậm rạp sau núi toát ra nhiều luồng yêu khí khác nhau.\n\n` +
      `👉 **Hãy chọn một loài Yêu Thú ở menu bên dưới để do thám thông tin:**`
    );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`hunt_select_beast_${userId}`)
    .setPlaceholder('👉 Chọn con thú muốn săn bắt...');

  beasts.forEach((b, idx) => {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${idx + 1}. ${b.name} (Cấp ${b.level})`)
        .setDescription(`HP: ${b.hp} | Công: ${b.atk} | Thủ: ${b.def}`)
        .setValue(`beast_${b.id}`)
        .setEmoji('🐾')
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await message.reply({ embeds: [embed], components: [row] });
}

export const SKILL_MANA_COST = {
  HOANG_GIAI: 20,
  HUYEN_GIAI: 35,
  DIA_GIAI: 50,
  THIEN_GIAI: 70,
  THAN_GIAI: 100
};

export const GEAR_MANA_COST = {
  HOANG_GIAI: 30,
  HUYEN_GIAI: 50,
  DIA_GIAI: 75,
  THIEN_GIAI: 100,
  THAN_GIAI: 150
};

export function createCombatEmbed(session) {
  const userHpBar = getProgressBar(session.userHp, session.userMaxHp, 10);
  const userMpBar = getProgressBar(session.userMp ?? 100, session.userMaxMp ?? 100, 10);
  const beastHpBar = getProgressBar(session.beastHp, session.beastMaxHp, 10);

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ [CHIẾN ĐẤU] ${session.userName} VS ${session.beastName}`)
    .setColor(session.beastHp <= 0 ? '#4CAF50' : session.userHp <= 0 ? '#F44336' : '#FF9800')
    .setDescription(
      `**👤 ${session.userName}:**\n` +
      `❤️ HP: \`${session.userHp}/${session.userMaxHp}\` [${userHpBar}]\n` +
      `🔷 MP: \`${session.userMp}/${session.userMaxMp}\` [${userMpBar}]\n\n` +
      `**👹 ${session.beastName}:**\n` +
      `💚 HP: \`${session.beastHp}/${session.beastMaxHp}\` [${beastHpBar}]\n\n` +
      `📜 **Diễn biến hiệp gần nhất:**\n${session.lastLog || '*Trận chiến bắt đầu, hãy chọn chiêu thức ra đòn!*'}`
    );

  return embed;
}

export function createCombatButtons(userId, equippedSkills = [], equippedGears = [], userMp = 100, isFinished = false) {
  if (isFinished) return [];

  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder().setCustomId(`combat_attack_normal_${userId}`).setLabel('🗡️ Đánh Thường (+15 MP)').setStyle(ButtonStyle.Primary)
  );

  // 1. Tuyệt kỹ công pháp (Tiêu hao Mana)
  if (equippedSkills && equippedSkills.length > 0) {
    const firstSkill = equippedSkills[0];
    const skillCost = SKILL_MANA_COST[firstSkill.rarity] || 25;
    const notEnoughMp = (userMp || 0) < skillCost;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`combat_skill::${firstSkill.skillId}::0::${userId}`)
        .setLabel(`🔥 ${firstSkill.name} (${skillCost} MP)`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(notEnoughMp)
    );
  }

  // 2. Tuyệt kỹ Pháp Bảo / Vũ Khí (Tiêu hao Mana, không giới hạn lượt)
  if (equippedGears && equippedGears.length > 0) {
    const mainGear = equippedGears.find(g => g.combatSkill && g.combatSkill.name) || equippedGears[0];
    if (mainGear && mainGear.combatSkill && mainGear.combatSkill.name) {
      const gearCost = GEAR_MANA_COST[mainGear.rarity] || 40;
      const notEnoughMp = (userMp || 0) < gearCost;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`combat_gear_skill::${mainGear.gearId}::${userId}`)
          .setLabel(`🔮 ${mainGear.combatSkill.name} (${gearCost} MP)`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(notEnoughMp)
      );
    }
  }

  row.addComponents(
    new ButtonBuilder().setCustomId(`combat_flee_${userId}`).setLabel('🏃 Tháo Chạy').setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

function getProgressBar(current, max, length = 10) {
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const filled = Math.floor((percent / 100) * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}
