import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';

import { MarketItem } from '../../database/models/MarketItem.js';
import { getFactionBuffs } from '../../services/factionService.js';

// Thuế chợ 5%: người bán nhận 95% giá niêm yết. Đây là "lỗ hổng thoát Linh Thạch"
// duy nhất của nền kinh tế, không có nó thì LT chỉ tăng chứ không bao giờ giảm.
export const MARKET_TAX_RATE = 0.05;

export const MARKET_MIN_PRICE = 10;
export const MARKET_MAX_PRICE = 10_000_000;
export const MARKET_MAX_LISTINGS = 10; // Số gian hàng tối đa mỗi tu sĩ


/** Số Linh Thạch người bán thực nhận sau thuế chợ (Tán Tu miễn thuế). */
function netPayout(seller, price) {
  const exempt = getFactionBuffs(seller?.faction).marketTaxExempt >= 1;
  return exempt ? price : price - Math.floor(price * MARKET_TAX_RATE);
}

function parsePrice(raw) {
  const n = parseInt(String(raw).replace(/[.,_]/g, ''), 10);
  return isNaN(n) ? NaN : n;
}

function validatePrice(price) {
  if (isNaN(price) || price <= 0) return `❌ Giá bán phải là một số nguyên dương!`;
  if (price < MARKET_MIN_PRICE) return `❌ Giá bán tối thiểu là **${MARKET_MIN_PRICE.toLocaleString()} Linh Thạch**.`;
  if (price > MARKET_MAX_PRICE) return `❌ Giá bán tối đa là **${MARKET_MAX_PRICE.toLocaleString()} Linh Thạch**.`;
  return null;
}

async function checkListingSlot(userId) {
  const count = await MarketItem.countDocuments({ sellerId: userId, active: true });
  if (count >= MARKET_MAX_LISTINGS) {
    return `❌ Đạo hữu đã có **${count}/${MARKET_MAX_LISTINGS}** gian hàng đang mở! Hãy dùng \`!huyban <mã>\` để thu hồi bớt trước khi đăng thêm.`;
  }
  return null;
}

