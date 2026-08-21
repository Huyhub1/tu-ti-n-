/**
 * KIỂM THỬ TRẦN GIỚI HẠN GIAO DIỆN DISCORD
 *
 * Discord từ chối payload (interaction "This interaction failed") khi vượt bất kỳ
 * trần cứng nào bên dưới. Các trần này không phải lỗi runtime của bot mà là lỗi
 * HTTP 400 từ API, nên không test nào khác bắt được — và chúng chỉ nổ khi người
 * chơi đã tích đủ nhiều đồ, tức là sau khi bot đã lên public.
 *
 *   • Embed: tối đa 25 field, description ≤ 4096, tổng ký tự ≤ 6000
 *   • Field: name ≤ 256, value ≤ 1024
 *   • Select menu: tối đa 25 option; label/description/value ≤ 100
 *   • Action row: tối đa 5 nút; mỗi message tối đa 5 row
 *
 * Bài test dựng một tu sĩ "béo phì" (nhiều gấp bội mức thực tế) rồi duyệt qua
 * mọi trang của từng khung giao diện để chắc chắn không khung nào vượt trần.
 */

import chalk from 'chalk';
import { createInventoryView } from '../src/commands/prefix/inventory.js';
import { createGearView } from '../src/commands/prefix/equipment.js';
import { createSkillsView, createSellSkillView } from '../src/commands/prefix/skills.js';
import { renderTanthuView } from '../src/commands/prefix/tutorial.js';
import { renderCapnhatView } from '../src/commands/prefix/capnhat.js';
import { TUTORIAL_QUESTS, TUTORIAL_TOTAL, rewardLine } from '../src/services/tutorialService.js';

const LIMITS = {
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  description: 4096,
  totalChars: 6000,
  selectOptions: 25,
  optionLabel: 100,
  optionDescription: 100,
  optionValue: 100,
  rowComponents: 5,
  messageRows: 5,
  // Discord CẮT CỤT customId dài quá 100 chứ không báo lỗi: nút hiện ra bình
  // thường nhưng bấm vào thì handler không nhận ra, thành nút chết câm.
  customId: 100
};

let errorCount = 0;
let checkCount = 0;

function fail(msg) {
  errorCount++;
  console.error(chalk.red(`  ❌ ${msg}`));
}

function checkView(label, view) {
  checkCount++;
  const data = view.embed.toJSON();

  const fields = data.fields || [];
  if (fields.length > LIMITS.fields) {
    fail(`${label}: ${fields.length} field (trần ${LIMITS.fields})`);
  }
  fields.forEach((f, i) => {
    if ((f.name || '').length > LIMITS.fieldName) {
      fail(`${label}: field #${i + 1} name dài ${f.name.length} ký tự (trần ${LIMITS.fieldName})`);
    }
    if ((f.value || '').length > LIMITS.fieldValue) {
      fail(`${label}: field #${i + 1} value dài ${f.value.length} ký tự (trần ${LIMITS.fieldValue})`);
    }
  });

  if ((data.description || '').length > LIMITS.description) {
    fail(`${label}: description dài ${data.description.length} ký tự (trần ${LIMITS.description})`);
  }

  const total =
    (data.title || '').length +
    (data.description || '').length +
    (data.footer?.text || '').length +
    (data.author?.name || '').length +
    fields.reduce((sum, f) => sum + (f.name || '').length + (f.value || '').length, 0);
  if (total > LIMITS.totalChars) {
    fail(`${label}: tổng ${total} ký tự trong embed (trần ${LIMITS.totalChars})`);
  }

  const rows = view.components || [];
  if (rows.length > LIMITS.messageRows) {
    fail(`${label}: ${rows.length} action row (trần ${LIMITS.messageRows})`);
  }
  rows.forEach((row, ri) => {
    const rowData = row.toJSON();
    const comps = rowData.components || [];
    const isSelect = comps.some(c => c.type === 3);

    if (!isSelect && comps.length > LIMITS.rowComponents) {
      fail(`${label}: row #${ri + 1} có ${comps.length} nút (trần ${LIMITS.rowComponents})`);
    }
    if (isSelect && comps.length !== 1) {
      fail(`${label}: row #${ri + 1} chứa select menu nhưng có ${comps.length} thành phần (phải đúng 1)`);
    }

    for (const c of comps) {
      if ((c.custom_id || '').length > LIMITS.customId) {
        fail(`${label}: customId dài ${c.custom_id.length} ký tự (trần ${LIMITS.customId})`);
      }
      if (c.type !== 3) continue;
      const opts = c.options || [];
      if (opts.length > LIMITS.selectOptions) {
        fail(`${label}: select menu có ${opts.length} lựa chọn (trần ${LIMITS.selectOptions})`);
      }
      if (opts.length === 0) {
        fail(`${label}: select menu rỗng — Discord từ chối menu không có lựa chọn nào`);
      }
      opts.forEach((o, oi) => {
        if ((o.label || '').length > LIMITS.optionLabel) {
          fail(`${label}: option #${oi + 1} label dài ${o.label.length} (trần ${LIMITS.optionLabel})`);
        }
        if ((o.description || '').length > LIMITS.optionDescription) {
          fail(`${label}: option #${oi + 1} description dài ${o.description.length} (trần ${LIMITS.optionDescription})`);
        }
        if ((o.value || '').length > LIMITS.optionValue) {
          fail(`${label}: option #${oi + 1} value dài ${o.value.length} (trần ${LIMITS.optionValue})`);
        }
      });
      const values = opts.map(o => o.value);
      if (new Set(values).size !== values.length) {
        fail(`${label}: select menu có value trùng nhau — Discord từ chối payload này`);
      }
    }
  });
}

