import mongoose from 'mongoose';

const MarketItemSchema = new mongoose.Schema({
  sellerId: { type: String, required: true, index: true },
  sellerName: { type: String, required: true },
  itemName: { type: String, required: true },
  itemType: { type: String, default: 'BI_KIP' }, // BI_KIP, DAN_DUOC, PHAP_BAO, KHOANG_THACH
  skillId: { type: String, default: null },

  // Giữ nguyên phẩm cấp gốc của món hàng. Trước đây lúc mua bí kíp bot
  // hardcode category='tam_phap' / rarity='HOANG_GIAI' nên bán một Thiên Giai
  // rồi mua lại sẽ bị tụt xuống Hoàng Giai.
  category: { type: String, default: 'tam_phap' },
  rarity: { type: String, default: 'HOANG_GIAI' },
  mastery: { type: Number, default: 10 },

  price: { type: Number, required: true }, // Giá Linh Thạch
  quantity: { type: Number, default: 1 },
  desc: { type: String, default: '' },

  // Mã ngắn hiển thị cho người chơi -> tra cứu O(1) thay vì quét toàn bộ chợ
  shortId: { type: String, index: true },

  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

MarketItemSchema.pre('validate', function (next) {
  if (!this.shortId) this.shortId = this._id.toString().slice(-6);
  next();
});

export const MarketItem = mongoose.model('MarketItem', MarketItemSchema);
