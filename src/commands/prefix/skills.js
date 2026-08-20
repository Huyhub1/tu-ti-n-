import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';


import { fuseSkills, RARITY_ORDER, findBestFusableRarity, getRarityName } from '../../services/skillService.js';

import { getUserTalentPerks } from '../../services/talentService.js';
import { COOLDOWNS, claimCooldown } from '../../utils/cooldown.js';


const TRAIN_COOLDOWN_SECONDS = COOLDOWNS.skillTrain;

// Trùng với MAX_COMBAT_SKILL_BUTTONS bên hunting.js: Discord chỉ còn 4 chỗ
// trống trên hàng nút đầu tiên sau nút "Đánh Thường".
export const MAX_EQUIPPED_SKILLS = 4;

/**
 * `!kichhoat <stt>` — bật/tắt một công pháp cho khay chiến đấu.
 * Trước đây cờ `equipped` chỉ được đặt đúng một lần cho công pháp khởi đầu và
 * không có lệnh nào đổi được, nên dòng chữ "tối đa kích hoạt 4 công pháp" ở
 * `!tangkinhcac` là lời hứa suông và mọi bí kíp mua/dung hợp về đều nằm kho.
 */
export async function executeKichhoat(message, args = []) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (!user.skills || user.skills.length === 0) {
    return message.reply({ content: `❌ Đạo hữu chưa có công pháp nào trong kho! Gõ \`!choden\` để tìm mua bí kíp.` });
  }

  const listEquipped = () => {
    const active = user.skills.filter(s => s.equipped);

    // Khi chưa chọn gì, hunting.js/dungeon.js tự lấy toàn bộ kho rồi lọc ra 4
    // bí kíp mạnh nhất, nên người chơi mới không bị thiệt vì chưa biết lệnh.
    if (active.length === 0) return '*(chưa chọn — vào trận bot tự dùng 4 bí kíp phẩm cao nhất trong kho)*';
    return active.map(s => `🔥 **[${s.name}]** \`${s.rarity}\` — thuần thục \`${s.mastery}%\``).join('\n');
  };

  if (args.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ [KHAY CHIẾN ĐẤU] - ${user.daoName || user.username}`)
      .setColor('#FF7043')
      .setDescription(
        `Công pháp đang kích hoạt (**${user.skills.filter(s => s.equipped).length}/${MAX_EQUIPPED_SKILLS}**):\n${listEquipped()}\n\n` +
        `💡 Gõ \`!kichhoat <stt>\` để bật/tắt một công pháp. Số thứ tự xem ở \`!tangkinhcac\`.`
      );
    return message.reply({ embeds: [embed] });
  }

  const index = parseInt(args[0], 10) - 1;
  if (Number.isNaN(index) || index < 0 || index >= user.skills.length) {
    return message.reply({ content: `❌ Số thứ tự không hợp lệ! Chọn từ **1** đến **${user.skills.length}** (xem \`!tangkinhcac\`).` });
  }

  const skill = user.skills[index];

  if (skill.equipped) {
    skill.equipped = false;
    await user.save();
    return message.reply({
      content: `🔻 Đã cất **[${skill.name}]** khỏi khay chiến đấu.\n⚔️ Đang kích hoạt: **${user.skills.filter(s => s.equipped).length}/${MAX_EQUIPPED_SKILLS}**`
    });
  }

  const activeCount = user.skills.filter(s => s.equipped).length;
  if (activeCount >= MAX_EQUIPPED_SKILLS) {
    return message.reply({
      content: `❌ Khay chiến đấu đã đầy (**${activeCount}/${MAX_EQUIPPED_SKILLS}**)! Hãy tắt bớt một công pháp trước:\n${listEquipped()}`
    });
  }

  skill.equipped = true;
  await user.save();
  return message.reply({
    content: `✅ Đã kích hoạt **[${skill.name}]** \`${skill.rarity}\` vào khay chiến đấu!\n⚔️ Đang kích hoạt: **${activeCount + 1}/${MAX_EQUIPPED_SKILLS}**`
  });
}

export async function executeTangkinhcac(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) {
    return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` để tạo nhân vật trước!` });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏴‍☠️ [CHỢ ĐEN & KHO BÍ KÍP CÁ NHÂN] - ${user.daoName || user.username}`)
    .setColor('#37474F')
    .setDescription(

      `Danh sách tất cả các công pháp đạo hữu đã thu thập (\`${user.skills.length}\` bí kíp):\n` +
      `*(Đang kích hoạt \`${user.skills.filter(s => s.equipped).length}/4\` — dùng \`!kichhoat <stt>\` để đổi)*\n\n`
    );

  if (user.skills.length === 0) {
    embed.setDescription(`*Kho của bạn đang trống! Hãy bấm nút [Vào Sàn Giao Dịch Chợ Đen] để mua bí kíp.*`);
  } else {
    user.skills.forEach((s, idx) => {

      const equipTag = s.equipped ? `✅ [ĐANG DÙNG]` : `⭕`;
      // stt hiển thị = index + 1, khớp với tham số của !kichhoat và !luyencong
      const masteryTag = s.mastery >= 100 ? `🔥 VIÊN MÃN (100%)` : `Thuần thục: \`${s.mastery}%\``;
      embed.addFields({
        name: `${idx + 1}. ${equipTag} **[${s.name}]** - Phẩm: \`${s.rarity}\``,
        value: `📂 Loại: \`${s.category}\` | ${masteryTag}`,
        inline: false
      });
    });
  }

  embed.addFields(
    {
      name: `💡 Lệnh Rèn Luyện & Nấu Chảy:`,

      value:
        `• \`!kichhoat <stt>\` : Bật/tắt công pháp cho khay chiến đấu (tối đa **4**).\n` +
        `• \`!luyencong <stt>\` : Bế quan luyện thuần thục công pháp (+15% Mastery, Delay 10s).\n` +
        `• \`!dunghop [phẩm cấp]\` : Nấu chảy 5 công pháp Viên Mãn cùng phẩm thành 1 bí kíp phẩm cao hơn!`,
      inline: false
    }
  );

  // 2 nút giao dịch Chợ Đen
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`btn_open_sell_menu_${user.userId}`).setLabel('💰 Bán Đồ Lên Chợ Đen').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`btn_open_market_${user.userId}`).setLabel('🏪 Vào Sàn Giao Dịch Chợ Đen').setStyle(ButtonStyle.Primary)
  );

  await message.reply({ embeds: [embed], components: [row] });
}


