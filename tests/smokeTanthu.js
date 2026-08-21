/**
 * ĐI THỬ TRỌN CHUỖI NHIỆM VỤ TÂN THỦ TRÊN DATABASE THẬT
 *
 * Khác với `test:tutorial` (chạy logic thuần trên object giả), bộ này tạo một
 * nhân vật thật trong MongoDB rồi lần lượt: dựng đúng cái màn hình mà người
 * chơi sẽ thấy khi gõ `!tanthu`, thoả điều kiện từng bước, bấm nút lĩnh
 * thưởng, và soi lại số dư sau mỗi lượt.
 *
 * Nó bắt được đúng lớp lỗi mà test logic thuần không thấy: schema thiếu field
 * (`tutorial.step` không được lưu), phần thưởng vật phẩm không vào túi, embed
 * vỡ vì thiếu dữ liệu, hay điều kiện viết trong config không khớp với hình
 * dạng thật của document.
 *
 * Chạy:  npm run smoke:tanthu
 * An toàn: chỉ đụng nhân vật tạm có userId "__smoke_tanthu", xoá sạch khi xong.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import chalk from 'chalk';

import { connectDB } from '../src/database/connect.js';
import { User } from '../src/database/models/User.js';
import { buildTanthuView, claimAndBuildView } from '../src/commands/prefix/tutorial.js';
import { TUTORIAL_QUESTS, TUTORIAL_TOTAL, progressOf } from '../src/services/tutorialService.js';

const USER_ID = '__smoke_tanthu';

let passed = 0;
let total = 0;

function assert(cond, label) {
  total++;
  if (cond) { passed++; console.log(chalk.green(`  ✅ ${label}`)); }
  else { console.log(chalk.red(`  ❌ ${label}`)); }
}

/**
 * Đưa nhân vật tới trạng thái thoả điều kiện của một bước, bằng cách ghi thẳng
 * vào đúng field mà `progressOf` sẽ đọc. Cố tình KHÔNG gọi lệnh game thật:
 * ở đây ta đang kiểm chuỗi nhiệm vụ, không kiểm lại `!tuluyen`.
 */
async function satisfy(goal) {
  const set = {};
  switch (goal.type) {
    case 'counter':
      set[`counters.${goal.key}`] = goal.amount;
      break;
    case 'checkInStreak':
      set['dailyCheckIn.streak'] = goal.amount;
      break;
    case 'equippedGear':
      set.equipments = Array.from({ length: goal.amount }, (_, i) => ({
        gearId: `smoke_gear_${i}`,
        name: `Pháp Bảo Thử ${i}`,
        rarity: 'PHAM',
        slot: 'VU_KHI',
        equipped: true,
        stats: { atk: 1, def: 1, maxHp: 1, critRate: 0 }
      }));
      break;
    case 'skillCount':
      set.skills = Array.from({ length: goal.amount }, (_, i) => ({
        skillId: `smoke_skill_${i}`,
        name: `Công Pháp Thử ${i}`,
        category: 'TAM_PHAP',
        rarity: 'HOANG',
        mastery: 0
      }));
      break;
    case 'realmAtLeast':
      set['realm.id'] = goal.realmId;
      set['realm.layer'] = 1;
      break;
    case 'layerAtLeast':
      set['realm.id'] = goal.realmId;
      set['realm.layer'] = goal.amount;
      break;
    default:
      throw new Error(`Chưa biết cách thoả điều kiện loại "${goal.type}"`);
  }
  return User.findOneAndUpdate({ userId: USER_ID }, { $set: set }, { new: true });
}

function textOf(payload) {
  if (payload?.content) return payload.content;
  const e = payload?.embeds?.[0];
  if (!e) return '';
  const d = e.data || e;
  return [d.title, d.description, (d.footer && d.footer.text) || ''].join('\n');
}

