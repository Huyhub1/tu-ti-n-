import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { User } from '../../database/models/User.js';
import { checkCooldown, formatWait, checkBattleReady } from '../../utils/cooldown.js';
import { meetsRequirement, requirementLabel } from '../../utils/power.js';
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
// `.unref()` ở cuối để bộ đếm không giữ tiến trình Node sống: bot vẫn chạy nhờ
// kết nối websocket của Discord, nhưng script kiểm thử nào lỡ nạp file này sẽ
// treo vĩnh viễn nếu thiếu — và bot cũng không thoát sạch khi tắt.
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
}, 60 * 1000).unref?.();

/**
 * Dựng màn hình chọn yêu thú (kèm mọi lớp kiểm tra trước trận).
 *
 * Tách khỏi executeSanthu để nút 'Săn tiếp' ở màn kết trận mở lại đúng menu
 * này mà không phải gõ lệnh: xong một con là chọn con kế tiếp ngay tại chỗ.
 *
 * Trả { content } khi chưa đi săn được (đang trong trận khác, còn hồi chiêu,
 * còn trọng thương) và { embeds, components } khi mở được menu.
 */
export async function buildSanthuView(userId) {
  const user = await User.findOne({ userId });

  if (!user) return { content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` };


  if (combatSessions[userId]) {
    return {
      content: `⚔️ Đạo hữu đang trong trận chiến với **[${combatSessions[userId].beastName}]**! Hãy hoàn thành trận đấu hiện tại trước khi bắt đầu cuộc đi săn mới.`
    };
  }

  const cd = checkCooldown(user, 'hunting');
  if (!cd.ready) {
    return {
      content: `⏳ Đạo hữu vừa đi săn về, khí huyết chưa ổn định! Vui lòng nghỉ thêm **${formatWait(cd.waitTime)}**.`
    };
  }

  const battle = checkBattleReady(user);
  if (!battle.ready) {
    return {
      content: `🩸 **Trọng thương chưa lành!** Máu hiện tại \`${battle.hp}/${battle.maxHp}\` — cần tối thiểu \`${battle.need}\` HP mới đủ sức xông trận.\n` +
        `💊 Hãy dùng \`!uongdan hoi_xuan_dan\` để hồi phục, hoặc \`!tuluyen\` để vận công dưỡng thương.`
    };
  }
  if (dungeonCombatSessions && dungeonCombatSessions[userId]) {
    return {
      content: `⛩️ Đạo hữu đang khiêu chiến Boss **[${dungeonCombatSessions[userId].bossName}]** trong bí cảnh! Hãy hoàn thành hoặc rút lui trước khi săn thú.`
    };
  }

  // Danh sách 20 con thú trải dài từ Phàm Nhân tới Nguyên Anh Đỉnh Phong.
  // Chỉ bày ra những con vừa tầm: 8 con mạnh nhất trong khả năng + 2 con khoá
  // phía trên làm mục tiêu phấn đấu. Bày cả 20 con vừa rối mắt vừa dụ tân thủ
  // lao đầu vào Hỗn Độn Ma Thần Hống rồi chết oan.
  const beasts = monstersConfig.beasts;
  const unlocked = beasts.filter(b => meetsRequirement(user, b));
  const locked = beasts.filter(b => !meetsRequirement(user, b)).slice(0, 2);
  const shown = unlocked.slice(-8).concat(locked);

  const embed = new EmbedBuilder()
    .setTitle(`🦁 [SĂN BẮT YÊU THÚ NGOẠI MÔN]`)
    .setColor('#4CAF50')
    .setDescription(
      `Khu rừng rậm rạp sau núi toát ra nhiều luồng yêu khí khác nhau.\n` +
      `Cảnh giới hiện tại: **${user.realm.name} · Tầng ${user.realm.layer}** — đã mở khoá ` +
      `**${unlocked.length}/${beasts.length}** loài yêu thú.\n\n` +
      `👉 **Hãy chọn một loài Yêu Thú ở menu bên dưới để do thám thông tin:**`
    );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`hunt_select_beast_${userId}`)
    .setPlaceholder('👉 Chọn con thú muốn săn bắt...');

  shown.forEach(b => {
    const isLocked = !meetsRequirement(user, b);
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${isLocked ? '🔒 ' : ''}Cấp ${b.level}. ${b.name}`.slice(0, 100))
        .setDescription(
          (isLocked
            ? `Cần ${requirementLabel(b)} | HP ${b.hp} | Công ${b.atk}`
            : `HP ${b.hp} | Công ${b.atk} | Thủ ${b.def} | +${b.exp} EXP, +${b.linhThach} LT`
          ).slice(0, 100)
        )
        .setValue(`beast_${b.id}`)
        .setEmoji(isLocked ? '🔒' : '🐾')
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embeds: [embed], components: [row] };
}

export async function executeSanthu(message) {
  await message.reply(await buildSanthuView(message.author.id));
}

export const SKILL_MANA_COST = {
  HOANG_GIAI: 20,
  HUYEN_GIAI: 35,
  DIA_GIAI: 50,
  THIEN_GIAI: 70,
  THAN_GIAI: 100
};


// Discord chỉ cho 5 nút mỗi hàng và nhãn tối đa 80 ký tự.
export const MAX_COMBAT_SKILL_BUTTONS = 4;
export const MAX_COMBAT_GEAR_BUTTONS = 2;

export function trimButtonLabel(label) {
  return label.length <= 80 ? label : `${label.slice(0, 77)}...`;
}

/**
 * Lọc danh sách công pháp dùng được trong trận: bỏ trùng skillId (Discord từ
 * chối cả tin nhắn nếu có 2 customId giống nhau), ưu tiên phẩm cao rồi thuần
 * thục cao, cắt còn tối đa 4 nút.
 */
export function pickCombatSkills(equippedSkills = []) {
  const seen = new Set();
  return (equippedSkills || [])
    .filter(s => {
      if (!s || !s.skillId || seen.has(s.skillId)) return false;
      seen.add(s.skillId);
      return true;
    })
    .sort((a, b) => {
      const rank = (SKILL_MANA_COST[b.rarity] || 0) - (SKILL_MANA_COST[a.rarity] || 0);
      return rank !== 0 ? rank : (b.mastery || 0) - (a.mastery || 0);
    })
    .slice(0, MAX_COMBAT_SKILL_BUTTONS);
}

// Chỉ pháp bảo thực sự có tuyệt kỹ mới thành nút; trùng gearId thì bỏ.
export function pickCombatGears(equippedGears = []) {
  const seen = new Set();
  return (equippedGears || [])
    .filter(g => {
      if (!g || !g.combatSkill || !g.combatSkill.name) return false;
      const key = g.gearId || g.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_COMBAT_GEAR_BUTTONS);
}

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


/**
 * Dựng bảng nút giao chiến.
 * Trước đây chỉ vẽ đúng 1 công pháp và 1 pháp bảo dù `!tangkinhcac` hứa
 * "tối đa kích hoạt 4 công pháp khi giao chiến" — nay vẽ đủ số đã kích hoạt.
 * Hàng 1: đánh thường + tối đa 4 công pháp (giới hạn 5 nút/hàng của Discord)
 * Hàng 2: tối đa 2 pháp bảo + tháo chạy
 */
export function createCombatButtons(userId, equippedSkills = [], equippedGears = [], userMp = 100, isFinished = false) {
  if (isFinished) return [];

  const skills = pickCombatSkills(equippedSkills);
  const gears = pickCombatGears(equippedGears);

  const rowSkills = new ActionRowBuilder();
  rowSkills.addComponents(
    new ButtonBuilder().setCustomId(`combat_attack_normal_${userId}`).setLabel('🗡️ Đánh Thường (+15 MP)').setStyle(ButtonStyle.Primary)
  );

  skills.forEach((skill, idx) => {
    const skillCost = SKILL_MANA_COST[skill.rarity] || 25;
    rowSkills.addComponents(
      new ButtonBuilder()
        .setCustomId(`combat_skill::${skill.skillId}::${idx}::${userId}`)
        .setLabel(trimButtonLabel(`🔥 ${skill.name} (${skillCost} MP)`))
        .setStyle(ButtonStyle.Danger)
        .setDisabled((userMp || 0) < skillCost)
    );
  });

  const rowSupport = new ActionRowBuilder();
  gears.forEach(gear => {
    const gearCost = GEAR_MANA_COST[gear.rarity] || 40;
    rowSupport.addComponents(
      new ButtonBuilder()
        .setCustomId(`combat_gear_skill::${gear.gearId}::${userId}`)
        .setLabel(trimButtonLabel(`🔮 ${gear.combatSkill.name} (${gearCost} MP)`))
        .setStyle(ButtonStyle.Success)
        .setDisabled((userMp || 0) < gearCost)
    );
  });
  rowSupport.addComponents(
    new ButtonBuilder().setCustomId(`combat_flee_${userId}`).setLabel('🏃 Tháo Chạy').setStyle(ButtonStyle.Secondary)
  );

  return [rowSkills, rowSupport];
}

function getProgressBar(current, max, length = 10) {
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const filled = Math.floor((percent / 100) * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}
