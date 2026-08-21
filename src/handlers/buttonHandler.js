import { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { User } from '../database/models/User.js';
import { MarketItem } from '../database/models/MarketItem.js';
import { Sect } from '../database/models/Sect.js';
import { cultivate, buildTuluyenView, dangDungTruocNgaRe } from '../commands/prefix/cultivate.js';
import { buildLamcongView } from '../commands/prefix/work.js';
import { buildDaokhoangView } from '../commands/prefix/mining.js';


import { attemptBreakthrough, getRealmDisplayName, calculateUserMaxExp } from '../services/cultivationService.js';

import { getUserTalentPerks } from '../services/talentService.js';
import { spendResources } from '../services/economyService.js';
import { getSkillById, getAllSkills } from '../services/skillService.js';
import { combatSessions, createCombatEmbed, createCombatButtons, SKILL_MANA_COST, GEAR_MANA_COST, buildSanthuView } from '../commands/prefix/hunting.js';
import { dungeonCombatSessions, createDungeonCombatEmbed, createDungeonCombatButtons, DUNGEON_SKILL_MANA_COST, DUNGEON_GEAR_MANA_COST } from '../commands/prefix/dungeon.js';
import { createGearListEmbed, createGearListButtons, isAdmin } from '../commands/prefix/admin.js';
import { createInventoryView } from '../commands/prefix/inventory.js';
import { createGearView } from '../commands/prefix/equipment.js';
import { createSkillsView, createSellSkillView } from '../commands/prefix/skills.js';
import { createSectEmbed, createSectButtons, getSectMaxMembers, getSectBuffText } from '../commands/prefix/sect.js';
import { createPublicGearListEmbed, createPublicGearSelectMenu, createPublicGearButtons } from '../commands/prefix/baovat.js';
import { getPillById } from '../commands/prefix/alchemy.js';

import { dokiepSessions, createDokiepEmbed, createDokiepButtons } from '../commands/prefix/dokiep.js';


import { COOLDOWNS, setCooldown, checkBattleReady, claimCooldown } from '../utils/cooldown.js';
import { meetsRequirement, requirementLabel } from '../utils/power.js';
import { parseRepeatId, repeatRow } from '../utils/repeatButton.js';
import { TUTORIAL_CLAIM_PREFIX, claimAndBuildView } from '../commands/prefix/tutorial.js';
import { tutorialNudge } from '../services/tutorialService.js';
import {
  PVP_MIN_BET,
  PVP_CHALLENGE_TTL_MS,
  simulateDuel,
  settleWager,
  releaseChallenge
} from '../services/pvpService.js';
import { getFactionBuffs, getCritMultiplier, applyIncomingDamage } from '../services/factionService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const factionsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/factions.json'), 'utf8'));
const monstersConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/monsters.json'), 'utf8'));
const dungeonsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/dungeons.json'), 'utf8'));
const itemsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/items.json'), 'utf8'));
const recipesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/recipes.json'), 'utf8'));
const equipmentConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/equipment.json'), 'utf8'));

const RARITY_MULTIPLIERS = {
  HOANG_GIAI: 1.35,
  HUYEN_GIAI: 1.65,
  DIA_GIAI: 2.10,
  THIEN_GIAI: 2.75,
  THAN_GIAI: 3.80
};


// ── CƯỜNG HÓA TRANG BỊ ──
export const MAX_ENHANCE_LEVEL = 15;

// Tỉ lệ thành công giảm dần theo cấp: +0 = 98% ... +14 = 30% (sàn)
export function getEnhanceSuccessRate(level) {
  return Math.max(0.30, 0.98 - level * 0.05);
}

// Đồng bộ HP/MP còn lại sau trận về nhân vật (dùng ở nhánh thắng trận)
function u_syncCombatStats(user, session) {
  if (!user || !session) return;
  user.stats.maxHp = user.stats.maxHp || 100;
  user.stats.maxMp = user.stats.maxMp || 100;
  user.stats.hp = Math.max(1, Math.min(user.stats.maxHp, session.userHp ?? user.stats.hp));
  user.stats.mp = Math.max(0, Math.min(user.stats.maxMp, session.userMp ?? user.stats.mp));
}

// Ghi trạng thái chiến đấu (HP/MP/thuần thục) từ RAM về CSDL.
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

// Hàm hỗ trợ thưởng rớt trang bị Bậc 4 (Huyền Giai)
const GEAR_TIER_LABEL = {
  HOANG_GIAI: 'Bậc 3',
  HUYEN_GIAI: 'Bậc 4',
  DIA_GIAI: 'Bậc 5',
  THIEN_GIAI: 'Bậc 6',
  THAN_GIAI: 'Bậc 7'
};

/**
 * Rơi pháp bảo theo phẩm của nội dung vừa hạ (trường gearTier trong
 * monsters.json / dungeons.json). Trước đây mọi nguồn đều chỉ rơi HUYEN_GIAI
 * nên 33/60 pháp bảo (Địa / Thiên / Thần Giai) không có bất kỳ đường nào để
 * sở hữu trong game — chúng chỉ tồn tại trong Tàng Bảo Các để ngắm.
 */
function checkGearDrop(user, rate = 0.15, tier = 'HUYEN_GIAI') {
  if (Math.random() <= rate) {
    const pool = equipmentConfig.equipments.filter(e => e.rarity === tier);
    if (pool.length > 0) {
      const droppedGear = pool[Math.floor(Math.random() * pool.length)];
      user.equipments = user.equipments || [];
      const isOwned = user.equipments.some(e => e.gearId === droppedGear.id);
      if (!isOwned) {
        user.equipments.push({
          gearId: droppedGear.id,
          name: droppedGear.name,
          type: droppedGear.type,
          slot: droppedGear.slot,
          rarity: droppedGear.rarity,
          rarityName: droppedGear.rarityName,
          enhanceLevel: 0,
          stats: { ...droppedGear.stats },
          combatSkill: { ...droppedGear.combatSkill },
          imageUrl: droppedGear.imageUrl || '',
          equipped: false
        });
        return `\n🎁 **[CƠ DUYÊN BẢO VẬT]:** Nhặt được pháp bảo ${GEAR_TIER_LABEL[tier] || ''} **[${droppedGear.name}]** (\`${droppedGear.rarityName}\`)!`;
      }
    }
  }
  return '';
}



/**
 * Phát thưởng khi hạ yêu thú (`!santhu`).
 * Cũng gom về một chỗ: trước đây chỉ nhánh đánh thường mới nhân hệ số tư chất
 * và mới thực sự bỏ Yêu Đan vào túi, trong khi cả ba nhánh đều in dòng
 * "🎁 1 Yêu Đan" — kết liễu bằng công pháp hay pháp bảo là mất trắng.
 */
function grantHuntVictoryRewards(user, session) {
  // Dem o day chu khong dem luc bat dau san: bo chay giua tran thi khong tinh.
  user.counters = user.counters || {};
  user.counters.hunt = (user.counters.hunt || 0) + 1;
  user.realm.exp += session.exp;
  user.currencies.linhThach += session.linhThach;
  user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + session.nguyenThach;

  const yeuDanId = `yeu_dan_${session.beastId}`;
  const existingItem = user.inventory.find(i => i.itemId === yeuDanId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    user.inventory.push({
      itemId: yeuDanId,
      name: `Yêu Đan [${session.beastName}]`,
      type: 'DAN_DUOC',
      quantity: 1,
      desc: `Nội đan chứa linh khí thuần túy của ${session.beastName}`
    });
  }

  const herbGain = 1 + Math.floor((session.beastLevel || 1) / 4);
  const herbStack = user.inventory.find(i => i.itemId === 'linh_thao');
  if (herbStack) {
    herbStack.quantity += herbGain;
  } else {
    user.inventory.push({
      itemId: 'linh_thao',
      name: 'Linh Thảo',
      type: 'NGUYEN_LIEU',
      quantity: herbGain,
      desc: 'Dược thảo tươi đẫm linh khí, nguyên liệu chính của Lò Luyện Đan.'
    });
  }

  const dropMsg = checkGearDrop(user, session.gearDropRate ?? 0.15, session.gearTier || 'HUYEN_GIAI');
  const rewardLine =
    `✨ \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} Linh Thạch\` | 🔮 \`+${session.nguyenThach} Nguyên Thạch\` | 🎁 **1 Yêu Đan** | 🌿 \`+${herbGain} Linh Thảo\``;

  return { dropMsg, rewardLine };
}

/**
 * Phát thưởng khi hạ Boss bí cảnh.
 * Gom về một chỗ vì trước đây ba nhánh kết liễu (đánh thường / công pháp /
 * pháp bảo) trả thưởng khác nhau: đánh thường random Nguyên Thạch nhưng in ra
 * số max (nói dối người chơi), còn công pháp và pháp bảo luôn ăn trọn max và
 * mất hẳn tỉ lệ rớt bí kíp. Nay cả ba đi chung một đường.
 */
function grantDungeonVictoryRewards(user, session) {
  const min = session.nguyenThachMin ?? 0;
  const max = Math.max(min, session.nguyenThachMax ?? min);
  const nguyenThachEarned = Math.floor(Math.random() * (max - min + 1)) + min;

  user.realm.exp += session.exp;
  user.currencies.linhThach += session.linhThach;
  user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + nguyenThachEarned;

  let dropMsg = '';

  // Rớt bí kíp
  if (Math.random() <= (session.rareDropRate || 0)) {
    const allSkills = getAllSkills();
    const droppedSkill = allSkills[Math.floor(Math.random() * allSkills.length)];
    if (droppedSkill && !user.skills.some(s => s.skillId === droppedSkill.id)) {
      user.skills.push({
        skillId: droppedSkill.id,
        name: droppedSkill.name,
        category: droppedSkill.category,
        rarity: droppedSkill.rarity,
        mastery: 10,
        equipped: false
      });
      dropMsg += `\n🎁 **MỞ RƯƠNG BẢO VẬT:** Thu được bí kíp **[${droppedSkill.name}]** (${droppedSkill.rarity})!`;
    }
  }

  dropMsg += checkGearDrop(user, session.gearDropRate ?? 0.30, session.gearTier || 'HUYEN_GIAI');

  const rewardLine =
    `✨ \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} LT\` | 🔮 \`+${nguyenThachEarned} Nguyên Thạch\``;

  return { nguyenThachEarned, dropMsg, rewardLine };
}

// Bang tra: mot hanh dong -> ham dung man hinh tuong ung. Khai bao ngoai
// handleButton de khong dung lai object nay moi lan co nguoi bam nut.
const REPEAT_BUILDERS = {
  tuluyen: buildTuluyenView,
  lamcong: buildLamcongView,
  daokhoang: buildDaokhoangView,
  santhu: buildSanthuView
};

