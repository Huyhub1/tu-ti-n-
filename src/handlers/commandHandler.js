import { execute as startSlash } from '../commands/slash/start.js';
import { execute as helpSlash, createHelpOverviewEmbed, createHelpSelectMenuRow } from '../commands/slash/help.js';
import { execute as profilePrefix } from '../commands/prefix/profile.js';
import { executeTuluyen, executeDotpha } from '../commands/prefix/cultivate.js';
import { executeTangkinhcac, executeLuyencong, executeDunghop } from '../commands/prefix/skills.js';
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
import { executeBaovat, executeXemphapbao } from '../commands/prefix/baovat.js';
import { executeTop } from '../commands/prefix/top.js';
import { executeDokiep } from '../commands/prefix/dokiep.js';
import { executeDiemdanh } from '../commands/prefix/daily.js';
import { User } from '../database/models/User.js';

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
        return executeTop(message, args);

      case 'admin':
      case 'adm':
      case 'thiendao':
        return executeAdmin(message, args);

      case 'baovat':
      case 'phapbaolist':
      case 'traphapbao':
      case 'thuvienphapbao':
      case 'tangbaocac':
      case 'itemlist':
      case 'gears':
      case 'danhsachphapbao':
        return executeBaovat(message, args);

      case 'xemphapbao':
      case 'xembaovat':
      case 'viewgear':
      case 'iteminfo':
      case 'xemitem':
      case 'infogear':
        return executeXemphapbao(message, args);

      case 'help':
      case 'huongdan': {
        const embed = createHelpOverviewEmbed();
        const row = createHelpSelectMenuRow();
        return message.reply({ embeds: [embed], components: [row] });
      }

      case 'tupan':
      case 'profile':
      case 'status':
        return profilePrefix(message, args);

      case 'phapbao':
      case 'trangbi':
      case 'gear':
      case 'vukhi':
        return executePhapbao(message);

      case 'ducphapbao':
      case 'luyenkhi':
      case 'craft':
      case 'ren':
        return executeDucphapbao(message);

      case 'tuido':
      case 'bag':
      case 'tui':
      case 'cankhon':
        return executeTuido(message);

      case 'diemdanh':
      case 'daily':
      case 'boique':
      case 'rutque':
      case 'thienmenh':
      case 'que':
        return executeDiemdanh(message);

      case 'tuluyen':
      case 'cultivate':
      case 'bequan':
        return executeTuluyen(message);

      case 'dotpha':
      case 'break':
      case 'breakthrough':
        return executeDotpha(message);

      case 'dokiep':
      case 'thienkiep':
      case 'loikiep':
      case 'tribulation':
        return executeDokiep(message);

      case 'santhu':
      case 'hunt':
      case 'tranyeu':
        return executeSanthu(message);

      case 'phoban':
      case 'dungeon':
      case 'bicanh':
        return executePhoban(message, args);

      case 'choden':
      case 'tangkinhcac':
      case 'skills':
      case 'bikip':
      case 'kho':
        return executeTangkinhcac(message);

      case 'luyencong':
      case 'train':
        return executeLuyencong(message, args);

      case 'dunghop':
      case 'fuse':
        return executeDunghop(message, args);

      case 'lamcong':
      case 'work':
      case 'kiemtien':
        return executeLamcong(message);

      case 'daokhoang':
      case 'mine':
      case 'khaiquang':
        return executeDaokhoang(message);

      case 'dothach':
      case 'catda':
      case 'cucuoc':
        return executeDothach(message, args);


      case 'chotroi':
      case 'market':
      case 'cho':
        return executeChotroi(message, args);

      case 'ban':
      case 'sell':
        return executeBan(message, args);

      case 'bandan':
      case 'selldan':
        return executeBandan(message, args);


      case 'mua':
      case 'buy':
        return executeMua(message, args);

      case 'huyban':
      case 'thuhoi':
      case 'unlist':
        return executeHuyban(message, args);

      case 'luyendan':
      case 'alchemy':
      case 'dan':
      case 'lodan':
      case 'luyenlinhdan':
        return executeLuyendan(message);

      case 'uongdan':
      case 'dungdan':
      case 'candan':
      case 'anlinhdan':
        return executeUongdan(message, args);

      case 'khieuchien':
      case 'pvp':
      case 'tivo':
        return executeKhieuchien(message, args);

      case 'laptongmon':
      case 'createsect':
        return executeLaptongmon(message, args);

      case 'tongmon':
      case 'sect':
      case 'bang':
        return executeTongmon(message);

      case 'moivaobang':
      case 'moibang':
      case 'invite':
        return executeMoivaobang(message, args);

      case 'conghien':
      case 'donate':
        return executeConghien(message, args);

      case 'nhiemvubang':
      case 'secttask':
      case 'taskbang':
        return executeNhiemvubang(message);

      case 'khuctruc':
      case 'kickbang':
      case 'kick':
        return executeKhuctruc(message, args);

      case 'phongchuc':
      case 'promote':
        return executePhongchuc(message, args);

      case 'bxhtongmon':
      case 'secttop':
      case 'topbang':
        return executeBxhtongmon(message);

      case 'matna':
      case 'mask': {
        const user = await User.findOne({ userId: message.author.id });
        if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });
        user.maskActive = !user.maskActive;
        await user.save();
        return message.reply({
          content: user.maskActive
            ? `🎭 Đạo hữu đã đeo **Mặt Nạ Ẩn Danh**! Thân phận hiện tại: **[Vô Danh Tà Tôn]**.`
            : `☀️ Đạo hữu đã tháo Mặt Nạ, hiển lộ danh xưng **[${user.daoName || user.username}]**.`
        });
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`[Prefix Command Error] ${command}:`, error);
    message.reply({ content: `❌ Đã xảy ra lỗi khi thực thi lệnh: ${error.message}` });
  }
}
