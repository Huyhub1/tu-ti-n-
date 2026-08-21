import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { User } from '../../database/models/User.js';
import { checkCooldown, formatWait, checkBattleReady } from '../../utils/cooldown.js';
import { meetsRequirement, requirementLabel } from '../../utils/power.js';

import { combatSessions, pickCombatSkills, pickCombatGears, trimButtonLabel } from './hunting.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dungeonsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/dungeons.json'), 'utf8'));

// Lưu trạng thái ải phó bản đang chiến đấu: dungeonCombatSessions[userId]
export const dungeonCombatSessions = {};

// Tự động dọn dẹp các phiên chiến đấu phó bản không tương tác quá 10 phút (giải phóng RAM)
// `.unref()` ở cuối để bộ đếm không giữ tiến trình Node sống: bot vẫn chạy nhờ
// kết nối websocket của Discord, nhưng script kiểm thử nào lỡ nạp file này sẽ
// treo vĩnh viễn nếu thiếu — và bot cũng không thoát sạch khi tắt.
setInterval(() => {
  const now = Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  for (const userId in dungeonCombatSessions) {
    if (dungeonCombatSessions[userId] && dungeonCombatSessions[userId].lastActionTime) {
      if (now - dungeonCombatSessions[userId].lastActionTime > TEN_MINUTES_MS) {
        delete dungeonCombatSessions[userId];
      }
    }
  }
}, 60 * 1000).unref?.();

export async function executePhoban(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });


  if (dungeonCombatSessions[userId]) {
    return message.reply({
      content: `⛩️ Đạo hữu đang trong ải khiêu chiến Boss **[${dungeonCombatSessions[userId].bossName}]**! Hãy hoàn thành hoặc rút lui trước khi mở ải mới.`
    });
  }

  const cd = checkCooldown(user, 'dungeon');
  if (!cd.ready) {
    return message.reply({
      content: `⏳ Bí cảnh vừa khép lại, linh khí cần thời gian tái tụ! Vui lòng chờ **${formatWait(cd.waitTime)}**.`
    });
  }

  const battle = checkBattleReady(user);
  if (!battle.ready) {
    return message.reply({
      content: `🩸 **Trọng thương chưa lành!** Máu hiện tại \`${battle.hp}/${battle.maxHp}\` — cần tối thiểu \`${battle.need}\` HP mới dám bước vào bí cảnh.\n` +
        `💊 Hãy dùng \`!uongdan hoi_xuan_dan\` để hồi phục, hoặc \`!tuluyen\` để vận công dưỡng thương.`
    });
  }
  if (combatSessions && combatSessions[userId]) {
    return message.reply({
      content: `⚔️ Đạo hữu đang trong trận chiến với **[${combatSessions[userId].beastName}]**! Hãy kết thúc trận săn thú trước khi vào phó bản.`
    });
  }

  // 8 ải trải từ Luyện Khí tới Nguyên Anh Đỉnh Phong. Trước đây minLevel/minLayer
  // trong config chỉ để trang trí — không chỗ nào kiểm tra — nên tân thủ vẫn
  // chọn được ải cuối rồi bị Boss một chiêu tiễn về thành.
  const dungeons = dungeonsConfig.dungeons;
  const unlockedDg = dungeons.filter(d => meetsRequirement(user, d));
  const lockedDg = dungeons.filter(d => !meetsRequirement(user, d)).slice(0, 2);
  const shownDg = unlockedDg.slice(-6).concat(lockedDg);

  const embed = new EmbedBuilder()
    .setTitle(`🏰 [BÍ CẢNH / PHÓ BẢN VIỄN CỔ]`)
    .setColor('#9C27B0')
    .setDescription(
      `Các đại trận di tích cổ đại ẩn giấu bảo vật vô giá và Boss canh giữ.\n` +
      `Cảnh giới hiện tại: **${user.realm.name} · Tầng ${user.realm.layer}** — đã mở khoá ` +
      `**${unlockedDg.length}/${dungeons.length}** ải bí cảnh.\n\n` +
      `👉 **Hãy chọn một Ải Bí Cảnh ở menu bên dưới để dò xét thông tin Boss:**`
    );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`dungeon_select_stage_${userId}`)
    .setPlaceholder('👉 Chọn Ải Bí Cảnh muốn thám hiểm...');

  shownDg.forEach(d => {
    const isLocked = !meetsRequirement(user, d);
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${isLocked ? '🔒 ' : ''}${d.name}`.slice(0, 100))
        .setDescription(
          (isLocked
            ? `Cần ${requirementLabel(d)} | Boss ${d.boss.name}`
            : `Boss ${d.boss.name} | HP ${d.boss.hp.toLocaleString()} | +${d.exp.toLocaleString()} EXP`
          ).slice(0, 100)
        )
        .setValue(`dungeon_${d.id}`)
        .setEmoji(isLocked ? '🔒' : '⛩️')
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await message.reply({ embeds: [embed], components: [row] });
}

export const DUNGEON_SKILL_MANA_COST = {
  HOANG_GIAI: 20,
  HUYEN_GIAI: 35,
  DIA_GIAI: 50,
  THIEN_GIAI: 70,
  THAN_GIAI: 100
};

export const DUNGEON_GEAR_MANA_COST = {
  HOANG_GIAI: 30,
  HUYEN_GIAI: 50,
  DIA_GIAI: 75,
  THIEN_GIAI: 100,
  THAN_GIAI: 150
};

export function createDungeonCombatEmbed(session) {
  const userHpBar = getProgressBar(session.userHp, session.userMaxHp, 10);
  const userMpBar = getProgressBar(session.userMp ?? 100, session.userMaxMp ?? 100, 10);
  const bossHpBar = getProgressBar(session.bossHp, session.bossMaxHp, 10);

  const embed = new EmbedBuilder()
    .setTitle(`⛩️ [CHIẾN BOSS BÍ CẢNH] ${session.userName} VS ${session.bossName}`)
    .setColor(session.bossHp <= 0 ? '#FFD700' : session.userHp <= 0 ? '#F44336' : '#9C27B0')
    .setDescription(
      `**Ải:** ${session.dungeonName}\n\n` +
      `**👤 ${session.userName}:**\n` +
      `❤️ HP: \`${session.userHp}/${session.userMaxHp}\` [${userHpBar}]\n` +
      `🔷 MP: \`${session.userMp}/${session.userMaxMp}\` [${userMpBar}]\n\n` +
      `**👹 ${session.bossName} (BOSS):**\n` +
      `💜 HP: \`${session.bossHp}/${session.bossMaxHp}\` [${bossHpBar}]\n\n` +
      `📜 **Diễn biến hiệp gần nhất:**\n${session.lastLog || '*Boss gầm thét, sát khí ngút trời! Hãy chọn chiêu thức ra đòn!*'}`
    );

  return embed;
}


