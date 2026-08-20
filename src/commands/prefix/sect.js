import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { Sect } from '../../database/models/Sect.js';

const SECT_TASK_COOLDOWN_SECONDS = 60; // 60s delay cho mỗi lần làm nhiệm vụ bang
const SECT_UPGRADE_COSTS = {
  1: { cost: 1000, maxMembers: 10, buffText: '+5% EXP Tu Luyện' },
  2: { cost: 3000, maxMembers: 15, buffText: '+10% EXP Tu Luyện, +5% Khí Vận' },
  3: { cost: 8000, maxMembers: 25, buffText: '+15% EXP Tu Luyện, Giảm 10% phí đột phá' },
  4: { cost: 20000, maxMembers: 40, buffText: '+20% EXP Tu Luyện, Hồi phục chân khí cấp tốc' },
  5: { cost: 50000, maxMembers: 60, buffText: '+25% EXP Tu Luyện, Mở khóa Thần Thú Hộ Tông Vạn Cổ' }
};

export function getSectMaxMembers(level = 1) {
  return SECT_UPGRADE_COSTS[level]?.maxMembers || 10;
}

export function getSectBuffText(level = 1) {
  return SECT_UPGRADE_COSTS[level]?.buffText || '+5% EXP Tu Luyện';
}

export function createSectEmbed(sect, user) {
  const maxMembers = getSectMaxMembers(sect.level);
  const buffDesc = getSectBuffText(sect.level);
  const nextLevel = sect.level + 1;
  const nextCost = SECT_UPGRADE_COSTS[sect.level]?.cost;
  const upgradeText = nextCost
    ? `Cần \`${nextCost.toLocaleString()} LT\` trong Ngân Khố để lên Cấp ${nextLevel}`
    : `Đã đạt cấp tối đa (Cấp 5 - Vạn Cổ Bất Hủ)`;

  const embed = new EmbedBuilder()
    .setTitle(`🏛️ [TÔNG MÔN THẾ LỰC] - ${sect.name}`)
    .setColor('#9C27B0')
    .setDescription(
      `👑 **Chưởng Môn:** **${sect.leaderName}**\n` +
      `⚖️ **Trận Doanh:** \`${sect.faction}\` | 📜 **Tôn Chỉ:** *${sect.desc || 'Trấn áp quần hùng, xưng bá thiên hạ.'}*\n\n` +
      `🏰 **Cấp Tông Môn:** **Cấp ${sect.level} / 5** | 🔥 **Uy Danh:** \`${sect.reputation.toLocaleString()} Điểm\`\n` +
      `🛡️ **Hộ Tông Đại Trận:** Cấp ${sect.arrayLevel} *(Giảm 15% tổn thất khi bị công kích)*\n` +
      `👥 **Đệ Tử:** \`${sect.members.length}/${maxMembers}\` thành viên\n` +
      `💎 **Ngân Khố Bang:** **\`${sect.treasury.linhThach.toLocaleString()} Linh Thạch\`**\n\n` +
      `✨ **Phúc Lợi Sơn Môn Hiện Tại:** \`${buffDesc}\`\n` +
      `📈 **Tiến Độ Nâng Cấp:** ${upgradeText}`
    );

  const memberList = sect.members.slice(0, 10).map((m, i) => {
    const roleIcon = m.role === 'LEADER' ? '👑 [Chưởng Môn]' : m.role === 'ELDER' ? '🎖️ [Trưởng Lão]' : '🥋 [Đệ Tử]';
    return `${i + 1}. ${roleIcon} **${m.username}** - Cống hiến: \`${m.contribution}\``;
  }).join('\n');

  embed.addFields({ name: `📜 Danh Sách Thành Viên Tiêu Biểu`, value: memberList || 'Chưa có thành viên', inline: false });
  embed.setFooter({ text: `Dùng !help sect để xem chi tiết toàn bộ lệnh môn phái!` });
  return embed;
}

