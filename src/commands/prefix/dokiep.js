import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { Sect } from '../../database/models/Sect.js';
import { dangKyNguonBanRon } from '../../utils/banRon.js';
import { canhBaoThieuHoMach, laXacNhan } from '../../utils/hoMachDan.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const realmsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/realms.json'), 'utf8'));

// Lưu trữ phiên độ kiếp theo thời gian thực

export const dokiepSessions = {};

// Độ kiếp là khoảnh khắc quan trọng nhất của một nhân vật. Tắt bot giữa chừng
// để cập nhật thì không có cách nào đền bù cho ra hồn.
dangKyNguonBanRon('độ kiếp', () => Object.keys(dokiepSessions).length);

// Dọn phiên độ kiếp bị bỏ dở (người chơi tắt máy giữa chừng). Không có bước
// này thì mỗi phiên treo vĩnh viễn trong RAM và người chơi cũng bị kẹt luôn
// vì lệnh !dokiep sẽ báo "đang độ kiếp" mãi mãi.
const DOKIEP_SESSION_TTL_MS = 10 * 60 * 1000;
// `.unref()` ở cuối để bộ đếm không giữ tiến trình Node sống: bot vẫn chạy nhờ
// kết nối websocket của Discord, nhưng script kiểm thử nào lỡ nạp file này sẽ
// treo vĩnh viễn nếu thiếu — và bot cũng không thoát sạch khi tắt.
setInterval(() => {
  const now = Date.now();
  for (const userId in dokiepSessions) {
    const session = dokiepSessions[userId];
    if (session && session.lastActionTime && now - session.lastActionTime > DOKIEP_SESSION_TTL_MS) {
      delete dokiepSessions[userId];
    }
  }
}, 60 * 1000).unref?.();

export function createDokiepEmbed(session) {
  const strikeNames = [
    'Tích Lịch Thần Lôi (Tử Lôi Sơ Khởi)',
    'Tử Tiêu Ma Lôi (Ma Khí Đoạt Phách)',
    'Cửu Thiên Huyền Lôi (Thiên Đạo Diệt Thế)'
  ];

  const currentStrikeName = strikeNames[session.currentStrike - 1] || 'Thiên Lôi Tuyệt Diệt';
  const hpPercent = Math.max(0, Math.min(100, Math.floor((session.currentHp / session.maxHp) * 100)));
  const progressBar = getProgressBar(session.currentHp, session.maxHp, 12);

  const embed = new EmbedBuilder()
    .setTitle(`⚡ [THIÊN LÔI ĐỘ KIẾP] - NGUYÊN ANH CỬU TRỌNG KIẾP`)
    .setColor(session.currentStrike === 3 ? '#FF1744' : (session.currentStrike === 2 ? '#9C27B0' : '#FFD600'))
    .setDescription(
      `🌌 **Thiên Địa Dị Tượng:** Vạn dặm mây đen vần vũ, Cửu Thiên Lôi Trì sôi trào!\n` +
      `Thiên Đạo không dung thứ tu sĩ phá đan nghịch mệnh, giáng xuống lôi phạt sinh tử!\n\n` +
      `⚡ **ĐẠO THIÊN LÔI: ${session.currentStrike}/3 - [${currentStrikeName}]**\n` +
      `❤️ **Khí Huyết:** \`${session.currentHp}/${session.maxHp} HP\` [${progressBar}] (\`${hpPercent}%\`)\n` +
      `🛡️ **Phòng Ngự Bản Thân:** \`${session.totalDef} DEF\`\n\n` +
      `📜 **Diễn biến lôi kiếp:**\n${session.lastLog}\n\n` +
      `👉 **Thiên cơ khó đoán, đạo hữu hãy chọn cách ứng phó tức thời:**`
    );

  return embed;
}