// Tên dài hết cỡ để ép các .slice() phải làm việc thật.
const LONG = 'Thái Thượng Vong Tình Thiên Ma Diệt Thế Hỗn Độn Chí Tôn Đại La Kim Tiên Quyết ' .repeat(4);

function makeFatUser(size) {
  return {
    userId: '123456789012345678',
    username: LONG,
    daoName: LONG,
    currencies: { linhThach: 999999999, nguyenThach: 999999, congDuc: 0, taTam: 0 },
    stats: { hp: 99999, maxHp: 99999, atk: 9999, def: 9999 },
    inventory: Array.from({ length: size }, (_, i) => ({
      itemId: `item_${i}`,
      name: `${LONG} ${i}`,
      type: i % 3 === 0 ? 'DAN_DUOC' : i % 3 === 1 ? 'NGUYEN_LIEU' : 'KHAC',
      quantity: 999,
      desc: LONG
    })),
    equipments: Array.from({ length: size }, (_, i) => ({
      gearId: `gear_${i}`,
      name: `${LONG} ${i}`,
      rarityName: 'Thần Khí',
      rarity: 'THAN',
      slot: i % 2 === 0 ? 'weapon' : 'accessory',
      equipped: i < 2,
      enhanceLevel: 15,
      stats: { atk: 9999, def: 9999, maxHp: 99999, critRate: 0.5 },
      combatSkill: { name: LONG, desc: LONG }
    })),
    skills: Array.from({ length: size }, (_, i) => ({
      name: `${LONG} ${i}`,
      rarity: 'THIEN',
      category: LONG,
      mastery: 100,
      equipped: i < 4
    }))
  };
}

console.log(chalk.bold.cyan(`\n🧪 KIỂM THỬ TRẦN GIỚI HẠN GIAO DIỆN DISCORD\n`));

