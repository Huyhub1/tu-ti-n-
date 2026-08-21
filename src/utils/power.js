import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const realmsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/realms.json'), 'utf8'));

// Thứ tự cảnh giới lấy thẳng từ realms.json để sau này thêm cảnh giới mới
// (Hoá Thần, Luyện Hư...) không phải sửa lại chỗ nào khác.
export const REALM_ORDER = realmsConfig.realms.map(r => r.id);

export function realmIndex(realmId) {
  const i = REALM_ORDER.indexOf(realmId);
  return i < 0 ? 0 : i;
}

/**
 * Quy cảnh giới + tầng về một con số duy nhất để so sánh cao thấp.
 * Mỗi cảnh giới chiếm 100 điểm nên tầng không bao giờ tràn sang cảnh giới trên.
 */
export function powerRank(realmId, layer = 1) {
  return realmIndex(realmId) * 100 + Math.max(1, layer || 1);
}

export function userRank(user) {
  return powerRank(user?.realm?.id, user?.realm?.layer);
}

/** Yêu cầu tối thiểu của một nội dung (thú / phó bản) đã đủ chưa? */
export function meetsRequirement(user, content) {
  if (!content?.minRealmId) return true;
  return userRank(user) >= powerRank(content.minRealmId, content.minLayer || 1);
}

export function realmDisplayName(realmId) {
  const r = realmsConfig.realms.find(x => x.id === realmId);
  return r ? r.name : realmId;
}

/** Chuỗi mô tả yêu cầu để in ra cho người chơi: "Kim Đan Kỳ · Tầng 2". */
export function requirementLabel(content) {
  if (!content?.minRealmId) return 'Không yêu cầu';
  const layer = content.minLayer || 1;
  return `${realmDisplayName(content.minRealmId)}${layer > 1 ? ` · Tầng ${layer}` : ''}`;
}

/**
 * Nội dung cao hơn người chơi bao nhiêu "bậc" (1 bậc = 1 tầng, 100 = 1 cảnh giới).
 * Dùng để đánh dấu mục tiêu quá sức trong menu thay vì giấu hẳn đi.
 */
export function overGap(user, content) {
  if (!content?.minRealmId) return 0;
  return powerRank(content.minRealmId, content.minLayer || 1) - userRank(user);
}

/**
 * TRẦN CHỈ SỐ VĨNH VIỄN TỪ ĐAN DƯỢC ("dược lực bão hòa").
 *
 * Đan dược trước đây cộng thẳng vào stats không giới hạn: Kim Đan Cố Bản Đan
 * giá 450 LT cho +25 ATK / +15 DEF / +500 Max HP và uống được vô hạn. Một
 * người chơi có 4,5 triệu LT mua được +250.000 Max HP — nhiều gấp 19 lần chỉ
 * số của Nguyên Anh Đỉnh Phong, khiến toàn bộ đường cong cảnh giới vô nghĩa.
 *
 * Trần đặt ở khoảng 30% chỉ số gốc của đỉnh phong từng cảnh giới, và tự nới ra
 * khi lên cảnh giới mới — đan dược vẫn hữu ích suốt game thay vì là mỏ vàng
 * một lần rồi thôi.
 */
export const PILL_CAP = {
  pham_nhan:  { atk: 10,  def: 5,   maxHp: 100 },
  luyen_khi:  { atk: 30,  def: 15,  maxHp: 300 },
  truc_co:    { atk: 90,  def: 45,  maxHp: 800 },
  kim_dan:    { atk: 250, def: 125, maxHp: 2000 },
  nguyen_anh: { atk: 600, def: 300, maxHp: 5000 }
};

export function pillCapOf(user) {
  return PILL_CAP[user?.realm?.id] || PILL_CAP.pham_nhan;
}

/** Còn nhận thêm được bao nhiêu điểm mỗi loại trước khi bão hòa. */
export function pillHeadroom(user) {
  const cap = pillCapOf(user);
  const got = user?.pillBonus || {};
  return {
    atk: Math.max(0, cap.atk - (got.atk || 0)),
    def: Math.max(0, cap.def - (got.def || 0)),
    maxHp: Math.max(0, cap.maxHp - (got.maxHp || 0))
  };
}

/**
 * LỰC CHIẾN — chỉ số tổng hợp duy nhất để so sánh sức mạnh hai người chơi.
 *
 * Đọc THẲNG từ user.stats và không cộng thêm gì nữa. Trang bị (buttonHandler
 * lúc mặc đồ) và đan dược (alchemy lúc uống) đều đã cộng chỉ số vào user.stats
 * ngay tại thời điểm dùng, nên nếu ở đây còn duyệt equipments để cộng lần nữa
 * thì ai đeo đồ sẽ bị tính dư đúng bằng chỉ số bộ đồ đang mặc — bảng xếp hạng
 * sai hoàn toàn và càng đeo nhiều càng sai nặng.
 *
 * Trọng số: công x4 · thủ x3 · máu x0.5 · bạo kích x1000 (5% => 50 điểm).
 */
export function battlePower(user) {
  const s = (user && user.stats) || {};
  const atk = s.atk || 0;
  const def = s.def || 0;
  const maxHp = s.maxHp || 0;
  const critRate = s.critRate || 0;
  return Math.floor(atk * 4 + def * 3 + maxHp * 0.5 + critRate * 1000);
}
