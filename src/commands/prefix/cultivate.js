import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { Sect } from '../../database/models/Sect.js';


import { attemptBreakthrough, calculateUserMaxExp } from '../../services/cultivationService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const factionsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/factions.json'), 'utf8'));

import { getFactionBuffs } from '../../services/factionService.js';
import { COOLDOWNS, claimCooldown, cooldownLine } from '../../utils/cooldown.js';
import { repeatRow } from '../../utils/repeatButton.js';
import { tutorialNudge } from '../../services/tutorialService.js';

const CULTIVATE_COOLDOWN_SECONDS = COOLDOWNS.cultivate;

export async function cultivate(user) {
  const now = new Date();
  if (user.cooldowns.cultivate) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.cultivate)) / 1000);
    if (elapsedSeconds < CULTIVATE_COOLDOWN_SECONDS) {
      const waitTime = CULTIVATE_COOLDOWN_SECONDS - elapsedSeconds;
      return {
        success: false,

        message: `⏳ Đạo hữu đang trong trạng thái bế quan điều tức! Vui lòng tĩnh tâm chờ thêm **${waitTime}s**.`
      };
    }
  }

  // Chốt lượt bằng một câu lệnh nguyên tử. Kiểm tra ở trên chỉ để báo lỗi cho
  // đẹp; nếu người chơi gửi nhiều lệnh cùng lúc thì tất cả đều vượt qua nó, nên
  // phải có thêm cổng chặn dưới đây mới không nhân đôi EXP cho một lượt.
  // $inc dem luot gui kem ngay trong lenh chot hoi chieu: gop mot vong CSDL,
  // va do cung mot phep ghi nen khong bao gio co canh 'da cay ma khong duoc dem'.
  const claimed = await claimCooldown(User, user.userId, 'cultivate', {}, { $inc: { 'counters.cultivate': 1 } });
  if (!claimed) {
    return {
      success: false,
      message: `⏳ Đạo hữu vận công quá gấp, chân khí chưa kịp quy nguyên! Chờ thêm giây lát rồi tu luyện tiếp.`
    };
  }

  // claimCooldown vua $inc bo dem duoi CSDL, nhung `user` trong bo nho van la
  // ban doc truoc do nen dong nhac nhiem vu o cuoi se cham mat mot luot. Gan
  // dung MOT truong chu khong gan ca cum `counters`: save() se chi sinh ra
  // $set cho rieng o nay, khong de len bo dem cua hanh dong khac dang chay.
  user.counters.cultivate = claimed.counters.cultivate;


  // Đồng bộ lại vạch tu vi theo config hiện hành. Mỗi lần cân bằng lại
  // realms.json, người chơi cũ vẫn giữ maxExp cũ trong CSDL nên sẽ phải cày
  // theo bảng số đã bị bỏ. Tính lại ở đây là chỗ rẻ nhất và tự lành.

  const configMaxExp = calculateUserMaxExp(user, user.realm.id, user.realm.layer || 1, user.isLuyenKhiVanTang);
  if (configMaxExp > 0 && user.realm.maxExp !== configMaxExp) {
    user.realm.maxExp = configMaxExp;
  }

  // Tính EXP nhận được theo cảnh giới
  let baseExpGain = 20;
  if (user.realm.id === 'luyen_khi') baseExpGain = 45;
  if (user.realm.id === 'truc_co') baseExpGain = 250;
  if (user.realm.id === 'kim_dan') baseExpGain = 1500;
  if (user.realm.id === 'nguyen_anh') baseExpGain = 8000;

  // Hệ số tư chất
  const talentMult = user.talent.expMultiplier || 1.0;

  // Hệ số tâm pháp trang bị
  let skillExpBonus = 0;
  const equippedTamPhap = user.skills.filter(s => s.equipped && s.category === 'tam_phap');
  for (const s of equippedTamPhap) {
    skillExpBonus += (s.mastery / 100) * 0.20; // Tối đa +20% mỗi tâm pháp viên mãn
  }

  // Hệ số Phẩm Chất Kim Đan (Nếu đã Kết Đan)
  const coreExpBonus = user.goldenCore && user.goldenCore.expBonus ? user.goldenCore.expBonus : 0;

  // Hệ số Phúc Lợi Tông Môn (Nếu đã gia nhập Tông Môn)
  let sectExpBonus = 0;
  if (user.sectId) {
    const sect = await Sect.findById(user.sectId);
    if (sect) {
      sectExpBonus = (sect.level || 1) * 0.05; // +5% mỗi cấp Tông Môn
    }
  }


  // Hệ số Pháp Bảo & Binh Khí Đang Đeo (Nội Tại VIP)
  // Nội tại nằm ở equipmentSchema.passives.expBonus — đồ đúc/thưởng chưa có
  // trường này thì bonus = 0, đúng như thiết kế.
  let gearExpBonus = 0;
  const equippedGears = (user.equipments || []).filter(e => e.equipped);
  for (const g of equippedGears) {
    if (g.passives && g.passives.expBonus) {
      gearExpBonus += g.passives.expBonus;
    }
  }

  // Hệ số Trận Doanh (đọc từ config thay vì số cứng)
  const factionBonus = 1 + getFactionBuffs(user.faction).cultivateExpBonus;

  const finalExp = Math.floor(baseExpGain * talentMult * (1 + skillExpBonus + coreExpBonus + sectExpBonus + gearExpBonus) * factionBonus);

  // Âm thầm tích lũy căn cơ ngầm trong database (lên đến 250%)
  const maxCapExp = Math.floor(user.realm.maxExp * 2.5);
  user.realm.exp = Math.min(maxCapExp, user.realm.exp + finalExp);
  user.cooldowns.cultivate = now;

  const isReadyToBreak = user.realm.exp >= user.realm.maxExp;

  await user.save();

  // Hiển thị giao diện luôn giới hạn chuẩn 100% để giữ cơ chế ẩn
  const displayExp = Math.min(user.realm.maxExp, user.realm.exp);

  return {
    success: true,
    expGained: finalExp,
    isReadyToBreak,
    displayExp,
    currentExp: user.realm.exp,
    maxExp: user.realm.maxExp
  };
}

