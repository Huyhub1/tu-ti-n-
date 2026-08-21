import { execute as startSlash } from '../commands/slash/start.js';
import { execute as helpSlash, createHelpOverviewEmbed, createHelpSelectMenuRow } from '../commands/slash/help.js';
import { execute as profilePrefix } from '../commands/prefix/profile.js';
import { executeTuluyen, executeDotpha } from '../commands/prefix/cultivate.js';

import { executeTangkinhcac, executeLuyencong, executeDunghop, executeKichhoat } from '../commands/prefix/skills.js';
import { executeLamcong } from '../commands/prefix/work.js';

import { executeChotroi, executeBan, executeBandan, executeMua, executeHuyban } from '../commands/prefix/market.js';
import { executeLuyendan, executeUongdan } from '../commands/prefix/alchemy.js';
import { executeKhieuchien } from '../commands/prefix/pvp.js';
import { executeDaokhoang } from '../commands/prefix/mining.js';
import { executeDothach } from '../commands/prefix/dothach.js';
import { executeSanthu } from '../commands/prefix/hunting.js';
import { executePhoban } from '../commands/prefix/dungeon.js';
import { executeTuido } from '../commands/prefix/inventory.js';
import { executeDucphapbao } from '../commands/prefix/crafting.js';
import { executePhapbao } from '../commands/prefix/equipment.js';
import { executeLaptongmon, executeTongmon, executeMoivaobang, executeConghien, executeNhiemvubang, executeKhuctruc, executePhongchuc, executeBxhtongmon } from '../commands/prefix/sect.js';
import { executeAdmin } from '../commands/prefix/admin.js';
import { executeCapnhat } from '../commands/prefix/capnhat.js';
import { executeBaovat, executeXemphapbao } from '../commands/prefix/baovat.js';
import { executeTop } from '../commands/prefix/top.js';
import { executeDokiep } from '../commands/prefix/dokiep.js';
import { executeDiemdanh } from '../commands/prefix/daily.js';
import { executeTanthu } from '../commands/prefix/tutorial.js';
import { User } from '../database/models/User.js';

// Danh sách mọi bí danh lệnh, dùng để gợi ý khi người chơi gõ sai.
// `npm run audit` đối chiếu mảng này với các nhánh `case` bên dưới, nên
// thêm lệnh mới mà quên khai báo ở đây là bộ kiểm thử báo lỗi ngay.
export const KNOWN_COMMANDS = [
  'top', 'bxh', 'leaderboard', 'bangxephang', 'xephang',
  'admin', 'adm', 'thiendao',
  'capnhat', 'update', 'phienban', 'version',
  'baovat', 'phapbaolist', 'traphapbao', 'thuvienphapbao', 'tangbaocac', 'itemlist', 'gears', 'danhsachphapbao',
  'xemphapbao', 'xembaovat', 'viewgear', 'iteminfo', 'xemitem', 'infogear',
  'help', 'huongdan',
  'tupan', 'profile', 'status',
  'phapbao', 'trangbi', 'gear', 'vukhi',
  'ducphapbao', 'luyenkhi', 'craft', 'ren',
  'tuido', 'bag', 'tui', 'cankhon',
  'diemdanh', 'daily', 'boique', 'rutque', 'thienmenh', 'que',
  'tuluyen', 'cultivate', 'bequan',
  'dotpha', 'break', 'breakthrough',
  'dokiep', 'thienkiep', 'loikiep', 'tribulation',
  'santhu', 'hunt', 'tranyeu',
  'phoban', 'dungeon', 'bicanh', 'choden',
  'tangkinhcac', 'skills', 'bikip', 'kho',
  'kichhoat', 'trangbicongphap', 'dungcongphap', 'setskill', 'equipskill',
  'luyencong', 'train', 'dunghop', 'fuse',
  'lamcong', 'work', 'kiemtien',
  'daokhoang', 'mine', 'khaiquang',
  'dothach', 'catda', 'cucuoc',
  'chotroi', 'market', 'cho',
  'ban', 'sell', 'bandan', 'selldan',
  'mua', 'buy', 'huyban', 'thuhoi', 'unlist',
  'luyendan', 'alchemy', 'dan', 'lodan', 'luyenlinhdan',
  'uongdan', 'dungdan', 'candan', 'anlinhdan',
  'khieuchien', 'pvp', 'tivo',
  'laptongmon', 'createsect', 'tongmon', 'sect', 'bang',
  'moivaobang', 'moibang', 'invite',
  'conghien', 'donate', 'nhiemvubang', 'secttask', 'taskbang',
  'khuctruc', 'kickbang', 'kick', 'phongchuc', 'promote',
  'bxhtongmon', 'secttop', 'topbang',
  'matna', 'mask',
  'tanthu', 'nhiemvu', 'quest', 'nv', 'newbie'
];

