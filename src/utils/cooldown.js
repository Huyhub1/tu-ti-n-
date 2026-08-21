/**
 * Quản lý thời gian hồi chiêu tập trung cho toàn bộ lệnh.
 * Trước đây mỗi lệnh tự khai báo hằng số riêng, và 3 lệnh
 * (săn thú / phó bản / đúc pháp bảo) hoàn toàn không có cooldown
 * dù schema đã khai báo sẵn trường tương ứng.
 */

export const COOLDOWNS = {
  cultivate: 10,   // !tuluyen
  work: 30,        // !lamcong
  skillTrain: 10,  // !luyencong
  pvp: 20,         // !khieuchien
  mining: 45,      // !daokhoang
  dothach: 20,     // !dothach
  hunting: 30,     // !santhu
  dungeon: 120,    // !phoban
  crafting: 60,    // !ducphapbao
  sectTask: 60     // nhiệm vụ bang
};

/**
 * Kiểm tra một cooldown.
 * @returns {{ ready: boolean, waitTime: number }} waitTime tính bằng giây
 */
export function checkCooldown(user, key) {
  const limit = COOLDOWNS[key];
  if (!limit) return { ready: true, waitTime: 0 };

  const last = user?.cooldowns?.[key];
  if (!last) return { ready: true, waitTime: 0 };

  const elapsed = Math.floor((Date.now() - new Date(last).getTime()) / 1000);
  if (elapsed >= limit) return { ready: true, waitTime: 0 };

  return { ready: false, waitTime: limit - elapsed };
}

/** Ghi lại mốc thời gian dùng lệnh (nhớ gọi user.save() sau đó). */
export function setCooldown(user, key) {
  if (!user.cooldowns) user.cooldowns = {};
  user.cooldowns[key] = new Date();
}

/** Định dạng số giây thành chuỗi dễ đọc: 95 -> "1 phút 35 giây" */
export function formatWait(seconds) {
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
}

/**
 * Ngưỡng máu tối thiểu để được phép vào trận (20% HP tối đa).
 * Giờ HP đã được lưu lại sau mỗi trận nên cần chặn vòng lặp chết liên tục.
 */
export const MIN_HP_RATIO_TO_FIGHT = 0.20;

export function checkBattleReady(user) {
  const maxHp = user?.stats?.maxHp || 100;
  const hp = user?.stats?.hp ?? maxHp;
  const need = Math.ceil(maxHp * MIN_HP_RATIO_TO_FIGHT);

  if (hp >= need) return { ready: true, hp, maxHp, need };
  return { ready: false, hp, maxHp, need };
}

/**
 * Chiếm cooldown một cách NGUYÊN TỬ (atomic).
 *
 * `checkCooldown` + `setCooldown` + `save()` là một chuỗi đọc-rồi-ghi: nếu người
 * chơi gửi 3 lệnh `!lamcong` trong cùng một tích tắc thì cả 3 đều đọc được mốc
 * cooldown cũ, cả 3 đều "hợp lệ", và người chơi ăn 3 lần thưởng cho 1 lượt.
 * Hàm này gộp kiểm tra + ghi mốc vào đúng một câu lệnh MongoDB nên chỉ duy nhất
 * một lượt lọt qua, y hệt cách `!dothach` đang làm.
 *
 * ⚠️ Luôn dùng document TRẢ VỀ cho các thao tác sau đó. Nếu tiếp tục dùng
 * document cũ rồi `save()`, mongoose sẽ ghi đè mốc cooldown vừa đặt.
 *
 * @param {import('mongoose').Model} User Model User
 * @param {string} userId
 * @param {string} key Khóa trong COOLDOWNS
 * @param {object} [extraFilter] Điều kiện lọc thêm (ví dụ chặn tiền âm)
 * @param {object} [extraUpdate] Toán tử update thêm (ví dụ `{ $inc: {...} }`)
 * @returns {Promise<object|null>} Document mới, hoặc null nếu chưa tới lượt
 */
export async function claimCooldown(User, userId, key, extraFilter = {}, extraUpdate = {}) {
  const limit = COOLDOWNS[key] || 0;
  const now = new Date();
  const cutoff = new Date(now.getTime() - limit * 1000);
  const field = `cooldowns.${key}`;

  const filter = {
    userId,
    ...extraFilter,
    $or: [
      { [field]: null },
      { [field]: { $exists: false } },
      { [field]: { $lte: cutoff } }
    ]
  };

  const update = { ...extraUpdate };
  update.$set = { ...(extraUpdate.$set || {}), [field]: now };

  return User.findOneAndUpdate(filter, update, { new: true });
}

/**
 * MỐC SẴN SÀNG LẠI, DẠNG NHÃN THỜI GIAN ĐỘNG CỦA DISCORD.
 *
 * Dòng "hồi chiêu 45 giây" là con số chết: người chơi đọc xong vẫn phải tự bấm
 * giờ, mà cuộn lại tin cũ thì nó vẫn nói y hệt dù đã hết hồi từ lâu. Nhãn
 * <t:UNIX:R> để Discord tự đếm ngược theo múi giờ và ngôn ngữ của từng người,
 * và tự đổi thành "x giây trước" khi đã sẵn sàng.
 *
 * @param key tên mốc hồi chiêu trong COOLDOWNS
 * @param from thời điểm bắt đầu tính (mặc định là bây giờ)
 */
export function readyAtTag(key, from = new Date()) {
  const limit = COOLDOWNS[key] || 0;
  // Mốc truyền vào thường là user.cooldowns[key] lấy từ CSDL. Mongoose trả về
  // Date, nhưng document đã .lean() hoặc dữ liệu cũ có thể là chuỗi — ép kiểu
  // rồi mới dùng, sai thì lấy mốc bây giờ chứ không để NaN lọt vào nhãn.
  const at = from instanceof Date ? from : new Date(from);
  const base = Number.isFinite(at.getTime()) ? at.getTime() : Date.now();
  const unixSeconds = Math.floor((base + limit * 1000) / 1000);
  return '<t:' + unixSeconds + ':R>';
}

/**
 * Dòng chân trang hồi chiêu dùng chung cho mọi lệnh hành động.
 *
 * Giữ nguyên con số tuyệt đối (để biết chu kỳ dài bao lâu) rồi ghép thêm mốc
 * sẵn sàng động ở sau.
 */
export function cooldownLine(key, from = new Date(), extra = '') {
  const limit = COOLDOWNS[key] || 0;
  const tail = extra ? ' · ' + extra : '';
  return '⏱️ *Hồi chiêu ' + formatWait(limit) + ' — sẵn sàng lại ' + readyAtTag(key, from) + tail + '*';
}
