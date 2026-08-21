import { User } from '../database/models/User.js';

/**
 * Trừ tài nguyên (Linh Thạch / Nguyên Thạch / vật phẩm trong túi) bằng đúng
 * MỘT lệnh atomic.
 *
 * Lò rèn, lò đan và phòng cường hóa trước đây đều đi theo lối
 * `findOne` → sửa trong bộ nhớ → `save()`. Giữa hai bước đó Discord hoàn toàn
 * có thể giao thêm một cú bấm nữa của cùng người chơi, nên spam nút là nhân
 * đôi thành phẩm mà chỉ mất một lần nguyên liệu — hoặc tệ hơn, đẩy số dư
 * xuống âm. Điều kiện `$gte` nằm ngay trong filter khiến lần bấm thứ hai
 * không khớp document nào và trả về `null` thay vì trừ lố.
 *
 * QUAN TRỌNG: sau khi gọi hàm này, mọi thao tác tiếp theo PHẢI thực hiện trên
 * document trả về. Nếu vẫn `save()` cái document đã đọc từ trước thì mảng
 * `inventory` cũ sẽ được ghi đè trở lại và nguyên liệu coi như được hoàn.
 *
 * @param {string} userId
 * @param {{linhThach?: number, nguyenThach?: number, items?: Array<{itemId: string, quantity: number}>}} cost
 * @returns {Promise<object|null>} document đã trừ xong, hoặc null nếu không đủ
 */
export async function spendResources(userId, cost = {}) {
  const linhThach = Math.max(0, Math.floor(cost.linhThach || 0));
  const nguyenThach = Math.max(0, Math.floor(cost.nguyenThach || 0));

  // Gộp các dòng trùng itemId lại: hai bộ lọc mảng cùng trỏ vào một phần tử
  // sẽ khiến MongoDB chỉ áp dụng một lần và người chơi mất ít nguyên liệu hơn.
  const merged = new Map();
  for (const it of cost.items || []) {
    if (!it || !it.itemId || !(it.quantity > 0)) continue;
    merged.set(it.itemId, (merged.get(it.itemId) || 0) + Math.ceil(it.quantity));
  }

  const filter = { userId };
  const inc = {};
  const arrayFilters = [];
  const itemConds = [];

  if (linhThach > 0) {
    filter['currencies.linhThach'] = { $gte: linhThach };
    inc['currencies.linhThach'] = -linhThach;
  }
  if (nguyenThach > 0) {
    filter['currencies.nguyenThach'] = { $gte: nguyenThach };
    inc['currencies.nguyenThach'] = -nguyenThach;
  }

  let i = 0;
  for (const [itemId, quantity] of merged) {
    const key = `it${i++}`;
    itemConds.push({ inventory: { $elemMatch: { itemId, quantity: { $gte: quantity } } } });
    inc[`inventory.$[${key}].quantity`] = -quantity;
    arrayFilters.push({ [`${key}.itemId`]: itemId, [`${key}.quantity`]: { $gte: quantity } });
  }
  if (itemConds.length > 0) filter.$and = itemConds;

  // Không mất gì thì khỏi ghi: MongoDB ném lỗi nếu $inc rỗng.
  if (Object.keys(inc).length === 0) return User.findOne({ userId });

  const opts = { new: true };
  if (arrayFilters.length > 0) opts.arrayFilters = arrayFilters;

  const updated = await User.findOneAndUpdate(filter, { $inc: inc }, opts);
  if (!updated) return null;

  if (merged.size > 0) {
    // Dọn những dòng vừa cạn sạch để túi đồ không đầy rác `x0`.
    const cleaned = await User.findOneAndUpdate(
      { userId, inventory: { $elemMatch: { quantity: { $lte: 0 } } } },
      { $pull: { inventory: { quantity: { $lte: 0 } } } },
      { new: true }
    ).catch(() => null);
    if (cleaned) return cleaned;
  }

  return updated;
}

/**
 * Cộng tài nguyên. Bọc lại cho đối xứng với `spendResources` để chỗ nào cần
 * hoàn tác một giao dịch hỏng cũng có sẵn đường atomic mà dùng.
 */
/**
 * Cộng vật phẩm vào túi bằng update nguyên tử, KHÔNG dùng `save()`.
 *
 * Lối cũ — đọc document, sửa mảng `inventory` trong bộ nhớ rồi `save()` — có
 * hai vết nứt. Thứ nhất, `save()` chạy kiểm tra hợp lệ trên TOÀN BỘ document:
 * chỉ cần một bản ghi cũ nào đó thiếu field bắt buộc (ví dụ sau này ta thêm
 * `required` cho một field của `skills`) là cú cộng vật phẩm ném lỗi, dù lỗi
 * chẳng liên quan gì tới cái túi. Thứ hai, nó ghi đè cả mảng nên một lệnh
 * khác đang cộng vật phẩm song song sẽ bị nuốt mất.
 *
 * Ở đây mỗi vật phẩm đi qua tối đa ba lệnh, không lệnh nào đụng phần còn lại
 * của document:
 *   1. Đã có ngăn  -> `$inc` thẳng vào `inventory.$.quantity`.
 *   2. Chưa có ngăn -> `$push`, kèm filter `$ne` để hai lệnh cùng tạo ngăn thì
 *      chỉ một lệnh khớp, không đẻ ra hai ngăn trùng itemId.
 *   3. Lệnh kia vừa tạo ngăn trước ta trong tích tắc -> quay lại `$inc`.
 *
 * @param {string} userId
 * @param {Array<{itemId: string, name?: string, type?: string, quantity: number}>} items
 * @returns {Promise<object|null>} document sau cùng, hoặc null nếu không cộng gì
 */
export async function grantItems(userId, items = []) {
  let doc = null;

  for (const raw of items || []) {
    const itemId = raw && raw.itemId;
    const quantity = Math.max(0, Math.floor((raw && raw.quantity) || 0));
    if (!itemId || !quantity) continue;

    const congVaoNganCu = () => User.findOneAndUpdate(
      { userId, 'inventory.itemId': itemId },
      { $inc: { 'inventory.$.quantity': quantity } },
      { new: true }
    ).catch(() => null);

    let ket = await congVaoNganCu();

    if (!ket) {
      ket = await User.findOneAndUpdate(
        { userId, 'inventory.itemId': { $ne: itemId } },
        { $push: { inventory: { ...raw, quantity } } },
        { new: true }
      ).catch(() => null);
    }

    if (!ket) ket = await congVaoNganCu();

    if (ket) doc = ket;
  }

  return doc;
}

export async function grantCurrencies(userId, { linhThach = 0, nguyenThach = 0 } = {}) {
  const inc = {};
  if (linhThach) inc['currencies.linhThach'] = linhThach;
  if (nguyenThach) inc['currencies.nguyenThach'] = nguyenThach;
  if (Object.keys(inc).length === 0) return null;
  return User.findOneAndUpdate({ userId }, { $inc: inc }, { new: true }).catch(() => null);
}