/**
 * Chạy một lượt tu luyện rồi dựng sẵn nguyên gói tin nhắn để hiển thị.
 *
 * Tách riêng khỏi executeTuluyen để nút 'Tu luyện tiếp' dùng lại được y
 * nguyên: lệnh gõ tay và nút bấm buộc phải cho ra cùng một màn hình, chép
 * làm hai bản thì sớm muộn cũng lệch nhau.
 *
 * Trả { content } khi không chạy được (chưa có nhân vật, còn hồi chiêu) và
 * { embeds, components } khi thành công. Chỗ gọi cứ nhìn có 'embeds' hay
 * không mà quyết định hiện công khai hay báo riêng cho người bấm.
 */
export async function buildTuluyenView(userId) {
  const user = await User.findOne({ userId });
  if (!user) {
    return { content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` };
  }

  const result = await cultivate(user);
  if (!result.success) {
    return { content: result.message };
  }

  const coreMsg = user.goldenCore && user.goldenCore.name ? `\n✨ Kim Đan Buff: **+${(user.goldenCore.expBonus * 100).toFixed(0)}% EXP**` : '';
  const percent = Math.min(100, Math.floor((result.displayExp / result.maxExp) * 100));

  const embed = new EmbedBuilder()
    .setTitle(`🧘 [BẾ QUAN TU LUYỆN] - ${user.daoName || user.username}`)
    .setColor('#4CAF50')
    .setDescription(
      `Đạo hữu ngồi xếp bằng vận chuyển chu thiên, hấp thu linh khí đất trời:\n\n` +
      `✨ Nhận được: **+${result.expGained} EXP** Tu Vi${coreMsg}\n` +
      `📊 Tiến độ: \`${result.displayExp}/${result.maxExp} EXP\` (${percent}%)\n` +

      cooldownLine('cultivate', user.cooldowns.cultivate) +
      tutorialNudge(user)
    );

  if (result.isReadyToBreak) {
    embed.addFields({
      name: `⚡ ĐÃ ĐẠT ĐỈNH PHONG!`,
      value: `Tu vi đã viên mãn, hãy gõ \`!dotpha\` để tiến cảnh!`
    });
  }

  return { embeds: [embed], components: repeatRow('tuluyen', userId) };
}

export async function executeTuluyen(message) {
  await message.reply(await buildTuluyenView(message.author.id));
}

export async function executeDotpha(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) {
    return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });
  }

  // Nếu đang ở Luyện Khí Đỉnh Phong (layer 4) và chưa chọn nhánh Nén Khí
  if (user.realm.id === 'luyen_khi' && user.realm.layer === 4 && !user.isLuyenKhiVanTang && user.realm.exp >= user.realm.maxExp) {
    const embed = new EmbedBuilder()
      .setTitle(`⚡ [NGÃ RẼ ĐẠI ĐẠO] - Luyện Khí Đỉnh Phong`)
      .setColor('#FF9800')
      .setDescription(
        `Đạo hữu đã đạt tới cảnh giới **Luyện Khí Đỉnh Phong**, đứng trước 2 sự lựa chọn lớn:\n\n` +
        `1. ⚡ **Đột Phá Trúc Cơ Kỳ:**\n` +
        `   - Vượt Lôi Kiếp, đúc Đạo Cơ, thọ nguyên tăng 200 năm, mở khóa ngự kiếm phi hành.\n\n` +
        `2. ⚔️ **Vạn Cổ Luyện Khí (Kế Thừa Từ Dương - 100k Năm):**\n` +
        `   - Từ chối Trúc Cơ, tiếp tục **Nén Khí Hải** lên Luyện Khí Tầng 5 ➜ 50+.\n` +
        `   - Pháp lực tích trữ vô cùng tận, **miễn nhiễm 100% Thiên Kiếp Lôi Phạt**, 1 đấm phá nát Kim Đan!`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`btn_break_trucco_${user.userId}`).setLabel('⚡ Đột Phá Trúc Cơ').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`btn_break_nenkhi_${user.userId}`).setLabel('⚔️ Nén Khí Hải (Từ Dương)').setStyle(ButtonStyle.Danger)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  const result = attemptBreakthrough(user);
  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(result.success ? `✨ [TIẾN CẢNH ĐỘT PHÁ]` : `💥 [ĐỘT PHÁ TRẮC TRỞ]`)
    .setColor(result.success ? '#FFD700' : '#F44336')
    .setDescription(result.message);

  await message.reply({ embeds: [embed] });
}
