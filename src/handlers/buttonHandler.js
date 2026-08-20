import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { User } from '../database/models/User.js';
import { MarketItem } from '../database/models/MarketItem.js';
import { Sect } from '../database/models/Sect.js';
import { cultivate } from '../commands/prefix/cultivate.js';
import { attemptBreakthrough } from '../services/cultivationService.js';
import { getSkillById, getAllSkills } from '../services/skillService.js';
import { combatSessions, createCombatEmbed, createCombatButtons, SKILL_MANA_COST, GEAR_MANA_COST } from '../commands/prefix/hunting.js';
import { dungeonCombatSessions, createDungeonCombatEmbed, createDungeonCombatButtons, DUNGEON_SKILL_MANA_COST, DUNGEON_GEAR_MANA_COST } from '../commands/prefix/dungeon.js';
import { createGearListEmbed, createGearListButtons, isAdmin } from '../commands/prefix/admin.js';
import { createSectEmbed, createSectButtons, getSectMaxMembers, getSectBuffText } from '../commands/prefix/sect.js';
import { createPublicGearListEmbed, createPublicGearSelectMenu, createPublicGearButtons } from '../commands/prefix/baovat.js';
import { getPillById } from '../commands/prefix/alchemy.js';
import { dokiepSessions, createDokiepEmbed, createDokiepButtons } from '../commands/prefix/dokiep.js';
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

// Hàm hỗ trợ thưởng rớt trang bị Bậc 4 (Huyền Giai)
function checkHuyenGiaiDrop(user, rate = 0.15) {
  if (Math.random() <= rate) {
    const huyenGiaiGears = equipmentConfig.equipments.filter(e => e.rarity === 'HUYEN_GIAI');
    if (huyenGiaiGears.length > 0) {
      const droppedGear = huyenGiaiGears[Math.floor(Math.random() * huyenGiaiGears.length)];
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
        return `\n🎁 **[CƠ DUYÊN BẢO VẬT]:** Nhặt được pháp bảo Bậc 4 **[${droppedGear.name}]** (\`${droppedGear.rarityName}\`)!`;
      }
    }
  }
  return '';
}

