import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';
import { getAllSkills } from '../../services/skillService.js';

const DOTHẠCH_COOLDOWN_SECONDS = 15; // 15s delay cho mỗi lần đổ thạch

export async function executeDothach(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const now = new Date();
  if (user.cooldowns.dothach) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.dothach)) / 1000);
    if (elapsedSeconds < DOTHẠCH_COOLDOWN_SECONDS) {
      const waitTime = DOTHẠCH_COOLDOWN_SECONDS - elapsedSeconds;
      return message.reply({
        content: `⏳ Đạo hữu đang quan sát mạch đá, vui lòng chờ **${waitTime}s** trước khi cắt viên tiếp theo!`
      });
    }
  }

  let betAmount = 100;
  if (args.length > 0) {
    const parsed = parseInt(args[0], 10);
    if (!isNaN(parsed) && parsed >= 50) {
      betAmount = parsed;
    }
  }

  if (user.currencies.linhThach < betAmount) {
    return message.reply({
      content: `❌ Không đủ Linh Thạch để mua phôi đá! Cần **${betAmount.toLocaleString()} Linh Thạch** (Hiện có: **${user.currencies.linhThach.toLocaleString()}**).`
    });
  }

  user.currencies.linhThach -= betAmount;
  user.cooldowns.dothach = now;

  // Tính kết quả đổ thạch
  const roll = Math.random();
  let embedColor = '#9E9E9E';
  let title = '';
  let desc = '';

  if (roll <= 0.40) {
    // 40% Phế thạch
    embedColor = '#757575';
    title = `🪨 [ĐỔ THẠCH] - Phế Thạch Rỗng Ruột`;
    desc = `Nhát dao hạ xuống, lớp đá vỡ vụn chỉ toàn đất cát! Đạo hữu mất **${betAmount.toLocaleString()} Linh Thạch**. Hãy kiên nhẫn thử lại!`;
  } else if (roll <= 0.70) {
    // 30% Hóa Cảnh Thạch (Lãi nhẹ)
    const nguyenThachEarned = Math.floor(Math.random() * 3) + 2; // 2-4 viên
    const refundLinhThach = Math.floor(betAmount * 1.2);
    user.currencies.linhThach += refundLinhThach;
    user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + nguyenThachEarned;

    embedColor = '#4CAF50';
    title = `🟢 [ĐỔ THẠCH] - Bạch Ngọc Nguyên Thạch`;
    desc = `Vết cắt phát ra ánh sáng dịu nhẹ! Mài ra được:\n\n` +
      `🔮 **+${nguyenThachEarned} Nguyên Thạch**\n` +
      `💎 Thu về: **+${refundLinhThach.toLocaleString()} Linh Thạch** (Lãi ${(refundLinhThach - betAmount).toLocaleString()} LT)`;
  } else if (roll <= 0.92) {
    // 22% Thượng Phẩm Dị Thạch (Lãi lớn)
    const nguyenThachEarned = Math.floor(Math.random() * 8) + 8; // 8-15 viên
    const refundLinhThach = Math.floor(betAmount * 2.0);
    user.currencies.linhThach += refundLinhThach;
    user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + nguyenThachEarned;

    embedColor = '#2196F3';
    title = `🔵 [ĐỔ THẠCH] - Thượng Phẩm Cổ Nguyên Thạch`;
    desc = `Lớp vỏ đá nứt toác, hào quang lam sắc ngút trời!\n\n` +
      `🔮 **+${nguyenThachEarned} Nguyên Thạch**\n` +
      `💎 Thu về: **+${refundLinhThach.toLocaleString()} Linh Thạch** (x2 vốn)`;
  } else {
    // 8% Thần Cổ Dị Tượng (Nổ hũ cực phẩm)
    const nguyenThachEarned = Math.floor(Math.random() * 20) + 25; // 25-45 viên
    const refundLinhThach = Math.floor(betAmount * 4.0);
    user.currencies.linhThach += refundLinhThach;
    user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + nguyenThachEarned;

    embedColor = '#FFD700';
    title = `✨ [ĐỔ THẠCH BẠO PHÁT] - CỔ THẦN BẢO THẠCH!`;
    desc = `Thiên địa dị tượng bùng nổ, khí tức hồng mông tràn ngập gian phòng!\n\n` +
      `🔮 **+${nguyenThachEarned} Nguyên Thạch Thần Bí**\n` +
      `💎 Thu về: **+${refundLinhThach.toLocaleString()} Linh Thạch** (x4 vốn)`;

    // Tặng thêm 1 bí kíp ngẫu nhiên nếu may mắn
    const allSkills = getAllSkills();
    const rareSkills = allSkills.filter(s => s.rarity === 'HUYEN_GIAI' || s.rarity === 'DIA_GIAI');
    if (rareSkills.length > 0) {
      const luckySkill = rareSkills[Math.floor(Math.random() * rareSkills.length)];
      if (!user.skills.some(s => s.skillId === luckySkill.id)) {
        user.skills.push({
          skillId: luckySkill.id,
          name: luckySkill.name,
          category: luckySkill.category,
          rarity: luckySkill.rarity,
          mastery: 10,
          equipped: false
        });
        desc += `\n📜 Nhặt được tàn thư phong ấn trong khối đá: **[${luckySkill.name}]** (${luckySkill.rarity})!`;
      }
    }
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(embedColor)
    .setDescription(
      `${desc}\n\n` +
      `💰 **Tài sản hiện tại:** \`${user.currencies.nguyenThach.toLocaleString()} Nguyên Thạch\` | \`${user.currencies.linhThach.toLocaleString()} Linh Thạch\`\n` +
      `⏱️ *Thời gian hồi chiêu: 15 giây*`
    );

  await message.reply({ embeds: [embed] });
}
