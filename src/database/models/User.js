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
  // Tổng chỉ số VĨNH VIỄN đã nhận từ đan dược. Trước đây đan cộng thẳng vào
  // stats không giới hạn: 450 LT đổi lấy +25 ATK / +500 Max HP lặp vô hạn là
  // máy in lực chiến, phá nát toàn bộ đường cong cảnh giới.
  // Buff đột phá một lần từ Trúc Cơ Đan: uống xong thì giữ ở đây cho tới lần
  // `!dotpha` kế tiếp, thành hay bại đều tiêu.
  breakthroughBuff: { type: Number, default: 0 },

  pillBonus: {
    atk: { type: Number, default: 0 },
    def: { type: Number, default: 0 },
    maxHp: { type: Number, default: 0 }
  },

  dailyCheckIn: {
    lastDate: { type: String, default: null },
    streak: { type: Number, default: 0 }
  },

  // ── CHUỖI NHIỆM VỤ TÂN THỦ ──
  // step = số bước ĐÃ nhận thưởng, cũng chính là chỉ số của bước đang làm dở.
  // Nhận thưởng luôn kèm điều kiện 'tutorial.step' bằng đúng giá trị cũ, nên
  // hai cú bấm cùng lúc chỉ một cú ăn được — đây là toàn bộ lớp chống nhân đôi.
  tutorial: {
    step: { type: Number, default: 0 },
    done: { type: Boolean, default: false }
  },

  // Số lần đã làm từng loại hành động, dùng làm điều kiện cho nhiệm vụ tân thủ.
  // Đếm riêng thay vì suy từ tài sản hiện có: người chơi tiêu hết Linh Thạch
  // thì vẫn phải được ghi nhận là đã làm công đủ số lần.
  counters: {
    cultivate: { type: Number, default: 0 },
    work: { type: Number, default: 0 },
    mining: { type: Number, default: 0 },
    hunt: { type: Number, default: 0 },
    pill: { type: Number, default: 0 }
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