// 0 = túi rỗng (nhánh early-return), 1 = một trang, 200 = nhiều hơn bất kỳ
// người chơi thật nào, đủ để lộ mọi lỗi phân trang.
for (const size of [0, 1, 7, 25, 200]) {
  const user = makeFatUser(size);
  console.log(chalk.yellow(`[Tu sĩ với ${size} vật phẩm / ${size} pháp bảo / ${size} bí kíp]`));

  const views = [
    ['Túi Càn Khôn', createInventoryView, size],
    ['Kho Pháp Bảo', createGearView, size],
    ['Tàng Kinh Các', createSkillsView, size],
    ['Menu Bán Bí Kíp', createSellSkillView, size]
  ];

  for (const [name, factory] of views) {
    // Menu bán chỉ mở khi có ít nhất 1 bí kíp (buttonHandler chặn trước đó),
    // nên bỏ qua trường hợp rỗng thay vì bắt nó dựng select menu trống.
    if (name === 'Menu Bán Bí Kíp' && size === 0) continue;

    const first = factory(user, 1);
    const totalPages = first.totalPages;
    for (let p = 1; p <= totalPages; p++) {
      checkView(`${name} trang ${p}/${totalPages}`, factory(user, p));
    }
    // Trang ngoài biên phải được kẹp lại chứ không được ném lỗi hay trả trang rỗng.
    for (const bad of [0, -5, totalPages + 10, NaN, undefined]) {
      const v = factory(user, bad);
      if (v.page < 1 || v.page > totalPages) {
        fail(`${name}: trang ${bad} bị kẹp thành ${v.page}, ngoài khoảng 1..${totalPages}`);
      }
      checkView(`${name} trang ngoài biên (${bad})`, v);
    }
    console.log(chalk.green(`  ✅ ${name}: ${totalPages} trang, mọi trang trong giới hạn`));
  }
}


// ── Màn hình chuỗi nhiệm vụ tân thủ ──
// Khung này không phân trang nên không nằm trong vòng lặp ở trên, nhưng nó có
// hai thứ riêng cần soi: dòng thông báo chèn thêm sau khi lĩnh thưởng (làm
// description dài ra), và customId của nút có nhét userId vào bên trong.
console.log(chalk.yellow(`[Chuỗi nhiệm vụ tân thủ]`));
{
  const SNOWFLAKE = '999999999999999999';
  const tanThu = (step) => ({
    userId: SNOWFLAKE,
    username: 'TuSi',
    daoName: LONG,                       // đạo hiệu dài hết cỡ, ép tiêu đề nở ra
    tutorial: { step, done: step >= TUTORIAL_TOTAL },
    counters: {},
    equipments: [],
    skills: [],
    realm: { id: 'pham_nhan', name: 'Phàm Nhân', layer: 1 },
    dailyCheckIn: { streak: 0 }
  });

  for (let step = 0; step <= TUTORIAL_TOTAL; step++) {
    const q = TUTORIAL_QUESTS[step];
    // Dòng thông báo dài nhất có thể: đúng cái sinh ra sau khi bấm lĩnh thưởng.
    const notice = q
      ? `🎁 **Đã lĩnh thưởng [${q.title}]:** ${rewardLine(q.reward)}\n\n`
      : `🎓 **HOÀN THÀNH BƯỚC CUỐI!**\n\n`;

    for (const [nhan, bao] of [['không', ''], ['có', notice]]) {
      const payload = renderTanthuView(tanThu(step), bao);
      if (!payload.embeds) {
        fail(`Tân thủ bước ${step}: không dựng được embed`);
        continue;
      }
      checkView(`Tân thủ bước ${step}/${TUTORIAL_TOTAL} (${nhan} lời báo)`, {
        embed: payload.embeds[0],
        components: payload.components
      });
    }
  }

  // Không có nhân vật thì phải ra {content}, không được ném lỗi.
  const rong = renderTanthuView(null);
  if (!rong.content) fail('Tân thủ: người chưa có nhân vật lẽ ra phải nhận {content}');

  console.log(chalk.green(`  ✅ Chuỗi tân thủ: ${TUTORIAL_TOTAL + 1} bước x 2 biến thể, mọi khung trong giới hạn`));
}