async function main() {
  await connectDB();
  console.log(chalk.bold.magenta(`\n======================================================`));
  console.log(chalk.bold.magenta(`  🌱 ĐI THỬ TRỌN CHUỖI TÂN THỦ TRÊN DATABASE THẬT`));
  console.log(chalk.bold.magenta(`======================================================\n`));

  // ── Người chưa có nhân vật ──
  await User.deleteOne({ userId: USER_ID });
  console.log(chalk.yellow(`[0] Người chưa khai đạo:`));
  const chuaCo = await buildTanthuView(USER_ID);
  assert(/khoi-dau|khởi đầu|chưa/i.test(textOf(chuaCo)),
    'chưa có nhân vật thì được chỉ sang /khoi-dau chứ không vỡ màn hình');

  // ── Tạo nhân vật mới tinh ──
  await User.create({
    userId: USER_ID,
    username: 'SmokeTanthu',
    daoName: 'Tân Thủ Thử Nghiệm',
    currencies: { linhThach: 0, nguyenThach: 0 }
  });

  console.log(chalk.yellow(`\n[1] Màn hình mở đầu:`));
  const mo = await buildTanthuView(USER_ID);
  const moText = textOf(mo);
  assert(!!mo.embeds?.length, 'dựng được embed');
  assert(moText.includes(TUTORIAL_QUESTS[0].title), `bước đầu hiện đúng tên "${TUTORIAL_QUESTS[0].title}"`);
  assert((mo.components || []).length === 1, 'có đúng 1 hàng nút');
  assert(mo.components[0].components[0].data.disabled === true,
    'nút Lĩnh thưởng bị khoá khi chưa đủ điều kiện');

  const somCham = await claimAndBuildView(USER_ID);
  assert(!somCham.embeds && /chưa|còn/i.test(textOf(somCham)),
    'bấm lĩnh sớm thì bị từ chối, không phát thưởng');
  assert((await User.findOne({ userId: USER_ID })).currencies.linhThach === 0,
    'số dư vẫn là 0 sau cú bấm sớm');

  // ── Đi từng bước ──
  console.log(chalk.yellow(`\n[2] Lần lượt qua ${TUTORIAL_TOTAL} bước:`));
  let ltCong = 0;
  let ntCong = 0;

  for (let i = 0; i < TUTORIAL_TOTAL; i++) {
    const q = TUTORIAL_QUESTS[i];
    const truoc = await satisfy(q.goal);

    if (!progressOf(truoc, q).done) {
      assert(false, `[${i + 1}] ${q.title} — thoả điều kiện xong mà progressOf vẫn báo chưa xong`);
      continue;
    }

    const mo2 = await buildTanthuView(USER_ID);
    const moKhoa = mo2.components?.[0]?.components?.[0]?.data?.disabled !== true;

    const sau = await claimAndBuildView(USER_ID);
    const u = await User.findOne({ userId: USER_ID });

    ltCong += q.reward?.linhThach || 0;
    ntCong += q.reward?.nguyenThach || 0;

    const duItem = (q.reward?.items || []).every(it => {
      const stack = (u.inventory || []).find(x => x.itemId === it.itemId);
      return stack && stack.quantity >= it.quantity;
    });

    const dungHet =
      !!sau.embeds &&
      u.tutorial.step === i + 1 &&
      u.currencies.linhThach === ltCong &&
      u.currencies.nguyenThach === ntCong &&
      duItem &&
      moKhoa;

    assert(dungHet,
      `[${i + 1}/${TUTORIAL_TOTAL}] ${q.title} — mở nút, lĩnh xong, bước=${u.tutorial.step}, ` +
      `LT=${u.currencies.linhThach}, NT=${u.currencies.nguyenThach}`);
  }

  // ── Tốt nghiệp ──
  console.log(chalk.yellow(`\n[3] Sau khi tốt nghiệp:`));
  const cuoi = await User.findOne({ userId: USER_ID });
  assert(cuoi.tutorial.done === true, 'cờ tutorial.done được bật');
  assert(cuoi.currencies.linhThach === ltCong, `tổng Linh Thạch nhận đúng ${ltCong.toLocaleString()}`);
  assert(cuoi.currencies.nguyenThach === ntCong, `tổng Nguyên Thạch nhận đúng ${ntCong}`);

  const manCuoi = await buildTanthuView(USER_ID);
  const cuoiText = textOf(manCuoi);
  assert(!!manCuoi.embeds?.length, 'màn hình tốt nghiệp vẫn dựng được embed');
  assert(/laptongmon|nhiemvubang/.test(cuoiText), 'màn tốt nghiệp chỉ đường sang vòng chơi chính');
  assert((manCuoi.components || []).length === 0, 'không còn nút Lĩnh thưởng thừa nào');

  const themNua = await claimAndBuildView(USER_ID);
  const truocThem = cuoi.currencies.linhThach;
  const sauThem = (await User.findOne({ userId: USER_ID })).currencies.linhThach;
  assert(!themNua.embeds && sauThem === truocThem, 'lĩnh thêm lần nữa không moi ra được đồng nào');

  // ── Document cũ bị hỏng ở chỗ khác ──
  // Đây chính là ca đã làm lộ vấn đề: bản ghi công pháp thiếu field bắt buộc.
  // Lối cũ (`claimed.save()`) kiểm tra hợp lệ cả document nên ném lỗi ngay,
  // dù chỗ hỏng chẳng liên quan gì tới cái túi — mà Linh Thạch thì đã trao và
  // bước đã tiêu mất rồi. Dựng document hỏng bằng driver thô để mongoose không
  // kịp chặn lúc tạo.
  console.log(chalk.yellow(`\n[4] Nhân vật có bản ghi cũ bị hỏng:`));
  await User.deleteOne({ userId: USER_ID });
  const questCoDo = TUTORIAL_QUESTS.findIndex(q => (q.reward?.items || []).length);
  const qCoDo = TUTORIAL_QUESTS[questCoDo];
  await User.collection.insertOne({
    userId: USER_ID,
    username: `SmokeTanthu`,
    daoName: `Tân Thủ Hỏng Hồ Sơ`,
    currencies: { linhThach: 0, nguyenThach: 0 },
    inventory: [],
    equipments: [],
    // Thiếu `category` — mongoose sẽ coi cả document là không hợp lệ.
    skills: [{ skillId: `legacy_hong`, name: `Bí Kíp Cũ` }],
    counters: {},
    tutorial: { step: questCoDo, done: false },
    realm: { id: `pham_nhan`, name: `Phàm Nhân`, layer: 1, exp: 0, maxExp: 150 },
    dailyCheckIn: { lastDate: null, streak: 0 }
  });
  await satisfy(qCoDo.goal);

  const nhanDo = await claimAndBuildView(USER_ID);
  const uHong = await User.findOne({ userId: USER_ID });
  const duDo = (qCoDo.reward.items || []).every(it => {
    const stack = (uHong.inventory || []).find(x => x.itemId === it.itemId);
    return stack && stack.quantity === it.quantity;
  });
  assert(!!nhanDo.embeds, `[${qCoDo.title}] vẫn lĩnh được dù hồ sơ có bản ghi cũ hỏng`);
  assert(duDo, `vật phẩm thưởng vào túi đủ số, không bị chặn bởi lỗi hợp lệ ở chỗ khác`);
  assert(uHong.currencies.linhThach === (qCoDo.reward.linhThach || 0),
    `Linh Thạch và vật phẩm cùng tới nơi, không mất vế nào`);

  // ── Dọn dẹp ──
  await User.deleteOne({ userId: USER_ID });
  console.log(chalk.gray(`\n🧹 Đã xoá nhân vật thử nghiệm.`));

  console.log(chalk.bold.magenta(`\n======================================================`));
  if (passed === total) {
    console.log(chalk.bold.green(`🎉 KẾT QUẢ: ${passed}/${total} PHÉP THỬ ĐẠT — chuỗi tân thủ chạy trọn vẹn trên DB thật!`));
  } else {
    console.log(chalk.bold.red(`⚠️ KẾT QUẢ: ${passed}/${total} đạt — còn ${total - passed} chỗ hỏng.`));
  }
  console.log(chalk.bold.magenta(`======================================================\n`));

  await mongoose.connection.close();
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (e) => {
  console.error(chalk.red(`\n💥 Lỗi khi chạy: ${e.stack || e.message}`));
  try { await User.deleteOne({ userId: USER_ID }); } catch {}
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
