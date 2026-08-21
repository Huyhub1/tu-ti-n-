/**
 * CHUỖI NHIỆM VỤ TÂN THỦ
 *
 * Người mới vào không có gì để bám: `!nhiemvubang` khoá sau một tông môn giá
 * 500 Linh Thạch, mà 500 LT thì phải cày mù mịt mới có. Chuỗi này là cái thang
 * bắc qua khoảng trống đó — mười bước dắt tay qua đúng mười cơ chế cốt lõi và
 * trả tổng cộng hơn 7000 LT, đủ để bước ra khỏi chuỗi là lập được bang ngay.
 *
 * Nội dung từng bước nằm ở src/config/tutorialQuests.json chứ không nằm trong
 * code, để cân bằng lại phần thưởng hay đảo thứ tự không phải đụng tới file này.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../database/models/User.js';
import { grantItems } from './economyService.js';
import { userRank, powerRank, realmDisplayName } from '../utils/power.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/tutorialQuests.json'), 'utf8')
);

export const TUTORIAL_QUESTS = questConfig.quests;
export const TUTORIAL_TOTAL = TUTORIAL_QUESTS.length;

/** Số bước đã nhận thưởng, kẹp lại trong [0, TUTORIAL_TOTAL] phòng dữ liệu cũ lệch. */
export function tutorialStep(user) {
  const raw = user?.tutorial?.step || 0;
  return Math.min(Math.max(raw, 0), TUTORIAL_TOTAL);
}

export function isTutorialDone(user) {
  return tutorialStep(user) >= TUTORIAL_TOTAL;
}

/** Bước đang làm dở, hoặc null nếu đã tốt nghiệp. */
export function currentQuest(user) {
  const step = tutorialStep(user);
  return step >= TUTORIAL_TOTAL ? null : TUTORIAL_QUESTS[step];
}

/**
 * Tiến độ của một bước: `{ current, target, done, label }`.
 *
 * `label` là chuỗi in ra cho người chơi. Với điều kiện đếm số thì nó là "2/3",
 * còn với điều kiện cảnh giới thì con số thô vô nghĩa nên in thẳng tên cảnh giới.
 */
export function progressOf(user, quest) {
  const goal = quest?.goal || {};

  switch (goal.type) {
    case 'counter': {
      const target = goal.amount || 1;
      const current = Math.min(user?.counters?.[goal.key] || 0, target);
      return { current, target, done: current >= target, label: `${current}/${target}` };
    }
    case 'checkInStreak': {
      const target = goal.amount || 1;
      const current = Math.min(user?.dailyCheckIn?.streak || 0, target);
      return { current, target, done: current >= target, label: `${current}/${target} ngày` };
    }
    case 'equippedGear': {
      const target = goal.amount || 1;
      const current = Math.min((user?.equipments || []).filter(e => e.equipped).length, target);
      return { current, target, done: current >= target, label: `${current}/${target} món đang mặc` };
    }
    case 'skillCount': {
      const target = goal.amount || 1;
      const current = Math.min((user?.skills || []).length, target);
      return { current, target, done: current >= target, label: `${current}/${target} công pháp` };
    }
    case 'realmAtLeast':
    case 'layerAtLeast': {
      // Cả hai dùng chung một phép so: quy cảnh giới + tầng về một số duy nhất.
      // 'realmAtLeast' chỉ cần đặt chân vào cảnh giới nên mặc định tầng 1.
      const needLayer = goal.type === 'layerAtLeast' ? (goal.amount || 1) : 1;
      const need = powerRank(goal.realmId, needLayer);
      const have = userRank(user);
      const needLabel = needLayer > 1
        ? `${realmDisplayName(goal.realmId)} Tầng ${needLayer}`
        : realmDisplayName(goal.realmId);
      const haveLabel = `${realmDisplayName(user?.realm?.id)} Tầng ${user?.realm?.layer || 1}`;
      return { current: have, target: need, done: have >= need, label: `${haveLabel} / cần ${needLabel}` };
    }
    default:
      // Kiểu điều kiện lạ (config gõ sai) thì coi như CHƯA đạt. Nếu mặc định
      // ngược lại, một lỗi chính tả trong JSON sẽ phát không cả chuỗi phần thưởng.
      return { current: 0, target: 1, done: false, label: '—' };
  }
}