// ── Màn hình !capnhat ──
// Khung này khác mọi khung còn lại ở một điểm: gần như toàn bộ nội dung của nó
// đến từ BÊN NGOÀI — chú thích commit, tên người đẩy, danh sách file đang sửa
// dở, tên nhánh trong .env. Không thứ nào có trần ký tự. Một chú thích commit
// dài dòng là đủ để lệnh chết, và nó chết đúng lúc người ta cần nó nhất: khi
// đang muốn biết vì sao bot không lên bản mới.
console.log(chalk.yellow(`[Thiên Cơ Các — màn hình !capnhat]`));
{
  const khoDay = (sach) => ({
    laKho: true,
    nhanh: LONG,
    commit: 'a'.repeat(40),
    ngan: 'aaaaaaa',
    chuThich: LONG,
    nguoi: LONG,
    luc: new Date().toISOString(),
    sach,
    banBan: Array.from({ length: 40 }, (_, i) => ` M ${LONG}/so-${i}.js`)
  });

  const tinDay = (coMoi, cachLy) => ({
    coMoi,
    soCommit: coMoi ? 30 : 0,
    dich: `origin/${LONG}`,
    lyDo: LONG,
    danhSach: Array.from({ length: 30 }, (_, i) => `abc123${i} ${LONG}`),
    biCachLy: cachLy ? { commit: 'b'.repeat(40), lyDo: LONG, luc: new Date().toISOString() } : null
  });

  const chDay = (bat) => ({ bat, phutMoiLan: 1440, remote: LONG, nhanh: LONG });
  const BAN_RON_DAY = { tong: 999, chiTiet: Array.from({ length: 30 }, (_, i) => ({ ten: `${LONG}-${i}`, so: 33 })) };

  let soKhung = 0;
  for (const sach of [true, false]) {
    for (const coMoi of [true, false]) {
      for (const cachLy of [true, false]) {
        for (const giamSat of [true, false]) {
          for (const daRaHieu of [true, false]) {
            for (const daXoaCachLy of [true, false]) {
              for (const batTuDong of [true, false]) {
                // Sổ bận rộn thêm một ô nữa vào embed đúng lúc nó đã đầy nhất
                // (sắp kéo + đang cách ly + cây bẩn), nên phải quét cả hai
                // trạng thái chứ không chỉ lúc vắng người.
                for (const banRon of [null, BAN_RON_DAY]) {
                const nhan = `capnhat sach=${sach} moi=${coMoi} cachly=${cachLy} ` +
                  `giamsat=${giamSat} rahieu=${daRaHieu} goCachLy=${daXoaCachLy} tudong=${batTuDong} ` +
                  `banron=${banRon ? banRon.tong : 0}`;
                let payload;
                try {
                  payload = renderCapnhatView(khoDay(sach), tinDay(coMoi, cachLy), chDay(batTuDong),
                    { daRaHieu, giamSat, daXoaCachLy, banRon });
                } catch (e) {
                  fail(`${nhan}: ném lỗi khi dựng — ${e.message}`);
                  continue;
                }
                if (!payload.embeds) { fail(`${nhan}: không dựng được embed`); continue; }
                checkView(nhan, { embed: payload.embeds[0], components: payload.components });
                soKhung++;
                }
              }
            }
          }
        }
      }
    }
  }

  // Thư mục không phải kho git: phải trả {content} chứ không được ném lỗi.
  const khongKho = renderCapnhatView({ laKho: false, lyDo: LONG }, null, chDay(true), {});
  if (!khongKho.content) fail('Thiên Cơ Các: thư mục không phải kho git lẽ ra phải nhận {content}');
  if ((khongKho.content || '').length > 2000) {
    fail(`Thiên Cơ Các: nội dung ${khongKho.content.length} ký tự, vượt trần 2000 của một tin nhắn`);
  }

  console.log(chalk.green(`  ✅ Thiên Cơ Các: ${soKhung} tổ hợp trạng thái, mọi khung trong giới hạn`));
}

console.log('');
if (errorCount === 0) {
  console.log(chalk.bold.green(`✅ HOÀN TẤT: ${checkCount} khung giao diện, không khung nào vượt trần Discord.\n`));
  process.exit(0);
} else {
  console.log(chalk.bold.red(`❌ PHÁT HIỆN ${errorCount} LỖI trên ${checkCount} khung giao diện.\n`));
  process.exit(1);
}