// Cùng bố cục với săn thú: hàng 1 đánh thường + tối đa 4 công pháp,
// hàng 2 tối đa 2 pháp bảo + rút lui.
export function createDungeonCombatButtons(userId, equippedSkills = [], equippedGears = [], userMp = 100, isFinished = false) {
  if (isFinished) return [];

  const skills = pickCombatSkills(equippedSkills);
  const gears = pickCombatGears(equippedGears);

  const rowSkills = new ActionRowBuilder();
  rowSkills.addComponents(
    new ButtonBuilder().setCustomId(`dungeon_attack_normal_${userId}`).setLabel('🗡️ Đánh Thường (+15 MP)').setStyle(ButtonStyle.Primary)
  );

  skills.forEach((skill, idx) => {
    const skillCost = DUNGEON_SKILL_MANA_COST[skill.rarity] || 25;
    rowSkills.addComponents(
      new ButtonBuilder()
        .setCustomId(`dungeon_skill::${skill.skillId}::${idx}::${userId}`)
        .setLabel(trimButtonLabel(`🔥 ${skill.name} (${skillCost} MP)`))
        .setStyle(ButtonStyle.Danger)
        .setDisabled((userMp || 0) < skillCost)
    );
  });

  const rowSupport = new ActionRowBuilder();
  gears.forEach(gear => {
    const gearCost = DUNGEON_GEAR_MANA_COST[gear.rarity] || 40;
    rowSupport.addComponents(
      new ButtonBuilder()
        .setCustomId(`dungeon_gear_skill::${gear.gearId}::${userId}`)
        .setLabel(trimButtonLabel(`🔮 ${gear.combatSkill.name} (${gearCost} MP)`))
        .setStyle(ButtonStyle.Success)
        .setDisabled((userMp || 0) < gearCost)
    );
  });
  rowSupport.addComponents(
    new ButtonBuilder().setCustomId(`dungeon_flee_${userId}`).setLabel('🏃 Rút Khỏi Bí Cảnh').setStyle(ButtonStyle.Secondary)
  );

  return [rowSkills, rowSupport];
}

function getProgressBar(current, max, length = 10) {
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const filled = Math.floor((percent / 100) * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}