/** Bước hiện tại đã đủ điều kiện bấm nhận thưởng chưa? */
export function isClaimable(user) {
  const quest = currentQuest(user);
  return !!quest && progressOf(user, quest).done;
}

/** Mô tả phần thưởng thành một dòng chữ: "100 Linh Thạch · 2 Linh Thảo". */
export function rewardLine(reward = {}) {
  const parts = [];
  if (reward.linhThach) parts.push(`💰 ${reward.linhThach.toLocaleString()} Linh Thạch`);
  if (reward.nguyenThach) parts.push(`💠 ${reward.nguyenThach.toLocaleString()} Nguyên Thạch`);
  for (const it of reward.items || []) parts.push(`🎁 ${it.quantity}x ${it.name}`);
  return parts.join(' · ') || '—';
}

/**
 * Nhận thưởng bước hiện tại.
 *
 * Chống nhận hai lần bằng đúng một thứ: bộ lọc `'tutorial.step': step` trong
 * findOneAndUpdate. Hai cú bấm cùng lúc thì cú sau không còn khớp bộ lọc nữa
 * (step đã +1) nên trả về null — không cần khoá, không cần cờ đang-xử-lý.
 *
 * Trả về `{ ok: true, quest, reward, user, graduated }` hoặc `{ ok: false, reason }`.
 */
export async function claimTutorialReward(userId) {
  const before = await User.findOne({ userId });
  if (!before) return { ok: false, reason: 'NO_CHARACTER' };
  if (isTutorialDone(before)) return { ok: false, reason: 'ALL_DONE' };

  const step = tutorialStep(before);
  const quest = TUTORIAL_QUESTS[step];
  const progress = progressOf(before, quest);
  if (!progress.done) return { ok: false, reason: 'NOT_YET', quest, progress };

  const reward = quest.reward || {};
  const inc = { 'tutorial.step': 1 };
  if (reward.linhThach) inc['currencies.linhThach'] = reward.linhThach;
  if (reward.nguyenThach) inc['currencies.nguyenThach'] = reward.nguyenThach;

  const graduated = step + 1 >= TUTORIAL_TOTAL;
  const update = { $inc: inc };
  if (graduated) update.$set = { 'tutorial.done': true };

  const claimed = await User.findOneAndUpdate(
    { userId, 'tutorial.step': step },
    update,
    { new: true }
  );
  // Null nghĩa là có cú bấm khác vừa nhận xong bước này trong tích tắc vừa rồi.
  if (!claimed) return { ok: false, reason: 'RACED' };

  // Vật phẩm phải cộng ở bước hai vì $inc không biết cộng vào phần tử nào của
  // mảng khi chưa rõ nó đã tồn tại hay chưa. Bước một đã chốt quyền nhận rồi
  // nên ở đây không còn nguy cơ nhân đôi, chỉ là ghi nốt vào túi.
  //
  // Cố tình KHÔNG `save()` cái document vừa nhận về: `save()` kiểm tra hợp lệ
  // toàn bộ document, nên một bản ghi cũ hỏng ở chỗ khác cũng đủ làm cú cộng
  // vật phẩm ném lỗi — mà lúc đó Linh Thạch đã trao và bước đã tiêu rồi.
  let ketQua = claimed;
  if ((reward.items || []).length) {
    const sauKhiNhan = await grantItems(userId, reward.items);
    if (sauKhiNhan) ketQua = sauKhiNhan;
  }

  return { ok: true, quest, reward, user: ketQua, graduated };
}

/**
 * Một dòng nhắc gắn dưới kết quả các lệnh cày cuốc.
 *
 * Chỉ hiện khi bước hiện tại vừa đủ điều kiện — nhắc suốt cả chuỗi thì thành
 * rác màn hình, mà im hẳn thì người chơi quên mất là mình có thưởng chưa lấy.
 * Trả về chuỗi rỗng cho người đã tốt nghiệp.
 */
export function tutorialNudge(user) {
  const quest = currentQuest(user);
  if (!quest) return '';
  if (!progressOf(user, quest).done) return '';
  return `\n\n🎉 **Nhiệm vụ [${quest.title}] đã hoàn thành!** Gõ \`!tanthu\` để nhận ${rewardLine(quest.reward)}.`;
}