export async function executeLuyencong(message, args) {
  let user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (user.skills.length === 0) {
    return message.reply({ content: `❌ Đạo hữu chưa có công pháp nào trong kho!` });
  }

  const now = new Date();
  if (user.cooldowns.skillTrain) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.skillTrain)) / 1000);
    if (elapsedSeconds < TRAIN_COOLDOWN_SECONDS) {
      const waitTime = TRAIN_COOLDOWN_SECONDS - elapsedSeconds;
      return message.reply({

        content: `⏳ Đạo hữu đang điều tức kinh mạch sau khi luyện võ! Vui lòng chờ thêm **${waitTime}s**.`
      });
    }
  }

  // Cổng chặn nguyên tử: spam nhiều lệnh cùng lúc chỉ được tính đúng 1 lượt
  // thuần thục, không thể nhồi mastery lên 100% trong một nhịp.
  const claimed = await claimCooldown(User, user.userId, 'skillTrain');
  if (!claimed) {
    return message.reply({ content: `⏳ Đạo hữu diễn chiêu quá gấp, kinh mạch chưa kịp điều hòa! Chờ thêm giây lát.` });
  }
  user = claimed;

  let skillIndex = 0;
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10) - 1;
    if (!isNaN(parsed) && parsed >= 0 && parsed < user.skills.length) {
      skillIndex = parsed;
    }
  }

  const skill = user.skills[skillIndex];
  if (skill.mastery >= 100) {
    return message.reply({
      content: `🔥 Công pháp **[${skill.name}]** đã đạt tới cảnh giới **VIÊN MÃN (100%)**, không thể luyện thêm! Hãy thu thập đủ 5 bí kíp viên mãn để dùng \`!dunghop\`!`
    });
  }


  // Tư chất Thiên Phẩm trở lên có skillMasterySpeed > 1 (x2), trước đây khai báo
  // trong talents.json nhưng không được đọc nên mọi linh căn học bài như nhau.
  const masteryGain = Math.max(1, Math.round(15 * (getUserTalentPerks(user).skillMasterySpeed || 1)));
  const masteryBefore = skill.mastery;

  skill.mastery = Math.min(100, skill.mastery + masteryGain);
  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`🧘 [BẾ QUAN LUYỆN VÕ]`)
    .setColor('#4CAF50')
    .setDescription(

      `Đạo hữu diễn luyện chiêu thức của **[${skill.name}]**:\n\n` +
      `✨ Độ thuần thục: \`${masteryBefore}%\` ➜ **\`${skill.mastery}%\`** (+${skill.mastery - masteryBefore}) ${skill.mastery >= 100 ? '🔥 **VIÊN MÃN!**' : ''}\n` +
      `${masteryGain > 15 ? `🌟 *Linh căn thiên phú giúp lĩnh ngộ nhanh gấp ${(masteryGain / 15).toFixed(1)} lần!*\n` : ''}` +
      `⏱️ *Thời gian hồi chiêu: 10 giây*`
    );

  await message.reply({ embeds: [embed] });
}


export async function executeDunghop(message, args = []) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  // Bản cũ khoá cứng 'HOANG_GIAI' nên cả nhánh dung hợp bậc cao là đồ trang trí.
  // Giờ: có tham số thì theo tham số, không thì tự chọn phẩm cấp cao nhất đủ liệu.
  let rarity = null;
  if (args.length > 0) {
    const wanted = String(args[0]).toUpperCase().replace(/[\s-]/g, '_');
    if (!RARITY_ORDER.includes(wanted)) {
      return message.reply({
        content: `❌ Phẩm cấp không hợp lệ! Chọn một trong: ${RARITY_ORDER.map(r => `\`${r}\``).join(', ')}\n💡 Bỏ trống để bot tự chọn phẩm cấp cao nhất mà đạo hữu đủ liệu.`
      });
    }
    rarity = wanted;
  } else {
    rarity = findBestFusableRarity(user);
    if (!rarity) {
      const tally = RARITY_ORDER
        .map(r => {
          const n = (user.skills || []).filter(s => s.rarity === r && s.mastery >= 100).length;
          return n > 0 ? `${getRarityName(r)}: **${n}/5**` : null;
        })
        .filter(Boolean)
        .join(' · ') || '*chưa có bí kíp nào viên mãn*';
      return message.reply({
        content: `❌ Chưa đủ **5 bí kíp cùng phẩm cấp đạt 100% viên mãn** để dung hợp!\n📊 Kiểm kê: ${tally}\n💡 Dùng \`!luyencong <số>\` để nâng thuần thục.`
      });
    }
  }

  const result = fuseSkills(user, rarity);
  if (!result.success) {
    return message.reply({ content: `❌ ${result.message}` });
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`🔮 [LÒ LUYỆN VẠN ĐẠO - DUNG HỢP]`)
    .setColor('#FFD700')
    .setDescription(result.message);

  await message.reply({ embeds: [embed] });
}
