import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';
import { MarketItem } from '../../database/models/MarketItem.js';

export async function executeChotroi(message) {
  const items = await MarketItem.find({ active: true }).sort({ createdAt: -1 }).limit(10).lean();

  const embed = new EmbedBuilder()
    .setTitle(`🏪 [CHỢ TRỜ TU CHÂN GIỚI]`)
    .setColor('#00BCD4')
    .setDescription(
      `Nơi giao thương tự do Công Pháp & Đan Dược giữa các tu sĩ khắp thiên hạ:\n` +
      `• Đăng bán Công Pháp: \`!ban <stt_kỹ_năng> <giá_LT>\`\n` +
      `• Đăng bán Đan Dược: \`!bandan <tên_hoặc_stt> <số_lượng> <giá_LT>\`\n` +
      `• Mua hàng: \`!mua <mã_số>\`\n\n`
    );

  if (items.length === 0) {
    embed.setDescription(`*Hiện tại chợ trời chưa có mặt hàng nào. Hãy là người đầu tiên đăng bán bằng lệnh \`!ban\` hoặc \`!bandan\`!*`);
  } else {
    items.forEach((item) => {
      const typeBadge = item.itemType === 'DAN_DUOC' ? `💊 [ĐAN DƯỢC x${item.quantity || 1}]` : `📜 [CÔNG PHÁP]`;
      embed.addFields({
        name: `🏷️ [MÃ: ${item._id.toString().slice(-6)}] - ${typeBadge} **${item.itemName}**`,
        value: `💎 Giá: **${item.price.toLocaleString()} Linh Thạch** | Người bán: **${item.sellerName}**${item.desc ? `\n*${item.desc}*` : ''}`,
        inline: false
      });
    });
  }

  await message.reply({ embeds: [embed] });
}

// Đăng bán Công Pháp
export async function executeBan(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (args.length < 2) {
    return message.reply({
      content: `❌ Cú pháp đúng: \`!ban <số_thứ_tự_công_pháp> <giá_linh_thạch>\`\nVí dụ: \`!ban 1 500\``
    });
  }

  const skillIdx = parseInt(args[0], 10) - 1;
  const price = parseInt(args[1], 10);

  if (isNaN(skillIdx) || skillIdx < 0 || skillIdx >= user.skills.length) {
    return message.reply({ content: `❌ Số thứ tự công pháp không hợp lệ! Hãy gõ \`!tangkinhcac\` để xem danh sách.` });
  }

  if (isNaN(price) || price <= 0) {
    return message.reply({ content: `❌ Giá bán phải là một số nguyên dương!` });
  }

  const skillToSell = user.skills[skillIdx];

  // Xóa khỏi user và tạo MarketItem
  user.skills.splice(skillIdx, 1);
  await user.save();

  const newMarketItem = new MarketItem({
    sellerId: user.userId,
    sellerName: user.daoName || user.username,
    itemName: skillToSell.name,
    itemType: 'BI_KIP',
    skillId: skillToSell.skillId,
    price: price,
    desc: `Bí kíp phẩm cấp ${skillToSell.rarity}`
  });

  await newMarketItem.save();

  const embed = new EmbedBuilder()
    .setTitle(`🏪 [ĐĂNG BÁN THÀNH CÔNG]`)
    .setColor('#4CAF50')
    .setDescription(
      `Đạo hữu đã niêm yết bí kíp **[${skillToSell.name}]** lên Chợ Trời!\n\n` +
      `💎 Giá niêm yết: **${price.toLocaleString()} Linh Thạch**\n` +
      `🏷️ Mã mặt hàng: \`${newMarketItem._id.toString().slice(-6)}\``
    );

  await message.reply({ embeds: [embed] });
}

