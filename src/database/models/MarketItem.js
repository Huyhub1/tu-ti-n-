import mongoose from 'mongoose';

const MarketItemSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  itemName: { type: String, required: true },
  itemType: { type: String, default: 'BI_KIP' }, // BI_KIP, DAN_DUOC, PHAP_BAO, KHOANG_THACH
  skillId: { type: String, default: null },
  price: { type: Number, required: true }, // Giá Linh Thạch
  quantity: { type: Number, default: 1 },
  desc: { type: String, default: '' },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

export const MarketItem = mongoose.model('MarketItem', MarketItemSchema);