export function createSectButtons(sect, userId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sect_btn_donate_${sect._id}_${userId}`).setLabel('💎 Cống Hiến LT').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sect_btn_task_${sect._id}_${userId}`).setLabel('📜 Nhiệm Vụ Bang').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`sect_btn_upgrade_${sect._id}_${userId}`).setLabel('🏰 Nâng Cấp Bang').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`sect_btn_top_${userId}`).setLabel('🏆 BXH Tông Môn').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`sect_btn_leave_${sect._id}_${userId}`).setLabel('🚪 Rời Bang').setStyle(ButtonStyle.Danger)
  );
  return [row];
}

// 1. Lệnh Khai Sơn Lập Phái: !laptongmon <Tên>
export async function executeLaptongmon(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (user.sectId) {
    return message.reply({ content: `❌ Đạo hữu đã gia nhập một Tông Môn rồi! Phải rời môn phái trước khi lập bang mới.` });
  }

  if (args.length < 1) {
    return message.reply({ content: `❌ Cú pháp: \`!laptongmon <Tên_Tông_Môn>\` (Ví dụ: \`!laptongmon Cửu U Ma Cung\`)` });
  }

  const sectName = args.join(' ').trim();
  const SECT_COST = 500;

  if (user.currencies.linhThach < SECT_COST) {
    return message.reply({
      content: `❌ Khai sơn lập phái cần **${SECT_COST} Linh Thạch** để xây dựng sơn môn! (Hiện có: **${user.currencies.linhThach.toLocaleString()}**).`
    });
  }

  const existingSect = await Sect.findOne({ name: sectName });
  if (existingSect) {
    return message.reply({ content: `❌ Tên Tông Môn **${sectName}** đã tồn tại trong thiên hạ!` });
  }


  // Trừ tiền atomic TRƯỚC khi dựng sơn môn. Gõ `!laptongmon` hai lần thật
  // nhanh với hai cái tên khác nhau thì trước đây cả hai đều lập được bang mà
  // chỉ mất một lần tiền. Điều kiện `sectId: null` cũng chặn luôn trường hợp
  // vừa được mời vào bang khác giữa chừng.
  // Cố ý KHÔNG sửa `user.currencies` trong bộ nhớ: `user.save()` bên dưới chỉ
  // ghi `sectId`/`sectRole`, nếu chạm vào số dư nó sẽ đè ngược giá trị cũ.
  const paidSect = await User.findOneAndUpdate(
    { userId: user.userId, sectId: null, 'currencies.linhThach': { $gte: SECT_COST } },
    { $inc: { 'currencies.linhThach': -SECT_COST } },
    { new: true }
  );

  if (!paidSect) {
    return message.reply({
      content: `❌ Không đủ **${SECT_COST} Linh Thạch** để khai sơn lập phái (hoặc đạo hữu vừa gia nhập một tông môn khác). Vui lòng thử lại!`
    });
  }

  const newSect = new Sect({
    name: sectName,
    leaderId: user.userId,
    leaderName: user.daoName || user.username,
    faction: user.faction,
    reputation: 50,
    treasury: { linhThach: 200 },
    members: [{
      userId: user.userId,
      username: user.daoName || user.username,
      role: 'LEADER',
      contribution: 100
    }]
  });


  try {
    await newSect.save();
  } catch (err) {
    // Tên bị người khác chiếm mất trong tích tắc chẳng hạn -> hoàn tiền ngay,
    // tuyệt đối không nuốt Linh Thạch của người chơi.
    await User.updateOne({ userId: user.userId }, { $inc: { 'currencies.linhThach': SECT_COST } }).catch(() => {});
    console.error('[sect:laptongmon] Không tạo được tông môn, đã hoàn Linh Thạch:', err);
    return message.reply({
      content: `❌ Khai sơn lập phái thất bại (tên tông môn có thể vừa bị người khác chiếm). **${SECT_COST} Linh Thạch** đã được hoàn lại.`
    });
  }

  user.sectId = newSect._id;
  user.sectRole = 'LEADER';
  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`🏛️ [KHAI SƠN LẬP PHÁI THÀNH CÔNG]`)
    .setColor('#FFD700')
    .setDescription(
      `Thiên địa dị tượng bùng nổ! Tông môn **[${sectName}]** chính thức khai tông lập phái!\n\n` +
      `👑 **Chưởng Môn:** **${user.daoName || user.username}**\n` +
      `⚖️ **Trận Doanh:** \`${user.faction}\`\n` +
      `🏰 **Cấp Sơn Môn:** Cấp 1 *(Nhận ngay +5% EXP Tu Luyện cho toàn bang)*\n\n` +
      `👉 Hãy dùng lệnh \`!tongmon\` để quản lý hoặc \`!moivaobang @user\` để chiêu mộ đệ tử!`
    );

  await message.reply({ embeds: [embed] });
}

