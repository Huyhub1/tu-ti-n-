
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { pillHeadroom, pillCapOf, meetsRequirement, requirementLabel } from '../../utils/power.js';
import { User } from '../../database/models/User.js';
import { getFactionBuffs } from '../../services/factionService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const alchemyConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/alchemy.json'), 'utf8'));

export function getPillById(pillId) {
  return alchemyConfig.pills.find(p => p.id === pillId);
}

const PILL_TIER_EMOJI = {
  HOANG_GIAI: '🟢',
  HUYEN_GIAI: '🔷',
  DIA_GIAI: '🔮',
  THIEN_GIAI: '🌟',
  THAN_GIAI: '☯️'
};

export function getAllPills() {
  return alchemyConfig.pills;
}

// Tạo Menu Dropdown chọn phương thuốc luyện đan
// `user` là tùy chọn để không phá các chỗ gọi cũ; có thì menu khoá luôn
// những phương thuốc vượt cảnh giới thay vì để người chơi bấm rồi mới báo lỗi.
export function createAlchemySelectMenu(userId, selectedPillId = null, user = null) {
  const options = alchemyConfig.pills.map(p => {
    const locked = user ? !meetsRequirement(user, p) : false;
    return {
      label: `${locked ? '🔒 ' : ''}${p.name} [${p.tierName}]`.slice(0, 100),
      description: (locked
        ? `Cần ${requirementLabel(p)} mới đủ hỏa hầu khống chế dược lực`
        : `Cần: ${p.recipe.linhThao} Linh Thảo + ${p.recipe.yeuDanCount} Yêu Đan + ${p.recipe.linhThach} LT`
      ).slice(0, 100),
      value: p.id,
      default: p.id === selectedPillId,
      emoji: locked ? '🔒' : (PILL_TIER_EMOJI[p.tier] || '🟢')
    };
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`alchemy_select_pill_${userId}`)
      .setPlaceholder('📜 Chọn Phương Thuốc Cần Luyện...')
      .addOptions(options)
  );
}

// Lệnh chính: Mở Lò Luyện Đan (!luyendan / !alchemy / !dan)
export async function executeLuyendan(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId }).lean();
  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });

  // Đếm số lượng dược liệu hiện có
  const linhThaoItem = (user.inventory || []).find(i => i.itemId === 'linh_thao');
  const linhThaoCount = linhThaoItem ? linhThaoItem.quantity : 0;

  // Đếm các loại yêu đan
  const yeuDanList = (user.inventory || []).filter(i => i.itemId.startsWith('yeu_dan_'));
  const totalYeuDan = yeuDanList.reduce((sum, i) => sum + i.quantity, 0);

  const embed = new EmbedBuilder()
    .setTitle(`🔮 [LÒ LUYỆN ĐAN VẠN CỔ] - ${user.daoName || user.username}`)
    .setColor('#9C27B0')
    .setDescription(
      `Nơi tôi luyện tinh hoa nhật nguyệt, hợp nhất Linh Thảo và Yêu Đan thành Tiên Đan nghịch thiên!\n\n` +
      `📦 **DƯỢC LIỆU TRONG TÚI TRỮ VẬT:**\n` +
      `  • 🌿 **Linh Thảo:** \`${linhThaoCount} nhánh\` (Kiếm từ \`!lamcong\` và \`!santhu\`)\n` +
      `  • 🐾 **Yêu Đan Yêu Thú:** \`${totalYeuDan} viên\` (Kiếm từ \`!santhu\`)\n` +
      `  • 💎 **Linh Thạch:** \`${user.currencies.linhThach.toLocaleString()} LT\`\n\n` +
      `👇 **Hãy chọn Phương Thuốc từ Menu bên dưới để nhóm lửa luyện đan:**`
    )
    .setFooter({ text: 'Dùng !uongdan <tên> để sử dụng đan dược | !bandan để bán trên Chợ Trời' });

  const selectRow = createAlchemySelectMenu(userId, null, user);
  await message.reply({ embeds: [embed], components: [selectRow] });
}