export async function handleButton(interaction) {
  const customId = interaction.customId;
  const clickerId = interaction.user.id;

  // 0. Nút 'làm lại' dưới kết quả các lệnh cày cuốc.
  //
  // Chạy lại đúng hàm dựng màn hình mà lệnh gõ tay dùng, rồi:
  //  · thành công  -> update() ngay tại tin nhắn cũ, kênh không bị ngập tin;
  //  · thất bại    -> báo riêng cho người bấm, giữ nguyên tin nhắn kèm nút để
  //                   họ bấm lại sau khi hết hồi chiêu (update() sẽ nuốt mất nút).
  const repeat = parseRepeatId(customId);
  if (repeat) {
    if (clickerId !== repeat.userId) {
      return interaction.reply({
        content: `⚠️ Nút này của đạo hữu khác! Hãy tự gõ lệnh của mình để nhận lượt riêng.`,
        flags: MessageFlags.Ephemeral
      });
    }
    const build = REPEAT_BUILDERS[repeat.action];
    if (!build) {
      return interaction.reply({ content: `❌ Nút đã cũ, hãy gõ lại lệnh.`, flags: MessageFlags.Ephemeral });
    }
    const payload = await build(repeat.userId);
    if (payload && payload.embeds) {
      return interaction.update({ embeds: payload.embeds, components: payload.components || [] });
    }
    return interaction.reply({
      content: (payload && payload.content) || `❌ Chưa thực hiện được, thử lại sau giây lát.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // 0b. Nút lĩnh thưởng chuỗi nhiệm vụ tân thủ.
  //
  // customId nhúng sẵn userId nên nút của người này bấm không ăn sang người kia.
  // Lớp chống nhận hai lần thật sự nằm ở tutorialService (lọc theo tutorial.step),
  // chỗ này chỉ chặn nhầm người cho đỡ khó hiểu.
  if (customId.startsWith(TUTORIAL_CLAIM_PREFIX)) {
    const ownerId = customId.slice(TUTORIAL_CLAIM_PREFIX.length);
    if (clickerId !== ownerId) {
      return interaction.reply({
        content: `⚠️ Đây là nhiệm vụ của đạo hữu khác! Gõ \`!tanthu\` để mở chuỗi của mình.`,
        flags: MessageFlags.Ephemeral
      });
    }
    const payload = await claimAndBuildView(ownerId);
    if (payload && payload.embeds) {
      return interaction.update({ embeds: payload.embeds, components: payload.components || [] });
    }
    return interaction.reply({
      content: (payload && payload.content) || `❌ Chưa lĩnh được, thử lại sau giây lát.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // 0.5 Ngã rẽ Luyện Khí Đỉnh Phong — hai nút này TỪNG KHÔNG CÓ NGƯỜI XỬ LÝ.
  //
  // Hậu quả: `!dotpha` ở Luyện Khí Đỉnh Phong luôn trả về màn hình chọn nhánh,
  // bấm nút thì Discord báo "interaction failed", và `attemptBreakthrough` không
  // bao giờ chạy tới. Không một ai vượt qua nổi đại cảnh giới đầu tiên —
  // `isLuyenKhiVanTang` cũng chẳng có chỗ nào trong `src/` đặt thành true.
  // Đây là bức tường chặn đứng toàn bộ tiến trình game, nên đừng gỡ khối này.
  if (customId.startsWith('btn_break_trucco_') || customId.startsWith('btn_break_nenkhi_')) {
    const chonNenKhi = customId.startsWith('btn_break_nenkhi_');
    const ownerId = customId.slice(chonNenKhi ? 'btn_break_nenkhi_'.length : 'btn_break_trucco_'.length);

    if (clickerId !== ownerId) {
      return interaction.reply({
        content: `⚠️ Ngã rẽ đại đạo này không phải của đạo hữu! Gõ \`!dotpha\` để mở ngã rẽ của mình.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const user = await User.findOne({ userId: ownerId });
    if (!user) {
      return interaction.reply({ content: `❌ Không tìm thấy dữ liệu nhân vật!`, flags: MessageFlags.Ephemeral });
    }

    // Đọc lại từ DB rồi mới kiểm tra: bảng nút cũ có thể nằm trong kênh cả
    // tiếng đồng hồ, người chơi đã đột phá bằng đường khác từ lâu.
    if (!dangDungTruocNgaRe(user)) {
      return interaction.reply({
        content: `⚠️ Ngã rẽ đã khép lại (cảnh giới hiện tại: **${user.realm.name}**). Gõ \`!dotpha\` để xem tình hình mới nhất.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (chonNenKhi) {
      // Một chiều, không có đường lui — nhưng chắc thắng, nên không cần cảnh báo
      // Hộ Mạch Đan. Lời cảnh báo "chọn rồi là vĩnh viễn" đã in trên màn hình.
      user.isLuyenKhiVanTang = true;
    }

    const result = attemptBreakthrough(user);
    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(result.success ? `✨ [TIẾN CẢNH ĐỘT PHÁ]` : `💥 [ĐỘT PHÁ TRẮC TRỞ]`)
      .setColor(result.success ? '#FFD700' : '#F44336')
      .setDescription(result.message);

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 1. Xử lý Chọn Trận Doanh khi Khởi Đầu
  if (customId.startsWith('choose_faction_')) {
    const parts = customId.split('_');
    const faction = parts[2] + (parts[3] && isNaN(parts[3]) ? '_' + parts[3] : '');
    const targetUserId = parts[parts.length - 1];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về đạo hữu!`, flags: MessageFlags.Ephemeral });
    }

    let user = await User.findOne({ userId: targetUserId });
    if (!user) {
      return interaction.reply({ content: `❌ Không tìm thấy dữ liệu nhân vật!`, flags: MessageFlags.Ephemeral });
    }

    const factionData = factionsConfig.factions[faction];
    if (!factionData) {
      return interaction.reply({ content: `❌ Trận doanh không hợp lệ!`, flags: MessageFlags.Ephemeral });
    }

    user.faction = faction;
    
    const starterSkillId = factionData.starterSkill;
    const starterSkillInfo = getSkillById(starterSkillId);
    if (starterSkillInfo && !user.skills.some(s => s.skillId === starterSkillId)) {
      user.skills.push({
        skillId: starterSkillInfo.id,
        name: starterSkillInfo.name,
        category: starterSkillInfo.category,
        rarity: starterSkillInfo.rarity,
        mastery: 20,
        equipped: true
      });
    }


    // Quà gia nhập lấy theo config để không lệch với bảng buff hiển thị
    const joinBuffs = getFactionBuffs(faction);
    user.stats.luck = (user.stats.luck || 10) + (joinBuffs.luckBonus || 0);

    if (faction === 'CHINH_DAO') {
      user.currencies.congDuc = 20;
    }
    if (faction === 'MA_DAO') {
      user.currencies.taTam = 30;
      user.stats.critRate = Math.max(user.stats.critRate || 0.05, 0.15);
    }

    // Hành trang tân thủ: đủ để thử ngay hai vòng lặp cốt lõi (uống đan và
    // luyện đan) trong năm phút đầu, thay vì phải cày mù mấy chục lượt mới
    // chạm tới hệ thống. Giá trị quy đổi ~90 Linh Thạch nên không lệch cân bằng.
    const STARTER_KIT = [
      { itemId: 'linh_thao', name: 'Linh Thảo', type: 'NGUYEN_LIEU', quantity: 3, desc: 'Dược thảo tươi đẫm linh khí, nguyên liệu chính của Lò Luyện Đan.' },
      { itemId: 'hoi_xuan_dan', name: 'Hồi Xuân Đan', type: 'DAN_DUOC', quantity: 2, desc: 'Đan dược hồi phục sinh mệnh tức thì.' }
    ];
    for (const gift of STARTER_KIT) {
      const stack = user.inventory.find(i => i.itemId === gift.itemId);
      if (stack) stack.quantity += gift.quantity;
      else user.inventory.push({ ...gift });
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`✨ [GIA NHẬP TRẬN DOANH] - ${factionData.tag}`)
      .setColor(factionData.color || '#4CAF50')
      .setDescription(
        `Chúc mừng đạo hữu **${user.username}** đã quy vị về **${factionData.name}**!\n\n` +

        `📖 **Tôn Chỉ:** ${factionData.desc}\n` +
        `⚡ **Đặc quyền:** ${factionData.buffText || 'Đang cập nhật'}\n` +
        `🎁 **Bí Kíp Khởi Đầu:** Đã tiếp nhận **[${starterSkillInfo ? starterSkillInfo.name : 'Cơ Bản Quyết'}]** vào Tàng Kinh Các.\n` +
        `🎒 **Hành Trang Tân Thủ:** 3x **Linh Thảo** · 2x **Hồi Xuân Đan** đã vào Túi Càn Khôn.\n\n` +

        `🧭 **CHỈ NAM TÂN THỦ — cứ làm ba việc này trước:**\n` +
        `**①** \`!tuluyen\` — bế quan hấp thụ linh khí. Đây là nguồn EXP chính, 10 giây một lượt.\n` +
        `**②** \`!diemdanh\` — nhận lộc trời và bói quẻ Thiên Cơ. Đi đủ 7 ngày liên tiếp có đại lễ.\n` +
        `**③** \`!santhu\` — săn yêu thú lấy **Yêu Đan** và **Linh Thảo**, nguyên liệu để \`!luyendan\`.\n\n` +

        `📈 Gom đủ tu vi thì gõ \`!dotpha\` để lên tầng. Xem toàn cảnh bản thân bằng \`!tupan\`.\n` +
        `📖 Lạc đường bất cứ lúc nào — gõ \`!help\` để mở Cẩm Nang Tu Chân.`
      );

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 2. Xử lý Bắt Đầu Săn Thú (Vào Trận Đánh Turn-Based)
  if (customId.startsWith('btn_start_hunt::') || customId.startsWith('btn_start_hunt_')) {
    let beastId, targetUserId;
    if (customId.includes('::')) {
      const parts = customId.split('::');
      beastId = parts[1];
      targetUserId = parts[2];
    } else {
      const parts = customId.replace('btn_start_hunt_', '').split('_');
      targetUserId = parts.pop();
      beastId = parts.join('_');
    }

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }

    let user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.`, flags: MessageFlags.Ephemeral });

    const beast = monstersConfig.beasts.find(b => b.id === beastId);
    if (!beast) return interaction.reply({ content: `❌ Thú không tồn tại!`, flags: MessageFlags.Ephemeral });

    // Menu đã lọc sẵn nhưng vẫn phải chặn lại ở đây: customId cũ nằm trong
    // lịch sử chat vẫn bấm lại được, và người chơi có thể đã rớt cảnh giới.
    if (!meetsRequirement(user, beast)) {
      return interaction.reply({
        content: `🔒 **[${beast.name}]** là yêu thú Cấp ${beast.level}, yêu khí quá nồng đậm!` +
          `\nCần đạt **${requirementLabel(beast)}** mới đủ sức đối đầu ` +
          `(hiện tại: **${user.realm.name} · Tầng ${user.realm.layer}**).`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (combatSessions && combatSessions[targetUserId]) {
      return interaction.reply({
        content: `⚔️ Đạo hữu đang trong trận chiến với **[${combatSessions[targetUserId].beastName}]**! Hãy hoàn thành trận đấu hiện tại trước.`,
        flags: MessageFlags.Ephemeral
      });
    }
    if (dungeonCombatSessions && dungeonCombatSessions[targetUserId]) {
      return interaction.reply({
        content: `⛩️ Đạo hữu đang khiêu chiến Boss trong bí cảnh! Hãy hoàn thành hoặc rút lui trước khi săn thú.`,
        flags: MessageFlags.Ephemeral
      });
    }


    // Chốt lượt săn bằng một câu lệnh nguyên tử trước khi dựng phiên chiến đấu.
    // Hai cú bấm sát nhau đều vượt qua được các kiểm tra phía trên vì giữa chúng
    // vẫn còn khe hở await.
    const claimedHunt = await claimCooldown(User, targetUserId, 'hunting');
    if (!claimedHunt) {
      return interaction.reply({ content: `⏳ Đạo hữu bấm quá nhanh, khí huyết chưa ổn định! Chờ thêm giây lát rồi săn tiếp.`, flags: MessageFlags.Ephemeral });
    }
    user = claimedHunt;

    let equippedSkills = user.skills.filter(s => s.equipped);
    if (equippedSkills.length === 0) equippedSkills = user.skills;


    const equippedGears = (user.equipments || []).filter(e => e.equipped);


    const huntBuffs = getFactionBuffs(user.faction);
    const huntPerks = getUserTalentPerks(user);

    combatSessions[targetUserId] = {
      factionBuffs: huntBuffs,
      lastDodged: false,
      userId: targetUserId,
      userName: user.daoName || user.username,
      userHp: user.stats.hp || 100,
      userMaxHp: user.stats.maxHp || 100,
      userMp: user.stats.mp ?? user.stats.maxMp ?? 100,
      userMaxMp: user.stats.maxMp || 100,

      userAtk: Math.floor((user.stats.atk || 15) * (1 + huntPerks.dmgBonus)),
      userDef: user.stats.def || 8,
      critRate: user.stats.critRate || 0.05,
      equippedSkills: equippedSkills,
      equippedGears: equippedGears,
      beastId: beast.id,
      beastName: beast.name,
      beastHp: beast.hp,
      beastMaxHp: beast.hp,
      beastAtk: beast.atk,
      beastDef: beast.def,

      // Hệ số tư chất nướng thẳng vào session để cả ba nhánh kết liễu ăn giống
      // nhau và con số in ra đúng bằng con số thực nhận. Trước đây chỉ nhánh
      // đánh thường nhân expMultiplier, đánh bằng công pháp/pháp bảo thì mất.
      exp: Math.floor(beast.exp * (1 + huntBuffs.expKillBonus) * (user.talent?.expMultiplier || 1)),
      linhThach: beast.linhThach,
      nguyenThach: beast.nguyenThach,
      gearDropRate: Math.min(0.60, 0.15 * (1 + huntBuffs.dropRateBonus)),
      gearTier: beast.gearTier || 'HUYEN_GIAI',
      beastLevel: beast.level || 1,
      lastActionTime: Date.now(),
      lastLog: `⚔️ **${user.daoName || user.username}** rút vũ khí xông vào chiến đấu với **${beast.name}**!`
    };

    const session = combatSessions[targetUserId];
    const embed = createCombatEmbed(session);
    const buttons = createCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);

    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 3. Xử lý Nút Đánh Thường Săn Thú
  if (customId.startsWith('combat_attack_normal_')) {
    const targetUserId = customId.replace('combat_attack_normal_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, flags: MessageFlags.Ephemeral });

    const session = combatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc hoặc không tồn tại!`, flags: MessageFlags.Ephemeral });

    session.lastActionTime = Date.now();

    // Hồi phục 15 MP khi đánh thường
    const mpRecovered = Math.min(15, session.userMaxMp - session.userMp);
    session.userMp = Math.min(session.userMaxMp, session.userMp + 15);

    const userDmg = Math.max(4, Math.floor(session.userAtk * (0.9 + Math.random() * 0.3) - session.beastDef * 0.4));
    session.beastHp = Math.max(0, session.beastHp - userDmg);

    let logText = `🗡️ **${session.userName}** xuất một chiêu đánh thường, gây **${userDmg} sát thương** và vận khí hồi phục **+${mpRecovered} MP**!`;

    if (session.beastHp <= 0) {
      delete combatSessions[targetUserId];

      const user = await User.findOne({ userId: targetUserId });
      let gearDropMsg = '';
      let huntNudge = '';
      let rewardLine = '';

      if (user) {
        const rewards = grantHuntVictoryRewards(user, session);
        gearDropMsg = rewards.dropMsg;
        rewardLine = rewards.rewardLine;
        u_syncCombatStats(user, session);
        await user.save();
        // Doc sau grantHuntVictoryRewards nen bo dem 'hunt' da +1: nguoi choi
        // thay ngay dong nhac trong chinh tin nhan bao chien thang.
        huntNudge = tutorialNudge(user);
      }

      session.lastLog = `${logText}\n\n🏆 **CHIẾN THẮNG!** Đạo hữu đã trảm sát **${session.beastName}**!\n✨ Nhận: ${rewardLine}${gearDropMsg}${huntNudge}`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: repeatRow('santhu', targetUserId) });
    }

    const beastDmg = applyIncomingDamage(session, Math.max(4, Math.floor(session.beastAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.4)));
    session.userHp = Math.max(0, session.userHp - beastDmg);
    logText += session.lastDodged
      ? `\n💨 **${session.userName}** thân pháp phiêu hốt, né sạch đòn phản kích của **${session.beastName}**!`
      : `\n👹 **${session.beastName}** gầm thét vồ tới, cắn xé gây **${beastDmg} sát thương** lên bạn!`;

    if (session.userHp <= 0) {
      delete combatSessions[targetUserId];
    await persistCombatState(targetUserId, session, { defeated: true });
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu đã bị trọng thương, đành phải vận chuyển độn thuật chạy về dưỡng thương!`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: repeatRow('santhu', targetUserId) });
    }

    await persistCombatState(targetUserId, session);
    session.lastLog = logText;
    const embed = createCombatEmbed(session);
    const buttons = createCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 4. Xử lý Nút Dùng Tuyệt Kỹ Công Pháp (Săn Thú)
  if (customId.startsWith('combat_skill::') || customId.startsWith('combat_attack_skill_')) {
    let skillId = null, targetUserId = clickerId;
    if (customId.startsWith('combat_skill::')) {
      const parts = customId.split('::');
      skillId = parts[1];
      targetUserId = parts[3];
    } else {
      targetUserId = customId.replace('combat_attack_skill_', '');
    }

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, flags: MessageFlags.Ephemeral });

    const session = combatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, flags: MessageFlags.Ephemeral });

    session.lastActionTime = Date.now();

    let user = await User.findOne({ userId: targetUserId });
    let skillName = 'Dẫn Khí Tuyệt Sát';
    let skillRarity = 'HOANG_GIAI';
    let skillMastery = 10;


    // Chỉ ĐỌC thông tin công pháp ở bước này — chưa cộng thuần thục
    let activeSkill = null;
    if (user && skillId) {
      activeSkill = user.skills.find(s => s.skillId === skillId) || null;
      if (activeSkill) {
        skillName = activeSkill.name;
        skillRarity = activeSkill.rarity;
        skillMastery = activeSkill.mastery;
      }
    }

    const skillCost = SKILL_MANA_COST[skillRarity] || 25;
    if (session.userMp < skillCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${skillCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, flags: MessageFlags.Ephemeral });
    }

    session.userMp -= skillCost;

    // Đủ MP và đòn đánh đã thực sự tung ra → mới cộng độ thuần thục
    if (activeSkill) {
      activeSkill.mastery = Math.min(100, activeSkill.mastery + 1);
    }

    const baseMult = RARITY_MULTIPLIERS[skillRarity] || 1.35;
    const masteryMult = 1 + (skillMastery / 300);
    const isCrit = Math.random() <= (session.critRate + 0.15);
    const finalMult = (baseMult * masteryMult) * (isCrit ? getCritMultiplier(session.factionBuffs) : 1.0);

    const userDmg = Math.max(8, Math.floor(session.userAtk * finalMult - session.beastDef * 0.3));
    session.beastHp = Math.max(0, session.beastHp - userDmg);

    let logText = `🔥 **${session.userName}** tiêu hao \`${skillCost} MP\` thi triển công pháp **[${skillName}]** (${skillRarity}) ${isCrit ? '💥 **[CHÍ MẠNG BẠO KÍCH!]**' : ''} giáng xuống **${userDmg} sát thương**!`;

    if (session.beastHp <= 0) {
      delete combatSessions[targetUserId];

      let gearDropMsg = '';
      let huntNudge = '';
      let rewardLine = '';
      if (user) {
        const rewards = grantHuntVictoryRewards(user, session);
        gearDropMsg = rewards.dropMsg;
        rewardLine = rewards.rewardLine;
        u_syncCombatStats(user, session);
        await user.save();
        // Doc sau grantHuntVictoryRewards nen bo dem 'hunt' da +1: nguoi choi
        // thay ngay dong nhac trong chinh tin nhan bao chien thang.
        huntNudge = tutorialNudge(user);
      }

      session.lastLog = `${logText}\n\n🏆 **CHIẾN THẮNG TUYỆT ĐỐI!** Một kích diệt sát **${session.beastName}**!\n✨ ${rewardLine}${gearDropMsg}${huntNudge}`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: repeatRow('santhu', targetUserId) });
    }

    const beastDmg = applyIncomingDamage(session, Math.max(4, Math.floor(session.beastAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.4)));
    session.userHp = Math.max(0, session.userHp - beastDmg);
    logText += session.lastDodged
      ? `\n💨 **${session.userName}** thân pháp phiêu hốt, né sạch đòn phản kích của **${session.beastName}**!`
      : `\n👹 **${session.beastName}** giãy giụa phản kích gây **${beastDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete combatSessions[targetUserId];
    await persistCombatState(user, session, { defeated: true });
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu kiệt sức, đành rút lui dưỡng thương!`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: repeatRow('santhu', targetUserId) });
    }

    await persistCombatState(user, session);
    session.lastLog = logText;
    const embed = createCombatEmbed(session);
    const buttons = createCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 5. Xử lý Nút Dùng Tuyệt Kỹ PHÁP BẢO / VŨ KHÍ (Tiêu hao Mana, Không giới hạn lượt)
  if (customId.startsWith('combat_gear_skill::')) {
    const parts = customId.split('::');
    const gearId = parts[1];
    const targetUserId = parts[2];

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, flags: MessageFlags.Ephemeral });

    const session = combatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, flags: MessageFlags.Ephemeral });

    session.lastActionTime = Date.now();

    let user = await User.findOne({ userId: targetUserId });
    const gear = user ? user.equipments.find(e => e.gearId === gearId || e.id === gearId) : null;
    const gearRarity = gear ? gear.rarity : 'HOANG_GIAI';
    const gearCost = GEAR_MANA_COST[gearRarity] || 40;

    if (session.userMp < gearCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${gearCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, flags: MessageFlags.Ephemeral });
    }

    session.userMp -= gearCost;

    const skillName = gear && gear.combatSkill ? gear.combatSkill.name : 'Pháp Bảo Uy Lực';
    const dmgMult = gear && gear.combatSkill ? (gear.combatSkill.damageMultiplier || 1.6) : 1.5;
    const lifestealRate = gear && gear.combatSkill ? (gear.combatSkill.lifesteal || 0) : 0;
    const healFlat = gear && gear.combatSkill ? (gear.combatSkill.heal || 0) : 0;

    const userDmg = Math.max(15, Math.floor(session.userAtk * dmgMult - session.beastDef * 0.25));
    session.beastHp = Math.max(0, session.beastHp - userDmg);

    let healMsg = '';
    if (lifestealRate > 0) {
      const healed = Math.floor(userDmg * lifestealRate);
      session.userHp = Math.min(session.userMaxHp, session.userHp + healed);
      healMsg = ` (🩸 Hút \`+${healed} HP\`)`;
    } else if (healFlat > 0) {
      session.userHp = Math.min(session.userMaxHp, session.userHp + healFlat);
      healMsg = ` (❤️ Hồi \`+${healFlat} HP\`)`;
    }

    let logText = `🔮 **${session.userName}** tiêu hao \`${gearCost} MP\` kích hoạt tuyệt kỹ Pháp Bảo **[${skillName}]** giáng xuống **${userDmg} sát thương**${healMsg}!`;

    if (session.beastHp <= 0) {
      delete combatSessions[targetUserId];

      let gearDropMsg = '';
      let huntNudge = '';
      let rewardLine = '';
      if (user) {
        const rewards = grantHuntVictoryRewards(user, session);
        gearDropMsg = rewards.dropMsg;
        rewardLine = rewards.rewardLine;
        u_syncCombatStats(user, session);
        await user.save();
        // Doc sau grantHuntVictoryRewards nen bo dem 'hunt' da +1: nguoi choi
        // thay ngay dong nhac trong chinh tin nhan bao chien thang.
        huntNudge = tutorialNudge(user);
      }

      session.lastLog = `${logText}\n\n🏆 **CHIẾN THẮNG TUYỆT ĐỐI!** Pháp bảo chấn sát **${session.beastName}**!\n✨ ${rewardLine}${gearDropMsg}${huntNudge}`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: repeatRow('santhu', targetUserId) });
    }

    const beastDmg = applyIncomingDamage(session, Math.max(4, Math.floor(session.beastAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.4)));
    session.userHp = Math.max(0, session.userHp - beastDmg);
    logText += session.lastDodged
      ? `\n💨 **${session.userName}** thân pháp phiêu hốt, né sạch đòn phản kích của **${session.beastName}**!`
      : `\n👹 **${session.beastName}** hoảng loạn cắn trả gây **${beastDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete combatSessions[targetUserId];
    await persistCombatState(user, session, { defeated: true });
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu kiệt sức, rút lui dưỡng thương!`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: repeatRow('santhu', targetUserId) });
    }

    await persistCombatState(user, session);
    session.lastLog = logText;
    const embed = createCombatEmbed(session);
    const buttons = createCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 6. Tháo chạy săn thú
  if (customId.startsWith('combat_flee_') || customId.startsWith('btn_cancel_hunt::') || customId.startsWith('btn_cancel_hunt_')) {
    const targetUserId = customId.replace('combat_flee_', '').replace('btn_cancel_hunt::', '').replace('btn_cancel_hunt_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });

    delete combatSessions[targetUserId];
    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('🏃 [TẨU THOÁT]').setColor('#757575').setDescription('Đạo hữu đã an toàn rút lui khỏi khu vực săn thú.')],
      components: repeatRow('santhu', targetUserId)
    });
  }

  // 7. Xử lý Bắt Đầu Đánh Boss Phó Bản
  if (customId.startsWith('btn_start_dungeon::') || customId.startsWith('btn_start_dungeon_')) {
    let dungeonId, targetUserId;
    if (customId.includes('::')) {
      const parts = customId.split('::');
      dungeonId = parts[1];
      targetUserId = parts[2];
    } else {
      const parts = customId.replace('btn_start_dungeon_', '').split('_');
      targetUserId = parts.pop();
      dungeonId = parts.join('_');
    }

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });

    let user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.`, flags: MessageFlags.Ephemeral });

    const dungeon = dungeonsConfig.dungeons.find(d => d.id === dungeonId);
    if (!dungeon) return interaction.reply({ content: `❌ Ải không tồn tại!`, flags: MessageFlags.Ephemeral });

    // minRealmId / minLayer trong dungeons.json trước đây chỉ để trang trí,
    // không chỗ nào kiểm tra — tân thủ vẫn mở được ải cuối rồi chết ngay.
    if (!meetsRequirement(user, dungeon)) {
      return interaction.reply({
        content: `🔒 Cấm chế của **[${dungeon.name}]** chưa chịu mở ra cho đạo hữu!` +
          `\nCần đạt **${requirementLabel(dungeon)}** ` +
          `(hiện tại: **${user.realm.name} · Tầng ${user.realm.layer}**).`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (dungeonCombatSessions && dungeonCombatSessions[targetUserId]) {
      return interaction.reply({
        content: `⛩️ Đạo hữu đang trong trận khiêu chiến Boss **[${dungeonCombatSessions[targetUserId].bossName}]**! Hãy hoàn thành hoặc rút lui trước.`,
        flags: MessageFlags.Ephemeral
      });
    }
    if (combatSessions && combatSessions[targetUserId]) {
      return interaction.reply({
        content: `⚔️ Đạo hữu đang trong trận săn thú! Hãy hoàn thành trận đấu trước khi vào phó bản.`,
        flags: MessageFlags.Ephemeral
      });
    }


    // Chốt lượt vào bí cảnh bằng một câu lệnh nguyên tử (xem ghi chú ở săn thú).
    const claimedDungeon = await claimCooldown(User, targetUserId, 'dungeon');
    if (!claimedDungeon) {
      return interaction.reply({ content: `⏳ Đạo hữu bấm quá nhanh, cửa bí cảnh chưa kịp mở lại! Chờ thêm giây lát.`, flags: MessageFlags.Ephemeral });
    }
    user = claimedDungeon;

    let equippedSkills = user.skills.filter(s => s.equipped);
    if (equippedSkills.length === 0) equippedSkills = user.skills;

    const equippedGears = (user.equipments || []).filter(e => e.equipped);


    const dgBuffs = getFactionBuffs(user.faction);
    const dgPerks = getUserTalentPerks(user);

    dungeonCombatSessions[targetUserId] = {
      factionBuffs: dgBuffs,
      lastDodged: false,
      userId: targetUserId,
      userName: user.daoName || user.username,
      userHp: user.stats.hp || 100,
      userMaxHp: user.stats.maxHp || 100,
      userMp: user.stats.mp ?? user.stats.maxMp ?? 100,
      userMaxMp: user.stats.maxMp || 100,

      userAtk: Math.floor((user.stats.atk || 15) * (1 + dgPerks.dmgBonus)),
      userDef: user.stats.def || 8,
      critRate: user.stats.critRate || 0.05,
      equippedSkills: equippedSkills,
      equippedGears: equippedGears,
      dungeonId: dungeon.id,
      dungeonName: dungeon.name,
      bossName: dungeon.boss.name,
      bossHp: dungeon.boss.hp,
      bossMaxHp: dungeon.boss.hp,
      bossAtk: dungeon.boss.atk,
      bossDef: dungeon.boss.def,

      exp: Math.floor(dungeon.exp * (1 + dgBuffs.expKillBonus) * (user.talent?.expMultiplier || 1)),
      linhThach: dungeon.linhThach,
      nguyenThachMin: dungeon.nguyenThachMin,
      nguyenThachMax: dungeon.nguyenThachMax,
      rareDropRate: Math.min(0.80, (dungeon.rareDropRate || 0) * (1 + dgBuffs.dropRateBonus)),
      gearDropRate: Math.min(0.75, (dungeon.gearDropRate ?? 0.30) * (1 + dgBuffs.dropRateBonus)),
      gearTier: dungeon.gearTier || 'HUYEN_GIAI',
      lastActionTime: Date.now(),
      lastLog: `⛩️ **${user.daoName || user.username}** bước vào trận nhãn, đối đầu trực tiếp với Thủ Lĩnh **${dungeon.boss.name}**!`
    };

    const session = dungeonCombatSessions[targetUserId];
    const embed = createDungeonCombatEmbed(session);
    const buttons = createDungeonCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 8. Xử lý Đánh Boss Thường trong Phó Bản
  if (customId.startsWith('dungeon_attack_normal_')) {
    const targetUserId = customId.replace('dungeon_attack_normal_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, flags: MessageFlags.Ephemeral });

    const session = dungeonCombatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, flags: MessageFlags.Ephemeral });

    session.lastActionTime = Date.now();

    // Hồi phục 15 MP khi đánh thường
    const mpRecovered = Math.min(15, session.userMaxMp - session.userMp);
    session.userMp = Math.min(session.userMaxMp, session.userMp + 15);

    const userDmg = Math.max(8, Math.floor(session.userAtk * (0.9 + Math.random() * 0.3) - session.bossDef * 0.35));
    session.bossHp = Math.max(0, session.bossHp - userDmg);
    let logText = `🗡️ **${session.userName}** xuất kiếm chém trúng yếu điểm của **${session.bossName}**, gây **${userDmg} sát thương** và vận khí hồi phục **+${mpRecovered} MP**!`;

    if (session.bossHp <= 0) {
      delete dungeonCombatSessions[targetUserId];

      const user = await User.findOne({ userId: targetUserId });
      let dropMsg = '';
      let rewardLine = '';

      if (user) {
        const rewards = grantDungeonVictoryRewards(user, session);
        dropMsg = rewards.dropMsg;
        rewardLine = rewards.rewardLine;
        u_syncCombatStats(user, session);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **ĐẠI THẮNG BÍ CẢNH!** Boss **${session.bossName}** đã bị tiêu diệt!\n${rewardLine}${dropMsg}`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const bossDmg = applyIncomingDamage(session, Math.max(8, Math.floor(session.bossAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.35)));
    session.userHp = Math.max(0, session.userHp - bossDmg);
    logText += session.lastDodged
      ? `\n💨 **${session.userName}** thân pháp phiêu hốt, né sạch đòn phản kích của **${session.bossName}**!`
      : `\n👹 **${session.bossName}** vung trượng đập nát hư không, giáng xuống **${bossDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete dungeonCombatSessions[targetUserId];
    await persistCombatState(targetUserId, session, { defeated: true });
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu trọng thương, phù bảo hộ cứu mạng truyền tống ra ngoài!`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    await persistCombatState(targetUserId, session);
    session.lastLog = logText;
    const embed = createDungeonCombatEmbed(session);
    const buttons = createDungeonCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 9. Xử lý Tuyệt Kỹ Boss trong Phó Bản
  if (customId.startsWith('dungeon_skill::') || customId.startsWith('dungeon_attack_skill_')) {
    let skillId = null, targetUserId = clickerId;
    if (customId.startsWith('dungeon_skill::')) {
      const parts = customId.split('::');
      skillId = parts[1];
      targetUserId = parts[3];
    } else {
      targetUserId = customId.replace('dungeon_attack_skill_', '');
    }

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, flags: MessageFlags.Ephemeral });

    const session = dungeonCombatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, flags: MessageFlags.Ephemeral });

    session.lastActionTime = Date.now();

    let user = await User.findOne({ userId: targetUserId });
    let skillName = 'Vô Thượng Thần Thông';
    let skillRarity = 'HOANG_GIAI';
    let skillMastery = 10;


    // Chỉ ĐỌC thông tin công pháp ở bước này — chưa cộng thuần thục
    let activeSkill = null;
    if (user && skillId) {
      activeSkill = user.skills.find(s => s.skillId === skillId) || null;
      if (activeSkill) {
        skillName = activeSkill.name;
        skillRarity = activeSkill.rarity;
        skillMastery = activeSkill.mastery;
      }
    }

    const skillCost = DUNGEON_SKILL_MANA_COST[skillRarity] || 25;
    if (session.userMp < skillCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${skillCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, flags: MessageFlags.Ephemeral });
    }

    session.userMp -= skillCost;

    // Đủ MP và đòn đánh đã thực sự tung ra → mới cộng độ thuần thục
    if (activeSkill) {
      activeSkill.mastery = Math.min(100, activeSkill.mastery + 1);
    }

    const baseMult = RARITY_MULTIPLIERS[skillRarity] || 1.35;
    const masteryMult = 1 + (skillMastery / 300);
    const isCrit = Math.random() <= (session.critRate + 0.15);
    const finalMult = (baseMult * masteryMult) * (isCrit ? getCritMultiplier(session.factionBuffs) : 1.0);

    const userDmg = Math.max(15, Math.floor(session.userAtk * finalMult - session.bossDef * 0.25));
    session.bossHp = Math.max(0, session.bossHp - userDmg);

    let logText = `🔥 **${session.userName}** tiêu hao \`${skillCost} MP\` thi triển tuyệt học **[${skillName}]** (${skillRarity}) ${isCrit ? '💥 **[BẠO KÍCH HOÀNG KIM!]**' : ''} gây **${userDmg} sát thương**!`;

    if (session.bossHp <= 0) {
      delete dungeonCombatSessions[targetUserId];

      let dropMsg = '';
      let rewardLine = '';
      if (user) {
        const rewards = grantDungeonVictoryRewards(user, session);
        dropMsg = rewards.dropMsg;
        rewardLine = rewards.rewardLine;
        u_syncCombatStats(user, session);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **ĐẠI THẮNG BÍ CẢNH!** Phá tan Boss **${session.bossName}**!\n${rewardLine}${dropMsg}`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const bossDmg = applyIncomingDamage(session, Math.max(10, Math.floor(session.bossAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.35)));
    session.userHp = Math.max(0, session.userHp - bossDmg);
    logText += session.lastDodged
      ? `\n💨 **${session.userName}** thân pháp phiêu hốt, né sạch đòn phản kích của **${session.bossName}**!`
      : `\n👹 **${session.bossName}** gào thét phản công gây **${bossDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete dungeonCombatSessions[targetUserId];
    await persistCombatState(user, session, { defeated: true });
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu kiệt sức, truyền tống thoát thân!`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    await persistCombatState(user, session);
    session.lastLog = logText;
    const embed = createDungeonCombatEmbed(session);
    const buttons = createDungeonCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 10. Xử lý Nút Dùng Tuyệt Kỹ PHÁP BẢO trong Phó Bản (Tiêu hao Mana, Không giới hạn lượt)
  if (customId.startsWith('dungeon_gear_skill::')) {
    const parts = customId.split('::');
    const gearId = parts[1];
    const targetUserId = parts[2];

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, flags: MessageFlags.Ephemeral });

    const session = dungeonCombatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, flags: MessageFlags.Ephemeral });

    session.lastActionTime = Date.now();

    let user = await User.findOne({ userId: targetUserId });
    const gear = user ? user.equipments.find(e => e.gearId === gearId || e.id === gearId) : null;
    const gearRarity = gear ? gear.rarity : 'HOANG_GIAI';
    const gearCost = DUNGEON_GEAR_MANA_COST[gearRarity] || 40;

    if (session.userMp < gearCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${gearCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, flags: MessageFlags.Ephemeral });
    }

    session.userMp -= gearCost;

    const skillName = gear && gear.combatSkill ? gear.combatSkill.name : 'Pháp Bảo Thần Uy';
    const dmgMult = gear && gear.combatSkill ? (gear.combatSkill.damageMultiplier || 1.8) : 1.6;
    const lifestealRate = gear && gear.combatSkill ? (gear.combatSkill.lifesteal || 0) : 0;
    const healFlat = gear && gear.combatSkill ? (gear.combatSkill.heal || 0) : 0;

    const userDmg = Math.max(25, Math.floor(session.userAtk * dmgMult - session.bossDef * 0.2));
    session.bossHp = Math.max(0, session.bossHp - userDmg);

    let healMsg = '';
    if (lifestealRate > 0) {
      const healed = Math.floor(userDmg * lifestealRate);
      session.userHp = Math.min(session.userMaxHp, session.userHp + healed);
      healMsg = ` (🩸 Hút \`+${healed} HP\`)`;
    } else if (healFlat > 0) {
      session.userHp = Math.min(session.userMaxHp, session.userHp + healFlat);
      healMsg = ` (❤️ Hồi \`+${healFlat} HP\`)`;
    }

    let logText = `🔮 **${session.userName}** tiêu hao \`${gearCost} MP\` phóng thích linh khí Pháp Bảo **[${skillName}]** oanh tạc trúng Boss **${userDmg} sát thương**${healMsg}!`;

    if (session.bossHp <= 0) {
      delete dungeonCombatSessions[targetUserId];

      let dropMsg = '';
      let rewardLine = '';
      if (user) {
        const rewards = grantDungeonVictoryRewards(user, session);
        dropMsg = rewards.dropMsg;
        rewardLine = rewards.rewardLine;
        u_syncCombatStats(user, session);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **ĐẠI THẮNG BÍ CẢNH!** Pháp bảo trấn sát Boss **${session.bossName}**!\n${rewardLine}${dropMsg}`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const bossDmg = applyIncomingDamage(session, Math.max(10, Math.floor(session.bossAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.35)));
    session.userHp = Math.max(0, session.userHp - bossDmg);
    logText += session.lastDodged
      ? `\n💨 **${session.userName}** thân pháp phiêu hốt, né sạch đòn phản kích của **${session.bossName}**!`
      : `\n👹 **${session.bossName}** gào thét cuồng nộ đánh trả gây **${bossDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete dungeonCombatSessions[targetUserId];
    await persistCombatState(user, session, { defeated: true });
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu trọng thương, truyền tống thoát thân!`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    await persistCombatState(user, session);
    session.lastLog = logText;
    const embed = createDungeonCombatEmbed(session);
    const buttons = createDungeonCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 11. Rút lui phó bản
  if (customId.startsWith('dungeon_flee_') || customId.startsWith('btn_cancel_dungeon::') || customId.startsWith('btn_cancel_dungeon_')) {
    const targetUserId = customId.replace('dungeon_flee_', '').replace('btn_cancel_dungeon::', '').replace('btn_cancel_dungeon_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });

    delete dungeonCombatSessions[targetUserId];
    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('🏃 [RÚT LUI]').setColor('#757575').setDescription('Đạo hữu đã an toàn rút khỏi cửa vào bí cảnh.')],
      components: []
    });
  }

  // 12. Xử lý Đúc Pháp Bảo (!ducphapbao)
  if (customId.startsWith('btn_start_craft::')) {
    const parts = customId.split('::');
    const recipeId = parts[1];
    const targetUserId = parts[2];

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });


    let user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.`, flags: MessageFlags.Ephemeral });

    const recipe = recipesConfig.recipes.find(r => r.id === recipeId);
    if (!recipe) return interaction.reply({ content: `❌ Công thức không tồn tại!`, flags: MessageFlags.Ephemeral });


    // ── KIỂM TRA ĐỦ NGUYÊN LIỆU TRƯỚC KHI TRỪ ──
    const needLT = recipe.requirements.linhThach || 0;
    const needNT = recipe.requirements.nguyenThach || 0;
    const haveLT = user.currencies.linhThach || 0;
    const haveNT = user.currencies.nguyenThach || 0;
    const missing = [];

    if (haveLT < needLT) missing.push(`💎 Linh Thạch: cần \`${needLT.toLocaleString()}\` (thiếu \`${(needLT - haveLT).toLocaleString()}\`)`);
    if (haveNT < needNT) missing.push(`🔮 Nguyên Thạch: cần \`${needNT}\` (thiếu \`${needNT - haveNT}\`)`);

    for (const req of (recipe.requirements.items || [])) {
      const invItem = user.inventory.find(i => i.itemId === req.itemId);
      const have = invItem ? invItem.quantity : 0;
      if (have < req.quantity) {
        missing.push(`📦 ${req.name || req.itemId}: cần \`${req.quantity}\` (thiếu \`${req.quantity - have}\`)`);
      }
    }

    if (missing.length > 0) {
      return interaction.reply({
        content: `❌ **Nguyên liệu không đủ để khởi lò!**\n\n${missing.join('\n')}\n\n` +
          `💡 *Săn quái (\`!santhu\`) để lấy Yêu Đan, đào khoáng (\`!daokhoang\`) để lấy Nguyên Thạch.*`,
        flags: MessageFlags.Ephemeral
      });
    }


    // Đủ điều kiện → trừ nguyên liệu bằng một lệnh atomic có điều kiện $gte.
    // Kiểm tra ở trên chỉ để báo lỗi cho đẹp; nó không chống được hai cú bấm
    // sát nhau vì giữa lúc đọc và lúc ghi vẫn còn khe hở.
    const spent = await spendResources(targetUserId, {
      linhThach: needLT,
      nguyenThach: needNT,
      items: (recipe.requirements.items || []).map(r => ({ itemId: r.itemId, quantity: r.quantity }))
    });

    if (!spent) {
      return interaction.reply({
        content: `❌ Nguyên liệu vừa thay đổi (đạo hữu bấm quá nhanh hoặc đã dùng ở nơi khác) — lò không khởi được. Gõ \`!ducphapbao\` để thử lại!`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Từ đây phải làm việc trên bản đã trừ; nếu save() cái document cũ thì
    // mảng inventory cũ sẽ đè ngược lại và nguyên liệu coi như được hoàn.
    user = spent;

    const baseGear = equipmentConfig.equipments.find(e => e.id === recipe.targetEquipmentId);
    const newGear = {
      gearId: baseGear ? baseGear.id : recipe.targetEquipmentId,
      name: baseGear ? baseGear.name : recipe.name,
      type: baseGear ? baseGear.type : 'VU_KHI',
      slot: baseGear ? baseGear.slot : 'weapon',
      rarity: baseGear ? baseGear.rarity : recipe.rarity,
      rarityName: baseGear ? baseGear.rarityName : 'Hoàng Giai',
      enhanceLevel: 0,
      stats: baseGear ? { ...baseGear.stats } : { atk: 15, def: 5, maxHp: 40, critRate: 0.02 },
      combatSkill: baseGear ? { ...baseGear.combatSkill } : { name: 'Thần Binh Trảm', damageMultiplier: 1.4, desc: 'Trảm kích' },
      imageUrl: baseGear ? (baseGear.imageUrl || '') : '',
      equipped: false
    };


    user.equipments = user.equipments || [];

    user.equipments.push(newGear);
    setCooldown(user, 'crafting');
    await user.save();
    // Nguyên liệu đã bị trừ nguyên tử ở trên nên không thể đúc trùng; ở đây chỉ
    // cần ghi lại mốc hồi chiêu cho lò.

    const embed = new EmbedBuilder()
      .setTitle(`✨ [ĐÚC THÀNH CÔNG THẦN BINH]`)
      .setColor('#FFD700')
      .setDescription(
        `Chân hỏa bùng nổ, dị tượng ngút trời!\n` +
        `Đạo hữu đã tôi luyện thành công: **[${newGear.name}]** (\`${newGear.rarityName}\`)!\n\n` +
        `📊 **Chỉ số:** 🗡️ ATK: \`+${newGear.stats.atk}\` | 🛡️ DEF: \`+${newGear.stats.def}\` | ❤️ HP: \`+${newGear.stats.maxHp}\`\n` +
        `🔥 **Tuyệt Kỹ:** **[${newGear.combatSkill.name}]** (*${newGear.combatSkill.desc}*)\n\n` +
        `👉 *Gõ \`!phapbao\` hoặc \`!trangbi\` để mặc ngay vào người!*`
      );

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 13. Hủy Đúc Pháp Bảo
  if (customId.startsWith('btn_cancel_craft::')) {
    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('🔥 [LÒ ĐÚC]').setColor('#757575').setDescription('Đã tắt ngọn lửa lò luyện khí.')],
      components: []
    });
  }

  // 14. Xử lý Mặc / Tháo Trang Bị (!phapbao)
  if (customId.startsWith('btn_equip_gear::')) {
    const parts = customId.split('::');
    const idx = parseInt(parts[1], 10);
    const targetUserId = parts[2];

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });

    let user = await User.findOne({ userId: targetUserId });
    if (!user || !user.equipments[idx]) return interaction.reply({ content: `❌ Trang bị không tồn tại!`, flags: MessageFlags.Ephemeral });

    const targetGear = user.equipments[idx];
    const willEquip = !targetGear.equipped;

    if (willEquip) {
      user.equipments.forEach(g => {
        if (g.slot === targetGear.slot && g.equipped) {
          g.equipped = false;
          user.stats.atk = Math.max(10, user.stats.atk - g.stats.atk);
          user.stats.def = Math.max(5, user.stats.def - g.stats.def);
          user.stats.maxHp = Math.max(100, user.stats.maxHp - g.stats.maxHp);
          user.stats.hp = Math.min(user.stats.maxHp, user.stats.hp);
        }
      });


      targetGear.equipped = true;
      user.stats.atk += targetGear.stats.atk;
      user.stats.def += targetGear.stats.def;
      user.stats.maxHp += targetGear.stats.maxHp;
      // Mặc giáp làm tăng thể chất -> được cộng đúng phần HP tối đa tăng thêm,
      // KHÔNG hồi đầy máu (nếu không sẽ thành nút hồi máu vô hạn).
      user.stats.hp = Math.min(user.stats.maxHp, (user.stats.hp || 0) + targetGear.stats.maxHp);
    } else {
      targetGear.equipped = false;
      user.stats.atk = Math.max(10, user.stats.atk - targetGear.stats.atk);
      user.stats.def = Math.max(5, user.stats.def - targetGear.stats.def);
      user.stats.maxHp = Math.max(100, user.stats.maxHp - targetGear.stats.maxHp);
      user.stats.hp = Math.min(user.stats.maxHp, user.stats.hp);
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(willEquip ? `⚔️ [TRANG BỊ THÀNH CÔNG]` : `📤 [ĐÃ THÁO TRANG BỊ]`)
      .setColor(willEquip ? '#4CAF50' : '#757575')
      .setDescription(
        `Đạo hữu đã ${willEquip ? 'trang bị' : 'tháo gỡ'} **[${targetGear.name}]**!\n\n` +
        `📊 **Thuộc tính nhân vật sau khi cập nhật:**\n` +
        `🗡️ **Công Kích:** \`${user.stats.atk}\` | 🛡️ **Phòng Ngự:** \`${user.stats.def}\` | ❤️ **Máu:** \`${user.stats.hp}/${user.stats.maxHp}\``
      );

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 15. Xử lý Cường Hóa Trang Bị (!phapbao)
  if (customId.startsWith('btn_enhance_gear::')) {
    const parts = customId.split('::');
    const idx = parseInt(parts[1], 10);
    const targetUserId = parts[2];

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });


    let user = await User.findOne({ userId: targetUserId });
    if (!user || !user.equipments[idx]) return interaction.reply({ content: `❌ Trang bị không tồn tại!`, flags: MessageFlags.Ephemeral });


    let gear = user.equipments[idx];
    const lv = gear.enhanceLevel || 0;

    // ── GIỚI HẠN CƯỜNG HÓA ──
    if (lv >= MAX_ENHANCE_LEVEL) {
      return interaction.reply({
        content: `🔒 **[${gear.name}]** đã đạt cấp cường hóa tối đa **+${MAX_ENHANCE_LEVEL}** — vật chất phàm tục không thể chịu thêm linh khí nữa!`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Chi phí tăng theo cấp số nhân để cân với sức mạnh tăng kép 8%
    const costLinhThach = Math.floor(150 * Math.pow(1.55, lv));
    const costNguyenThach = Math.floor(lv / 2) + 1;
    const successRate = getEnhanceSuccessRate(lv);

    if (user.currencies.linhThach < costLinhThach || (user.currencies.nguyenThach || 0) < costNguyenThach) {
      return interaction.reply({
        content: `❌ Không đủ tài nguyên cường hóa! Cần **${costLinhThach.toLocaleString()} Linh Thạch** + **${costNguyenThach} Nguyên Thạch** (Hiện có: \`${user.currencies.linhThach.toLocaleString()}\` LT | \`${user.currencies.nguyenThach || 0}\` NT).`,
        flags: MessageFlags.Ephemeral
      });
    }


    // Nguyên liệu bị tiêu hao dù thành công hay thất bại. Trừ atomic để spam
    // nút không thể cường hóa nhiều lần bằng một lần tiền.
    const spentEnhance = await spendResources(targetUserId, {
      linhThach: costLinhThach,
      nguyenThach: costNguyenThach
    });

    if (!spentEnhance) {
      return interaction.reply({
        content: `❌ Tài nguyên vừa thay đổi — không đủ để cường hóa! Cần **${costLinhThach.toLocaleString()} Linh Thạch** + **${costNguyenThach} Nguyên Thạch**.`,
        flags: MessageFlags.Ephemeral
      });
    }

    user = spentEnhance;
    gear = user.equipments[idx];

    // ── PHÁN ĐỊNH THÀNH BẠI ──
    if (Math.random() > successRate) {
      let downgradeMsg = '';
      // Từ +10 trở lên, thất bại có 20% nguy cơ tụt 1 cấp
      if (lv >= 10 && Math.random() < 0.20) {
        const dAtk = Math.max(2, Math.floor(gear.stats.atk / 1.08 * 0.08) + 1);
        const dDef = Math.max(1, Math.floor(gear.stats.def / 1.08 * 0.08) + 1);
        const dHp = Math.max(10, Math.floor(gear.stats.maxHp / 1.08 * 0.08) + 5);

        gear.enhanceLevel = lv - 1;
        gear.stats.atk = Math.max(1, gear.stats.atk - dAtk);
        gear.stats.def = Math.max(0, gear.stats.def - dDef);
        gear.stats.maxHp = Math.max(0, gear.stats.maxHp - dHp);

        if (gear.equipped) {
          user.stats.atk = Math.max(10, user.stats.atk - dAtk);
          user.stats.def = Math.max(5, user.stats.def - dDef);
          user.stats.maxHp = Math.max(100, user.stats.maxHp - dHp);
          user.stats.hp = Math.min(user.stats.maxHp, user.stats.hp);
        }
        downgradeMsg = `\n\n💔 **Linh văn trên thân binh nứt vỡ!** Cấp cường hóa tụt xuống **+${gear.enhanceLevel}**.`;
      }

      await user.save();

      const failEmbed = new EmbedBuilder()
        .setTitle(`💥 [CƯỜNG HÓA THẤT BẠI] - ${gear.name} (+${lv})`)
        .setColor('#D32F2F')
        .setDescription(
          `Búa thần giáng xuống, nhưng linh khí phản phệ bắn tung tóe!\n` +
          `Nguyên liệu hóa thành tro bụi: \`-${costLinhThach.toLocaleString()} LT\` | \`-${costNguyenThach} NT\`.${downgradeMsg}\n\n` +
          `🎲 *Tỉ lệ thành công ở cấp +${lv} là **${Math.round(successRate * 100)}%** — đạo hữu hãy thử lại!*`
        );
      return interaction.update({ embeds: [failEmbed], components: [] });
    }

    // ── THÀNH CÔNG ──
    gear.enhanceLevel = lv + 1;
    const atkBoost = Math.max(2, Math.floor(gear.stats.atk * 0.08) + 1);
    const defBoost = Math.max(1, Math.floor(gear.stats.def * 0.08) + 1);
    const hpBoost = Math.max(10, Math.floor(gear.stats.maxHp * 0.08) + 5);

    gear.stats.atk += atkBoost;
    gear.stats.def += defBoost;
    gear.stats.maxHp += hpBoost;

    if (gear.equipped) {
      user.stats.atk += atkBoost;
      user.stats.def += defBoost;
      user.stats.maxHp += hpBoost;
      // Tăng HP tối đa thì được cộng đúng phần tăng thêm, không hồi đầy máu
      user.stats.hp = Math.min(user.stats.maxHp, (user.stats.hp || 0) + hpBoost);
    }

    await user.save();

    const nextRate = gear.enhanceLevel >= MAX_ENHANCE_LEVEL
      ? '🔒 Đã đạt cấp tối đa'
      : `${Math.round(getEnhanceSuccessRate(gear.enhanceLevel) * 100)}% (chi phí ${Math.floor(150 * Math.pow(1.55, gear.enhanceLevel)).toLocaleString()} LT)`;

    const embed = new EmbedBuilder()
      .setTitle(`✨ [CƯỜNG HÓA THÀNH CÔNG] - ${gear.name} (+${gear.enhanceLevel})`)
      .setColor('#FFD700')
      .setDescription(
        `Thần binh phát sáng hào quang rực rỡ!\n` +
        `Trang bị **[${gear.name}]** đã tăng lên cấp **+${gear.enhanceLevel}/${MAX_ENHANCE_LEVEL}**!\n\n` +
        `📈 **Chỉ số hiện tại:**\n` +
        `🗡️ ATK: \`${gear.stats.atk}\` (+${atkBoost})\n` +
        `🛡️ DEF: \`${gear.stats.def}\` (+${defBoost})\n` +
        `❤️ HP: \`${gear.stats.maxHp}\` (+${hpBoost})\n\n` +
        `🎲 **Lần cường hóa kế tiếp:** ${nextRate}`
      );

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 16. Đóng Menu Trang Bị
  if (customId.startsWith('btn_cancel_gear::')) {
    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('🛡️ [TRANG BỊ]').setColor('#757575').setDescription('Đã đóng giao diện trang bị.')],
      components: []
    });
  }

  // 17. Xử lý Nuốt / Sử Dụng Vật Phẩm trong Túi Đồ (!tuido)
  if (customId.startsWith('btn_use_item::')) {
    const parts = customId.split('::');
    const itemId = parts[1];
    const itemIdx = parseInt(parts[2], 10);
    const targetUserId = parts[3];

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });

    let user = await User.findOne({ userId: targetUserId });
    if (!user || !user.inventory[itemIdx]) {
      return interaction.reply({ content: `❌ Vật phẩm không còn tồn tại trong túi đồ!`, flags: MessageFlags.Ephemeral });
    }

    const item = user.inventory[itemIdx];
    let expGained = 50;
    let healAmount = 100;
    let effectMsg = '';

    // Nuốt Yêu Đan từ các loài thú săn bắt
    if (item.itemId.startsWith('yeu_dan_')) {
      const beastId = item.itemId.replace('yeu_dan_', '');
      const beast = monstersConfig.beasts.find(b => b.id === beastId);
      const baseDanExp = beast ? (beast.danExp || 60) : 60;
      const baseDanHeal = beast ? (beast.danHeal || 150) : 150;

      expGained = Math.floor(baseDanExp * (user.talent.expMultiplier || 1.0));
      healAmount = baseDanHeal;
      effectMsg = `🔮 **HẤP THU [${item.name}]!** Yêu khí tinh thuần chuyển hóa thành chân khí dồi dào:\n✨ **+${expGained} EXP** Tu Vi\n❤️ **+${healAmount} HP** Hồi Phục Thể Lực!`;
    } else {
      const configItem = itemsConfig.consumables.find(i => i.id === item.itemId);
      if (configItem) {
        expGained = Math.floor(configItem.expGain * (user.talent.expMultiplier || 1.0));
        healAmount = configItem.healHp;
      }
      effectMsg = `💊 **NUỐT ĐAN DƯỢC THÀNH CÔNG!** Đan hỏa tỏa ra khắp tứ chi bách mạch:\n✨ **+${expGained} EXP** Tu Vi\n❤️ **+${healAmount} HP** Hồi Phục!`;
    }

    user.realm.exp += expGained;
    user.stats.hp = Math.min(user.stats.maxHp, user.stats.hp + healAmount);

    item.quantity -= 1;
    if (item.quantity <= 0) {
      user.inventory.splice(itemIdx, 1);
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`✨ [SỬ DỤNG VẬT PHẨM] - ${item.name}`)
      .setColor('#4CAF50')
      .setDescription(
        `${effectMsg}\n\n` +
        `📊 **Tu Vi hiện tại:** \`${user.realm.exp}/${user.realm.maxExp} EXP\`\n` +
        `❤️ **Sinh Mệnh hiện tại:** \`${user.stats.hp}/${user.stats.maxHp} HP\`\n` +
        `📦 **Số lượng còn lại trong túi:** \`x${Math.max(0, item.quantity)}\``
      );

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 18. Đóng túi đồ
  if (customId.startsWith('btn_cancel_inv::')) {
    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('🎒 [TÚI ĐỒ]').setColor('#757575').setDescription('Đã cất túi trữ vật vào đai lưng.')],
      components: []
    });
  }

  // 19. Nút Bán Đồ Lên Chợ Đen
  if (customId.startsWith('btn_open_sell_menu_')) {
    const targetUserId = customId.replace('btn_open_sell_menu_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });

    let user = await User.findOne({ userId: targetUserId });
    if (!user || user.skills.length === 0) {
      return interaction.reply({ content: `❌ Kho của bạn chưa có bí kíp nào để đăng bán!`, flags: MessageFlags.Ephemeral });
    }

    // Kho bí kíp không có trần nên phải phân trang, xem ghi chú trong skills.js.
    const view = createSellSkillView(user, 1);
    return interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
  }

  // 20. Nút Xem & Mua Ở Chợ Đen
  if (customId.startsWith('btn_open_market_')) {
    const items = await MarketItem.find({ active: true }).sort({ createdAt: -1 }).limit(10).lean();

    const embed = new EmbedBuilder()
      .setTitle(`🏪 [SÀN GIAO DỊCH CHỢ ĐEN]`)
      .setColor('#00BCD4')
      .setDescription(
        `Nơi giao thương tự do giữa các tu sĩ:\n` +
        `*(Chọn món đồ ở menu bên dưới để mua trực tiếp chỉ với 1 click)*\n\n`
      );

    if (items.length === 0) {
      embed.setDescription(`*Hiện tại chợ đen chưa có mặt hàng nào. Hãy dùng nút [Bán Đồ Lên Chợ Đen] để đăng bán!*`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`market_buy_select_${clickerId}`)
      .setPlaceholder('👉 Chọn bí kíp muốn mua...');

    items.forEach((item, idx) => {
      embed.addFields({
        name: `${idx + 1}. **${item.itemName}**`,
        value: `💎 Giá: **${item.price.toLocaleString()} Linh Thạch** | Người bán: **${item.sellerName}**`,
        inline: false
      });

      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${idx + 1}. ${item.itemName} (${item.price.toLocaleString()} LT)`)
          .setDescription(`Người bán: ${item.sellerName}`)
          .setValue(item._id.toString())
          .setEmoji('💎')
      );
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  }

  // 20a. Chuyển trang Tàng Kinh Các và menu bán bí kíp.
  if (customId.startsWith('btn_skill_page::') || customId.startsWith('btn_sell_page::')) {
    const isSell = customId.startsWith('btn_sell_page::');
    const [, rawPage, targetUserId] = customId.split('::');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Tàng Kinh Các này không thuộc về đạo hữu!`, flags: MessageFlags.Ephemeral });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) {
      return interaction.reply({
        content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const targetPage = parseInt(rawPage, 10) || 1;
    const view = isSell ? createSellSkillView(user, targetPage) : createSkillsView(user, targetPage);
    return interaction.update({ embeds: [view.embed], components: view.components });
  }

  // 20b. Chuyển trang Túi Càn Khôn và Kho Pháp Bảo.
  // Hai danh sách này dài theo thời gian chơi nên bắt buộc phải phân trang;
  // xem thêm ghi chú về trần 25 field / 25 lựa chọn trong inventory.js.
  if (customId.startsWith('btn_inv_page::') || customId.startsWith('btn_gear_page::')) {
    const isInv = customId.startsWith('btn_inv_page::');
    const [, rawPage, targetUserId] = customId.split('::');
    if (clickerId !== targetUserId) {
      return interaction.reply({
        content: isInv ? `⚠️ Túi đồ này không thuộc về đạo hữu!` : `⚠️ Kho trang bị này không thuộc về đạo hữu!`,
        flags: MessageFlags.Ephemeral
      });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) {
      return interaction.reply({
        content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const targetPage = parseInt(rawPage, 10) || 1;
    const view = isInv ? createInventoryView(user, targetPage) : createGearView(user, targetPage);
    return interaction.update({ embeds: [view.embed], components: view.components });
  }

  // 21. Nút Chuyển Trang Danh Sách Pháp Bảo (!admin listgear)
  if (customId.startsWith('btn_listgear_prev_') || customId.startsWith('btn_listgear_next_')) {
    const isPrev = customId.startsWith('btn_listgear_prev_');
    const parts = customId.split('_');
    const currentPage = parseInt(parts[3], 10) || 1;
    const targetUserId = parts[4];

    if (!isAdmin(clickerId)) {
      return interaction.reply({ content: `❌ Chỉ có Admin tối cao mới được chuyển trang danh sách này!`, flags: MessageFlags.Ephemeral });
    }

    const targetPage = isPrev ? currentPage - 1 : currentPage + 1;
    const { embed, page, totalPages } = createGearListEmbed(targetPage);
    const buttons = createGearListButtons(page, totalPages, clickerId);

    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 22. Xử lý Chấp Nhận Thách Đấu Lôi Đài (PVP)

  if (customId.startsWith('pvp_accept_')) {
    const parts = customId.split('_');
    const challengerId = parts[2];
    const targetUserId = parts[3];
    const betAmount = parseInt(parts[4], 10) || PVP_MIN_BET;
    const issuedAt = parseInt(parts[5], 10) || 0;

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Lời thách đấu này không dành cho bạn!`, flags: MessageFlags.Ephemeral });
    }

    // Chiến thư quá hạn -> không cho bấm nút cũ để "phục kích" sau vài giờ
    if (issuedAt && Date.now() - issuedAt > PVP_CHALLENGE_TTL_MS) {
      releaseChallenge(challengerId, targetUserId);
      return interaction.update({
        embeds: [new EmbedBuilder()
          .setTitle('⌛ [CHIẾN THƯ ĐÃ HẾT HẠN]')
          .setColor('#757575')
          .setDescription(`Chiến thư đã bay theo gió, không còn hiệu lực. Hãy phát chiến thư mới bằng \`!khieuchien @user <cược>\`.`)],
        components: []
      });
    }

    const challenger = await User.findOne({ userId: challengerId });
    const defender = await User.findOne({ userId: targetUserId });

    if (!challenger || !defender) {
      releaseChallenge(challengerId, targetUserId);
      return interaction.reply({ content: `❌ Dữ liệu người chơi không hợp lệ!`, flags: MessageFlags.Ephemeral });
    }

    if ((challenger.currencies.linhThach || 0) < betAmount) {
      releaseChallenge(challengerId, targetUserId);
      return interaction.update({
        embeds: [new EmbedBuilder()
          .setTitle('❌ [TỈ VÕ BỊ HUỶ]')
          .setColor('#F44336')
          .setDescription(`Người khiêu chiến **${challenger.daoName || challenger.username}** không còn đủ **${betAmount.toLocaleString()} Linh Thạch** để tỉ võ!`)],
        components: []
      });
    }

    if ((defender.currencies.linhThach || 0) < betAmount) {
      return interaction.reply({ content: `❌ Bạn không đủ **${betAmount.toLocaleString()} Linh Thạch** để tiếp nhận thách đấu!`, flags: MessageFlags.Ephemeral });
    }

    const defenderBattle = checkBattleReady(defender);
    if (!defenderBattle.ready) {
      return interaction.reply({
        content: `🩸 Đạo hữu đang trọng thương (\`${defenderBattle.hp}/${defenderBattle.maxHp}\` HP), cần tối thiểu \`${defenderBattle.need}\` HP mới lên đài được!`,
        flags: MessageFlags.Ephemeral
      });
    }

    releaseChallenge(challengerId, targetUserId);

    // ── GIAO ĐẤU THEO LƯỢT (bản cũ chỉ là 1 phép so sánh lực chiến) ──
    const duel = simulateDuel(challenger, defender);
    const challengerWins = duel.winner === 'challenger';
    const winnerDoc = challengerWins ? challenger : defender;
    const loserDoc = challengerWins ? defender : challenger;
    const winnerName = winnerDoc.daoName || winnerDoc.username;
    const loserName = loserDoc.daoName || loserDoc.username;

    // ── CHUYỂN CƯỢC NGUYÊN TỬ + ĐÓNG DẤU HỒI CHIÊU CHO CẢ HAI ──
    const settled = await settleWager(winnerDoc.userId, loserDoc.userId, betAmount, new Date());
    if (!settled.ok) {
      const why = settled.reason === 'INSUFFICIENT_LOSER'
        ? `**${loserName}** đã tiêu hết Linh Thạch trước khi trận đấu ngã ngũ — kèo huỷ, không ai mất gì.`
        : `Có trục trặc khi thanh toán tiền cược, trận đấu bị huỷ và Linh Thạch đã được hoàn lại.`;
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('❌ [TỈ VÕ BỊ HUỶ]').setColor('#F44336').setDescription(why)],
        components: []
      });
    }

    // Chỉ hiển thị 5 hiệp cuối để embed không vượt giới hạn ký tự của Discord
    const shownRounds = duel.log.slice(-5);
    const battleLog = shownRounds
      .map((r) => `**Hiệp ${r.round}**\n${r.lines.join('\n')}`)
      .join('\n\n') || '*Hai bên chưa kịp ra chiêu.*';
    const omitted = duel.log.length - shownRounds.length;

    const endNote = duel.reason === 'timeout'
      ? `⌛ Hết **${duel.rounds}** hiệp mà chưa phân thắng bại — trọng tài xử theo khí huyết còn lại.`
      : duel.reason === 'doubleKo'
        ? `💥 Lưỡng bại câu thương! Theo luật lôi đài, người thủ đài giành phần thắng.`
        : `🏁 Kết thúc ở **hiệp ${duel.rounds}**.`;

    const winnerHp = challengerWins ? duel.challengerHp : duel.defenderHp;
    const winnerMaxHp = challengerWins ? duel.challengerMaxHp : duel.defenderMaxHp;
    const loserHp = challengerWins ? duel.defenderHp : duel.challengerHp;
    const loserMaxHp = challengerWins ? duel.defenderMaxHp : duel.challengerMaxHp;

    const resultEmbed = new EmbedBuilder()
      .setTitle(`⚔️ [KẾT QUẢ TỈ VÕ LÔI ĐÀI]`)
      .setColor(challengerWins ? '#4CAF50' : '#2196F3')
      .setDescription(
        `Trận tỉ thí giữa **${challenger.daoName || challenger.username}** và **${defender.daoName || defender.username}** đã ngã ngũ!\n\n` +
        (omitted > 0 ? `*...(bỏ qua ${omitted} hiệp đầu)*\n\n` : '') +
        `${battleLog}\n\n${endNote}`
      )
      .addFields(
        {
          name: `🏆 Thắng: ${winnerName}`,
          value: `💰 **+${betAmount.toLocaleString()} Linh Thạch**\n❤️ Còn lại: ${winnerHp}/${winnerMaxHp} HP`,
          inline: true
        },
        {
          name: `💀 Thua: ${loserName}`,
          value: `💸 **-${betAmount.toLocaleString()} Linh Thạch**\n❤️ Còn lại: ${loserHp}/${loserMaxHp} HP`,
          inline: true
        }
      )
      .setFooter({ text: `Tỉ võ điểm đáo vi chỉ — máu trên lôi đài không ảnh hưởng máu thật. Hồi chiêu ${COOLDOWNS.pvp}s.` });

    return interaction.update({ embeds: [resultEmbed], components: [] });
  }

  // 23. Xử lý Từ Chối Thách Đấu Lôi Đài (PVP)
  if (customId.startsWith('pvp_decline_')) {
    const parts = customId.split('_');
    const challengerId = parts[2];
    const targetUserId = parts[3];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }


    releaseChallenge(challengerId, targetUserId);

    const defender = await User.findOne({ userId: targetUserId });
    const defenderName = defender ? (defender.daoName || defender.username) : 'Đối thủ';

    const declineEmbed = new EmbedBuilder()
      .setTitle(`🏳️ [TỪ CHỐI KHIÊU CHIẾN]`)
      .setColor('#757575')
      .setDescription(`Đạo hữu **${defenderName}** đã từ chối tiếp nhận chiến thư lôi đài.`);

    return interaction.update({ embeds: [declineEmbed], components: [] });
  }

  // 24. Xử lý Chấp Nhận Lời Mời Vào Bang
  if (customId.startsWith('sect_invite_accept_')) {
    const parts = customId.split('_');
    const sectId = parts[3];
    const targetUserId = parts[4];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Lời mời này không dành cho bạn!`, flags: MessageFlags.Ephemeral });
    }

    let user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.`, flags: MessageFlags.Ephemeral });

    if (user.sectId) {
      return interaction.reply({ content: `❌ Bạn đã ở trong một môn phái khác!`, flags: MessageFlags.Ephemeral });
    }

    const sect = await Sect.findById(sectId);
    if (!sect) return interaction.reply({ content: `❌ Tông môn này không còn tồn tại!`, flags: MessageFlags.Ephemeral });

    const maxMembers = getSectMaxMembers(sect.level);
    if (sect.members.length >= maxMembers) {
      return interaction.reply({ content: `❌ Sơn môn đã đủ đệ tử (${sect.members.length}/${maxMembers})!`, flags: MessageFlags.Ephemeral });
    }

    sect.members.push({
      userId: user.userId,
      username: user.daoName || user.username,
      role: 'MEMBER',
      contribution: 0,
      joinedAt: new Date()
    });
    sect.reputation += 10;
    await sect.save();

    user.sectId = sect._id;
    user.sectRole = 'MEMBER';
    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`🎉 [GIA NHẬP SƠN MÔN THÀNH CÔNG]`)
      .setColor('#4CAF50')
      .setDescription(
        `Chúc mừng đạo hữu **${user.daoName || user.username}** đã chính thức trở thành đệ tử của **[${sect.name}]**!\n\n` +
        `✨ Nhận ngay Buff Sơn Môn: \`${getSectBuffText(sect.level)}\`\n` +
        `👉 Hãy dùng lệnh \`!tongmon\` để xem thông tin và nhận nhiệm vụ bang!`
      );

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 25. Xử lý Từ Chối Lời Mời Vào Bang
  if (customId.startsWith('sect_invite_decline_')) {
    const parts = customId.split('_');
    const targetUserId = parts[4];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏳️ [TỪ CHỐI LỜI MỜI]`)
      .setColor('#757575')
      .setDescription(`Đạo hữu đã từ chối gia nhập môn phái.`);

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 26. Nút Mở Modal Nhập Số Linh Thạch Cống Hiến
  if (customId.startsWith('sect_btn_donate_')) {
    const parts = customId.split('_');
    const sectId = parts[3];
    const targetUserId = parts[4];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_sect_donate::${sectId}::${targetUserId}`)
      .setTitle('💎 CỐNG HIẾN LINH THẠCH TÔNG MÔN');

    const amountInput = new TextInputBuilder()
      .setCustomId('sect_donate_amount_input')
      .setLabel('Nhập số Linh Thạch muốn quyên góp:')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ví dụ: 100, 500, 1000, 5000...')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);

    const row = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  // 27. Nút Nâng Cấp Tông Môn
  if (customId.startsWith('sect_btn_upgrade_')) {
    const parts = customId.split('_');
    const sectId = parts[3];
    const targetUserId = parts[4];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }

    let user = await User.findOne({ userId: targetUserId });
    const sect = await Sect.findById(sectId);

    if (!user || !sect) return interaction.reply({ content: `❌ Dữ liệu không hợp lệ!`, flags: MessageFlags.Ephemeral });

    if (user.sectRole !== 'LEADER' && user.sectRole !== 'ELDER') {
      return interaction.reply({ content: `❌ Chỉ có Chưởng Môn hoặc Trưởng Lão mới có quyền nâng cấp sơn môn!`, flags: MessageFlags.Ephemeral });
    }

    const UPGRADE_COSTS = { 1: 1000, 2: 3000, 3: 8000, 4: 20000 };
    const cost = UPGRADE_COSTS[sect.level];

    if (!cost || sect.level >= 5) {
      return interaction.reply({ content: `🏛️ Tông Môn đã đạt tới cảnh giới cực hạn (Cấp 5 - Vạn Cổ Tối Cao)!`, flags: MessageFlags.Ephemeral });
    }

    if (sect.treasury.linhThach < cost) {
      return interaction.reply({
        content: `❌ Ngân Khố Bang không đủ Linh Thạch! Cần **${cost.toLocaleString()} LT** (Hiện có: **${sect.treasury.linhThach.toLocaleString()} LT**). Hãy vận động toàn bang dùng nút [💎 Góp 100 LT] hoặc lệnh \`!conghien\`!`,
        flags: MessageFlags.Ephemeral
      });
    }

    sect.treasury.linhThach -= cost;
    sect.level += 1;
    sect.arrayLevel += 1;
    sect.reputation += 100;
    await sect.save();

    const embed = createSectEmbed(sect, user);
    const buttons = createSectButtons(sect, targetUserId);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 28. Nút Nhiệm Vụ Bang Nhanh
  if (customId.startsWith('sect_btn_task_')) {
    const parts = customId.split('_');
    const sectId = parts[3];
    const targetUserId = parts[4];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }


    let user = await User.findOne({ userId: targetUserId });
    const sect = await Sect.findById(sectId);

    if (!user || !sect) return interaction.reply({ content: `❌ Dữ liệu không hợp lệ!`, flags: MessageFlags.Ephemeral });

    // sectId lấy từ customId của embed cũ nên có thể trỏ tới tông môn mà người
    // chơi đã rời khỏi. Không chặn thì họ vẫn cày uy danh cho bang cũ.
    if (String(user.sectId || '') !== String(sect._id)) {
      return interaction.reply({ content: `❌ Đạo hữu không còn là đệ tử của tông môn này!`, flags: MessageFlags.Ephemeral });
    }

    const now = new Date();
    if (user.cooldowns.sectTask) {
      const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.sectTask)) / 1000);
      if (elapsedSeconds < COOLDOWNS.sectTask) {
        const waitTime = COOLDOWNS.sectTask - elapsedSeconds;
        return interaction.reply({ content: `⏳ Đạo hữu vừa làm nhiệm vụ bang! Vui lòng nghỉ ngơi thêm **${waitTime}s**.`, flags: MessageFlags.Ephemeral });
      }
    }

    // Cổng chặn nguyên tử: bấm nút liên tục chỉ ăn đúng 1 lượt thưởng.
    const claimedTask = await claimCooldown(User, targetUserId, 'sectTask');
    if (!claimedTask) {
      return interaction.reply({ content: `⏳ Đạo hữu bấm quá nhanh, chấp sự đường chưa kịp ghi công! Chờ thêm giây lát.`, flags: MessageFlags.Ephemeral });
    }
    user = claimedTask;

    const tasks = [
      { title: '🛡️ [TUẦN TRA SƠN MÔN]', desc: 'Quét sạch tà tu dòm ngó, bảo vệ đại trận yên bình!', exp: 120, lt: 60, contrib: 15, rep: 8 },
      { title: '🌿 [THU THẬP LINH THẢO]', desc: 'Hái linh dược quý trong sơn cốc nạp vào Dược Đường môn phái!', exp: 100, lt: 80, contrib: 20, rep: 6 },
      { title: '👹 [TRẢM MA HỘ TRẬN]', desc: 'Hiệp lực tiêu diệt yêu thú quấy phá chân núi, uy danh vang xa!', exp: 180, lt: 100, contrib: 25, rep: 12 },
      { title: '🔨 [TU BỔ TRẬN PHÁP]', desc: 'Vận chuyển linh thạch gia cố các mắt trận Hộ Tông Đại Trận!', exp: 140, lt: 50, contrib: 30, rep: 10 }
    ];

    const task = tasks[Math.floor(Math.random() * tasks.length)];

    user.realm.exp += task.exp;
    user.currencies.linhThach += task.lt;

    sect.reputation += task.rep;
    const member = sect.members.find(m => m.userId === user.userId);
    if (member) member.contribution = (member.contribution || 0) + task.contrib;

    await user.save();
    await sect.save();

    const embed = createSectEmbed(sect, user);
    const buttons = createSectButtons(sect, targetUserId);

    await interaction.update({ embeds: [embed], components: buttons });
    return interaction.followUp({
      content: `🎉 **${task.title}:** ${task.desc}\n✨ \`+${task.exp} EXP\` | 💎 \`+${task.lt} LT\` | 🎖️ \`+${task.contrib} Cống Hiến\` | 🔥 \`+${task.rep} Uy Danh\`!`,
      flags: MessageFlags.Ephemeral
    });
  }

  // 29. Nút Xem BXH Vạn Phái
  if (customId.startsWith('sect_btn_top_')) {
    const sects = await Sect.find().sort({ level: -1, reputation: -1, 'treasury.linhThach': -1 }).limit(10).lean();
    const embed = new EmbedBuilder()
      .setTitle(`🏆 [BẢNG XẾP HẠNG VẠN PHÁI THIÊN HẠ]`)
      .setColor('#FFD700')
      .setDescription(`Danh sách các môn phái hùng mạnh nhất:\n\n`);

    if (sects.length === 0) {
      embed.setDescription(`*Chưa có Tông Môn nào được thành lập.*`);
    } else {
      sects.forEach((s, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
        embed.addFields({
          name: `${medal} **[${s.name}]** (Cấp ${s.level}) - ${s.faction}`,
          value: `👑 Chưởng Môn: **${s.leaderName}** | 👥 Đệ Tử: \`${s.members.length}\` | 🔥 Uy Danh: \`${s.reputation}\` | 💎 Ngân Khố: \`${s.treasury.linhThach.toLocaleString()} LT\``,
          inline: false
        });
      });
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // 30. Nút Rời Khỏi Bang
  if (customId.startsWith('sect_btn_leave_')) {
    const parts = customId.split('_');
    const sectId = parts[3];
    const targetUserId = parts[4];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }

    let user = await User.findOne({ userId: targetUserId });
    const sect = await Sect.findById(sectId);

    if (!user || !sect) return interaction.reply({ content: `❌ Dữ liệu không hợp lệ!`, flags: MessageFlags.Ephemeral });

    if (user.sectRole === 'LEADER') {
      if (sect.members.length > 1) {
        return interaction.reply({ content: `❌ Chưởng Môn không thể tùy tiện rời bang khi còn đệ tử! Hãy dùng lệnh \`!phongchuc @user LEADER\` để nhường ngôi Chưởng Môn trước!`, flags: MessageFlags.Ephemeral });
      } else {
        // Giải tán môn phái nếu chỉ còn 1 mình
        await Sect.findByIdAndDelete(sectId);
        user.sectId = null;
        user.sectRole = 'NONE';
        await user.save();

        return interaction.update({
          embeds: [new EmbedBuilder().setTitle('🏛️ [GIẢI TÁN TÔNG MÔN]').setColor('#757575').setDescription(`Chưởng Môn đã chính thức giải tán môn phái **[${sect.name}]**!`)],
          components: []
        });
      }
    }

    sect.members = sect.members.filter(m => m.userId !== targetUserId);
    await sect.save();

    user.sectId = null;
    user.sectRole = 'NONE';
    await user.save();

    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('🚪 [XUẤT SƯ RỜI BANG]').setColor('#757575').setDescription(`Đạo hữu đã chính thức rời khỏi môn phái **[${sect.name}]**, trở lại làm Tán Tu tiêu dao tự tại.`)],
      components: []
    });
  }

  // 31. Nút Chuyển Trang Danh Sách Bảo Vật Công Khai (!baovat)
  if (customId.startsWith('btn_public_gear_prev_') || customId.startsWith('btn_public_gear_next_')) {
    const isPrev = customId.startsWith('btn_public_gear_prev_');
    const raw = customId.replace(isPrev ? 'btn_public_gear_prev_' : 'btn_public_gear_next_', '');
    const parts = raw.split('_');
    const targetUserId = parts.pop();
    const currentPage = parseInt(parts.pop(), 10) || 1;
    const rarity = parts.join('_') || 'ALL';

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, flags: MessageFlags.Ephemeral });
    }

    const targetPage = isPrev ? currentPage - 1 : currentPage + 1;
    const { embed, page, totalPages } = createPublicGearListEmbed(rarity, targetPage);
    const menuRow = createPublicGearSelectMenu(rarity, clickerId);
    const buttonsRow = createPublicGearButtons(rarity, page, totalPages, clickerId);

    return interaction.update({ embeds: [embed], components: [menuRow, buttonsRow] });
  }

  // 32. Nút Khởi Hỏa Luyện Đan (!luyendan)
  if (customId.startsWith('btn_brew_pill::')) {
    const [, pillId, targetUserId] = customId.split('::');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải lò luyện đan của bạn!`, flags: MessageFlags.Ephemeral });


    let user = await User.findOne({ userId: clickerId });
    const pill = getPillById(pillId);
    if (!pill || !user) return interaction.reply({ content: `❌ Lỗi nạp dữ liệu đan dược!`, flags: MessageFlags.Ephemeral });

    if (!meetsRequirement(user, pill)) {
      return interaction.reply({
        content: `🔒 **[${pill.name}]** là phương thuốc ${pill.tierName}, dược lực quá mãnh liệt!\n` +
          `Cần đạt **${requirementLabel(pill)}** mới khống chế nổi hỏa hầu ` +
          `(hiện tại: **${user.realm.name} · Tầng ${user.realm.layer}**).`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Kiểm tra nguyên liệu
    const linhThaoItem = (user.inventory || []).find(i => i.itemId === 'linh_thao');
    const linhThaoCount = linhThaoItem ? linhThaoItem.quantity : 0;

    // Yêu Đan rơi theo TỪNG loài thú nên túi đồ luôn là nhiều chồng lẻ.
    // Bản cũ đòi một chồng duy nhất đủ số, trong khi bảng nguyên liệu lại cộng
    // tổng mọi chồng — hiện "18/18 ✅" nhưng bấm vào lại báo thiếu dược liệu.
    // Nay gom nhiều chồng, vẫn trừ nguyên tử trong đúng một câu lệnh Mongo.
    const yeuDanStacks = (user.inventory || []).filter(i => i.itemId.startsWith('yeu_dan_') && i.quantity > 0);
    const totalYeuDan = yeuDanStacks.reduce((sum, i) => sum + i.quantity, 0);
    const yeuDanSpend = [];
    let yeuDanNeed = pill.recipe.yeuDanCount;
    for (const stack of yeuDanStacks) {
      if (yeuDanNeed <= 0) break;
      const take = Math.min(stack.quantity, yeuDanNeed);
      yeuDanSpend.push({ itemId: stack.itemId, quantity: take });
      yeuDanNeed -= take;
    }

    if (linhThaoCount < pill.recipe.linhThao || totalYeuDan < pill.recipe.yeuDanCount || user.currencies.linhThach < pill.recipe.linhThach) {
      return interaction.reply({
        content: `❌ Dược liệu không đủ để khởi hỏa luyện đan!\n` +
          `🌿 Linh Thảo \`${linhThaoCount}/${pill.recipe.linhThao}\` | ` +
          `🐾 Yêu Đan \`${totalYeuDan}/${pill.recipe.yeuDanCount}\` | ` +
          `💎 Linh Thạch \`${(user.currencies.linhThach || 0).toLocaleString()}/${pill.recipe.linhThach.toLocaleString()}\``,
        flags: MessageFlags.Ephemeral
      });
    }


    // Trừ nguyên liệu atomic: kiểm tra ở trên không chặn được hai cú bấm sát
    // nhau, mà lò đan là chỗ dễ nhân bản đan dược nhất.
    const spentBrew = await spendResources(clickerId, {
      linhThach: pill.recipe.linhThach,
      items: [
        { itemId: 'linh_thao', quantity: pill.recipe.linhThao },
        ...yeuDanSpend
      ]
    });

    if (!spentBrew) {
      return interaction.reply({
        content: `❌ Dược liệu vừa thay đổi — lò đan tắt lửa! Gõ \`!luyendan\` để mở lại lò.`,
        flags: MessageFlags.Ephemeral
      });
    }

    user = spentBrew;

    // Dem luot luyen dan thanh cong (dieu kien nhiem vu tan thu). Dat sau
    // spendResources chu khong dat truoc: tru nguyen lieu that bai thi coi
    // nhu chua he mo lo.
    user.counters = user.counters || {};
    user.counters.pill = (user.counters.pill || 0) + 1;

    // Thêm đan vào inventory
    const existingPill = user.inventory.find(i => i.itemId === pill.id);
    if (existingPill) {
      existingPill.quantity += 1;
    } else {
      user.inventory.push({
        itemId: pill.id,
        name: pill.name,
        type: 'DAN_DUOC',
        quantity: 1,
        desc: pill.desc
      });
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`✨ [LUYỆN ĐAN THÀNH CÔNG] - ${pill.name}`)
      .setColor('#00E676')
      .setDescription(
        `🔥 Ngọn lửa đan hỏa bùng lên, lò luyện đan phát ra mùi thơm ngào ngạt thấu tận trời xanh!\n\n` +
        `🎉 Đạo hữu đã luyện chế thành công **1 viên [${pill.name}]** (${pill.tierName})!\n` +
        `📦 Đan dược đã được cất vào **Túi Trữ Vật**.\n\n` +
        `👉 Dùng lệnh \`!uongdan ${pill.id}\` để nuốt đan tăng tu vi hoặc \`!bandan ${pill.id} 1 <giá>\` để bán lên Chợ Trời!`
      );

    return interaction.update({ embeds: [embed], components: [] });
  }

  // 33. Xử lý Các Nút Thao Tác Độ Kiếp Thiên Lôi (!dokiep)
  if (customId.startsWith('dokiep_action_')) {
    const raw = customId.replace('dokiep_action_', '');
    const parts = raw.split('_');
    const targetUserId = parts.pop();
    const actionType = parts.join('_'); // chan_khi, phap_bao, dan_duoc, tong_mon

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Đây là lôi kiếp của tu sĩ khác, can thiệp bừa bãi sẽ bị thiên lôi tru diệt!`, flags: MessageFlags.Ephemeral });
    }


    const session = dokiepSessions[targetUserId];
    if (!session) {
      return interaction.reply({ content: `❌ Phiên độ kiếp đã kết thúc hoặc không tồn tại!`, flags: MessageFlags.Ephemeral });
    }
    session.lastActionTime = Date.now(); // Giữ phiên sống chừng nào còn thao tác

    let user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Không tìm thấy dữ liệu nhân vật!`, flags: MessageFlags.Ephemeral });

    // Sát thương cơ bản từng đạo lôi kiếp
    const baseDmgByStrike = [1000, 1800, 2800];
    const rawDmg = baseDmgByStrike[session.currentStrike - 1] || 1500;

    let damageMitigation = 0.20; // 20% giảm sát thương cơ bản
    let actionLog = '';

    // 1. Phân tích tác dụng từng loại hành động
    if (actionType === 'chan_khi') {
      const defBonus = Math.min(0.45, (session.totalDef / 200) * 0.35);
      damageMitigation += (0.25 + defBonus);
      actionLog = `🛡️ **${session.userName}** dồn toàn bộ chân khí hộ thể, ngưng tụ Hộ Thân Cương Khí cản lại phần lớn lôi lực!`;
    } else if (actionType === 'phap_bao') {
      const topGear = session.equippedGears.find(g => g.rarity === 'THAN_GIAI' || g.rarity === 'THIEN_GIAI' || g.rarity === 'DIA_GIAI');
      if (topGear) {
        const gearCut = topGear.rarity === 'THAN_GIAI' ? 0.60 : (topGear.rarity === 'THIEN_GIAI' ? 0.45 : 0.30);
        damageMitigation += gearCut;
        actionLog = `🔮 **${session.userName}** tế xuất thần binh **[${topGear.name}]**, bảo quang rực rỡ chém tan 1 nửa lôi quang!`;
      } else {
        damageMitigation += 0.15;
        actionLog = `🔮 **${session.userName}** xuất thủ binh khí thường, bị lôi điện đánh cháy xém, chỉ cản được một chút uy lực!`;
      }
    } else if (actionType === 'dan_duoc') {
      const hoMachDan = user.inventory.find(i => i.itemId === 'ho_mach_dan');
      const tuKhiDan = user.inventory.find(i => i.itemId === 'tu_khi_dan' || i.itemId === 'hoi_xuan_dan');

      if (hoMachDan) {
        damageMitigation += 0.55;
        session.currentHp = Math.min(session.maxHp, session.currentHp + 400);
        actionLog = `💊 **${session.userName}** dẫn động dược lực **[Hộ Mạch Đan]** trong đan điền, dược hương bảo bọc tâm mạch, hồi phục 400 HP và triệt tiêu hơn nửa lôi kiếp!`;
      } else if (tuKhiDan) {
        damageMitigation += 0.30;
        session.currentHp = Math.min(session.maxHp, session.currentHp + 250);
        actionLog = `💊 **${session.userName}** kích hoạt đan dược trong túi, hồi phục 250 HP và giảm bớt sát thương!`;
      } else {
        damageMitigation += 0.10;
        actionLog = `💊 Trong đan điền không có đan dược thích hợp, **${session.userName}** chỉ có thể gượng ép nuốt khí, chịu thương tổn khá nặng!`;
      }
    } else if (actionType === 'tong_mon') {
      if (user.sectId) {
        const sect = await Sect.findById(user.sectId).lean();
        const sectLevel = sect ? (sect.level || 1) : 1;
        const sectCut = 0.25 + (sectLevel * 0.08);
        damageMitigation += Math.min(0.65, sectCut);
        actionLog = `🏛️ **${session.userName}** kết nối đại trận **[${sect?.name || 'Tông Môn'}]**, Hộ Tông Trận Pháp sáng rực hấp thu phần lớn lôi đình cuồng bạo!`;
      } else {
        damageMitigation -= 0.10; // Tán tu không có môn phái mà dẫn lôi sẽ bị phản phệ
        actionLog = `🏛️ Đạo hữu là Tán Tu không có Hộ Tông Trận Pháp! Thiên lôi bị kích động cuồng bạo hơn, giáng thẳng xuống đầu!`;
      }
    }


    // Tính toán sát thương nhận vào thực tế.
    // Kháng thiên lôi bẩm sinh (Thiên Phẩm -30%) nhân sau cùng, nằm ngoài trần
    // 85% của các thủ đoạn chống đỡ nên vẫn còn giá trị ở đạo lôi thứ ba.
    const tribulationResist = getUserTalentPerks(user).tribulationResist || 0;
    const mitigatedDmg = Math.max(0, Math.floor(rawDmg * (1 - Math.min(0.85, damageMitigation)) - session.totalDef * 0.5));
    const finalDamage = Math.max(80, Math.floor(mitigatedDmg * (1 - tribulationResist)));
    session.currentHp = Math.max(0, session.currentHp - finalDamage);

    session.lastLog = `${actionLog}\n⚡ Sát thương lôi kiếp xuyên qua: **-${finalDamage} HP**!`;

    // 2. Kiểm tra nếu Thất Bại (HP <= 0)
    if (session.currentHp <= 0) {
      delete dokiepSessions[targetUserId];

      // Kiểm tra có Hộ Mạch Đan cứu mạng không
      const hoMachIdx = user.inventory.findIndex(i => i.itemId === 'ho_mach_dan');
      let protectionMsg = '';

      if (hoMachIdx !== -1) {
        user.inventory[hoMachIdx].quantity -= 1;
        if (user.inventory[hoMachIdx].quantity <= 0) user.inventory.splice(hoMachIdx, 1);
        user.realm.exp = Math.floor(user.realm.exp * 0.85); // Chỉ mất 15%
        protectionMsg = `\n\n🛡️ **HỘ MẠCH ĐAN PHÁT HUY TÁC DỤNG:** Dược lực thần kỳ tự động vỡ ra che chở đan điền, cứu đạo hữu một mạng khỏi phế bỏ tu vi (Chỉ hao hụt 15% Tu Vi)!`;
      } else {
        // TỤT TU VI: Rơi từ Kim Đan Đỉnh Phong xuống Kim Đan Trung Kỳ

        user.realm.layer = 2;
        user.realm.name = getRealmDisplayName('kim_dan', 2, false);

        user.realm.maxExp = calculateUserMaxExp(user, 'kim_dan', 2, false);
        user.realm.exp = 0;
        protectionMsg = `\n\n💀 Không có bảo dược hộ mệnh, Kim Đan bị lôi kiếp đánh nứt toác, tu vi bị đánh tụt thẳng về **Kim Đan Kỳ [Trung Kỳ]**!`;
      }

      await user.save();

      const embed = new EmbedBuilder()
        .setTitle(`💥 [ĐỘ KIẾP THẤT BẠI] - THIÊN LÔI TRẢM MỆNH`)
        .setColor('#D32F2F')
        .setDescription(
          `⚡ **Đạo Thiên Lôi thứ ${session.currentStrike}** quá hung hãn xé rách toàn bộ phòng ngự!\n` +
          `**${session.userName}** thổ huyết ngã quỵ, vỡ đan hóa anh bất thành!${protectionMsg}\n\n` +
          `💡 *Hãy chuẩn bị thêm Hộ Mạch Đan (\`!luyendan\`), rèn đúc Thần Binh (\`!ducphapbao\`) hoặc thăng cấp Tông Môn rồi hẵng độ kiếp lại!*`
        );

      return interaction.update({ embeds: [embed], components: [] });
    }

    // 3. Nếu còn sống qua đạo này
    if (session.currentStrike < 3) {
      session.currentStrike += 1;
      const nextEmbed = createDokiepEmbed(session);
      const nextButtons = createDokiepButtons(targetUserId);
      return interaction.update({ embeds: [nextEmbed], components: nextButtons });
    }

    // 4. VƯỢT QUA 3 ĐẠO THIÊN LÔI - THÀNH CÔNG VỠ ĐAN HÓA ANH!
    delete dokiepSessions[targetUserId];


    user.realm.id = 'nguyen_anh';
    user.realm.name = getRealmDisplayName('nguyen_anh', 1, false);
    user.realm.layer = 1;
    user.realm.exp = 0;

    user.realm.maxExp = calculateUserMaxExp(user, 'nguyen_anh', 1, false);
    user.stats.maxHp += 2000;
    user.stats.hp = user.stats.maxHp;
    user.stats.atk += 300;
    user.stats.def += 150;
    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`🌌 [ĐỘ KIẾP THÀNH CÔNG - NGUYÊN ANH ĐẠI THÀNH]`)
      .setColor('#FFD700')
      .setDescription(
        `🎉 **THIÊN ĐỊA QUỲ LẠY - VẠN ĐẠO QUY TÂM!**\n` +
        `**${session.userName}** ngửa mặt thét dài, Kim Đan vỡ tan ngưng tụ thành một tôn **Nguyên Anh Kim Thân Bất Tử** bay vút lên chín tầng mây xé toạc Lôi Vân!\n\n` +
        `👑 **Cảnh Giới Mới:** **[Nguyên Anh Kỳ - Sơ Kỳ]**\n` +
        `💥 **Sức Mạnh Tăng Vọt:** \`+2,000 Max HP\` | \`+300 ATK\` | \`+150 DEF\`\n` +
        `🔮 **Đặc Quyền Nguyên Anh:** Khí tức Lão Tổ trấn áp vạn chúng sinh linh toàn server!\n\n` +
        `🏆 *Chúc mừng đạo hữu đã chính thức bước vào hàng ngũ Cự Đầu Tu Chân Giới!*`
      );

    return interaction.update({ embeds: [embed], components: [] });
  }
}