// 2. Lệnh Xem Bảng Tông Môn: !tongmon
export async function executeTongmon(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (!user.sectId) {
    return message.reply({
      content: `*Đạo hữu hiện là tán tu chưa thuộc về môn phái nào. Hãy dùng \`!laptongmon <Tên>\` để lập bang riêng hoặc nhờ Chưởng Môn khác mời vào qua lệnh \`!moivaobang\`!*`
    });
  }

  const sect = await Sect.findById(user.sectId);
  if (!sect) {
    user.sectId = null;
    user.sectRole = 'NONE';
    await user.save();
    return message.reply({ content: `❌ Tông Môn của bạn đã bị giải tán!` });
  }

  const embed = createSectEmbed(sect, user);
  const buttons = createSectButtons(sect, user.userId);
  await message.reply({ embeds: [embed], components: buttons });
}

// 3. Lệnh Mời Đạo Hữu Vào Bang: !moivaobang @user
export async function executeMoivaobang(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user || !user.sectId) {
    return message.reply({ content: `❌ Bạn chưa gia nhập môn phái nào!` });
  }

  const sect = await Sect.findById(user.sectId);
  if (!sect) return message.reply({ content: `❌ Môn phái không tồn tại!` });

  if (user.sectRole !== 'LEADER' && user.sectRole !== 'ELDER') {
    return message.reply({ content: `❌ Chỉ có Chưởng Môn hoặc Trưởng Lão mới có quyền chiêu mộ đệ tử!` });
  }

  const maxMembers = getSectMaxMembers(sect.level);
  if (sect.members.length >= maxMembers) {
    return message.reply({ content: `❌ Sơn môn hiện tại đã đầy đệ tử (\`${sect.members.length}/${maxMembers}\`)! Hãy nâng cấp Tông Môn để chiêu mộ thêm.` });
  }

  const targetMention = message.mentions.users.first();
  if (!targetMention || targetMention.id === message.author.id) {
    return message.reply({ content: `❌ Hãy tag đạo hữu bạn muốn chiêu mộ! (Ví dụ: \`!moivaobang @user\`)` });
  }

  const targetUser = await User.findOne({ userId: targetMention.id });
  if (!targetUser) return message.reply({ content: `❌ Người chơi này chưa bước vào tiên đồ!` });

  if (targetUser.sectId) {
    return message.reply({ content: `❌ Đạo hữu này đã có môn phái, không thể gia nhập!` });
  }

  const embed = new EmbedBuilder()
    .setTitle(`💌 [THIỆP MỜI GIA NHẬP TÔNG MÔN]`)
    .setColor('#00BCD4')
    .setDescription(
      `Đạo hữu **${user.daoName || user.username}** (${user.sectRole === 'LEADER' ? 'Chưởng Môn' : 'Trưởng Lão'}) gửi lời mời gia nhập **[${sect.name}]** (Cấp ${sect.level}) tới <@${targetUser.userId}>!\n\n` +
      `✨ **Phúc Lợi Môn Phái:** \`${getSectBuffText(sect.level)}\`\n\n` +
      `👉 Đạo hữu có muốn quy thuận dưới trướng **${sect.name}**?`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sect_invite_accept_${sect._id}_${targetUser.userId}`)
      .setLabel('✅ Đồng Ý Gia Nhập')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`sect_invite_decline_${sect._id}_${targetUser.userId}`)
      .setLabel('❌ Từ Chối')
      .setStyle(ButtonStyle.Secondary)
  );

  await message.reply({ embeds: [embed], components: [row] });
}

// 4. Lệnh Cống Hiến Linh Thạch: !conghien <số_lượng>

/** Trần một lần cống hiến — chặn lỗi gõ nhầm kiểu `!conghien 999999999`. */
export const MAX_DONATE_PER_TIME = 10_000_000;

/**
 * Chuyển Linh Thạch từ túi tu sĩ vào ngân khố tông môn.
 *
 * Dùng chung cho `!conghien` và modal cống hiến ở `!tongmon` — hai đường
 * trước đây là hai bản chép tay riêng biệt, cùng mắc lỗi `findOne` → sửa bộ
 * nhớ → `save()`: spam cùng lúc thì ngân khố nhận nhiều hơn số Linh Thạch
 * thực sự bị trừ khỏi người chơi.
 *
 * @returns {Promise<{ok: boolean, message?: string, embed?: EmbedBuilder}>}
 */
export async function donateToSect(user, sect, amount) {
  if (isNaN(amount) || amount <= 0) {
    return { ok: false, message: `❌ Số Linh Thạch cống hiến phải là một số nguyên dương hợp lệ!` };
  }

  if (amount > MAX_DONATE_PER_TIME) {
    return { ok: false, message: `❌ Mỗi lần chỉ cống hiến tối đa **${MAX_DONATE_PER_TIME.toLocaleString()} Linh Thạch**.` };
  }

  // Trừ atomic trước, nạp ngân khố sau; hỏng ở bước nào cũng hoàn tác được.
  const paid = await User.findOneAndUpdate(
    { userId: user.userId, 'currencies.linhThach': { $gte: amount } },
    { $inc: { 'currencies.linhThach': -amount } },
    { new: true }
  );

  if (!paid) {
    return {
      ok: false,
      message: `❌ Đạo hữu không đủ **${amount.toLocaleString()} Linh Thạch** để cống hiến! (Hiện có: **${(user.currencies?.linhThach || 0).toLocaleString()}**)`
    };
  }

  const contribGain = Math.floor(amount / 2);

  const updatedSect = await Sect.findOneAndUpdate(
    { _id: sect._id },
    { $inc: { 'treasury.linhThach': amount } },
    { new: true }
  ).catch(() => null);

  if (!updatedSect) {
    await User.updateOne({ userId: user.userId }, { $inc: { 'currencies.linhThach': amount } }).catch(() => {});
    return { ok: false, message: `❌ Ngân khố tông môn không nhận được Linh Thạch — giao dịch đã hoàn tác.` };
  }

  await Sect.updateOne(
    { _id: sect._id, 'members.userId': user.userId },
    { $inc: { 'members.$.contribution': contribGain } }
  ).catch((err) => console.error('[sect:conghien] Không cộng được điểm cống hiến:', err));

  const embed = new EmbedBuilder()
    .setTitle(`💎 [CỐNG HIẾN MÔN PHÁI]`)
    .setColor('#4CAF50')
    .setDescription(
      `Đạo hữu **${user.daoName || user.username}** đã quyên góp **${amount.toLocaleString()} Linh Thạch** vào Ngân Khố **[${sect.name}]**!\n\n` +
      `✨ Nhận được: **+${contribGain.toLocaleString()} Điểm Cống Hiến**\n` +
      `💰 Ngân Khố Tông Môn hiện tại: **${(updatedSect.treasury?.linhThach || 0).toLocaleString()} Linh Thạch**\n` +
      `💎 Số dư còn lại của đạo hữu: **${(paid.currencies.linhThach || 0).toLocaleString()} Linh Thạch**`
    );

  return { ok: true, embed };
}

export async function executeConghien(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user || !user.sectId) return message.reply({ content: `❌ Bạn chưa gia nhập môn phái!` });

  const sect = await Sect.findById(user.sectId);
  if (!sect) return message.reply({ content: `❌ Môn phái không tồn tại!` });

  const amount = parseInt(args[0], 10);
  if (isNaN(amount) || amount <= 0) {
    return message.reply({ content: `❌ Cú pháp đúng: \`!conghien <số_linh_thạch>\` (Ví dụ: \`!conghien 200\`)` });
  }

  const result = await donateToSect(user, sect, amount);
  if (!result.ok) return message.reply({ content: result.message });

  await message.reply({ embeds: [result.embed] });
}