// Lệnh nuốt đan dược (!uongdan <tên_đan> / !dungdan)
export async function executeUongdan(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });
  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });

  if (args.length === 0) {
    // Liệt kê các đan dược đang có trong túi
    const danList = (user.inventory || []).filter(i => i.type === 'DAN_DUOC' && i.quantity > 0);
    if (danList.length === 0) {
      return message.reply({ content: `💊 Trong túi trữ vật của bạn hiện không có đan dược nào! Hãy dùng \`!luyendan\` để điều chế hoặc mua từ \`!chotroi\`.` });
    }

    const embed = new EmbedBuilder()
      .setTitle(`💊 [DAN DƯỢC TRONG TÚI TRỮ VẬT]`)
      .setColor('#4CAF50')
      .setDescription(danList.map((d, idx) => `${idx + 1}. **${d.name}** (x${d.quantity}) - *${d.desc}*`).join('\n\n'))
      .setFooter({ text: 'Dùng !uongdan <tên_đan_hoặc_stt> để nuốt đan dược' });

    return message.reply({ embeds: [embed] });
  }

  const query = args.join(' ').toLowerCase();
  let pillItem = null;
  let pillIdx = -1;

  // Tìm theo STT hoặc theo tên/ID
  const num = parseInt(query, 10);
  const danList = user.inventory.filter(i => i.type === 'DAN_DUOC' && i.quantity > 0);
  if (!isNaN(num) && num > 0 && num <= danList.length) {
    pillItem = danList[num - 1];
    pillIdx = user.inventory.indexOf(pillItem);
  } else {
    pillIdx = user.inventory.findIndex(i => i.type === 'DAN_DUOC' && i.quantity > 0 && (i.name.toLowerCase().includes(query) || i.itemId.toLowerCase().includes(query)));
    if (pillIdx !== -1) pillItem = user.inventory[pillIdx];
  }

  if (!pillItem || pillIdx === -1) {
    return message.reply({ content: `❌ Không tìm thấy đan dược hợp lệ trong túi đồ! Gõ \`!uongdan\` để xem danh sách.` });
  }


  const pillConfig = getPillById(pillItem.itemId);
  // Buff Chính Đạo: +15% hiệu quả hồi phục của đan dược
  const potionBonus = getFactionBuffs(user.faction).potionEffectBonus;
  // Mức hồi cố định vô dụng ở hậu kỳ nên mọi đan có thêm ngưỡng theo % Max HP.
  const flatHeal = (pillConfig ? pillConfig.healHp : 200);
  const pctHeal = Math.floor((user.stats.maxHp || 100) * (pillConfig?.healPercent || 0));
  const healAmount = Math.floor(Math.max(flatHeal, pctHeal) * (1 + potionBonus));
  const expAmount = pillConfig ? Math.floor(pillConfig.expGain * (user.talent.expMultiplier || 1.0)) : 100;

  // Áp dụng hiệu quả đan dược
  user.stats.hp = Math.min(user.stats.maxHp, user.stats.hp + healAmount);
  user.realm.exp += expAmount;

  // ── DƯỢC LỰC BÃO HÒA ──
  // Chỉ số vĩnh viễn từ đan dược bị chặn trần theo cảnh giới. Không có trần,
  // người chơi đủ Linh Thạch mua thẳng lực chiến gấp chục lần cảnh giới cho phép.
  let bonusText = '';
  if (pillConfig && pillConfig.statBonus) {
    user.pillBonus = user.pillBonus || { atk: 0, def: 0, maxHp: 0 };
    const room = pillHeadroom(user);
    const cap = pillCapOf(user);
    let wasted = [];

    for (const key of ['atk', 'def', 'maxHp']) {
      const want = pillConfig.statBonus[key] || 0;
      if (!want) continue;
      const gain = Math.min(want, room[key]);
      if (gain > 0) {
        user.stats[key] += gain;
        if (key === 'maxHp') user.stats.hp += gain;
        user.pillBonus[key] = (user.pillBonus[key] || 0) + gain;
      }
      const label = key === 'atk' ? '🗡️ ATK' : key === 'def' ? '🛡️ DEF' : '❤️ Max HP';
      if (gain > 0) {
        bonusText += `\n${label} **+${gain} vĩnh viễn** \`(${user.pillBonus[key]}/${cap[key]})\``;
      }
      if (gain < want) wasted.push(label);
    }

    if (wasted.length) {
      bonusText += `\n\n⚠️ *Dược lực đã bão hòa (${wasted.join(", ")}) — thân thể ở **${user.realm.name}** không hấp thu thêm được nữa. Hãy đột phá cảnh giới để nới trần.*`;
    }
  }

  // Buff đột phá một lần: cộng dồn nhưng chặn trần +30% để uống mười viên
  // cũng không biến tỉ lệ đột phá thành gần như chắc chắn.
  let breakText = '';
  if (pillConfig && pillConfig.breakBonus) {
    const before = user.breakthroughBuff || 0;
    user.breakthroughBuff = Math.min(0.30, before + pillConfig.breakBonus);
    breakText = user.breakthroughBuff > before
      ? `\n⚡ **Tỉ lệ đột phá kế tiếp** \`+${Math.round(user.breakthroughBuff * 100)}%\` *(dùng một lần)*`
      : `\n⚠️ *Dược lực trợ đột phá đã đạt trần +30%, viên này chỉ còn tác dụng hồi phục.*`;
  }

  // Trừ số lượng đan dược
  pillItem.quantity -= 1;
  if (pillItem.quantity <= 0) {
    user.inventory.splice(pillIdx, 1);
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`✨ [NUỐT LINH ĐAN] - ${user.daoName || user.username}`)
    .setColor('#00E676')
    .setDescription(
      `Đạo hữu nuốt vào 1 viên **[${pillItem.name}]**, đan dược hóa thành luồng nhiệt lưu cuồn cuộn chảy khắp kỳ kinh bát mạch:\n\n` +
      `❤️ **Hồi Phục Sinh Lực:** \`+${healAmount} HP\` (${user.stats.hp}/${user.stats.maxHp})\n` +
      `⚡ **Hấp Thu Chân Khí:** \`+${expAmount} EXP Tu Vi\` (${user.realm.exp}/${user.realm.maxExp})${breakText}${bonusText}`
    );

  await message.reply({ embeds: [embed] });
}