export function createDokiepButtons(userId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dokiep_action_chan_khi_${userId}`)
      .setLabel('🛡️ Vận Khí Hộ Thân')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dokiep_action_phap_bao_${userId}`)
      .setLabel('🔮 Xuất Thủ Pháp Bảo')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`dokiep_action_dan_duoc_${userId}`)
      .setLabel('💊 Bí Thuật Đan Điền')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`dokiep_action_tong_mon_${userId}`)
      .setLabel('🏛️ Trận Pháp Dẫn Lôi')
      .setStyle(ButtonStyle.Danger)
  );

  return [row];
}

function getProgressBar(current, max, length = 10) {
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const filled = Math.floor((percent / 100) * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

// Lệnh chính: !dokiep
export async function executeDokiep(message, args = []) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });
  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });

  // Kiểm tra điều kiện độ kiếp: Phải là Kim Đan Kỳ Tầng Đỉnh Phong (layer >= 4) và đầy EXP
  if (user.realm.id !== 'kim_dan') {
    if (user.realm.id === 'nguyen_anh') {
      return message.reply({ content: `🌌 Đạo hữu đã là **Nguyên Anh Lão Tổ**, không cần độ kiếp Nguyên Anh nữa!` });
    }
    return message.reply({
      content: `⚡ Cảnh giới hiện tại (**${user.realm.name}**) chưa đủ để kích hoạt Thiên Lôi Kiếp!\n*(Chỉ khi tu sĩ đạt **Kim Đan Kỳ Đỉnh Phong** viên mãn mới có thể gõ \`!dokiep\`)*.`
    });
  }

  if (user.realm.layer < 4 || user.realm.exp < user.realm.maxExp) {
    return message.reply({
      content: `⚠️ Khí tức đan điền chưa đạt tới cực hạn viên mãn (${user.realm.exp}/${user.realm.maxExp} EXP)!\nHãy tiếp tục bế quan \`!tuluyen\` cho tới khi cảm nhận bình cảnh nứt vỡ rồi hẵng gõ \`!dokiep\`.`
    });
  }

  // Đang trong trận độ kiếp dở dang
  if (dokiepSessions[userId]) {
    return message.reply({ content: `⚡ Đạo hữu đang trong đại kiếp! Hãy chọn thao tác đối phó trên bảng điều khiển!` });
  }

  // Chặn đúng một nhịp nếu vào trận tay không. Kiểm sau các cửa trên để người
  // chưa đủ điều kiện không phải đọc một bức tường cảnh báo chẳng liên quan.
  if (!laXacNhan(args)) {
    const canhBao = canhBaoThieuHoMach(user, {
      tieuDe: '⚠️ [KHOAN ĐÃ] — CHƯA CÓ HỘ MẠCH ĐAN MÀ ĐÒI ĐỘ KIẾP',
      tiLe: realmsConfig.realms.find(r => r.id === 'kim_dan')?.breakSuccessRate ?? 0.35,
      hauQua: 'Kim Đan nứt toác, tu vi tụt thẳng từ **Đỉnh Phong** về **Trung Kỳ**, EXP về `0`. ' +
        'Công sức hai tầng coi như đổ sông.',
      lenhLieu: '!dokiep xacnhan'
    });
    if (canhBao) return message.reply({ embeds: [canhBao] });
  }

  // Tính toán chỉ số khởi tạo cho phiên độ kiếp
  const equippedGears = (user.equipments || []).filter(e => e.equipped);
  let totalDef = user.stats.def || 50;
  let totalHp = user.stats.maxHp || 1000;

  for (const g of equippedGears) {
    totalDef += (g.stats.def || 0);
    totalHp += (g.stats.maxHp || 0);
  }


  dokiepSessions[userId] = {
    userId,
    userName: user.daoName || user.username,
    lastActionTime: Date.now(),
    currentStrike: 1,
    currentHp: totalHp,
    maxHp: totalHp,
    totalDef,
    equippedGears,
    lastLog: `⚡ Thiên địa chấn động, đạo lôi kiếp đầu tiên màu tím biếc giáng thẳng từ tầng mây thứ chín xuống đỉnh đầu!`
  };

  const session = dokiepSessions[userId];
  const embed = createDokiepEmbed(session);
  const buttons = createDokiepButtons(userId);

  await message.reply({ embeds: [embed], components: buttons });
}
