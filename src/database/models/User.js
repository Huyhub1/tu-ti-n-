import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  daoName: { type: String, default: 'Vô Danh Tu Sĩ' },
  
  // Tư chất bẩm sinh
  talent: {
    tier: { type: String, default: 'PHAM_PHAM' },
    tierName: { type: String, default: 'Phàm Phẩm' },
    name: { type: String, default: 'Ngũ Hành Tạp Linh Căn' },
    desc: { type: String, default: 'Linh căn hỗn tạp năm màu, hấp thu thiên địa linh khí bình thường.' },
    expMultiplier: { type: Number, default: 1.0 },
    specialSkill: { type: String, default: null }
  },
  rerollsLeft: { type: Number, default: 0 },

  // Trận doanh & Đạo tâm
  faction: { type: String, enum: ['CHINH_DAO', 'MA_DAO', 'TAN_TU'], default: 'TAN_TU' },
  karma: { type: Number, default: 0 },
  maskActive: { type: Boolean, default: false },

  // Cảnh giới & Tu vi
  realm: {
    id: { type: String, default: 'pham_nhan' },
    name: { type: String, default: 'Phàm Nhân' },
    layer: { type: Number, default: 1 },
    exp: { type: Number, default: 0 },
    maxExp: { type: Number, default: 150 }
  },
  isLuyenKhiVanTang: { type: Boolean, default: false },

  // Phẩm Chất Kim Đan khi Kết Đan (Trúc Cơ -> Kim Đan)
  goldenCore: {
    grade: { type: String, default: null },
    name: { type: String, default: null },
    expBonus: { type: Number, default: 0 },
    desc: { type: String, default: null }
  },

  // Tiền tệ
  currencies: {
    linhThach: { type: Number, default: 100 },
    nguyenThach: { type: Number, default: 0 },
    congDuc: { type: Number, default: 0 },
    taTam: { type: Number, default: 0 },
    thienMenh: { type: Number, default: 0 }
  },

  // Chỉ số chiến đấu
  stats: {
    hp: { type: Number, default: 100 },
    maxHp: { type: Number, default: 100 },
    mp: { type: Number, default: 100 },
    maxMp: { type: Number, default: 100 },
    atk: { type: Number, default: 15 },
    def: { type: Number, default: 8 },
    critRate: { type: Number, default: 0.05 },
    dodgeRate: { type: Number, default: 0.05 },
    luck: { type: Number, default: 10 }
  },

  // Công pháp đã học
  skills: [{
    skillId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    rarity: { type: String, default: 'HOANG_GIAI' },
    mastery: { type: Number, default: 10 },
    equipped: { type: Boolean, default: false }
  }],

  // Kho Pháp Bảo & Binh Khí Sở Hữu
  equipments: [{
    gearId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: 'VU_KHI' },
    slot: { type: String, default: 'weapon' },
    rarity: { type: String, default: 'HOANG_GIAI' },
    rarityName: { type: String, default: 'Hoàng Giai' },
    enhanceLevel: { type: Number, default: 0 },
    stats: {
      atk: { type: Number, default: 0 },
      def: { type: Number, default: 0 },
      maxHp: { type: Number, default: 0 },
      critRate: { type: Number, default: 0 }
    },
    combatSkill: {
      name: { type: String, default: '' },
      damageMultiplier: { type: Number, default: 1.5 },
      lifesteal: { type: Number, default: 0 },
      heal: { type: Number, default: 0 },
      desc: { type: String, default: '' }
    },
    imageUrl: { type: String, default: '' },
    equipped: { type: Boolean, default: false }
  }],

  // Túi đồ (Yêu đan, Đan dược...)
  inventory: [{
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: 'DAN_DUOC' },
    quantity: { type: Number, default: 1 },
    desc: { type: String, default: '' }
  }],

  // Tông môn
  sectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sect', default: null },
  sectRole: { type: String, enum: ['MEMBER', 'ELDER', 'LEADER', 'NONE'], default: 'NONE' },

  // Điểm danh & Bói quẻ hàng ngày
  dailyCheckIn: {
    lastDate: { type: String, default: null },
    streak: { type: Number, default: 0 }
  },

  // Thời gian chờ (Cooldowns)
  cooldowns: {
    cultivate: { type: Date, default: null },
    work: { type: Date, default: null },
    skillTrain: { type: Date, default: null },
    pvp: { type: Date, default: null },
    mining: { type: Date, default: null },
    dothach: { type: Date, default: null },
    hunting: { type: Date, default: null },
    dungeon: { type: Date, default: null },
    crafting: { type: Date, default: null },
    sectTask: { type: Date, default: null }
  }
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
