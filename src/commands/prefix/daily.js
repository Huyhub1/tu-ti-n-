import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';

// Lấy chuỗi ngày hôm nay định dạng YYYY-MM-DD theo giờ Việt Nam (UTC+7)
export function getTodayDateString() {
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return utc7.toISOString().split('T')[0];
}

// Lấy chuỗi ngày hôm qua định dạng YYYY-MM-DD
export function getYesterdayDateString() {
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return utc7.toISOString().split('T')[0];
}

// Bói Quẻ Thiên Cơ ngẫu nhiên
export function rollDailyFortune() {
  const rand = Math.random();

  if (rand < 0.15) {
    // 🌟 Đại Cát (15%)
    return {
      type: 'DAI_CAT',
      title: '🌟 ĐẠI CÁT - TỬ KHÍ ĐÔNG LAI',
      color: '#FFD700',
      money: Math.floor(Math.random() * 300) + 500, // 500 - 800 LT
      nguyenThach: Math.floor(Math.random() * 3) + 3, // 3 - 5 NT
      linhThao: 2,
      exp: 300,
      quote: 'Tử khí đông lai, hồng phúc tề thiên! Hôm nay đạo hữu vạn sự hanh thông, xuất hành gặt hái đại cơ duyên!'
    };
  } else if (rand < 0.50) {
    // ☀️ Trung Cát (35%)
    return {
      type: 'TRUNG_CAT',
      title: '☀️ TRUNG CÁT - GIÓ HÒA MƯA THUẬN',
      color: '#4CAF50',
      money: Math.floor(Math.random() * 150) + 300, // 300 - 450 LT
      nguyenThach: Math.floor(Math.random() * 2) + 1, // 1 - 2 NT
      linhThao: 1,
      exp: 150,
      quote: 'Khí vận bình ổn, tâm cảnh an định. Thích hợp bế quan tích lũy đan điền, tương lai tất thành đại nghiệp!'
    };
  } else if (rand < 0.85) {
    // 🌤️ Tiểu Cát (35%)
    return {
      type: 'TIEU_CAT',
      title: '🌤️ TIỂU CÁT - SÓNG YÊN BIỂN LẶNG',
      color: '#00BCD4',
      money: Math.floor(Math.random() * 100) + 150, // 150 - 250 LT
      nguyenThach: 0,
      linhThao: 1,
      exp: 80,
      quote: 'Mọi việc diễn ra êm đềm, không gặp trắc trở. Hãy chuyên tâm rèn luyện công pháp!'
    };
  } else {
    // ⚡ Hung Hóa Cát (15%)
    return {
      type: 'HUNG_HOA_CAT',
      title: '⚡ HUNG HÓA CÁT - NGHỊCH CẢNH TRÙNG SINH',
      color: '#E91E63',
      money: 200,
      nguyenThach: 1,
      linhThao: 0,
      yeuDan: 1,
      exp: 100,
      quote: 'Có chút trắc trở nhỏ nơi đan điền, nhưng trong nguy có cơ! Trảm yêu trừ ma tất gặt hái kỳ bảo!'
    };
  }
}

// Tạo chuỗi hiển thị 7 ngày streak
export function createStreakDisplay(currentStreak) {
  const days = [1, 2, 3, 4, 5, 6, 7];
  return days.map(d => {
    if (d < currentStreak) return `✅ N${d}`;
    if (d === currentStreak) return `🔥 **[N${d}]**`;
    if (d === 7) return `🎁 N7`;
    return `▫️ N${d}`;
  }).join(' ➜ ');
}