// Đăng bán Đan Dược
export async function executeBandan(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (args.length < 3) {
    return message.reply({
      content: `❌ Cú pháp đúng: \`!bandan <tên_đan_hoặc_stt> <số_lượng> <tổng_giá_linh_thạch>\`\nVí dụ: \`!bandan hoi_xuan_dan 2 300\` hoặc \`!bandan 1 1 150\``
    });
  }

  const danQuery = args[0].toLowerCase();
  const quantity = parseInt(args[1], 10);
  const price = parseInt(args[2], 10);

  if (isNaN(quantity) || quantity <= 0) {
    return message.reply({ content: `❌ Số lượng đan dược phải lớn hơn 0!` });
  }

  if (isNaN(price) || price <= 0) {
    return message.reply({ content: `❌ Giá bán phải là một số nguyên dương!` });
  }

  const danList = (user.inventory || []).filter(i => i.type === 'DAN_DUOC' && i.quantity > 0);
  let pillItem = null;
  let pillIdx = -1;

  const num = parseInt(danQuery, 10);
  if (!isNaN(num) && num > 0 && num <= danList.length) {
    pillItem = danList[num - 1];
    pillIdx = user.inventory.indexOf(pillItem);
  } else {
    pillIdx = user.inventory.findIndex(i => i.type === 'DAN_DUOC' && i.quantity > 0 && (i.itemId.toLowerCase() === danQuery || i.name.toLowerCase().includes(danQuery)));
    if (pillIdx !== -1) pillItem = user.inventory[pillIdx];
  }

  if (!pillItem || pillIdx === -1) {
    return message.reply({ content: `❌ Không tìm thấy đan dược hợp lệ trong túi đồ! Dùng \`!uongdan\` để xem kho đan dược.` });
  }

  if (pillItem.quantity < quantity) {
    return message.reply({ content: `❌ Bạn chỉ có **${pillItem.quantity} viên** [${pillItem.name}], không đủ để bán ${quantity} viên!` });
  }

  // Trừ số lượng khỏi inventory
  pillItem.quantity -= quantity;
  if (pillItem.quantity <= 0) {
    user.inventory.splice(pillIdx, 1);
  }
  await user.save();

  const newMarketItem = new MarketItem({
    sellerId: user.userId,
    sellerName: user.daoName || user.username,
    itemName: pillItem.name,
    itemType: 'DAN_DUOC',
    skillId: pillItem.itemId,
    quantity: quantity,
    price: price,
    desc: pillItem.desc || 'Đan dược thượng phẩm'
  });

  await newMarketItem.save();

  const embed = new EmbedBuilder()
    .setTitle(`🏪 [ĐĂNG BÁN ĐAN DƯỢC THÀNH CÔNG]`)
    .setColor('#9C27B0')
    .setDescription(
      `Đạo hữu đã niêm yết **x${quantity} [${pillItem.name}]** lên Chợ Trời!\n\n` +
      `💎 Tổng giá bán: **${price.toLocaleString()} Linh Thạch**\n` +
      `🏷️ Mã mặt hàng: \`${newMarketItem._id.toString().slice(-6)}\``
    );

  await message.reply({ embeds: [embed] });
}

// Mua hàng trên Chợ Trời
export async function executeMua(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (args.length < 1) {
    return message.reply({ content: `❌ Cú pháp đúng: \`!mua <mã_mặt_hàng>\` (Ví dụ: \`!mua abc123\`)` });
  }

  const shortId = args[0].trim();
  const items = await MarketItem.find({ active: true });
  const item = items.find(i => i._id.toString().endsWith(shortId));

  if (!item) {
    return message.reply({ content: `❌ Không tìm thấy mặt hàng với mã **${shortId}** trên Chợ Trời!` });
  }

  if (item.sellerId === user.userId) {
    return message.reply({ content: `❌ Đạo hữu không thể tự mua mặt hàng của chính mình!` });
  }

  if (user.currencies.linhThach < item.price) {
    return message.reply({
      content: `❌ Không đủ Linh Thạch! Cần **${item.price.toLocaleString()}** Linh Thạch (Hiện có: **${user.currencies.linhThach.toLocaleString()}**).`
    });
  }

  // Khóa và đóng item bằng Atomic Update chống Race Condition
  const lockedItem = await MarketItem.findOneAndUpdate(
    { _id: item._id, active: true },
    { $set: { active: false } }
  );

  if (!lockedItem) {
    return message.reply({ content: `❌ Mặt hàng này vừa được một tu sĩ khác nhanh tay mua mất!` });
  }

  // Trừ tiền người mua
  user.currencies.linhThach -= item.price;

  let deliveryNotice = '';

  if (item.itemType === 'DAN_DUOC') {
    // Nhận đan dược vào túi đồ
    const existing = user.inventory.find(i => i.itemId === item.skillId);
    if (existing) {
      existing.quantity += (item.quantity || 1);
    } else {
      user.inventory.push({
        itemId: item.skillId || 'hoi_xuan_dan',
        name: item.itemName,
        type: 'DAN_DUOC',
        quantity: item.quantity || 1,
        desc: item.desc || 'Đan dược mua từ Chợ Trời'
      });
    }
    deliveryNotice = `💊 **x${item.quantity || 1} [${item.itemName}]** đã được chuyển vào **Túi Trữ Vật** (Dùng \`!uongdan\` để sử dụng)!`;
  } else {
    // Nhận công pháp vào Tàng Kinh Các
    user.skills.push({
      skillId: item.skillId || 'co_ban_dan_khi_quyet',
      name: item.itemName,
      category: 'tam_phap',
      rarity: 'HOANG_GIAI',
      mastery: 10,
      equipped: false
    });
    deliveryNotice = `📜 Bí kíp **[${item.itemName}]** đã được cất vào **Tàng Kinh Các** (\`!tangkinhcac\`).`;
  }

  await user.save();

  // Cộng tiền cho người bán
  const seller = await User.findOne({ userId: item.sellerId });
  if (seller) {
    seller.currencies.linhThach += item.price;
    await seller.save();
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎉 [GIAO DỊCH THÀNH CÔNG]`)
    .setColor('#4CAF50')
    .setDescription(
      `Đạo hữu đã mua thành công **[${item.itemName}]** với giá **${item.price.toLocaleString()} Linh Thạch**!\n\n` +
      `${deliveryNotice}`
    );

  await message.reply({ embeds: [embed] });
}