// 5. Lệnh Nhiệm Vụ Môn Phái: !nhiemvubang
export async function executeNhiemvubang(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user || !user.sectId) return message.reply({ content: `❌ Bạn chưa gia nhập môn phái!` });

  const sect = await Sect.findById(user.sectId);
  if (!sect) return message.reply({ content: `❌ Môn phái không tồn tại!` });

  const now = new Date();
  if (user.cooldowns.sectTask) {
    const elapsedSeconds = Math.floor((now - new Date(user.cooldowns.sectTask)) / 1000);
    if (elapsedSeconds < SECT_TASK_COOLDOWN_SECONDS) {
      const waitTime = SECT_TASK_COOLDOWN_SECONDS - elapsedSeconds;
      return message.reply({
        content: `⏳ Đạo hữu vừa hoàn thành ủy thác môn phái! Vui lòng nghỉ ngơi thêm **${waitTime}s**.`
      });
    }
  }

  const tasks = [
    { title: '🛡️ [TUẦN TRA SƠN MÔN]', desc: 'Quét sạch tà tu dòm ngó ngoài sơn môn, bảo vệ đại trận yên bình!', exp: 120, lt: 60, contrib: 15, rep: 8 },
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
  if (member) {
    member.contribution = (member.contribution || 0) + task.contrib;
  }

  await user.save();
  await sect.save();

  const embed = new EmbedBuilder()
    .setTitle(task.title)
    .setColor('#2196F3')
    .setDescription(
      `${task.desc}\n\n` +
      `🎁 **Phần thưởng nhận được:**\n` +
      `✨ Tu Vi: **+${task.exp} EXP**\n` +
      `💎 Linh Thạch: **+${task.lt} LT**\n` +
      `🎖️ Cống Hiến Bang: **+${task.contrib} Điểm**\n` +
      `🔥 Uy Danh Tông Môn: **+${task.rep} Điểm**\n\n` +
      `⏱️ *Thời gian hồi chiêu: 60 giây*`
    );

  await message.reply({ embeds: [embed] });
}

