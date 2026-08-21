/**
 * KIỂM THỬ CHUỖI NHIỆM VỤ TÂN THỦ
 *
 * Chuỗi này là thứ đầu tiên người chơi mới chạm vào, nên một bước hỏng là mất
 * luôn người đó — họ không có gì để so sánh và sẽ kết luận là bot lỗi.
 *
 * Bộ này khoá lại ba nhóm rủi ro:
 *  · config lệch code — điều kiện gõ sai kiểu, hint trỏ tới lệnh không tồn tại;
 *  · tính tiến độ sai — nhất là nhánh cảnh giới, chỗ duy nhất không đếm số;
 *  · phát thưởng hớ — bước chưa xong mà đã coi là xong.
 *
 * Không đụng tới CSDL: claimTutorialReward() cần Mongo nên phần nguyên tử của
 * nó thuộc về tests/testRaceConditions.js.
 */

import {
  TUTORIAL_QUESTS,
  TUTORIAL_TOTAL,
  tutorialStep,
  isTutorialDone,
  currentQuest,
  progressOf,
  isClaimable,
  rewardLine,
  tutorialNudge
} from '../src/services/tutorialService.js';
import { KNOWN_COMMANDS } from '../src/handlers/commandHandler.js';

let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

function eq(got, want, label) {
  if (got === want) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label} — nhận ${JSON.stringify(got)}, mong đợi ${JSON.stringify(want)}`); }
}

/** Tu sĩ giả lập: mọi trường điều kiện đều có mặt để progressOf không phải đoán. */
function fakeUser(over = {}) {
  return {
    userId: 'test',
    username: 'Test',
    realm: { id: 'pham_nhan', layer: 1 },
    counters: { cultivate: 0, work: 0, mining: 0, hunt: 0, pill: 0 },
    dailyCheckIn: { streak: 0 },
    equipments: [],
    skills: [],
    tutorial: { step: 0, done: false },
    ...over
  };
}

console.log('\n📜 KIỂM THỬ CHUỖI NHIỆM VỤ TÂN THỦ\n');

// ── [1] Toàn vẹn cấu hình ───────────────────────────────────────────────────
console.log('[1] Toàn vẹn tutorialQuests.json:');
eq(TUTORIAL_TOTAL, TUTORIAL_QUESTS.length, 'TUTORIAL_TOTAL khớp số bước thật');
ok(TUTORIAL_TOTAL >= 8 && TUTORIAL_TOTAL <= 12, `số bước nằm trong khoảng hợp lý (${TUTORIAL_TOTAL})`);

const ids = TUTORIAL_QUESTS.map(q => q.id);
eq(new Set(ids).size, ids.length, 'không có id trùng');

const KNOWN_GOALS = ['counter', 'checkInStreak', 'equippedGear', 'skillCount', 'realmAtLeast', 'layerAtLeast'];
const badGoal = TUTORIAL_QUESTS.filter(q => !KNOWN_GOALS.includes(q.goal && q.goal.type));
eq(badGoal.length, 0, 'mọi goal.type đều nằm trong số kiểu progressOf xử lý được');

const COUNTER_KEYS = ['cultivate', 'work', 'mining', 'hunt', 'pill'];
const badCounter = TUTORIAL_QUESTS.filter(q => q.goal.type === 'counter' && !COUNTER_KEYS.includes(q.goal.key));
eq(badCounter.length, 0, 'mọi goal counter đều trỏ vào một bộ đếm có thật trong schema');

const missingField = TUTORIAL_QUESTS.filter(q => !q.title || !q.desc || !q.hint || !q.reward);
eq(missingField.length, 0, 'không bước nào thiếu title/desc/hint/reward');

const emptyReward = TUTORIAL_QUESTS.filter(q => rewardLine(q.reward) === '—');
eq(emptyReward.length, 0, 'không bước nào thưởng rỗng');

// Hint gõ sai là lỗi câm: người mới làm theo rồi bot báo "không có lệnh này".
const hintCommands = [...new Set(
  TUTORIAL_QUESTS.flatMap(q => (q.hint.match(/![a-z0-9]+/gi) || []).map(t => t.slice(1).toLowerCase()))
)];
const unknownHints = hintCommands.filter(c => !KNOWN_COMMANDS.includes(c));
eq(unknownHints.length, 0, `mọi lệnh nhắc trong hint đều có thật (${hintCommands.length} lệnh được nhắc)`);

const totalLT = TUTORIAL_QUESTS.reduce((a, q) => a + (q.reward.linhThach || 0), 0);
ok(totalLT >= 500, `tổng thưởng ${totalLT.toLocaleString()} LT, dư sức lập tông môn 500 LT sau khi tốt nghiệp`);

// ── [2] Đếm bước và chặn dữ liệu lệch ───────────────────────────────────────
console.log('\n[2] tutorialStep kẹp giá trị ngoài biên:');
eq(tutorialStep(fakeUser()), 0, 'người mới ở bước 0');
eq(tutorialStep(fakeUser({ tutorial: { step: -5 } })), 0, 'step âm bị kẹp về 0');
eq(tutorialStep(fakeUser({ tutorial: { step: 999 } })), TUTORIAL_TOTAL, 'step vượt trần bị kẹp về tổng số bước');
eq(tutorialStep({}), 0, 'tu sĩ thiếu hẳn trường tutorial vẫn ra 0');
ok(!isTutorialDone(fakeUser()), 'người mới chưa tốt nghiệp');
ok(isTutorialDone(fakeUser({ tutorial: { step: TUTORIAL_TOTAL } })), 'đi hết chuỗi là tốt nghiệp');
eq(currentQuest(fakeUser({ tutorial: { step: TUTORIAL_TOTAL } })), null, 'tốt nghiệp thì không còn bước hiện tại');
eq(currentQuest(fakeUser()).id, TUTORIAL_QUESTS[0].id, 'bước hiện tại của người mới là bước đầu tiên');

// ── [3] Tính tiến độ từng kiểu điều kiện ────────────────────────────────────
console.log('\n[3] progressOf theo từng kiểu điều kiện:');
const qCounter = { goal: { type: 'counter', key: 'work', amount: 3 } };
eq(progressOf(fakeUser({ counters: { work: 0 } }), qCounter).done, false, 'counter 0/3 chưa xong');
eq(progressOf(fakeUser({ counters: { work: 2 } }), qCounter).label, '2/3', 'counter 2/3 hiện đúng nhãn');
eq(progressOf(fakeUser({ counters: { work: 3 } }), qCounter).done, true, 'counter 3/3 là xong');
eq(progressOf(fakeUser({ counters: { work: 99 } }), qCounter).label, '3/3', 'counter dư không hiện quá mục tiêu');

const qStreak = { goal: { type: 'checkInStreak', amount: 1 } };
eq(progressOf(fakeUser({ dailyCheckIn: { streak: 0 } }), qStreak).done, false, 'chưa điểm danh thì chưa xong');
eq(progressOf(fakeUser({ dailyCheckIn: { streak: 1 } }), qStreak).done, true, 'điểm danh 1 ngày là xong');

const qGear = { goal: { type: 'equippedGear', amount: 1 } };
eq(progressOf(fakeUser({ equipments: [{ equipped: false }] }), qGear).done, false, 'có pháp bảo nhưng chưa mặc thì chưa xong');
eq(progressOf(fakeUser({ equipments: [{ equipped: true }] }), qGear).done, true, 'mặc 1 pháp bảo là xong');

const qSkill = { goal: { type: 'skillCount', amount: 2 } };
eq(progressOf(fakeUser({ skills: [{}] }), qSkill).done, false, '1 công pháp chưa đủ 2');
eq(progressOf(fakeUser({ skills: [{}, {}] }), qSkill).done, true, '2 công pháp là đủ');

const qRealm = { goal: { type: 'realmAtLeast', realmId: 'luyen_khi' } };
eq(progressOf(fakeUser({ realm: { id: 'pham_nhan', layer: 9 } }), qRealm).done, false, 'Phàm Nhân tầng 9 vẫn chưa vào Luyện Khí');
eq(progressOf(fakeUser({ realm: { id: 'luyen_khi', layer: 1 } }), qRealm).done, true, 'Luyện Khí tầng 1 là đạt');
eq(progressOf(fakeUser({ realm: { id: 'kim_dan', layer: 1 } }), qRealm).done, true, 'cảnh giới cao hơn cũng tính là đạt');

const qLayer = { goal: { type: 'layerAtLeast', realmId: 'luyen_khi', amount: 5 } };
eq(progressOf(fakeUser({ realm: { id: 'luyen_khi', layer: 4 } }), qLayer).done, false, 'Luyện Khí tầng 4 chưa đủ tầng 5');
eq(progressOf(fakeUser({ realm: { id: 'luyen_khi', layer: 5 } }), qLayer).done, true, 'Luyện Khí tầng 5 là đủ');
eq(progressOf(fakeUser({ realm: { id: 'truc_co', layer: 1 } }), qLayer).done, true, 'Trúc Cơ tầng 1 vượt Luyện Khí tầng 5');

// Gõ sai trong JSON phải làm nhiệm vụ đứng lại, chứ không phải phát thưởng.
eq(progressOf(fakeUser(), { goal: { type: 'kieu_la' } }).done, false, 'goal.type lạ thì coi như CHƯA đạt (ngả về phía an toàn)');

// ── [4] Điều kiện lĩnh thưởng ───────────────────────────────────────────────
console.log('\n[4] isClaimable bám đúng bước hiện tại:');
const q0 = TUTORIAL_QUESTS[0];
ok(q0.goal.type === 'counter' && q0.goal.key === 'cultivate', 'bước 1 là tu luyện (giả định của các phép dưới đây)');
ok(!isClaimable(fakeUser()), 'người mới tinh chưa lĩnh được gì');
ok(isClaimable(fakeUser({ counters: { cultivate: q0.goal.amount } })), 'tu luyện đủ số lượt thì lĩnh được bước 1');
// Đây là bẫy dễ sập nhất: đủ điều kiện bước 1 nhưng ĐANG đứng ở bước 2.
ok(!isClaimable(fakeUser({ counters: { cultivate: 99 }, tutorial: { step: 1 } })),
   'đã lĩnh bước 1 rồi thì điều kiện bước 1 không mở khoá bước 2');
ok(!isClaimable(fakeUser({ tutorial: { step: TUTORIAL_TOTAL } })), 'người tốt nghiệp không lĩnh thêm được');

// ── [5] Dòng nhắc gắn dưới lệnh cày ─────────────────────────────────────────
console.log('\n[5] tutorialNudge chỉ lên tiếng đúng lúc:');
eq(tutorialNudge(fakeUser()), '', 'chưa đủ điều kiện thì im lặng');
eq(tutorialNudge(fakeUser({ tutorial: { step: TUTORIAL_TOTAL } })), '', 'tốt nghiệp rồi thì im lặng vĩnh viễn');
const nudge = tutorialNudge(fakeUser({ counters: { cultivate: q0.goal.amount } }));
ok(nudge.includes(q0.title), 'đủ điều kiện thì nhắc, kèm tên bước');
ok(nudge.includes('!tanthu'), 'dòng nhắc chỉ rõ lệnh cần gõ');
ok(nudge.length < 200, `dòng nhắc đủ ngắn để không lấn kết quả lệnh (${nudge.length} ký tự)`);

// ── [6] Không bước nào vượt trần hiển thị của Discord ───────────────────────
console.log('\n[6] Độ dài chuỗi hiển thị:');
const tooLong = TUTORIAL_QUESTS.filter(q => `${q.title}${q.desc}${q.hint}${rewardLine(q.reward)}`.length > 1000);
eq(tooLong.length, 0, 'không bước nào dài quá 1000 ký tự khi ghép vào mô tả embed');

console.log('\n======================================================');
if (fail === 0) {
  console.log(`🎉 HOÀN TẤT: ${pass}/${pass} phép kiểm thử chuỗi tân thủ đều đúng.`);
} else {
  console.error(`⚠️ THẤT BẠI: ${fail} phép sai trên tổng ${pass + fail}.`);
}
console.log('======================================================\n');

process.exit(fail === 0 ? 0 : 1);