export async function handleButton(interaction) {
  const customId = interaction.customId;
  const clickerId = interaction.user.id;

  // 1. Xử lý Chọn Trận Doanh khi Khởi Đầu
  if (customId.startsWith('choose_faction_')) {
    const parts = customId.split('_');
    const faction = parts[2] + (parts[3] && isNaN(parts[3]) ? '_' + parts[3] : '');
    const targetUserId = parts[parts.length - 1];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về đạo hữu!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) {
      return interaction.reply({ content: `❌ Không tìm thấy dữ liệu nhân vật!`, ephemeral: true });
    }

    const factionData = factionsConfig.factions[faction];
    if (!factionData) {
      return interaction.reply({ content: `❌ Trận doanh không hợp lệ!`, ephemeral: true });
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

    if (faction === 'CHINH_DAO') {
      user.currencies.congDuc = 20;
      user.stats.luck = 25;
    }
    if (faction === 'MA_DAO') {
      user.currencies.taTam = 30;
      user.stats.critRate = 0.15;
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`✨ [GIA NHẬP TRẬN DOANH] - ${factionData.tag}`)
      .setColor(factionData.color || '#4CAF50')
      .setDescription(
        `Chúc mừng đạo hữu **${user.username}** đã quy vị về **${factionData.name}**!\n\n` +
        `📖 **Tôn Chỉ:** ${factionData.desc}\n` +
        `🎁 **Bí Kíp Khởi Đầu:** Đã tiếp nhận **[${starterSkillInfo ? starterSkillInfo.name : 'Cơ Bản Quyết'}]** vào Tàng Kinh Các.\n\n` +
        `👉 **Hãy gõ \`!tupan\` để mở Bảng Tu Chân và bắt đầu con đường xưng bá!**`
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
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Chưa tạo nhân vật!`, ephemeral: true });

    const beast = monstersConfig.beasts.find(b => b.id === beastId);
    if (!beast) return interaction.reply({ content: `❌ Thú không tồn tại!`, ephemeral: true });

    if (combatSessions && combatSessions[targetUserId]) {
      return interaction.reply({
        content: `⚔️ Đạo hữu đang trong trận chiến với **[${combatSessions[targetUserId].beastName}]**! Hãy hoàn thành trận đấu hiện tại trước.`,
        ephemeral: true
      });
    }
    if (dungeonCombatSessions && dungeonCombatSessions[targetUserId]) {
      return interaction.reply({
        content: `⛩️ Đạo hữu đang khiêu chiến Boss trong bí cảnh! Hãy hoàn thành hoặc rút lui trước khi săn thú.`,
        ephemeral: true
      });
    }

    let equippedSkills = user.skills.filter(s => s.equipped);
    if (equippedSkills.length === 0) equippedSkills = user.skills;

    const equippedGears = (user.equipments || []).filter(e => e.equipped);

    combatSessions[targetUserId] = {
      userId: targetUserId,
      userName: user.daoName || user.username,
      userHp: user.stats.hp || 100,
      userMaxHp: user.stats.maxHp || 100,
      userMp: user.stats.mp ?? user.stats.maxMp ?? 100,
      userMaxMp: user.stats.maxMp || 100,
      userAtk: user.stats.atk || 15,
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
      exp: beast.exp,
      linhThach: beast.linhThach,
      nguyenThach: beast.nguyenThach,
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
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, ephemeral: true });

    const session = combatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc hoặc không tồn tại!`, ephemeral: true });

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

      if (user) {
        const expGained = Math.floor(session.exp * (user.talent.expMultiplier || 1.0));
        user.realm.exp += expGained;
        user.currencies.linhThach += session.linhThach;
        user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + session.nguyenThach;

        const existingItem = user.inventory.find(i => i.itemId === `yeu_dan_${session.beastId}`);
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          user.inventory.push({
            itemId: `yeu_dan_${session.beastId}`,
            name: `Yêu Đan [${session.beastName}]`,
            type: 'DAN_DUOC',
            quantity: 1,
            desc: `Nội đan chứa linh khí thuần túy của ${session.beastName}`
          });
        }

        // Tỉ lệ rớt trang bị Bậc 4 (Huyền Giai)
        gearDropMsg = checkHuyenGiaiDrop(user, 0.15);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **CHIẾN THẮNG!** Đạo hữu đã trảm sát **${session.beastName}**!\n✨ Nhận: \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} Linh Thạch\` | 🔮 \`+${session.nguyenThach} Nguyên Thạch\` | 🎁 **1 Yêu Đan**!${gearDropMsg}`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const beastDmg = Math.max(4, Math.floor(session.beastAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.4));
    session.userHp = Math.max(0, session.userHp - beastDmg);
    logText += `\n👹 **${session.beastName}** gầm thét vồ tới, cắn xé gây **${beastDmg} sát thương** lên bạn!`;

    if (session.userHp <= 0) {
      delete combatSessions[targetUserId];
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu đã bị trọng thương, đành phải vận chuyển độn thuật chạy về dưỡng thương!`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, ephemeral: true });

    const session = combatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, ephemeral: true });

    session.lastActionTime = Date.now();

    const user = await User.findOne({ userId: targetUserId });
    let skillName = 'Dẫn Khí Tuyệt Sát';
    let skillRarity = 'HOANG_GIAI';
    let skillMastery = 10;

    if (user && skillId) {
      const userSkill = user.skills.find(s => s.skillId === skillId);
      if (userSkill) {
        skillName = userSkill.name;
        skillRarity = userSkill.rarity;
        skillMastery = userSkill.mastery;
        userSkill.mastery = Math.min(100, userSkill.mastery + 1);
        await user.save();
      }
    }

    const skillCost = SKILL_MANA_COST[skillRarity] || 25;
    if (session.userMp < skillCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${skillCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, ephemeral: true });
    }

    session.userMp -= skillCost;

    const baseMult = RARITY_MULTIPLIERS[skillRarity] || 1.35;
    const masteryMult = 1 + (skillMastery / 300);
    const isCrit = Math.random() <= (session.critRate + 0.15);
    const finalMult = (baseMult * masteryMult) * (isCrit ? 1.35 : 1.0);

    const userDmg = Math.max(8, Math.floor(session.userAtk * finalMult - session.beastDef * 0.3));
    session.beastHp = Math.max(0, session.beastHp - userDmg);

    let logText = `🔥 **${session.userName}** tiêu hao \`${skillCost} MP\` thi triển công pháp **[${skillName}]** (${skillRarity}) ${isCrit ? '💥 **[CHÍ MẠNG BẠO KÍCH!]**' : ''} giáng xuống **${userDmg} sát thương**!`;

    if (session.beastHp <= 0) {
      delete combatSessions[targetUserId];
      let gearDropMsg = '';
      if (user) {
        user.realm.exp += session.exp;
        user.currencies.linhThach += session.linhThach;
        user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + session.nguyenThach;
        gearDropMsg = checkHuyenGiaiDrop(user, 0.15);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **CHIẾN THẮNG TUYỆT ĐỐI!** Một kích diệt sát **${session.beastName}**!\n✨ \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} Linh Thạch\` | 🔮 \`+${session.nguyenThach} Nguyên Thạch\` | 🎁 **1 Yêu Đan**!${gearDropMsg}`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const beastDmg = Math.max(4, Math.floor(session.beastAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.4));
    session.userHp = Math.max(0, session.userHp - beastDmg);
    logText += `\n👹 **${session.beastName}** giãy giụa phản kích gây **${beastDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete combatSessions[targetUserId];
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu kiệt sức, đành rút lui dưỡng thương!`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, ephemeral: true });

    const session = combatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, ephemeral: true });

    session.lastActionTime = Date.now();

    const user = await User.findOne({ userId: targetUserId });
    const gear = user ? user.equipments.find(e => e.gearId === gearId || e.id === gearId) : null;
    const gearRarity = gear ? gear.rarity : 'HOANG_GIAI';
    const gearCost = GEAR_MANA_COST[gearRarity] || 40;

    if (session.userMp < gearCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${gearCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, ephemeral: true });
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
      if (user) {
        user.realm.exp += session.exp;
        user.currencies.linhThach += session.linhThach;
        user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + session.nguyenThach;
        gearDropMsg = checkHuyenGiaiDrop(user, 0.15);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **CHIẾN THẮNG TUYỆT ĐỐI!** Pháp bảo chấn sát **${session.beastName}**!\n✨ \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} Linh Thạch\` | 🔮 \`+${session.nguyenThach} Nguyên Thạch\` | 🎁 **1 Yêu Đan**!${gearDropMsg}`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const beastDmg = Math.max(4, Math.floor(session.beastAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.4));
    session.userHp = Math.max(0, session.userHp - beastDmg);
    logText += `\n👹 **${session.beastName}** hoảng loạn cắn trả gây **${beastDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete combatSessions[targetUserId];
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu kiệt sức, rút lui dưỡng thương!`;
      const embed = createCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    session.lastLog = logText;
    const embed = createCombatEmbed(session);
    const buttons = createCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 6. Tháo chạy săn thú
  if (customId.startsWith('combat_flee_') || customId.startsWith('btn_cancel_hunt::') || customId.startsWith('btn_cancel_hunt_')) {
    const targetUserId = customId.replace('combat_flee_', '').replace('btn_cancel_hunt::', '').replace('btn_cancel_hunt_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

    delete combatSessions[targetUserId];
    return interaction.update({
      embeds: [new EmbedBuilder().setTitle('🏃 [TẨU THOÁT]').setColor('#757575').setDescription('Đạo hữu đã an toàn rút lui khỏi khu vực săn thú.')],
      components: []
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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Chưa tạo nhân vật!`, ephemeral: true });

    const dungeon = dungeonsConfig.dungeons.find(d => d.id === dungeonId);
    if (!dungeon) return interaction.reply({ content: `❌ Ải không tồn tại!`, ephemeral: true });

    if (dungeonCombatSessions && dungeonCombatSessions[targetUserId]) {
      return interaction.reply({
        content: `⛩️ Đạo hữu đang trong trận khiêu chiến Boss **[${dungeonCombatSessions[targetUserId].bossName}]**! Hãy hoàn thành hoặc rút lui trước.`,
        ephemeral: true
      });
    }
    if (combatSessions && combatSessions[targetUserId]) {
      return interaction.reply({
        content: `⚔️ Đạo hữu đang trong trận săn thú! Hãy hoàn thành trận đấu trước khi vào phó bản.`,
        ephemeral: true
      });
    }

    let equippedSkills = user.skills.filter(s => s.equipped);
    if (equippedSkills.length === 0) equippedSkills = user.skills;
    const equippedGears = (user.equipments || []).filter(e => e.equipped);

    dungeonCombatSessions[targetUserId] = {
      userId: targetUserId,
      userName: user.daoName || user.username,
      userHp: user.stats.hp || 100,
      userMaxHp: user.stats.maxHp || 100,
      userMp: user.stats.mp ?? user.stats.maxMp ?? 100,
      userMaxMp: user.stats.maxMp || 100,
      userAtk: user.stats.atk || 15,
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
      exp: dungeon.exp,
      linhThach: dungeon.linhThach,
      nguyenThachMin: dungeon.nguyenThachMin,
      nguyenThachMax: dungeon.nguyenThachMax,
      rareDropRate: dungeon.rareDropRate,
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
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, ephemeral: true });

    const session = dungeonCombatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, ephemeral: true });

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

      if (user) {
        const nguyenThachEarned = Math.floor(Math.random() * (session.nguyenThachMax - session.nguyenThachMin + 1)) + session.nguyenThachMin;
        user.realm.exp += session.exp;
        user.currencies.linhThach += session.linhThach;
        user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + nguyenThachEarned;

        // Rớt bí kíp
        if (Math.random() <= session.rareDropRate) {
          const allSkills = getAllSkills();
          const droppedSkill = allSkills[Math.floor(Math.random() * allSkills.length)];
          if (!user.skills.some(s => s.skillId === droppedSkill.id)) {
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

        // Tỉ lệ rớt trang bị Bậc 4 (Huyền Giai) từ Boss (30%)
        const gearDropMsg = checkHuyenGiaiDrop(user, 0.30);
        dropMsg += gearDropMsg;

        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **ĐẠI THẮNG BÍ CẢNH!** Boss **${session.bossName}** đã bị tiêu diệt!\n✨ \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} LT\` | 🔮 \`+${session.nguyenThachMax} Nguyên Thạch\`${dropMsg}`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const bossDmg = Math.max(8, Math.floor(session.bossAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.35));
    session.userHp = Math.max(0, session.userHp - bossDmg);
    logText += `\n👹 **${session.bossName}** vung trượng đập nát hư không, giáng xuống **${bossDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete dungeonCombatSessions[targetUserId];
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu trọng thương, phù bảo hộ cứu mạng truyền tống ra ngoài!`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, ephemeral: true });

    const session = dungeonCombatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, ephemeral: true });

    session.lastActionTime = Date.now();

    const user = await User.findOne({ userId: targetUserId });
    let skillName = 'Vô Thượng Thần Thông';
    let skillRarity = 'HOANG_GIAI';
    let skillMastery = 10;

    if (user && skillId) {
      const userSkill = user.skills.find(s => s.skillId === skillId);
      if (userSkill) {
        skillName = userSkill.name;
        skillRarity = userSkill.rarity;
        skillMastery = userSkill.mastery;
        userSkill.mastery = Math.min(100, userSkill.mastery + 1);
        await user.save();
      }
    }

    const skillCost = DUNGEON_SKILL_MANA_COST[skillRarity] || 25;
    if (session.userMp < skillCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${skillCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, ephemeral: true });
    }

    session.userMp -= skillCost;

    const baseMult = RARITY_MULTIPLIERS[skillRarity] || 1.35;
    const masteryMult = 1 + (skillMastery / 300);
    const isCrit = Math.random() <= (session.critRate + 0.15);
    const finalMult = (baseMult * masteryMult) * (isCrit ? 1.35 : 1.0);

    const userDmg = Math.max(15, Math.floor(session.userAtk * finalMult - session.bossDef * 0.25));
    session.bossHp = Math.max(0, session.bossHp - userDmg);

    let logText = `🔥 **${session.userName}** tiêu hao \`${skillCost} MP\` thi triển tuyệt học **[${skillName}]** (${skillRarity}) ${isCrit ? '💥 **[BẠO KÍCH HOÀNG KIM!]**' : ''} gây **${userDmg} sát thương**!`;

    if (session.bossHp <= 0) {
      delete dungeonCombatSessions[targetUserId];
      let dropMsg = '';
      if (user) {
        user.realm.exp += session.exp;
        user.currencies.linhThach += session.linhThach;
        user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + session.nguyenThachMax;
        dropMsg = checkHuyenGiaiDrop(user, 0.30);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **ĐẠI THẮNG BÍ CẢNH!** Phá tan Boss **${session.bossName}**!\n✨ \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} LT\` | 🔮 \`+${session.nguyenThachMax} Nguyên Thạch\`!${dropMsg}`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const bossDmg = Math.max(10, Math.floor(session.bossAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.35));
    session.userHp = Math.max(0, session.userHp - bossDmg);
    logText += `\n👹 **${session.bossName}** gào thét phản công gây **${bossDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete dungeonCombatSessions[targetUserId];
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu kiệt sức, truyền tống thoát thân!`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải trận đấu của bạn!`, ephemeral: true });

    const session = dungeonCombatSessions[targetUserId];
    if (!session) return interaction.reply({ content: `❌ Trận chiến đã kết thúc!`, ephemeral: true });

    session.lastActionTime = Date.now();

    const user = await User.findOne({ userId: targetUserId });
    const gear = user ? user.equipments.find(e => e.gearId === gearId || e.id === gearId) : null;
    const gearRarity = gear ? gear.rarity : 'HOANG_GIAI';
    const gearCost = DUNGEON_GEAR_MANA_COST[gearRarity] || 40;

    if (session.userMp < gearCost) {
      return interaction.reply({ content: `⚠️ Không đủ Linh Lực (cần **${gearCost} MP**, hiện có **${session.userMp} MP**)! Hãy đánh thường để tích lũy chân khí.`, ephemeral: true });
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
      if (user) {
        user.realm.exp += session.exp;
        user.currencies.linhThach += session.linhThach;
        user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + session.nguyenThachMax;
        dropMsg = checkHuyenGiaiDrop(user, 0.30);
        await user.save();
      }

      session.lastLog = `${logText}\n\n🏆 **ĐẠI THẮNG BÍ CẢNH!** Pháp bảo trấn sát Boss **${session.bossName}**!\n✨ \`+${session.exp} EXP\` | 💎 \`+${session.linhThach} LT\` | 🔮 \`+${session.nguyenThachMax} Nguyên Thạch\`!${dropMsg}`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    const bossDmg = Math.max(10, Math.floor(session.bossAtk * (0.9 + Math.random() * 0.2) - session.userDef * 0.35));
    session.userHp = Math.max(0, session.userHp - bossDmg);
    logText += `\n👹 **${session.bossName}** gào thét cuồng nộ đánh trả gây **${bossDmg} sát thương**!`;

    if (session.userHp <= 0) {
      delete dungeonCombatSessions[targetUserId];
      session.lastLog = `${logText}\n\n💀 **THẤT BẠI!** Đạo hữu trọng thương, truyền tống thoát thân!`;
      const embed = createDungeonCombatEmbed(session);
      return interaction.update({ embeds: [embed], components: [] });
    }

    session.lastLog = logText;
    const embed = createDungeonCombatEmbed(session);
    const buttons = createDungeonCombatButtons(targetUserId, session.equippedSkills, session.equippedGears, session.userMp, false);
    return interaction.update({ embeds: [embed], components: buttons });
  }

  // 11. Rút lui phó bản
  if (customId.startsWith('dungeon_flee_') || customId.startsWith('btn_cancel_dungeon::') || customId.startsWith('btn_cancel_dungeon_')) {
    const targetUserId = customId.replace('dungeon_flee_', '').replace('btn_cancel_dungeon::', '').replace('btn_cancel_dungeon_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Chưa tạo nhân vật!`, ephemeral: true });

    const recipe = recipesConfig.recipes.find(r => r.id === recipeId);
    if (!recipe) return interaction.reply({ content: `❌ Công thức không tồn tại!`, ephemeral: true });

    // Trừ nguyên liệu
    user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) - recipe.requirements.nguyenThach;
    user.currencies.linhThach -= recipe.requirements.linhThach;

    recipe.requirements.items.forEach(req => {
      const invItem = user.inventory.find(i => i.itemId === req.itemId);
      if (invItem) {
        invItem.quantity -= req.quantity;
      }
    });
    user.inventory = user.inventory.filter(i => i.quantity > 0);

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
    await user.save();

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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

    const user = await User.findOne({ userId: targetUserId });
    if (!user || !user.equipments[idx]) return interaction.reply({ content: `❌ Trang bị không tồn tại!`, ephemeral: true });

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
      user.stats.hp = user.stats.maxHp;
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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

    const user = await User.findOne({ userId: targetUserId });
    if (!user || !user.equipments[idx]) return interaction.reply({ content: `❌ Trang bị không tồn tại!`, ephemeral: true });

    const gear = user.equipments[idx];
    const costLinhThach = (gear.enhanceLevel + 1) * 150;
    const costNguyenThach = Math.floor(gear.enhanceLevel / 3) + 1;

    if (user.currencies.linhThach < costLinhThach || (user.currencies.nguyenThach || 0) < costNguyenThach) {
      return interaction.reply({
        content: `❌ Không đủ tài nguyên cường hóa! Cần **${costLinhThach.toLocaleString()} Linh Thạch** + **${costNguyenThach} Nguyên Thạch** (Hiện có: \`${user.currencies.linhThach}\` LT | \`${user.currencies.nguyenThach || 0}\` NT).`,
        ephemeral: true
      });
    }

    user.currencies.linhThach -= costLinhThach;
    user.currencies.nguyenThach -= costNguyenThach;

    gear.enhanceLevel += 1;
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
      user.stats.hp = user.stats.maxHp;
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setTitle(`✨ [CƯỜNG HÓA THÀNH CÔNG] - ${gear.name} (+${gear.enhanceLevel})`)
      .setColor('#FFD700')
      .setDescription(
        `Thần binh phát sáng hào quang rực rỡ!\n` +
        `Trang bị **[${gear.name}]** đã tăng lên cấp **+${gear.enhanceLevel}**!\n\n` +
        `📈 **Chỉ số gia tăng:**\n` +
        `🗡️ ATK: \`+${gear.stats.atk}\` (+${atkBoost})\n` +
        `🛡️ DEF: \`+${gear.stats.def}\` (+${defBoost})\n` +
        `❤️ HP: \`+${gear.stats.maxHp}\` (+${hpBoost})`
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

    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

    const user = await User.findOne({ userId: targetUserId });
    if (!user || !user.inventory[itemIdx]) {
      return interaction.reply({ content: `❌ Vật phẩm không còn tồn tại trong túi đồ!`, ephemeral: true });
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
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });

    const user = await User.findOne({ userId: targetUserId });
    if (!user || user.skills.length === 0) {
      return interaction.reply({ content: `❌ Kho của bạn chưa có bí kíp nào để đăng bán!`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`💰 [ĐĂNG BÁN BÍ KÍP LÊN CHỢ ĐEN]`)
      .setColor('#4CAF50')
      .setDescription(`👉 **Hãy chọn bí kíp bạn muốn niêm yết bán ở menu bên dưới:**\n*(Sau khi chọn sẽ xuất hiện bảng nhập giá bán)*`);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`sell_select_item_${targetUserId}`)
      .setPlaceholder('👉 Chọn bí kíp muốn bán...');

    user.skills.forEach((s, idx) => {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${idx + 1}. [${s.name}] (${s.rarity})`)
          .setDescription(`Loại: ${s.category} | Thuần thục: ${s.mastery}%`)
          .setValue(`skill_${idx}`)
          .setEmoji('📜')
      );
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
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
      return interaction.reply({ embeds: [embed], ephemeral: true });
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
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // 21. Nút Chuyển Trang Danh Sách Pháp Bảo (!admin listgear)
  if (customId.startsWith('btn_listgear_prev_') || customId.startsWith('btn_listgear_next_')) {
    const isPrev = customId.startsWith('btn_listgear_prev_');
    const parts = customId.split('_');
    const currentPage = parseInt(parts[3], 10) || 1;
    const targetUserId = parts[4];

    if (!isAdmin(clickerId)) {
      return interaction.reply({ content: `❌ Chỉ có Admin tối cao mới được chuyển trang danh sách này!`, ephemeral: true });
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
    const betAmount = parseInt(parts[4], 10) || 50;

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Lời thách đấu này không dành cho bạn!`, ephemeral: true });
    }

    const challenger = await User.findOne({ userId: challengerId });
    const defender = await User.findOne({ userId: targetUserId });

    if (!challenger || !defender) {
      return interaction.reply({ content: `❌ Dữ liệu người chơi không hợp lệ!`, ephemeral: true });
    }

    if (challenger.currencies.linhThach < betAmount) {
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('❌ [TỈ VÕ BỊ HỦY]').setColor('#F44336').setDescription(`Người khiêu chiến **${challenger.daoName || challenger.username}** không còn đủ **${betAmount.toLocaleString()} Linh Thạch** để tỉ võ!`)],
        components: []
      });
    }

    if (defender.currencies.linhThach < betAmount) {
      return interaction.reply({ content: `❌ Bạn không đủ ${betAmount} Linh Thạch để tiếp nhận thách đấu!`, ephemeral: true });
    }

    const now = new Date();
    // Tính lực chiến (Power = ATK*2 + DEF*2 + HP*0.5 + Crit/Dodge)
    const challengerPower = challenger.stats.atk * 2 + challenger.stats.def * 2 + challenger.stats.hp * 0.5 + (Math.random() * 50);
    const defenderPower = defender.stats.atk * 2 + defender.stats.def * 2 + defender.stats.hp * 0.5 + (Math.random() * 50);

    const challengerWins = challengerPower >= defenderPower;
    const winner = challengerWins ? challenger : defender;
    const loser = challengerWins ? defender : challenger;

    winner.currencies.linhThach += betAmount;
    loser.currencies.linhThach -= betAmount;
    challenger.cooldowns.pvp = now;
    defender.cooldowns.pvp = now;

    await challenger.save();
    await defender.save();

    const winnerName = winner.daoName || winner.username;
    const loserName = loser.daoName || loser.username;

    const resultEmbed = new EmbedBuilder()
      .setTitle(`⚔️ [KẾT QUẢ TỈ VÕ LÔI ĐÀI]`)
      .setColor(challengerWins ? '#4CAF50' : '#2196F3')
      .setDescription(
        `Trận tỉ thí long trời lở đất giữa **${challenger.daoName || challenger.username}** và **${defender.daoName || defender.username}** đã kết thúc!\n\n` +
        `🏆 **Bậc Thầy Chiến Thắng:** **[${winnerName}]**\n` +
        `💀 **Bại Tướng:** **[${loserName}]**\n\n` +
        `💰 Tiền thưởng lôi đài: **+${betAmount.toLocaleString()} Linh Thạch** cho ${winnerName}!`
      );

    return interaction.update({ embeds: [resultEmbed], components: [] });
  }

  // 23. Xử lý Từ Chối Thách Đấu Lôi Đài (PVP)
  if (customId.startsWith('pvp_decline_')) {
    const parts = customId.split('_');
    const challengerId = parts[2];
    const targetUserId = parts[3];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
    }

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
      return interaction.reply({ content: `⚠️ Lời mời này không dành cho bạn!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Chưa tạo nhân vật!`, ephemeral: true });

    if (user.sectId) {
      return interaction.reply({ content: `❌ Bạn đã ở trong một môn phái khác!`, ephemeral: true });
    }

    const sect = await Sect.findById(sectId);
    if (!sect) return interaction.reply({ content: `❌ Tông môn này không còn tồn tại!`, ephemeral: true });

    const maxMembers = getSectMaxMembers(sect.level);
    if (sect.members.length >= maxMembers) {
      return interaction.reply({ content: `❌ Sơn môn đã đủ đệ tử (${sect.members.length}/${maxMembers})!`, ephemeral: true });
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
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
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
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
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
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    const sect = await Sect.findById(sectId);

    if (!user || !sect) return interaction.reply({ content: `❌ Dữ liệu không hợp lệ!`, ephemeral: true });

    if (user.sectRole !== 'LEADER' && user.sectRole !== 'ELDER') {
      return interaction.reply({ content: `❌ Chỉ có Chưởng Môn hoặc Trưởng Lão mới có quyền nâng cấp sơn môn!`, ephemeral: true });
    }

    const UPGRADE_COSTS = { 1: 1000, 2: 3000, 3: 8000, 4: 20000 };
    const cost = UPGRADE_COSTS[sect.level];

    if (!cost || sect.level >= 5) {
      return interaction.reply({ content: `🏛️ Tông Môn đã đạt tới cảnh giới cực hạn (Cấp 5 - Vạn Cổ Tối Cao)!`, ephemeral: true });
    }

    if (sect.treasury.linhThach < cost) {
      return interaction.reply({
        content: `❌ Ngân Khố Bang không đủ Linh Thạch! Cần **${cost.toLocaleString()} LT** (Hiện có: **${sect.treasury.linhThach.toLocaleString()} LT**). Hãy vận động toàn bang dùng nút [💎 Góp 100 LT] hoặc lệnh \`!conghien\`!`,
        ephemeral: true
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
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    const sect = await Sect.findById(sectId);

    if (!user || !sect) return interaction.reply({ content: `❌ Dữ liệu không hợp lệ!`, ephemeral: true });

    const now = new Date();
    if (user.cooldowns.sectTask) {
      const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.sectTask)) / 1000);
      if (elapsedSeconds < 60) {
        const waitTime = 60 - elapsedSeconds;
        return interaction.reply({ content: `⏳ Đạo hữu vừa làm nhiệm vụ bang! Vui lòng nghỉ ngơi thêm **${waitTime}s**.`, ephemeral: true });
      }
    }

    const tasks = [
      { title: '🛡️ [TUẦN TRA SƠN MÔN]', desc: 'Quét sạch tà tu dòm ngó, bảo vệ đại trận yên bình!', exp: 120, lt: 60, contrib: 15, rep: 8 },
      { title: '🌿 [THU THẬP LINH THẢO]', desc: 'Hái linh dược quý trong sơn cốc nạp vào Dược Đường môn phái!', exp: 100, lt: 80, contrib: 20, rep: 6 },
      { title: '👹 [TRẢM MA HỘ TRẬN]', desc: 'Hiệp lực tiêu diệt yêu thú quấy phá chân núi, uy danh vang xa!', exp: 180, lt: 100, contrib: 25, rep: 12 },
      { title: '🔨 [TU BỔ TRẬN PHÁP]', desc: 'Vận chuyển linh thạch gia cố các mắt trận Hộ Tông Đại Trận!', exp: 140, lt: 50, contrib: 30, rep: 10 }
    ];

    const task = tasks[Math.floor(Math.random() * tasks.length)];
    user.realm.exp += task.exp;
    user.currencies.linhThach += task.lt;
    user.cooldowns.sectTask = now;

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
      ephemeral: true
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

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 30. Nút Rời Khỏi Bang
  if (customId.startsWith('sect_btn_leave_')) {
    const parts = customId.split('_');
    const sectId = parts[3];
    const targetUserId = parts[4];

    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    const sect = await Sect.findById(sectId);

    if (!user || !sect) return interaction.reply({ content: `❌ Dữ liệu không hợp lệ!`, ephemeral: true });

    if (user.sectRole === 'LEADER') {
      if (sect.members.length > 1) {
        return interaction.reply({ content: `❌ Chưởng Môn không thể tùy tiện rời bang khi còn đệ tử! Hãy dùng lệnh \`!phongchuc @user LEADER\` để nhường ngôi Chưởng Môn trước!`, ephemeral: true });
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
      return interaction.reply({ content: `⚠️ Nút bấm này không thuộc về bạn!`, ephemeral: true });
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
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải lò luyện đan của bạn!`, ephemeral: true });

    const user = await User.findOne({ userId: clickerId });
    const pill = getPillById(pillId);
    if (!pill || !user) return interaction.reply({ content: `❌ Lỗi nạp dữ liệu đan dược!`, ephemeral: true });

    // Kiểm tra nguyên liệu
    const linhThaoItem = (user.inventory || []).find(i => i.itemId === 'linh_thao');
    const linhThaoCount = linhThaoItem ? linhThaoItem.quantity : 0;

    const yeuDanItem = (user.inventory || []).find(i => i.itemId.startsWith('yeu_dan_') && i.quantity >= pill.recipe.yeuDanCount);
    if (linhThaoCount < pill.recipe.linhThao || !yeuDanItem || user.currencies.linhThach < pill.recipe.linhThach) {
      return interaction.reply({ content: `❌ Dược liệu không đủ để khởi hỏa luyện đan!`, ephemeral: true });
    }

    // Trừ nguyên liệu
    linhThaoItem.quantity -= pill.recipe.linhThao;
    if (linhThaoItem.quantity <= 0) {
      user.inventory = user.inventory.filter(i => i.itemId !== 'linh_thao');
    }

    yeuDanItem.quantity -= pill.recipe.yeuDanCount;
    if (yeuDanItem.quantity <= 0) {
      user.inventory = user.inventory.filter(i => i !== yeuDanItem);
    }

    user.currencies.linhThach -= pill.recipe.linhThach;

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
      return interaction.reply({ content: `⚠️ Đây là lôi kiếp của tu sĩ khác, can thiệp bừa bãi sẽ bị thiên lôi tru diệt!`, ephemeral: true });
    }

    const session = dokiepSessions[targetUserId];
    if (!session) {
      return interaction.reply({ content: `❌ Phiên độ kiếp đã kết thúc hoặc không tồn tại!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Không tìm thấy dữ liệu nhân vật!`, ephemeral: true });

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

    // Tính toán sát thương nhận vào thực tế
    const finalDamage = Math.max(80, Math.floor(rawDmg * (1 - Math.min(0.85, damageMitigation)) - session.totalDef * 0.5));
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
        user.realm.name = 'Kim Đan Kỳ [Trung Kỳ]';
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
    user.realm.name = 'Nguyên Anh Kỳ';
    user.realm.layer = 1;
    user.realm.exp = 0;
    user.realm.maxExp = 2500000;
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