// Khoảng cách Levenshtein rút gọn: chỉ cần biết "có gần không" nên cắt sớm
// khi hàng hiện tại đã vượt ngưỡng, thay vì tính hết ma trận.
function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Trả về lệnh gần nhất, hoặc null nếu chuỗi gõ vào chẳng giống lệnh nào.
export function suggestCommand(input) {
  let best = null;
  let bestScore = Infinity;
  const limit = input.length <= 3 ? 1 : 2;
  for (const cmd of KNOWN_COMMANDS) {
    // Gõ nhầm gần như luôn giữ đúng chữ cái đầu. Bỏ ràng buộc này thì "!test"
    // lại được gợi ý thành "!sect" và bot trở nên phiền.
    if (cmd[0] !== input[0]) continue;
    let d = editDistance(input, cmd, limit);
    // Gõ thiếu/thừa đuôi ("santh", "tangkinh") vẫn nên nhận ra, nhưng chỉ khi
    // phần lệch đủ ngắn — nếu không thì "t" sẽ khớp với hàng chục lệnh.
    if (d > limit && Math.abs(cmd.length - input.length) <= 3 &&
        (cmd.startsWith(input) || input.startsWith(cmd))) {
      d = limit;
    }
    if (d < bestScore) { best = cmd; bestScore = d; }
  }
  return bestScore <= limit ? best : null;
}

// Người mới gần như không gõ trúng tên lệnh ở lần đầu — họ gõ đúng thứ đang
// nghĩ trong đầu: "!start", "!batdau", "!shop", "!guild". Dò gần đúng không
// cứu được vì đó không phải lỗi chính tả, và tệ hơn là nó đoán bừa: "batdau"
// chỉ lệch 2 chữ so với "bandan", nên bot từng chỉ người mới đi... bán đan.
//
// Bảng này chặn TRƯỚC bước dò gần đúng: trả lời theo ý định thay vì theo mặt
// chữ. Im lặng ở đây là mất người chơi thật — người mới gõ một câu không thấy
// bot nhúc nhích thì mặc định là bot hỏng và bỏ đi luôn.
const START_INTENT = [
  'start', 'begin', 'play', 'newgame', 'new',
  'batdau', 'bat-dau', 'khoidau', 'khoi-dau', 'nhapmon', 'nhapdao',
  'choi', 'choigame', 'taonhanvat', 'tao', 'create', 'dangky', 'register', 'join'
];

const INTENT_HINTS = {
  shop: 'chotroi', store: 'chotroi', cuahang: 'chotroi',
  guild: 'tongmon', clan: 'tongmon', mon: 'tongmon', monphai: 'tongmon',
  pk: 'khieuchien', duel: 'khieuchien', danhnhau: 'khieuchien', solo: 'khieuchien',
  inv: 'tuido', inventory: 'tuido', items: 'tuido', balo: 'tuido',
  rank: 'top', level: 'top', lv: 'top',
  ver: 'capnhat', vers: 'capnhat', capnhap: 'capnhat', napnhat: 'capnhat',
  char: 'profile', character: 'profile', me: 'profile', chiso: 'profile',
  nhanvat: 'profile', tuvi: 'profile', canhgioi: 'profile',
  heal: 'uongdan', hoimau: 'uongdan',
  tien: 'lamcong', gold: 'lamcong', money: 'lamcong',
  weapon: 'phapbao', binhkhi: 'phapbao',
  skill: 'tangkinhcac', congphap: 'tangkinhcac',
  guide: 'help', tutorial: 'tanthu', lenh: 'help', commands: 'help'
};

/**
 * Trả lời theo ý định người chơi, hoặc null nếu chuỗi gõ vào không nằm trong
 * bảng. Tách riêng khỏi `suggestCommand` để hai cơ chế không giẫm chân nhau.
 */
