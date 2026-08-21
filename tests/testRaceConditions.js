/**
 * KIỂM THỬ CHỐNG SPAM TRÊN DATABASE THẬT
 *
 * Các test khác chỉ chạy logic thuần. Bộ này kết nối MongoDB thật rồi bắn
 * nhiều thao tác SONG SONG vào cùng một nhân vật để kiểm chứng rằng các cổng
 * chặn nguyên tử thực sự chỉ cho đúng 1 lượt lọt qua.
 *
 * Chạy:  npm run test:race
 * An toàn: chỉ đụng vào nhân vật tạm có userId "__racetest_*", xoá sạch khi xong.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import chalk from 'chalk';

import { connectDB } from '../src/database/connect.js';
import { User } from '../src/database/models/User.js';
import { claimCooldown, COOLDOWNS } from '../src/utils/cooldown.js';
import { spendResources, grantCurrencies, grantItems } from '../src/services/economyService.js';
import { claimTutorialReward, TUTORIAL_QUESTS, TUTORIAL_TOTAL } from '../src/services/tutorialService.js';

const PREFIX_ID = '__racetest_';
let passed = 0;
let total = 0;

function assert(cond, label) {
  total++;
  if (cond) {
    passed++;
    console.log(chalk.green(`  ✅ ${label}`));
  } else {
    console.log(chalk.red(`  ❌ ${label}`));
  }
}

async function makeUser(suffix, extra = {}) {
  const userId = PREFIX_ID + suffix;
  await User.deleteOne({ userId });
  return User.create({
    userId,
    username: 'RaceTest',
    daoName: 'Đạo Hữu Thử Nghiệm',
    currencies: { linhThach: 10000, nguyenThach: 100 },
    inventory: [
      { itemId: 'linh_thao', name: 'Linh Thảo', type: 'NGUYEN_LIEU', quantity: 10 },
      { itemId: 'yeu_dan_so_cap', name: 'Yêu Đan (Sơ Cấp)', type: 'DAN_DUOC', quantity: 10 }
    ],
    ...extra
  });
}

async function main() {
  await connectDB();
  console.log(chalk.bold.magenta(`\n======================================================`));
  console.log(chalk.bold.magenta(`  🧪 KIỂM THỬ CHỐNG SPAM TRÊN DATABASE THẬT`));
  console.log(chalk.bold.magenta(`======================================================\n`));

  // ── 1. Cổng hồi chiêu: 20 lệnh song song chỉ 1 lệnh được đi tiếp ──
  console.log(chalk.yellow(`[1] Cổng hồi chiêu nguyên tử (claimCooldown)...`));
  for (const key of ['work', 'mining', 'cultivate', 'skillTrain', 'sectTask', 'hunting', 'dungeon']) {
    const u = await makeUser('cd_' + key);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => claimCooldown(User, u.userId, key))
    );
    const ok = results.filter(Boolean).length;
    assert(ok === 1, `${key.padEnd(10)} — bắn 20 lệnh cùng lúc, lọt qua ${ok}/20 (mong đợi 1, hồi chiêu ${COOLDOWNS[key]}s)`);
  }

  // ── 2. Điểm danh: không thể nhận 2 lần bổng lộc trong ngày ──
  console.log(chalk.yellow(`\n[2] Đóng dấu điểm danh trong ngày...`));
  {
    const u = await makeUser('daily');
    const today = '2026-08-20';
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        User.findOneAndUpdate(
          { userId: u.userId, 'dailyCheckIn.lastDate': { $ne: today } },
          { $set: { 'dailyCheckIn.lastDate': today, 'dailyCheckIn.streak': 1 } },
          { new: true }
        )
      )
    );
    const ok = results.filter(Boolean).length;
    assert(ok === 1, `bắn 15 lệnh !diemdanh cùng lúc, lọt qua ${ok}/15 (mong đợi 1)`);
  }

  // ── 3. Trừ Linh Thạch: không thể tiêu quá số dư ──
  console.log(chalk.yellow(`\n[3] Trừ tài nguyên nguyên tử (spendResources)...`));
  {
    const u = await makeUser('spend_lt');           // có 10.000 LT
    const results = await Promise.all(
      Array.from({ length: 12 }, () => spendResources(u.userId, { linhThach: 1000 }))
    );
    const ok = results.filter(Boolean).length;
    const after = await User.findOne({ userId: u.userId }).lean();
    assert(ok === 10, `mua 12 lần x1.000 LT trên số dư 10.000, thành công ${ok}/12 (mong đợi 10)`);
    assert(after.currencies.linhThach === 0, `số dư cuối = ${after.currencies.linhThach} (mong đợi 0, không âm)`);
  }

  // ── 4. Trừ vật phẩm trong túi: không thể dùng nhiều hơn số đang có ──
  {
    const u = await makeUser('spend_item');         // có 10 Linh Thảo
    const results = await Promise.all(
      Array.from({ length: 8 }, () => spendResources(u.userId, { items: [{ itemId: 'linh_thao', quantity: 3 }] }))
    );
    const ok = results.filter(Boolean).length;
    const after = await User.findOne({ userId: u.userId }).lean();
    const left = (after.inventory.find(i => i.itemId === 'linh_thao') || { quantity: 0 }).quantity;
    assert(ok === 3, `luyện đan 8 lần x3 Linh Thảo trên 10 nhánh, thành công ${ok}/8 (mong đợi 3)`);
    assert(left === 1, `Linh Thảo còn lại = ${left} (mong đợi 1, không âm)`);
  }

  // ── 5. Trừ hỗn hợp tiền + nhiều loại vật phẩm cùng lúc ──
  {
    const u = await makeUser('spend_mix');
    const results = await Promise.all(
      Array.from({ length: 6 }, () => spendResources(u.userId, {
        linhThach: 2000,
        nguyenThach: 30,
        items: [{ itemId: 'linh_thao', quantity: 4 }, { itemId: 'yeu_dan_so_cap', quantity: 4 }]
      }))
    );
    const ok = results.filter(Boolean).length;
    const after = await User.findOne({ userId: u.userId }).lean();
    const herb = (after.inventory.find(i => i.itemId === 'linh_thao') || { quantity: 0 }).quantity;
    // Nút thắt chặt nhất là Nguyên Thạch: 100 / 30 = 3 lượt.
    assert(ok === 2, `đúc pháp bảo 6 lần (2.000 LT + 30 NT + 4+4 vật phẩm), thành công ${ok}/6 (mong đợi 2 — nút thắt là 10 Linh Thảo / 4)`);
    assert(after.currencies.linhThach >= 0 && after.currencies.nguyenThach >= 0 && herb >= 0,
      `mọi số dư đều không âm (LT ${after.currencies.linhThach}, NT ${after.currencies.nguyenThach}, Linh Thảo ${herb})`);
  }

  // ── 6. Cộng tiền song song không mất mát (lost update) ──
  console.log(chalk.yellow(`\n[4] Cộng tiền song song (grantCurrencies)...`));
  {
    const u = await makeUser('grant');              // bắt đầu 10.000 LT
    await Promise.all(Array.from({ length: 25 }, () => grantCurrencies(u.userId, { linhThach: 100 })));
    const after = await User.findOne({ userId: u.userId }).lean();
    assert(after.currencies.linhThach === 12500,
      `25 lần cộng 100 LT vào 10.000, kết quả ${after.currencies.linhThach} (mong đợi 12.500 — không mất lượt nào)`);
  }

  // ── 7. Nhiệm vụ tân thủ: một bước chỉ lĩnh thưởng được đúng một lần ──
  //
  // Đây là chỗ dễ in tiền nhất trong chuỗi: người chơi bấm nút 🎁 liên tiếp
  // vài nhịp là đủ nhận trùng nếu cổng chặn không nằm ngay trong lệnh ghi.
  console.log(chalk.yellow(`\n[5] Lĩnh thưởng nhiệm vụ tân thủ (claimTutorialReward)...`));
  {
    const q0 = TUTORIAL_QUESTS[0];
    const u = await makeUser('tutorial', {
      counters: { [q0.goal.key]: q0.goal.amount },
      currencies: { linhThach: 0, nguyenThach: 0 }
    });
    const results = await Promise.all(
      Array.from({ length: 15 }, () => claimTutorialReward(u.userId))
    );
    const ok = results.filter(r => r.ok).length;
    const after = await User.findOne({ userId: u.userId }).lean();
    assert(ok === 1, `bấm nút lĩnh thưởng 15 lần cùng lúc, lọt qua ${ok}/15 (mong đợi 1)`);
    assert(after.tutorial.step === 1, `bước hiện tại = ${after.tutorial.step} (mong đợi 1, không nhảy cóc)`);
    assert(after.currencies.linhThach === (q0.reward.linhThach || 0),
      `nhận đúng ${after.currencies.linhThach} LT (mong đợi ${q0.reward.linhThach || 0} — không nhân đôi)`);
  }

  // Điều kiện chưa đạt thì không lệnh nào lọt, kể cả bắn song song.
  {
    const u = await makeUser('tutorial_chua_du', { counters: { cultivate: 0 } });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => claimTutorialReward(u.userId))
    );
    const ok = results.filter(r => r.ok).length;
    const after = await User.findOne({ userId: u.userId }).lean();
    assert(ok === 0, `chưa đủ điều kiện, bắn 10 lệnh lọt qua ${ok}/10 (mong đợi 0)`);
    assert(after.tutorial.step === 0, `bước vẫn đứng yên ở ${after.tutorial.step} (mong đợi 0)`);
  }

  // Người đã tốt nghiệp bấm lại thì phải bị chặn, không được cộng thêm gì.
  {
    const u = await makeUser('tutorial_xong', {
      tutorial: { step: TUTORIAL_TOTAL, done: true },
      currencies: { linhThach: 0, nguyenThach: 0 }
    });
    const r = await claimTutorialReward(u.userId);
    const after = await User.findOne({ userId: u.userId }).lean();
    assert(!r.ok && r.reason === 'ALL_DONE', `người đã tốt nghiệp bị chặn (lý do: ${r.reason})`);
    assert(after.currencies.linhThach === 0, `không cộng thêm đồng nào (${after.currencies.linhThach} LT)`);
  }

  // ── 8. Cộng vật phẩm song song: một ngăn duy nhất, không mất lượt ──
  // Điểm gãy nằm ở vật phẩm CHƯA có trong túi: mọi lệnh cùng thấy "chưa có"
  // rồi cùng $push, đẻ ra nhiều ngăn trùng itemId. Từ đó về sau mọi phép cộng
  // và trừ chỉ chạm được ngăn đầu tiên, phần còn lại thành hàng ma trong túi.
  console.log(chalk.yellow(`\n[6] Cộng vật phẩm song song (grantItems)...`));
  {
    const u = await makeUser('grantitems');
    const MOI = { itemId: '__race_item_moi', name: 'Vật Phẩm Thử', type: 'NGUYEN_LIEU', quantity: 2 };

    await Promise.all(Array.from({ length: 12 }, () => grantItems(u.userId, [MOI])));
    const sau = await User.findOne({ userId: u.userId }).lean();
    const ngan = (sau.inventory || []).filter(i => i.itemId === MOI.itemId);

    assert(ngan.length === 1,
      `vật phẩm mới: 12 lệnh cùng lúc tạo ra ${ngan.length} ngăn (mong đợi 1, không trùng lặp)`);
    assert(ngan.length === 1 && ngan[0].quantity === 24,
      `vật phẩm mới: tổng số lượng ${ngan[0] ? ngan[0].quantity : 0} (mong đợi 24 — không mất lượt nào)`);

    // Vật phẩm đã có sẵn ngăn thì đi thẳng nhánh $inc, kiểm luôn cho đủ cặp.
    await Promise.all(Array.from({ length: 12 }, () => grantItems(u.userId, [{ itemId: 'linh_thao', name: 'Linh Thảo', quantity: 5 }])));
    const sau2 = await User.findOne({ userId: u.userId }).lean();
    const nganCu = (sau2.inventory || []).filter(i => i.itemId === 'linh_thao');
    assert(nganCu.length === 1 && nganCu[0].quantity === 70,
      `vật phẩm sẵn có: 10 + 12x5 = ${nganCu[0] ? nganCu[0].quantity : 0} trong ${nganCu.length} ngăn (mong đợi 70 trong 1 ngăn)`);

    // Đầu vào rác không được làm hỏng túi hay ném lỗi.
    await grantItems(u.userId, [{ itemId: 'xau', quantity: 0 }, { quantity: 5 }, null]);
    const sau3 = await User.findOne({ userId: u.userId }).lean();
    assert(sau3.inventory.length === sau2.inventory.length,
      `đầu vào rác (số lượng 0, thiếu itemId, null) bị bỏ qua, túi vẫn ${sau3.inventory.length} ngăn`);
  }

  // ── Dọn dẹp ──
  const del = await User.deleteMany({ userId: new RegExp('^' + PREFIX_ID) });
  console.log(chalk.gray(`\n🧹 Đã xoá ${del.deletedCount} nhân vật thử nghiệm.`));

  console.log(chalk.bold.magenta(`\n======================================================`));
  if (passed === total) {
    console.log(chalk.bold.green(`🎉 KẾT QUẢ: ${passed}/${total} PHÉP THỬ ĐẠT — không có đường nhân đôi nào lọt lưới!`));
  } else {
    console.log(chalk.bold.red(`❌ KẾT QUẢ: ${passed}/${total} PHÉP THỬ ĐẠT.`));
  }
  console.log(chalk.bold.magenta(`======================================================\n`));

  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(chalk.red(`\n💥 Lỗi khi chạy kiểm thử: ${err.message}`));
  await User.deleteMany({ userId: new RegExp('^' + PREFIX_ID) }).catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
