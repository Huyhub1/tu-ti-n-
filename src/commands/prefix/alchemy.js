
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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

export function getAllPills() {
  return alchemyConfig.pills;
}

// Tạo Menu Dropdown chọn phương thuốc luyện đan
export function createAlchemySelectMenu(userId, selectedPillId = null) {
  const options = alchemyConfig.pills.map(p => {
    return {
      label: `${p.name} [${p.tierName}]`,
      description: `Cần: ${p.recipe.linhThao} Linh Thảo + ${p.recipe.yeuDanCount} Yêu Đan + ${p.recipe.linhThach} LT`,
      value: p.id,
      default: p.id === selectedPillId,
      emoji: p.tier === 'DIA_GIAI' ? '🔮' : (p.tier === 'HUYEN_GIAI' ? '🔷' : '🟢')
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
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

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
      `  • 🌿 **Linh Thảo:** \`${linhThaoCount} nhánh\` (Kiếm từ \`!lamcong\`)\n` +
      `  • 🐾 **Yêu Đan Yêu Thú:** \`${totalYeuDan} viên\` (Kiếm từ \`!santhu\`)\n` +
      `  • 💎 **Linh Thạch:** \`${user.currencies.linhThach.toLocaleString()} LT\`\n\n` +
      `👇 **Hãy chọn Phương Thuốc từ Menu bên dưới để nhóm lửa luyện đan:**`
    )
    .setFooter({ text: 'Dùng !uongdan <tên> để sử dụng đan dược | !bandan để bán trên Chợ Trời' });

  const selectRow = createAlchemySelectMenu(userId);
  await message.reply({ embeds: [embed], components: [selectRow] });
}

// Lệnh nuốt đan dược (!uongdan <tên_đan> / !dungdan)
export async function executeUongdan(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

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
  const healAmount = Math.floor((pillConfig ? pillConfig.healHp : 200) * (1 + potionBonus));
  const expAmount = pillConfig ? Math.floor(pillConfig.expGain * (user.talent.expMultiplier || 1.0)) : 100;

  // Áp dụng hiệu quả đan dược
  user.stats.hp = Math.min(user.stats.maxHp, user.stats.hp + healAmount);
  user.realm.exp += expAmount;

  let bonusText = '';
  if (pillConfig && pillConfig.statBonus) {
    if (pillConfig.statBonus.atk) {
      user.stats.atk += pillConfig.statBonus.atk;
      bonusText += `\n🗡️ **+${pillConfig.statBonus.atk} ATK vĩnh viễn!**`;
    }
    if (pillConfig.statBonus.def) {
      user.stats.def += pillConfig.statBonus.def;
      bonusText += `\n🛡️ **+${pillConfig.statBonus.def} DEF vĩnh viễn!**`;
    }
    if (pillConfig.statBonus.maxHp) {
      user.stats.maxHp += pillConfig.statBonus.maxHp;
      user.stats.hp += pillConfig.statBonus.maxHp;
      bonusText += `\n❤️ **+${pillConfig.statBonus.maxHp} Max HP vĩnh viễn!**`;
    }
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
      `⚡ **Hấp Thu Chân Khí:** \`+${expAmount} EXP Tu Vi\` (${user.realm.exp}/${user.realm.maxExp})${bonusText}`
    );

  await message.reply({ embeds: [embed] });
}
