import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const equipmentPath = path.join(__dirname, '../src/config/equipment.json');
const rawData = JSON.parse(fs.readFileSync(equipmentPath, 'utf8'));

// Cấu hình thang chỉ số vượt trội theo phẩm cấp
const RARITY_PROFILES = {
  THAN_GIAI: {
    rarityName: 'Thần Giai Thái Cổ',
    color: '#FFD700',
    atkRange: [750, 950],
    defRange: [380, 520],
    hpRange: [10000, 18000],
    critRange: [0.40, 0.50],
    dmgMultRange: [5.5, 7.5],
    expBonus: 1.50
  },
  THIEN_GIAI: {
    rarityName: 'Thiên Giai Tuyệt Phẩm',
    color: '#E91E63',
    atkRange: [320, 450],
    defRange: [160, 240],
    hpRange: [3500, 6000],
    critRange: [0.25, 0.35],
    dmgMultRange: [4.0, 5.0],
    expBonus: 0.70
  },
  DIA_GIAI: {
    rarityName: 'Địa Giai Cực Phẩm',
    color: '#9C27B0',
    atkRange: [130, 190],
    defRange: [65, 100],
    hpRange: [1400, 2400],
    critRange: [0.14, 0.20],
    dmgMultRange: [2.8, 3.5],
    expBonus: 0.35
  },
  HUYEN_GIAI: {
    rarityName: 'Huyền Giai Thượng Phẩm',
    color: '#2196F3',
    atkRange: [50, 80],
    defRange: [25, 45],
    hpRange: [450, 800],
    critRange: [0.07, 0.12],
    dmgMultRange: [2.0, 2.5],
    expBonus: 0.15
  },
  HOANG_GIAI: {
    rarityName: 'Hoàng Giai Phổ Thông',
    color: '#8D6E63',
    atkRange: [15, 25],
    defRange: [8, 15],
    hpRange: [120, 220],
    critRange: [0.03, 0.05],
    dmgMultRange: [1.4, 1.6],
    expBonus: 0.05
  }
};

// Cấu hình chi tiết cho 5 Thần Khí Thái Cổ Đỉnh Cao
const SPECIAL_THAN_GIAI = {
  chuong_hon_don: {
    stats: { atk: 880, def: 520, maxHp: 16000, critRate: 0.45 },
    passives: {
      expBonus: 1.50,
      damageReduction: 0.35,
      regenHpPerTurn: 0.15,
      desc: "🔔 [HỖN ĐỘN THÁI CỔ CHUNG]: +150% EXP Tu Vi vĩnh viễn, Miễn 35% toàn bộ sát thương nhận vào, Tự động hồi phục 15% HP tối đa sau mỗi hiệp đấu."
    },
    combatSkill: {
      name: "Định Càn Khôn Nhật Nguyệt",
      damageMultiplier: 6.5,
      shield: 3500,
      desc: "Tiếng chuông ngân vang trấn áp nhật nguyệt: Gây 650% sát thương cực đại, Tạo Giáp Càn Khôn +3,500 HP và Trấn áp giảm 50% ATK kẻ địch!"
    }
  },
  lien_hoa_sang_the: {
    stats: { atk: 780, def: 480, maxHp: 18000, critRate: 0.40 },
    passives: {
      expBonus: 1.50,
      regenHpPerTurn: 0.20,
      resurrect: 1,
      desc: "🌸 [SÁNG THẾ THANH LIÊN]: +150% EXP Tu Vi vĩnh viễn, Hồi 20% HP sau mỗi hiệp, Ban phúc Bất Tử chuyển nguy thành an khi gặp đại nạn."
    },
    combatSkill: {
      name: "Vạn Hóa Sáng Thế Thanh Liên",
      damageMultiplier: 6.0,
      heal: 3000,
      desc: "Thanh liên nở rộ khai thiên lập địa: Gây 600% sát thương cực hạn, Hồi phục +3,000 HP lập tức và Hóa giải mọi thương thế!"
    }
  },
  dinh_than_nong: {
    stats: { atk: 750, def: 450, maxHp: 15000, critRate: 0.42 },
    passives: {
      expBonus: 1.50,
      alchemyMastery: 3.0,
      luckBonus: 50,
      desc: "🌿 [THẦN NÔNG BÁCH THẢO TIÊN KHÍ]: +150% EXP Tu Vi vĩnh viễn, Tăng x3 lần hiệu quả đan dược, Tăng +50% Khí Vận may mắn nhặt bảo vật quý."
    },
    combatSkill: {
      name: "Càn Khôn Thần Nông Đỉnh Chấn",
      damageMultiplier: 5.8,
      lifesteal: 0.50,
      desc: "Luyện hóa càn khôn vạn dặm: Gây 580% sát thương, Hút 50% Máu (Lifesteal) và Gia tăng vĩnh viễn +500 HP tối đa trong trận!"
    }
  },
  cung_ban_mat_troi: {
    stats: { atk: 950, def: 380, maxHp: 12000, critRate: 0.50 },
    passives: {
      expBonus: 1.50,
      armorPen: 0.50,
      tripleCritChance: 0.40,
      desc: "☀️ [XẠ NHẬT THẦN UY]: +150% EXP Tu Vi vĩnh viễn, Bỏ qua 50% Phòng ngự của kẻ địch, Đòn đánh có 40% cơ hội kích hoạt Tam Trọng Bạo Kích (x3 Sát thương)!"
    },
    combatSkill: {
      name: "Cửu Dương Lạc Nhật Trảm Thần",
      damageMultiplier: 7.5,
      armorPen: 0.70,
      desc: "Mũi tên bắn rụng chín mặt trời: Gây 750% sát thương diệt tuyệt, Bỏ qua 70% Giáp đối thủ và Nhất Kích Tất Sát!"
    }
  },
  gay_nhu_y_kim_co: {
    stats: { atk: 920, def: 420, maxHp: 14000, critRate: 0.48 },
    passives: {
      expBonus: 1.50,
      stunChance: 0.35,
      powerMultiplier: 1.50,
      desc: "🐒 [ĐỊNH HẢI THẦN CHÂM BẤT DIỆT]: +150% EXP Tu Vi vĩnh viễn, Tăng +50% Uy Lực Chiến Lực, Đòn đánh có 35% cơ hội làm choáng và Bạo Kích x3!"
    },
    combatSkill: {
      name: "Thiên Địa Nhất Bổng Phá Càn Khôn",
      damageMultiplier: 7.0,
      desc: "Thiết bổng một kích đập vỡ thiên địa: Gây 700% sát thương bạo liệt, Làm choáng đối phương 1 hiệp và Giảm 50% DEF của kẻ địch!"
    }
  }
};