// 6. Lệnh Trục Xuất Đệ Tử: !khuctruc @user
export async function executeKhuctruc(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user || !user.sectId) return message.reply({ content: `❌ Bạn chưa gia nhập môn phái!` });

  const sect = await Sect.findById(user.sectId);
  if (!sect) return message.reply({ content: `❌ Môn phái không tồn tại!` });

  if (user.sectRole !== 'LEADER' && user.sectRole !== 'ELDER') {
    return message.reply({ content: `❌ Chỉ có Chưởng Môn hoặc Trưởng Lão mới có quyền trục xuất đệ tử!` });
  }

  const targetMention = message.mentions.users.first();
  if (!targetMention || targetMention.id === message.author.id) {
    return message.reply({ content: `❌ Hãy tag đệ tử cần trục xuất! (Ví dụ: \`!khuctruc @user\`)` });
  }

  const targetUser = await User.findOne({ userId: targetMention.id });
  if (!targetUser || !targetUser.sectId || targetUser.sectId.toString() !== sect._id.toString()) {
    return message.reply({ content: `❌ Người chơi này không thuộc môn phái của bạn!` });
  }

  if (targetUser.sectRole === 'LEADER') {
    return message.reply({ content: `❌ Không thể trục xuất Chưởng Môn!` });
  }
  if (user.sectRole === 'ELDER' && targetUser.sectRole === 'ELDER') {
    return message.reply({ content: `❌ Trưởng Lão không thể trục xuất Trưởng Lão khác!` });
  }

  sect.members = sect.members.filter(m => m.userId !== targetUser.userId);
  await sect.save();

  targetUser.sectId = null;
  targetUser.sectRole = 'NONE';
  await targetUser.save();

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ [TRỤC XUẤT SƠN MÔN]`)
    .setColor('#F44336')
    .setDescription(
      `Đạo hữu **${targetUser.daoName || targetUser.username}** đã bị trục xuất khỏi **[${sect.name}]**!`
    );

  await message.reply({ embeds: [embed] });
}

// 7. Lệnh Bổ Nhiệm Chức Vị: !phongchuc @user <ELDER/MEMBER>
export async function executePhongchuc(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user || !user.sectId || user.sectRole !== 'LEADER') {
    return message.reply({ content: `❌ Chỉ có Chưởng Môn mới có quyền bổ nhiệm chức vị!` });
  }

  const sect = await Sect.findById(user.sectId);
  if (!sect) return message.reply({ content: `❌ Môn phái không tồn tại!` });

  const targetMention = message.mentions.users.first();
  if (!targetMention || targetMention.id === message.author.id) {
    return message.reply({ content: `❌ Cú pháp: \`!phongchuc @user <ELDER|MEMBER>\`` });
  }

  const newRole = args[1]?.toUpperCase();
  if (newRole !== 'ELDER' && newRole !== 'MEMBER') {
    return message.reply({ content: `❌ Chức vị hợp lệ: \`ELDER\` (Trưởng Lão) hoặc \`MEMBER\` (Đệ Tử).` });
  }

  const member = sect.members.find(m => m.userId === targetMention.id);
  if (!member) {
    return message.reply({ content: `❌ Người chơi này không thuộc môn phái!` });
  }

  member.role = newRole;
  await sect.save();

  const targetUser = await User.findOne({ userId: targetMention.id });
  if (targetUser) {
    targetUser.sectRole = newRole;
    await targetUser.save();
  }

  const roleName = newRole === 'ELDER' ? '🎖️ [Đại Trưởng Lão]' : '🥋 [Đệ Tử]';
  const embed = new EmbedBuilder()
    .setTitle(`👑 [SẮC PHONG CHỨC VỊ]`)
    .setColor('#FFD700')
    .setDescription(
      `Chưởng Môn đã sắc phong cho **${member.username}** trở thành **${roleName}** của môn phái **[${sect.name}]**!`
    );

  await message.reply({ embeds: [embed] });
}

// 8. Bảng Xếp Hạng Vạn Phái: !bxhtongmon
export async function executeBxhtongmon(message) {
  const sects = await Sect.find().sort({ level: -1, reputation: -1, 'treasury.linhThach': -1 }).limit(10).lean();

  const embed = new EmbedBuilder()
    .setTitle(`🏆 [BẢNG XẾP HẠNG VẠN PHÁI THIÊN HẠ]`)
    .setColor('#FFD700')
    .setDescription(`Danh sách các Tông Môn hùng mạnh và danh chấn thiên hạ nhất:\n\n`);

  if (sects.length === 0) {
    embed.setDescription(`*Chưa có Tông Môn nào được thành lập. Hãy là người đầu tiên khai sơn lập phái bằng lệnh \`!laptongmon\`!*`);
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

  await message.reply({ embeds: [embed] });
}