export async function executeChotroi(message, args = []) {
  const page = Math.max(1, parseInt(args[0], 10) || 1);
  const PER_PAGE = 10;

  const total = await MarketItem.countDocuments({ active: true });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const items = await MarketItem.find({ active: true })
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * PER_PAGE)
    .limit(PER_PAGE)
    .lean();

  const embed = new EmbedBuilder()
    .setTitle(`🏪 [CHỢ TRỜI TU CHÂN GIỚI]`)
    .setColor('#00BCD4')
    .setDescription(
      `Nơi giao thương tự do Công Pháp & Đan Dược giữa các tu sĩ khắp thiên hạ:\n` +
      `• Đăng bán Công Pháp: \`!ban <stt_kỹ_năng> <giá_LT>\`\n` +
      `• Đăng bán Đan Dược: \`!bandan <tên_hoặc_stt> <số_lượng> <giá_LT>\`\n` +
      `• Mua hàng: \`!mua <mã_số>\` · Thu hồi: \`!huyban <mã_số>\`\n` +
      `• Xem trang khác: \`!chotroi <số_trang>\`\n\n` +
      `🏦 *Thuế chợ **${Math.round(MARKET_TAX_RATE * 100)}%** trừ vào tiền người bán nhận được.*\n`
    )
    .setFooter({ text: `Trang ${safePage}/${totalPages} · Tổng ${total} mặt hàng` });

  if (items.length === 0) {
    embed.setDescription(`*Hiện tại chợ trời chưa có mặt hàng nào. Hãy là người đầu tiên đăng bán bằng lệnh \`!ban\` hoặc \`!bandan\`!*`);
  } else {
    items.forEach((item) => {
      const typeBadge = item.itemType === 'DAN_DUOC' ? `💊 [ĐAN DƯỢC x${item.quantity || 1}]` : `📜 [CÔNG PHÁP]`;
      const code = item.shortId || item._id.toString().slice(-6);
      embed.addFields({
        name: `🏷️ [MÃ: ${code}] - ${typeBadge} **${item.itemName}**`,
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
  const price = parsePrice(args[1]);

  if (isNaN(skillIdx) || skillIdx < 0 || skillIdx >= user.skills.length) {
    return message.reply({ content: `❌ Số thứ tự công pháp không hợp lệ! Hãy gõ \`!tangkinhcac\` để xem danh sách.` });
  }

  const priceError = validatePrice(price);
  if (priceError) return message.reply({ content: priceError });

  const slotError = await checkListingSlot(user.userId);
  if (slotError) return message.reply({ content: slotError });

  const skillToSell = user.skills[skillIdx];

  // Tạo gian hàng TRƯỚC, xóa công pháp SAU. Nếu MarketItem lỗi thì người chơi
  // vẫn còn bí kíp trong tay (bản cũ xóa trước nên lỗi = mất trắng).
  const newMarketItem = new MarketItem({
    sellerId: user.userId,
    sellerName: user.daoName || user.username,
    itemName: skillToSell.name,
    itemType: 'BI_KIP',
    skillId: skillToSell.skillId,
    category: skillToSell.category || 'tam_phap',
    rarity: skillToSell.rarity || 'HOANG_GIAI',
    mastery: skillToSell.mastery ?? 10,
    price: price,
    desc: `Bí kíp phẩm cấp ${skillToSell.rarity}`
  });

  try {
    await newMarketItem.save();
  } catch (err) {
    console.error('[market:ban] Không tạo được gian hàng:', err);
    return message.reply({ content: `❌ Chợ Trời đang trục trặc, chưa niêm yết được. Bí kíp vẫn còn nguyên trong Tàng Kinh Các.` });
  }

  try {
    user.skills.splice(skillIdx, 1);
    await user.save();
  } catch (err) {
    // Hoàn tác gian hàng để không nhân bản vật phẩm
    console.error('[market:ban] Lỗi xóa bí kíp, hoàn tác gian hàng:', err);
    await MarketItem.deleteOne({ _id: newMarketItem._id }).catch(() => {});
    return message.reply({ content: `❌ Giao dịch thất bại, đã hoàn tác. Vui lòng thử lại.` });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏪 [ĐĂNG BÁN THÀNH CÔNG]`)
    .setColor('#4CAF50')
    .setDescription(
      `Đạo hữu đã niêm yết bí kíp **[${skillToSell.name}]** lên Chợ Trời!\n\n` +
      `💎 Giá niêm yết: **${price.toLocaleString()} Linh Thạch**\n` +

      `🏦 Thực nhận khi bán được: **${netPayout(user, price).toLocaleString()} Linh Thạch**\n` +
      `🏷️ Mã mặt hàng: \`${newMarketItem.shortId}\``
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
  const price = parsePrice(args[2]);

  if (isNaN(quantity) || quantity <= 0 || quantity > 999) {
    return message.reply({ content: `❌ Số lượng đan dược phải trong khoảng 1 – 999!` });
  }

  const priceError = validatePrice(price);
  if (priceError) return message.reply({ content: priceError });

  const slotError = await checkListingSlot(user.userId);
  if (slotError) return message.reply({ content: slotError });

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

  const snapshot = { itemId: pillItem.itemId, name: pillItem.name, desc: pillItem.desc };

  const newMarketItem = new MarketItem({
    sellerId: user.userId,
    sellerName: user.daoName || user.username,
    itemName: snapshot.name,
    itemType: 'DAN_DUOC',
    skillId: snapshot.itemId,
    quantity: quantity,
    price: price,
    desc: snapshot.desc || 'Đan dược thượng phẩm'
  });

  try {
    await newMarketItem.save();
  } catch (err) {
    console.error('[market:bandan] Không tạo được gian hàng:', err);
    return message.reply({ content: `❌ Chợ Trời đang trục trặc, chưa niêm yết được. Đan dược vẫn còn trong túi.` });
  }

  try {
    pillItem.quantity -= quantity;
    if (pillItem.quantity <= 0) user.inventory.splice(pillIdx, 1);
    await user.save();
  } catch (err) {
    console.error('[market:bandan] Lỗi trừ đan dược, hoàn tác gian hàng:', err);
    await MarketItem.deleteOne({ _id: newMarketItem._id }).catch(() => {});
    return message.reply({ content: `❌ Giao dịch thất bại, đã hoàn tác. Vui lòng thử lại.` });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏪 [ĐĂNG BÁN ĐAN DƯỢC THÀNH CÔNG]`)
    .setColor('#9C27B0')
    .setDescription(
      `Đạo hữu đã niêm yết **x${quantity} [${snapshot.name}]** lên Chợ Trời!\n\n` +
      `💎 Tổng giá bán: **${price.toLocaleString()} Linh Thạch**\n` +

      `🏦 Thực nhận khi bán được: **${netPayout(user, price).toLocaleString()} Linh Thạch**\n` +
      `🏷️ Mã mặt hàng: \`${newMarketItem.shortId}\``
    );

  await message.reply({ embeds: [embed] });
}

/** Tìm gian hàng theo mã ngắn — ưu tiên index, chỉ quét toàn bộ khi là hàng cũ chưa có shortId. */
async function findListing(shortId) {
  const direct = await MarketItem.findOne({ shortId, active: true });
  if (direct) return direct;

  // Tương thích ngược với dữ liệu tạo trước khi có trường shortId
  const legacy = await MarketItem.find({ active: true, shortId: { $in: [null, ''] } }).lean();
  const hit = legacy.find(i => i._id.toString().endsWith(shortId));
  return hit ? MarketItem.findById(hit._id) : null;
}

// Trả hàng về cho người bán, dùng khi hủy bán hoặc khi cần hoàn tác
async function returnItemToOwner(ownerId, item) {
  const owner = await User.findOne({ userId: ownerId });
  if (!owner) return false;

  if (item.itemType === 'DAN_DUOC') {
    const existing = owner.inventory.find(i => i.itemId === item.skillId);
    if (existing) existing.quantity += (item.quantity || 1);
    else owner.inventory.push({
      itemId: item.skillId || 'hoi_xuan_dan',
      name: item.itemName,
      type: 'DAN_DUOC',
      quantity: item.quantity || 1,
      desc: item.desc || 'Đan dược thu hồi từ Chợ Trời'
    });
  } else if (!owner.skills.some(s => s.skillId === item.skillId)) {
    owner.skills.push({
      skillId: item.skillId || 'co_ban_dan_khi_quyet',
      name: item.itemName,
      category: item.category || 'tam_phap',
      rarity: item.rarity || 'HOANG_GIAI',
      mastery: item.mastery ?? 10,
      equipped: false
    });
  }

  await owner.save();
  return true;
}

// Thu hồi gian hàng
export async function executeHuyban(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (args.length < 1) {
    return message.reply({ content: `❌ Cú pháp đúng: \`!huyban <mã_mặt_hàng>\`` });
  }

  const item = await findListing(args[0].trim());
  if (!item) return message.reply({ content: `❌ Không tìm thấy gian hàng với mã **${args[0].trim()}**!` });

  if (item.sellerId !== user.userId) {
    return message.reply({ content: `❌ Đây không phải gian hàng của đạo hữu!` });
  }

  const closed = await MarketItem.findOneAndUpdate({ _id: item._id, active: true }, { $set: { active: false } });
  if (!closed) return message.reply({ content: `❌ Gian hàng này vừa được giao dịch xong rồi!` });

  const ok = await returnItemToOwner(user.userId, item);
  if (!ok) {
    await MarketItem.updateOne({ _id: item._id }, { $set: { active: true } }).catch(() => {});
    return message.reply({ content: `❌ Không thu hồi được, gian hàng vẫn mở.` });
  }

  return message.reply({
    content: `📦 Đã thu hồi **[${item.itemName}]** khỏi Chợ Trời về kho của đạo hữu.`
  });
}

// Mua hàng trên Chợ Trời
export async function executeMua(message, args) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  if (args.length < 1) {
    return message.reply({ content: `❌ Cú pháp đúng: \`!mua <mã_mặt_hàng>\` (Ví dụ: \`!mua abc123\`)` });
  }

  const shortId = args[0].trim();
  const item = await findListing(shortId);

  if (!item) {
    return message.reply({ content: `❌ Không tìm thấy mặt hàng với mã **${shortId}** trên Chợ Trời!` });
  }

  if (item.sellerId === user.userId) {
    return message.reply({ content: `❌ Đạo hữu không thể tự mua mặt hàng của chính mình!` });
  }

  if ((user.currencies.linhThach || 0) < item.price) {
    return message.reply({
      content: `❌ Không đủ Linh Thạch! Cần **${item.price.toLocaleString()}** Linh Thạch (Hiện có: **${(user.currencies.linhThach || 0).toLocaleString()}**).`
    });
  }

  // 1) Trừ tiền người mua bằng Atomic Update (chặn chi âm khi spam nhiều lệnh)
  const paid = await User.findOneAndUpdate(
    { userId: user.userId, 'currencies.linhThach': { $gte: item.price } },
    { $inc: { 'currencies.linhThach': -item.price } },
    { new: true }
  );

  if (!paid) {
    return message.reply({ content: `❌ Không đủ Linh Thạch (số dư vừa thay đổi). Vui lòng thử lại!` });
  }

  // 2) Khóa gian hàng bằng Atomic Update chống Race Condition
  const lockedItem = await MarketItem.findOneAndUpdate(
    { _id: item._id, active: true },
    { $set: { active: false } }
  );

  if (!lockedItem) {
    // Người khác nhanh tay hơn -> hoàn tiền ngay
    await User.updateOne({ userId: user.userId }, { $inc: { 'currencies.linhThach': item.price } }).catch(() => {});
    return message.reply({ content: `❌ Mặt hàng này vừa được một tu sĩ khác nhanh tay mua mất! Linh Thạch đã được hoàn lại.` });
  }

  // 3) Giao hàng
  let deliveryNotice = '';
  try {
    const buyer = await User.findOne({ userId: user.userId });

    if (item.itemType === 'DAN_DUOC') {
      const existing = buyer.inventory.find(i => i.itemId === item.skillId);
      if (existing) {
        existing.quantity += (item.quantity || 1);
      } else {
        buyer.inventory.push({
          itemId: item.skillId || 'hoi_xuan_dan',
          name: item.itemName,
          type: 'DAN_DUOC',
          quantity: item.quantity || 1,
          desc: item.desc || 'Đan dược mua từ Chợ Trời'
        });
      }
      deliveryNotice = `💊 **x${item.quantity || 1} [${item.itemName}]** đã được chuyển vào **Túi Trữ Vật** (Dùng \`!uongdan\` để sử dụng)!`;
    } else {
      // Giữ nguyên phẩm cấp / hệ / độ thuần thục gốc của bí kíp
      if (buyer.skills.some(s => s.skillId === item.skillId)) {
        throw new Error('DUPLICATE_SKILL');
      }
      buyer.skills.push({
        skillId: item.skillId || 'co_ban_dan_khi_quyet',
        name: item.itemName,
        category: item.category || 'tam_phap',
        rarity: item.rarity || 'HOANG_GIAI',
        mastery: item.mastery ?? 10,
        equipped: false
      });
      deliveryNotice = `📜 Bí kíp **[${item.itemName}]** (\`${item.rarity || 'HOANG_GIAI'}\`) đã được cất vào **Tàng Kinh Các** (\`!tangkinhcac\`).`;
    }

    await buyer.save();
  } catch (err) {
    // Giao hàng hỏng -> hoàn tiền và mở lại gian hàng, tuyệt đối không nuốt tiền
    await User.updateOne({ userId: user.userId }, { $inc: { 'currencies.linhThach': item.price } }).catch(() => {});
    await MarketItem.updateOne({ _id: item._id }, { $set: { active: true } }).catch(() => {});

    if (err.message === 'DUPLICATE_SKILL') {
      return message.reply({ content: `❌ Đạo hữu đã sở hữu bí kíp **[${item.itemName}]** rồi! Giao dịch đã hủy, Linh Thạch được hoàn lại.` });
    }
    console.error('[market:mua] Lỗi giao hàng, đã hoàn tác:', err);
    return message.reply({ content: `❌ Giao dịch gặp sự cố, Linh Thạch đã được hoàn lại. Vui lòng thử lại.` });
  }


  // 4) Trả tiền người bán (trừ thuế chợ; Tán Tu được miễn thuế)
  const seller = await User.findOne({ userId: item.sellerId }).select('faction').lean();
  const taxExempt = getFactionBuffs(seller?.faction).marketTaxExempt >= 1;
  const tax = taxExempt ? 0 : Math.floor(item.price * MARKET_TAX_RATE);
  const payout = item.price - tax;
  await User.updateOne({ userId: item.sellerId }, { $inc: { 'currencies.linhThach': payout } }).catch((err) => {
    console.error('[market:mua] Không cộng được tiền cho người bán:', err);
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎉 [GIAO DỊCH THÀNH CÔNG]`)
    .setColor('#4CAF50')
    .setDescription(
      `Đạo hữu đã mua thành công **[${item.itemName}]** với giá **${item.price.toLocaleString()} Linh Thạch**!\n\n` +

      `${deliveryNotice}\n` +
      (taxExempt
        ? `🏦 *Người bán là Tán Tu nên được **miễn thuế chợ**, nhận trọn **${payout.toLocaleString()} LT**.*`
        : `🏦 *Người bán nhận **${payout.toLocaleString()} LT** (thuế chợ ${Math.round(MARKET_TAX_RATE * 100)}%: ${tax.toLocaleString()} LT).*`)
    );

  await message.reply({ embeds: [embed] });
}
