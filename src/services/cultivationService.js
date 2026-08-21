
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getFactionBuffs } from './factionService.js';
import { getUserTalentPerks } from './talentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const realmsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/realms.json'), 'utf8'));
const goldenCoreConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/goldenCore.json'), 'utf8'));

function getRealmsConfig() {
  return realmsConfig;
}

function getGoldenCoreConfig() {
  return goldenCoreConfig;
}

export function getRealmById(realmId) {
  const config = getRealmsConfig();
  return config.realms.find(r => r.id === realmId) || config.realms[0];
}

export function getRealmDisplayName(realmId, layer, isLuyenKhiVanTang = false) {
  const realm = getRealmById(realmId);
  if (realmId === 'pham_nhan') return 'Phàm Nhân';
  if (isLuyenKhiVanTang && layer > 4) {
    return `Luyện Khí Kỳ [Tầng ${layer}]`;
  }
  const config = getRealmsConfig();
  const stageNames = config.stageNames || ['Sơ Kỳ', 'Trung Kỳ', 'Hậu Kỳ', 'Đỉnh Phong'];
  const stage = stageNames[Math.min(layer - 1, stageNames.length - 1)] || 'Sơ Kỳ';
  return `${realm.name} [${stage}]`;
}

// CƠ CHẾ ẨN: Tính toán tỉ lệ Kết Đan dựa trên độ dày căn cơ và EXP dư thừa tích lũy
// Đảm bảo Thiên Đạo Vô Khuyết Kim Đan KHÔNG BAO GIỜ vượt quá 50%
export function rollGoldenCore(user = null) {
  const config = getGoldenCoreConfig();
  
  // Trọng số cơ bản: Hạ Phẩm (40), Trung Phẩm (35), Thượng Phẩm (18), Cực Phẩm (6), Thiên Đạo (1)
  let weights = [40, 35, 18, 6, 1];

  if (user) {
    // 1. Kiểm tra tu vi dư thừa (Dư EXP so với maxExp)
    if (user.realm && user.realm.exp > user.realm.maxExp) {
      const surplusRatio = Math.min(2.0, (user.realm.exp - user.realm.maxExp) / user.realm.maxExp); // Dư từ 0% đến 200%
      const bonusHighTier = Math.floor(surplusRatio * 15);
      weights[0] = Math.max(10, weights[0] - bonusHighTier * 2);
      weights[2] += Math.floor(bonusHighTier * 0.8);
      weights[3] += Math.floor(bonusHighTier * 1.0);
      weights[4] += Math.floor(bonusHighTier * 0.5);
    }

    // 2. Kiểm tra độ thuần thục công pháp tâm pháp tu luyện
    const tamPhapSkills = (user.skills || []).filter(s => s.category === 'tam_phap');
    if (tamPhapSkills.length > 0) {
      const avgMastery = tamPhapSkills.reduce((sum, s) => sum + (s.mastery || 0), 0) / tamPhapSkills.length;
      if (avgMastery >= 80) {
        weights[0] = Math.max(5, weights[0] - 10);
        weights[2] += 6;
        weights[3] += 5;
        weights[4] += 3;
      }
    }

    // 3. Tư chất bẩm sinh hỗ trợ
    if (user.talent && (user.talent.tier === 'THIEN_PHAM' || user.talent.tier === 'THAN_PHAM')) {
      weights[3] += 8;
      weights[4] += 5;
    }
  }

  // KHÓNG CHẾ CỨNG (HARD CAP): Tỉ lệ Thiên Đạo Kim Đan (weights[4]) tuyệt đối KHÔNG VƯỢT QUÁ 50%
  const otherWeightsSum = weights[0] + weights[1] + weights[2] + weights[3];
  if (weights[4] > otherWeightsSum) {
    weights[4] = otherWeightsSum; // Đảm bảo tối đa 50% (weights[4] / (otherWeightsSum + weights[4]) <= 0.50)
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const randomVal = Math.random() * totalWeight;
  let cumulative = 0;

  for (let i = 0; i < config.grades.length; i++) {
    cumulative += weights[i];
    if (randomVal <= cumulative) {
      return config.grades[i];
    }
  }

  return config.grades[0];
}

export function calculateMaxExp(realmId, layer, isLuyenKhiVanTang = false) {
  const realm = getRealmById(realmId);
  const baseExp = realm.baseExp || 100;
  const expGrowth = realm.expGrowth || 2.2;

  if (isLuyenKhiVanTang && realmId === 'luyen_khi' && layer >= 5) {
    return Math.floor(baseExp * Math.pow(1.18, layer - 1));
  }

  return Math.floor(baseExp * Math.pow(expGrowth, layer - 1));
}


/**
 * Vạch tu vi thực tế của một nhân vật = công thức config trừ đi ưu đãi
 * `breakDiscount` của linh căn (Cực Phẩm giảm 15%). Bọc lại ở một chỗ để mọi
 * nơi ghi maxExp đều thống nhất, tránh cảnh hiển thị một đằng tính một nẻo.
 */
export function calculateUserMaxExp(user, realmId, layer, isLuyenKhiVanTang = false) {
  const base = calculateMaxExp(realmId, layer, isLuyenKhiVanTang);
  const discount = getUserTalentPerks(user).breakDiscount || 0;
  return Math.max(1, Math.floor(base * (1 - discount)));
}

/**
 * Tỉ lệ đột phá THỰC TẾ của nhân vật, tính cả buff trận doanh và Trúc Cơ Đan.
 *
 * Soi gương đúng phép tính trong `attemptBreakthrough` nhưng KHÔNG tiêu buff —
 * dùng để hiển thị. Lấy thẳng `breakSuccessRate` trong config mà khoe với người
 * chơi là nói sai: người Chính Đạo vừa uống Trúc Cơ Đan có tỉ lệ cao hơn hẳn.
 */
export function tiLeDotPhaThucTe(user) {
  const config = getRealmsConfig();
  const realm = config.realms.find(r => r.id === user?.realm?.id) || config.realms[0];

  // Buff trận doanh là hệ số NHÂN tương đối, không phải cộng thẳng:
  // cộng thẳng +0.25 vào Nguyên Anh (0.25) sẽ thành 0.50 — gấp đôi, quá lệch.
  const goc = realm.breakSuccessRate || 0.60;
  let rate = goc;

  const factionBuffs = getFactionBuffs(user?.faction);
  if (factionBuffs.breakSuccessBonus > 0) rate *= (1 + factionBuffs.breakSuccessBonus);

  const breakBuff = user?.breakthroughBuff || 0;
  if (breakBuff > 0) rate *= (1 + breakBuff);

  // Trần 0.95 là để chặn buff thổi tỉ lệ lên gần chắc thắng. Nhưng config ghi
  // thẳng 1.0 (Phàm Nhân ➜ Luyện Khí) là cố ý cho chắc thắng — kẹp nó xuống
  // 0.95 nghĩa là ngay lần đột phá đầu đời, tân thủ vẫn có 5% ăn nguyên cái
  // thông báo "BỊ CẮN TRẢ TỤT TU VI" đỏ lòm. Tôn trọng ý đồ của config.
  if (goc >= 1) return 1;
  return Math.min(0.95, rate);
}

/**
 * `!dotpha` lần này có thật sự đánh cược cảnh giới không?
 *
 * Hầu hết các lần gõ `!dotpha` KHÔNG hề rủi ro: lên tiểu cảnh giới (Sơ Kỳ ➜
 * Trung Kỳ ➜ Hậu Kỳ ➜ Đỉnh Phong) và nhánh Nén Khí Vạn Tầng đều thành công
 * 100%. Chỉ nhánh 3 — vượt sang đại cảnh giới mới — mới tung xúc xắc.
 *
 * Phải soi đúng theo `attemptBreakthrough`, vì doạ người chơi ở một lượt chắc
 * thắng còn tai hại hơn là im lặng: họ sẽ ngồi ôm EXP đầy mà không dám bấm.
 */
export function sapDanhCuocDotPha(user) {
  const config = getRealmsConfig();
  const realm = config.realms.find(r => r.id === user?.realm?.id);
  if (!realm) return false;

  // Chưa đầy tu vi thì `attemptBreakthrough` từ chối ngay, chưa tới lượt cược.
  if (!(user?.realm?.exp >= user?.realm?.maxExp)) return false;

  // Nhánh 1: còn tầng để lên trong cùng cảnh giới — chắc chắn thành công.
  if ((user.realm.layer || 1) < realm.maxLayer) return false;

  // Nhánh 2: Nén Khí Vạn Tầng — cũng chắc chắn thành công (hoặc chạm trần bản).
  if (user.isLuyenKhiVanTang && realm.canCompress) return false;

  // Hết nội dung của phiên bản: không cược gì cả, chỉ báo hết đường.
  const nextRealmId = realm.nextRealmId;
  if (!nextRealmId) return false;
  if (!config.realms.some(r => r.id === nextRealmId)) return false;

  // Kim Đan ➜ Nguyên Anh bị đá sang `!dokiep`, `!dotpha` không cược ở đây.
  if (realm.id === 'kim_dan' && nextRealmId === 'nguyen_anh') return false;

  // Phàm Nhân ➜ Luyện Khí có tỉ lệ 1.0: chắc thắng, đừng doạ.
  if (tiLeDotPhaThucTe(user) >= 1) return false;

  return true;
}

export function attemptBreakthrough(user) {
  const config = getRealmsConfig();
  const currentRealm = config.realms.find(r => r.id === user.realm.id) || config.realms[0];
  const currentLayer = user.realm.layer;

  const isMaxExp = user.realm.exp >= user.realm.maxExp;
  const stageNames = config.stageNames || ['Sơ Kỳ', 'Trung Kỳ', 'Hậu Kỳ', 'Đỉnh Phong'];
  const talentPerks = getUserTalentPerks(user);

  if (!isMaxExp) {
    return {
      success: false,
      message: `Tu vi chưa viên mãn! Cần đạt **${user.realm.maxExp}** EXP (Hiện có: **${user.realm.exp}** EXP). Hãy dùng \`!tuluyen\` hoặc bấm nút **[🧘 Tu Luyện]**.`
    };
  }

  // 1. Tăng tiểu cảnh giới (Sơ Kỳ ➜ Trung Kỳ ➜ Hậu Kỳ ➜ Đỉnh Phong)
  if (currentLayer < currentRealm.maxLayer) {
    const nextLayer = currentLayer + 1;
    user.realm.layer = nextLayer;
    user.realm.exp = 0;

    user.realm.maxExp = calculateUserMaxExp(user, currentRealm.id, nextLayer, user.isLuyenKhiVanTang);

    user.stats.maxHp += Math.floor((currentRealm.hpGain || 50) * (1 + talentPerks.hpBonus));
    user.stats.hp = user.stats.maxHp;
    user.stats.maxMp = (user.stats.maxMp || 100) + (currentRealm.mpGain || 40);
    user.stats.mp = user.stats.maxMp;
    user.stats.atk += currentRealm.atkGain || 10;
    user.stats.def += currentRealm.defGain || 5;


    const nextStageName = stageNames[nextLayer - 1] || 'Sơ Kỳ';
    user.realm.name = getRealmDisplayName(currentRealm.id, nextLayer, user.isLuyenKhiVanTang);

    return {
      success: true,
      message: `🎉 **ĐỘT PHÁ THÀNH CÔNG!** Đạt tới **${currentRealm.name} [${nextStageName}]**!`
    };
  }

  // 2. Nếu đang ở chế độ Nén Khí Vạn Tầng (Từ Dương)
  if (user.isLuyenKhiVanTang && currentRealm.canCompress) {
    const maxCompress = currentRealm.compressMaxLayer || 50;
    const nextLayer = currentLayer + 1;

    if (nextLayer > maxCompress) {
      return {
        success: false,
        message: `Đã đạt tới đỉnh phong **${currentRealm.name} Tầng ${maxCompress}** của phiên bản hiện tại! Hãy đón chờ bản cập nhật tiếp theo!`
      };
    }

    user.realm.layer = nextLayer;
    user.realm.exp = 0;

    user.realm.maxExp = calculateUserMaxExp(user, currentRealm.id, nextLayer, true);

    user.stats.maxHp += Math.floor((currentRealm.hpGain || 50) * (1 + talentPerks.hpBonus));
    user.stats.hp = user.stats.maxHp;
    user.stats.maxMp = (user.stats.maxMp || 100) + (currentRealm.mpGain || 40);
    user.stats.mp = user.stats.maxMp;
    user.stats.atk += currentRealm.atkGain || 10;
    user.stats.def += currentRealm.defGain || 5;
    user.realm.name = `Luyện Khí Kỳ [Tầng ${nextLayer}]`;

    return {
      success: true,
      message: `🎉 **ĐỘT PHÁ THÀNH CÔNG!** Đạt tới **Luyện Khí Kỳ [Tầng ${nextLayer}]**!\n⚡ *(Nhánh Vạn Cổ Nén Khí: Pháp lực nén tăng vọt, miễn nhiễm lôi kiếp!)*`
    };
  }

  // 3. Đột phá sang Đại Cảnh Giới Tiếp Theo
  const nextRealmId = currentRealm.nextRealmId;
  if (!nextRealmId) {
    return {
      success: false,
      message: `Đạo hữu đã đạt tới cảnh giới đỉnh phong **${currentRealm.name} [Đỉnh Phong]** của phiên bản hiện tại! Các cảnh giới Thần Cấp tiếp theo sẽ mở ở bản cập nhật kế tiếp!`
    };
  }

  // ĐẶC BIỆT: Kim Đan -> Nguyên Anh BẮT BUỘC phải dùng lệnh !dokiep
  if (currentRealm.id === 'kim_dan' && nextRealmId === 'nguyen_anh') {
    return {
      success: false,
      message: `⚡ **LÔI VÂN KÉO TỚI - THIÊN KIẾP ĐANG HÌNH THÀNH!**\nĐột phá từ Kim Đan lên **Nguyên Anh Kỳ** là hành vi nghịch thiên đoạt mệnh, không thể đột phá thông thường!\n👉 Hãy chuẩn bị tâm lý và gõ lệnh \`!dokiep\` để nghênh chiến 3 Đạo Thiên Lôi Sinh Tử!`
    };
  }

  const nextRealm = config.realms.find(r => r.id === nextRealmId);
  if (!nextRealm) {
    return {
      success: false,
      message: `Chưa mở khóa cảnh giới tiếp theo.`
    };
  }


  // Dùng chung một hàm với con số khoe trên màn hình. Trước đây hai chỗ chép
  // tay cùng phép tính, nên chỉ cần sửa lệch một bên là bot nói dối người chơi.
  const successRate = tiLeDotPhaThucTe(user);

  // Trúc Cơ Đan tiêu ngay dù thành hay bại — nếu chỉ tiêu khi thất bại thì
  // uống một viên là có buff vĩnh viễn.
  user.breakthroughBuff = 0;

  const roll = Math.random();
  if (roll <= successRate) {
    let specialMsg = '';

    // CƠ CHẾ KẾT ĐAN ẨN (Trúc Cơ -> Kim Đan)
    if (currentRealm.id === 'truc_co' && nextRealm.id === 'kim_dan') {
      const isDiligence = user.realm.exp >= (user.realm.maxExp * 1.5);
      const core = rollGoldenCore(user);

      user.goldenCore = {
        grade: core.id,
        name: core.name,
        expBonus: core.expBonus,
        desc: core.desc
      };

      user.stats.atk += core.atkBonus || 0;
      user.stats.def += core.defBonus || 0;
      user.stats.maxHp += core.hpBonus || 0;
      user.stats.maxMp = (user.stats.maxMp || 100) + 200;
      user.stats.critRate = (user.stats.critRate || 0.05) + (core.critBonus || 0);

      const foundationMsg = isDiligence
        ? `\n📜 *Nhờ tích lũy căn cơ thâm hậu và đan điền dạt dào linh khí, đạo cơ bùng nổ sinh ra dị tượng hiếm có!*`
        : ``;

      specialMsg = `\n\n✨ **[KẾT THÀNH KIM ĐAN]:** **[${core.name}]**${foundationMsg}\n` +
        `📖 *${core.desc}*\n` +
        `⚡ **Tốc độ tu luyện vĩnh viễn:** \`+${(core.expBonus * 100).toFixed(0)}% EXP\`\n` +
        `🗡️ **Thuộc tính cộng thêm:** \`+${core.atkBonus} ATK\` | \`+${core.defBonus} DEF\` | \`+${core.hpBonus} HP\` | \`+${(core.critBonus * 100).toFixed(0)}% Bạo Kích\`!`;
    }


    user.realm.id = nextRealm.id;
    user.realm.name = getRealmDisplayName(nextRealm.id, 1, false);
    user.realm.layer = 1;
    user.realm.exp = 0;

    user.realm.maxExp = calculateUserMaxExp(user, nextRealm.id, 1, false);

    user.stats.maxHp += Math.floor((nextRealm.hpGain || 100) * 2 * (1 + talentPerks.hpBonus));
    user.stats.hp = user.stats.maxHp;
    user.stats.maxMp = (user.stats.maxMp || 100) + (nextRealm.mpGain || 50) * 2;
    user.stats.mp = user.stats.maxMp;
    user.stats.atk += (nextRealm.atkGain || 20) * 2;
    user.stats.def += (nextRealm.defGain || 10) * 2;

    return {
      success: true,
      message: (currentRealm.breakMessage || `🎉 **ĐỘT PHÁ THÀNH CÔNG!** Đạt tới **${nextRealm.name} [Sơ Kỳ]**!`) + specialMsg
    };
  } else {
    // Kiểm tra Hộ Mạch Đan
    const hoMachIdx = (user.inventory || []).findIndex(i => i.itemId === 'ho_mach_dan');
    if (hoMachIdx !== -1) {
      user.inventory[hoMachIdx].quantity -= 1;
      if (user.inventory[hoMachIdx].quantity <= 0) user.inventory.splice(hoMachIdx, 1);
      user.realm.exp = Math.floor(user.realm.maxExp * 0.85);
      return {
        success: false,
        message: `💥 **ĐỘT PHÁ THẤT BẠI!**\n🛡️ May nhờ có **[Hộ Mạch Đan]** trong túi tự động tỏa sáng bảo vệ kinh mạch, đạo hữu **không bị tụt tầng cảnh giới**, chỉ hao hụt 15% Tu Vi!`
      };
    }

    // Không có bảo dược -> BỊ TỤT TẦNG CẢNH GIỚI VÀ MẤT TU VI
    const oldName = user.realm.name;
    const newLayer = Math.max(1, user.realm.layer - 1);
    user.realm.layer = newLayer;
    user.realm.name = getRealmDisplayName(user.realm.id, newLayer, user.isLuyenKhiVanTang);

    user.realm.maxExp = calculateUserMaxExp(user, user.realm.id, newLayer, user.isLuyenKhiVanTang);
    user.realm.exp = Math.floor(user.realm.maxExp * 0.40);

    return {
      success: false,
      message: `💥 **ĐỘT PHÁ THẤT BẠI - BỊ CẮN TRẢ TỤT TU VI!**\n💀 Không có bảo dược hộ thân, chân khí nghịch chuyển làm tổn thương đạo cơ, cảnh giới bị đánh tụt từ **${oldName}** xuống **${user.realm.name}**!\n👉 *Hãy dùng \`!luyendan\` chế tạo [Hộ Mạch Đan] để bảo vệ đạo cơ không bị tụt cấp khi thất bại!*`
    };
  }
}