export function resolveIntent(input, prefix = '!') {
  if (START_INTENT.includes(input)) {
    return `🌱 **Chào mừng đạo hữu đến với Tu Tiên Giới!**\n` +
      `Muốn bước vào tiên đồ, hãy gõ lệnh gạch chéo \`/khoi-dau\` — bot sẽ gieo quẻ **tư chất bẩm sinh** và cho đạo hữu chọn phe **Chính / Ma / Tán Tu**.\n\n` +
      `Sau đó, ba lệnh đầu tiên nên thuộc lòng:\n` +
      `• \`${prefix}tuluyen\` — bế quan hấp thụ linh khí, tăng tu vi.\n` +
      `• \`${prefix}lamcong\` — làm công kiếm Linh Thạch tiêu vặt.\n` +
      `• \`${prefix}santhu\` — săn yêu thú lấy Yêu Đan luyện đan, đúc bảo.\n\n` +
      `📖 Gõ \`${prefix}help\` bất cứ lúc nào để mở Cẩm Nang Tu Chân đầy đủ.`;
  }

  const target = INTENT_HINTS[input];
  if (!target) return null;
  return `💡 Pháp quyết đạo hữu cần là \`${prefix}${target}\`.\n` +
    `📖 Gõ \`${prefix}help\` để mở Cẩm Nang Tu Chân đầy đủ.`;
}

export async function handleSlashCommand(interaction) {
  const { commandName } = interaction;

  if (commandName === 'khoi-dau') {
    return startSlash(interaction);
  }
  if (commandName === 'help') {
    return helpSlash(interaction);
  }
}