export async function executeDiemdanh(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  if (!user.dailyCheckIn) {
    user.dailyCheckIn = { lastDate: null, streak: 0 };
  }

  // Đã điểm danh hôm nay rồi
  if (user.dailyCheckIn.lastDate === today) {
    const embed = new EmbedBuilder()
      .setTitle(`📜 [THIÊN CƠ BẢNG] - ĐÃ ĐIỂM DANH HÔM NAY`)
      .setColor('#9E9E9E')
      .setDescription(
        `Đạo hữu **${user.daoName || user.username}** đã rút quẻ và nhận bổng lộc hôm nay rồi!\n\n` +
        `🔥 **Chuỗi Điểm Danh Hiện Tại:** \`${user.dailyCheckIn.streak || 1} Ngày\`\n` +
        `📅 **Lộ trình:** ${createStreakDisplay(user.dailyCheckIn.streak || 1)}\n\n` +
        `⏰ *Hãy quay lại vào ngày mai (sau 00:00) để tiếp tục rút quẻ nhận đại phúc lợi!*`
      );
    return message.reply({ embeds: [embed] });
  }

  // Tính toán chuỗi Streak
  let streak = 1;
  if (user.dailyCheckIn.lastDate === yesterday) {
    streak = (user.dailyCheckIn.streak || 0) + 1;
    if (streak > 7) streak = 1; // Sau ngày 7 lặp lại chu kỳ mới
  }

  user.dailyCheckIn.lastDate = today;
  user.dailyCheckIn.streak = streak;

  // Rút Quẻ
  const fortune = rollDailyFortune();

  // Thưởng cơ bản từ quẻ
  user.currencies.linhThach += fortune.money;
  if (fortune.nguyenThach > 0) {
    user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + fortune.nguyenThach;
  }
  user.realm.exp += fortune.exp;

  // Thưởng Linh Thảo / Yêu Đan
  if (fortune.linhThao && fortune.linhThao > 0) {
    const existingHerb = (user.inventory || []).find(i => i.itemId === 'linh_thao');
    if (existingHerb) existingHerb.quantity += fortune.linhThao;
    else user.inventory.push({ itemId: 'linh_thao', name: 'Linh Thảo', type: 'NGUYEN_LIEU', quantity: fortune.linhThao, desc: 'Dược thảo tươi chứa linh khí dùng để luyện đan.' });
  }

  if (fortune.yeuDan && fortune.yeuDan > 0) {
    const existingDan = (user.inventory || []).find(i => i.itemId === 'yeu_dan_so_cap');
    if (existingDan) existingDan.quantity += fortune.yeuDan;
    else user.inventory.push({ itemId: 'yeu_dan_so_cap', name: 'Yêu Đan (Sơ Cấp)', type: 'DAN_DUOC', quantity: fortune.yeuDan, desc: 'Nội đan chứa linh khí thuần túy từ yêu thú.' });
  }

  // Thưởng thêm theo chuỗi ngày (Streak Bonus)
  let streakBonusText = '';
  const streakBonusMoney = streak * 60;
  user.currencies.linhThach += streakBonusMoney;

  if (streak === 7) {
    // THƯỞNG ĐẠI LỘC NGÀY 7
    const hoiXuanDan = (user.inventory || []).find(i => i.itemId === 'hoi_xuan_dan');
    if (hoiXuanDan) hoiXuanDan.quantity += 1;
    else user.inventory.push({ itemId: 'hoi_xuan_dan', name: 'Hồi Xuân Đan', type: 'DAN_DUOC', quantity: 1, desc: 'Đan dược hồi phục 500 HP sinh mệnh tức thì.' });

    const hoMachDan = (user.inventory || []).find(i => i.itemId === 'ho_mach_dan');
    if (hoMachDan) hoMachDan.quantity += 1;
    else user.inventory.push({ itemId: 'ho_mach_dan', name: 'Hộ Mạch Đan', type: 'DAN_DUOC', quantity: 1, desc: 'Bảo đan che chở đan điền, chống tụt cấp khi độ kiếp thất bại.' });

    user.currencies.nguyenThach = (user.currencies.nguyenThach || 0) + 10;
    user.currencies.linhThach += 500;

    streakBonusText = `\n\n🎉 🎁 **ĐẠI LỘC THIÊN ĐẠO CHUỖI 7 NGÀY:**\n` +
      `  • 💎 \`+500 Linh Thạch\` | 🔮 \`+10 Nguyên Thạch\`\n` +
      `  • 💊 **1 Viên [Hồi Xuân Đan]** + **1 Viên [Hộ Mạch Đan]** (Bảo vệ khi độ kiếp)!`;
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`📜 [BÓI QUẺ THIÊN CƠ] - ${fortune.title}`)
    .setColor(fortune.color)
    .setDescription(
      `Đạo hữu **${user.daoName || user.username}** thắp hương kính thiên địa, rút được linh quẻ:\n\n` +
      `💬 *"${fortune.quote}"*\n\n` +
      `🎁 **BỔNG LỘC THIÊN ĐẠO BAN TẶNG:**\n` +
      `  • 💎 **Linh Thạch:** \`+${fortune.money} LT\` (+${streakBonusMoney} LT thưởng chuỗi)\n` +
      (fortune.nguyenThach > 0 ? `  • 🔮 **Nguyên Thạch:** \`+${fortune.nguyenThach} NT\`\n` : '') +
      `  • ✨ **Tu Vi:** \`+${fortune.exp} EXP\`\n` +
      (fortune.linhThao > 0 ? `  • 🌿 **Dược Liệu:** \`+${fortune.linhThao} Linh Thảo\` (\`!luyendan\`)\n` : '') +
      (fortune.yeuDan > 0 ? `  • 🐾 **Nội Đan:** \`+${fortune.yeuDan} Yêu Đan\`\n` : '') +
      streakBonusText +
      `\n\n🔥 **Chuỗi Điểm Danh:** \`${streak}/7 Ngày\`\n` +
      `📅 **Lộ trình:** ${createStreakDisplay(streak)}`
    )
    .setFooter({ text: 'Dùng !diemdanh mỗi ngày sau 00:00 để duy trì chuỗi Streak nhận Hộ Mạch Đan!' });

  await message.reply({ embeds: [embed] });
}