rawData.equipments.forEach(e => {
  const profile = RARITY_PROFILES[e.rarity] || RARITY_PROFILES.HOANG_GIAI;
  e.rarityName = profile.rarityName;
  e.color = profile.color;

  if (e.rarity === 'THAN_GIAI' && SPECIAL_THAN_GIAI[e.id]) {
    const special = SPECIAL_THAN_GIAI[e.id];
    e.stats = { ...special.stats };
    e.passives = { ...special.passives };
    e.combatSkill = { ...e.combatSkill, ...special.combatSkill };
    return;
  }

  // Phân bổ ngẫu nhiên có trật tự trong khoảng của tier
  const atk = Math.floor(profile.atkRange[0] + Math.random() * (profile.atkRange[1] - profile.atkRange[0]));
  const def = Math.floor(profile.defRange[0] + Math.random() * (profile.defRange[1] - profile.defRange[0]));
  const hp = Math.floor((profile.hpRange[0] + Math.random() * (profile.hpRange[1] - profile.hpRange[0])) / 50) * 50;
  const crit = parseFloat((profile.critRange[0] + Math.random() * (profile.critRange[1] - profile.critRange[0])).toFixed(2));
  const dmgMult = parseFloat((profile.dmgMultRange[0] + Math.random() * (profile.dmgMultRange[1] - profile.dmgMultRange[0])).toFixed(1));

  e.stats = { atk, def, maxHp: hp, critRate: crit };

  if (e.rarity === 'THIEN_GIAI') {
    e.passives = {
      expBonus: profile.expBonus,
      armorPen: 0.25,
      regenHpPerTurn: 0.08,
      desc: `🌟 [Thiên Đạo Trấn Thế]: +${(profile.expBonus * 100).toFixed(0)}% EXP Tu Vi vĩnh viễn, Bỏ qua 25% Giáp kẻ địch, Tự động hồi 8% HP mỗi hiệp đấu.`
    };
    e.combatSkill = {
      name: e.combatSkill?.name || `${e.name} Tuyệt Kỹ`,
      damageMultiplier: dmgMult,
      shield: Math.floor(hp * 0.2),
      desc: `Khai mở chân hỏa Thiên Giai: Gây ${(dmgMult * 100).toFixed(0)}% sát thương và Tạo khiên hộ thể +${Math.floor(hp * 0.2)} HP!`
    };
  } else if (e.rarity === 'DIA_GIAI') {
    e.passives = {
      expBonus: profile.expBonus,
      luckBonus: 15,
      desc: `🔮 [Địa Mạch Tinh Hoa]: +${(profile.expBonus * 100).toFixed(0)}% EXP Tu Vi vĩnh viễn, Tăng +15% Khí Vận may mắn rơi đồ hiếm.`
    };
    e.combatSkill = {
      name: e.combatSkill?.name || `${e.name} Kỹ Năng`,
      damageMultiplier: dmgMult,
      heal: Math.floor(hp * 0.15),
      desc: `Vận chuyển địa khí: Gây ${(dmgMult * 100).toFixed(0)}% sát thương và Hồi phục +${Math.floor(hp * 0.15)} HP!`
    };
  } else if (e.rarity === 'HUYEN_GIAI') {
    e.passives = {
      expBonus: profile.expBonus,
      defBonus: 0.08,
      desc: `✨ [Bảo Khí Linh Quang]: +${(profile.expBonus * 100).toFixed(0)}% EXP Tu Vi vĩnh viễn, Tăng 8% Phòng ngự.`
    };
    e.combatSkill = {
      name: e.combatSkill?.name || `${e.name} Uy Lực`,
      damageMultiplier: dmgMult,
      desc: `Kích phát linh khí: Gây ${(dmgMult * 100).toFixed(0)}% sát thương bạo liệt!`
    };
  } else {
    e.passives = {
      expBonus: profile.expBonus,
      desc: `🗡️ [Phàm Binh Dẫn Khí]: +${(profile.expBonus * 100).toFixed(0)}% EXP Tu Vi.`
    };
    e.combatSkill = {
      name: e.combatSkill?.name || `${e.name} Nhất Kích`,
      damageMultiplier: dmgMult,
      desc: `Đòn đánh cường hóa: Gây ${(dmgMult * 100).toFixed(0)}% sát thương cơ bản.`
    };
  }
});

fs.writeFileSync(equipmentPath, JSON.stringify(rawData, null, 2), 'utf8');
console.log('✅ Đã cân bằng lại toàn bộ 60 Pháp Bảo với khoảng cách sức mạnh và nội tại Thần Giai cực VIP!');