export async function handlePrefixCommand(message, prefix = '!') {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    switch (command) {
      case 'top':
      case 'bxh':
      case 'leaderboard':
      case 'bangxephang':
      case 'xephang':
        return await executeTop(message, args);

      case 'admin':
      case 'adm':
      case 'thiendao':
        return await executeAdmin(message, args);

      case 'capnhat':
      case 'update':
      case 'phienban':
      case 'version':
        return await executeCapnhat(message, args);

      case 'baovat':
      case 'phapbaolist':
      case 'traphapbao':
      case 'thuvienphapbao':
      case 'tangbaocac':
      case 'itemlist':
      case 'gears':
      case 'danhsachphapbao':
        return await executeBaovat(message, args);

      case 'xemphapbao':
      case 'xembaovat':
      case 'viewgear':
      case 'iteminfo':
      case 'xemitem':
      case 'infogear':
        return await executeXemphapbao(message, args);

      case 'help':
      case 'huongdan': {
        const embed = createHelpOverviewEmbed();
        const row = createHelpSelectMenuRow();
        return await message.reply({ embeds: [embed], components: [row] });
      }

      case 'tupan':
      case 'profile':
      case 'status':
        return await profilePrefix(message, args);

      case 'phapbao':
      case 'trangbi':
      case 'gear':
      case 'vukhi':
        return await executePhapbao(message);

      case 'ducphapbao':
      case 'luyenkhi':
      case 'craft':
      case 'ren':
        return await executeDucphapbao(message);

      case 'tuido':
      case 'bag':
      case 'tui':
      case 'cankhon':
        return await executeTuido(message);

      case 'tanthu':
      case 'nhiemvu':
      case 'quest':
      case 'nv':
      case 'newbie':
        return await executeTanthu(message);

      case 'diemdanh':
      case 'daily':
      case 'boique':
      case 'rutque':
      case 'thienmenh':
      case 'que':
        return await executeDiemdanh(message);

      case 'tuluyen':
      case 'cultivate':
      case 'bequan':
        return await executeTuluyen(message);

      case 'dotpha':
      case 'break':
      case 'breakthrough':
        return await executeDotpha(message);

      case 'dokiep':
      case 'thienkiep':
      case 'loikiep':
      case 'tribulation':
        return await executeDokiep(message);

      case 'santhu':
      case 'hunt':
      case 'tranyeu':
        return await executeSanthu(message);

      case 'phoban':
      case 'dungeon':
      case 'bicanh':
        return await executePhoban(message, args);

      case 'choden':
      case 'tangkinhcac':
      case 'skills':
      case 'bikip':
      case 'kho':
        return await executeTangkinhcac(message);


      case 'kichhoat':
      case 'trangbicongphap':
      case 'dungcongphap':
      case 'setskill':
      case 'equipskill':
        return await executeKichhoat(message, args);

      case 'luyencong':
      case 'train':
        return await executeLuyencong(message, args);

      case 'dunghop':
      case 'fuse':
        return await executeDunghop(message, args);

      case 'lamcong':
      case 'work':
      case 'kiemtien':
        return await executeLamcong(message);

      case 'daokhoang':
      case 'mine':
      case 'khaiquang':
        return await executeDaokhoang(message);

      case 'dothach':
      case 'catda':
      case 'cucuoc':
        return await executeDothach(message, args);


      case 'chotroi':
      case 'market':
      case 'cho':
        return await executeChotroi(message, args);

      case 'ban':
      case 'sell':
        return await executeBan(message, args);

      case 'bandan':
      case 'selldan':
        return await executeBandan(message, args);


      case 'mua':
      case 'buy':
        return await executeMua(message, args);

      case 'huyban':
      case 'thuhoi':
      case 'unlist':
        return await executeHuyban(message, args);

      case 'luyendan':
      case 'alchemy':
      case 'dan':
      case 'lodan':
      case 'luyenlinhdan':
        return await executeLuyendan(message);

      case 'uongdan':
      case 'dungdan':
      case 'candan':
      case 'anlinhdan':
        return await executeUongdan(message, args);

      case 'khieuchien':
      case 'pvp':
      case 'tivo':
        return await executeKhieuchien(message, args);

      case 'laptongmon':
      case 'createsect':
        return await executeLaptongmon(message, args);

      case 'tongmon':
      case 'sect':
      case 'bang':
        return await executeTongmon(message);

      case 'moivaobang':
      case 'moibang':
      case 'invite':
        return await executeMoivaobang(message, args);

      case 'conghien':
      case 'donate':
        return await executeConghien(message, args);

      case 'nhiemvubang':
      case 'secttask':
      case 'taskbang':
        return await executeNhiemvubang(message);

      case 'khuctruc':
      case 'kickbang':
      case 'kick':
        return await executeKhuctruc(message, args);

      case 'phongchuc':
      case 'promote':
        return await executePhongchuc(message, args);

      case 'bxhtongmon':
      case 'secttop':
      case 'topbang':
        return await executeBxhtongmon(message);

      case 'matna':
      case 'mask': {
        const user = await User.findOne({ userId: message.author.id });
        if (!user) return await message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });
        user.maskActive = !user.maskActive;
        await user.save();
        return await message.reply({
          content: user.maskActive
            ? `🎭 Đạo hữu đã đeo **Mặt Nạ Ẩn Danh**! Thân phận hiện tại: **[Vô Danh Tà Tôn]**.`
            : `☀️ Đạo hữu đã tháo Mặt Nạ, hiển lộ danh xưng **[${user.daoName || user.username}]**.`
        });
      }

      default: {
        // Chỉ lên tiếng khi chuỗi gõ vào thực sự giống một lệnh. Nếu trả lời
        // mọi thứ bắt đầu bằng "!" thì bot sẽ spam kênh mỗi lần có người gõ
        // "!!!" hay "!?" trong lúc tán gẫu.
        if (!/^[a-z0-9_-]{2,20}$/.test(command)) return;

        // Hỏi ý định trước: người mới gõ "!start" là muốn bắt đầu chơi, không
        // phải gõ nhầm tên một pháp quyết nào đó.
        const hint = resolveIntent(command, prefix);
        if (hint) return await message.reply({ content: hint });

        const guess = suggestCommand(command);
        if (!guess) return;
        return await message.reply({
          content: `❓ Tiên giới không có pháp quyết \`${prefix}${command}\`. Ý đạo hữu là \`${prefix}${guess}\` chăng?\n` +
            `📖 Gõ \`${prefix}help\` để mở Cẩm Nang Tu Chân đầy đủ.`
        });
      }
    }
  } catch (error) {
    console.error(`[Prefix Command Error] ${command}:`, error);
    // Không đẩy `error.message` ra kênh chat: chuỗi đó có thể chứa URI database
    // hay chi tiết nội bộ. Người chơi nhận thông báo chung, log giữ bản đầy đủ.
    try {
      await message.reply({
        content: `❌ Thiên cơ hỗn loạn, pháp quyết \`${prefix}${command}\` chưa thi triển được.\n` +
          `Đạo hữu thử lại sau giây lát; nếu vẫn lỗi xin báo quản trị tông môn.`
      });
    } catch (replyErr) {
      console.error(`[Prefix Command Error] không gửi nổi thông báo lỗi:`, replyErr.message);
    }
  }
}
