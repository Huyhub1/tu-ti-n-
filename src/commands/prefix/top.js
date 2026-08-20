import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';
import { Sect } from '../../database/models/Sect.js';
import { getRealmDisplayName } from '../../services/cultivationService.js';

const REALM_ORDER = {
  pham_nhan: 0,
  luyen_khi: 1,
  truc_co: 2,
  kim_dan: 3,
  nguyen_anh: 4,
  hoa_than: 5
};

const FACTION_TAGS = {
  CHINH_DAO: '🔵 [Chính]',
  MA_DAO: '🔴 [Ma]',
  TAN_TU: '⚪ [Tán]'
};

export async function createTopEmbed(category = 'top_realm') {
  const embed = new EmbedBuilder();

  switch (category) {
    // 1. BXH Tu Vi & Cảnh Giới
    case 'top_realm': {
      const users = await User.find().lean();
      users.sort((a, b) => {
        const orderA = REALM_ORDER[a.realm?.id] ?? 0;
        const orderB = REALM_ORDER[b.realm?.id] ?? 0;
        if (orderA !== orderB) return orderB - orderA;

        const layerA = a.realm?.layer || 1;
        const layerB = b.realm?.layer || 1;
        if (layerA !== layerB) return layerB - layerA;

        return (b.realm?.exp || 0) - (a.realm?.exp || 0);
      });

      const top10 = users.slice(0, 10);
      const listText = top10.map((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
        const realmName = getRealmDisplayName(u.realm?.id, u.realm?.layer, u.isLuyenKhiVanTang);
        const fTag = FACTION_TAGS[u.faction] || '⚪ [Tán]';
        const daoName = u.maskActive ? '🎭 Vô Danh Tà Tôn' : (u.daoName || u.username);

        return `${medal} **${daoName}** ${fTag}\n` +
          `   • Cảnh giới: **${realmName}** | EXP: \`${(u.realm?.exp || 0).toLocaleString()} / ${(u.realm?.maxExp || 150).toLocaleString()}\`\n` +
          `   • Tư chất: \`${u.talent?.name || 'Phàm Phẩm'}\` (*${u.talent?.tierName || 'Phàm'}*)`;
      }).join('\n\n');

      embed
        .setTitle(`👑 [THIÊN ĐẠO BẢNG - BẢNG CẢNH GIỚI & TU VI]`)
        .setColor('#FFD700')
        .setDescription(
          `Vinh danh 10 vị đại năng có tu vi cao thâm và cảnh giới phi phàm nhất thiên hạ:\n\n` +
          (listText || '*Chưa có tu sĩ nào bước vào tiên đồ.*')
        )
        .setFooter({ text: `Chọn menu bên dưới để chuyển sang Bảng Phú Hào / Lực Chiến / Tông Môn` });
      break;
    }

    // 2. BXH Phú Hào (Linh Thạch & Nguyên Thạch)
    case 'top_wealth': {
      const users = await User.find().lean();
      users.sort((a, b) => {
        const wealthA = (a.currencies?.linhThach || 0) + (a.currencies?.nguyenThach || 0) * 50;
        const wealthB = (b.currencies?.linhThach || 0) + (b.currencies?.nguyenThach || 0) * 50;
        return wealthB - wealthA;
      });

      const top10 = users.slice(0, 10);
      const listText = top10.map((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
        const lt = (u.currencies?.linhThach || 0).toLocaleString();
        const nt = (u.currencies?.nguyenThach || 0).toLocaleString();
        const daoName = u.maskActive ? '🎭 Vô Danh Tà Tôn' : (u.daoName || u.username);
        const fTag = FACTION_TAGS[u.faction] || '⚪ [Tán]';

        return `${medal} **${daoName}** ${fTag}\n` +
          `   • Tài phú: 💎 **\`${lt} Linh Thạch\`** | 🔮 **\`${nt} Nguyên Thạch\`**`;
      }).join('\n\n');

      embed
        .setTitle(`💰 [THIÊN PHÚ BẢNG - BẢNG PHÚ HÀO VẠN GIỚI]`)
        .setColor('#00BCD4')
        .setDescription(
          `Top 10 phú thương và cự đầu tài phú nắm giữ kho tàng đồ sộ nhất tu chân giới:\n\n` +
          (listText || '*Chưa có dữ liệu phú hào.*')
        )
        .setFooter({ text: `Chọn menu bên dưới để đổi danh mục xếp hạng` });
      break;
    }

    // 3. BXH Chiến Thần & Lực Chiến Tổng Hợp
    case 'top_power': {
      const users = await User.find().lean();

      const userPowers = users.map(u => {
        let totalAtk = u.stats?.atk || 15;
        let totalDef = u.stats?.def || 8;
        let totalHp = u.stats?.maxHp || 100;
        let totalCrit = u.stats?.critRate || 0.05;

        // Cộng chỉ số trang bị đang mặc
        const equippedGears = (u.equipments || []).filter(e => e.equipped);
        for (const g of equippedGears) {
          totalAtk += g.stats?.atk || 0;
          totalDef += g.stats?.def || 0;
          totalHp += g.stats?.maxHp || 0;
          totalCrit += g.stats?.critRate || 0;
        }

        const battlePower = Math.floor(totalAtk * 4 + totalDef * 3 + totalHp * 0.5 + totalCrit * 1000);
        return { user: u, battlePower, totalAtk, totalDef, totalHp, equippedGears };
      });

      userPowers.sort((a, b) => b.battlePower - a.battlePower);
      const top10 = userPowers.slice(0, 10);

      const listText = top10.map((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
        const daoName = p.user.maskActive ? '🎭 Vô Danh Tà Tôn' : (p.user.daoName || p.user.username);
        const fTag = FACTION_TAGS[p.user.faction] || '⚪ [Tán]';
        const bestGear = p.equippedGears[0]?.name || 'Phàm Binh';

        return `${medal} **${daoName}** ${fTag}\n` +
          `   • Lực Chiến: ⚡ **\`${p.battlePower.toLocaleString()} Điểm\`**\n` +
          `   • Chỉ số: 🗡️ \`+${p.totalAtk}\` ATK | 🛡️ \`+${p.totalDef}\` DEF | ❤️ \`+${p.totalHp}\` HP\n` +
          `   • Thần Binh: *[${bestGear}]*`;
      }).join('\n\n');

      embed
        .setTitle(`⚔️ [CHIẾN THẦN BẢNG - BẢNG LỰC CHIẾN TỐI CAO]`)
        .setColor('#E91E63')
        .setDescription(
          `Top 10 Chiến Thần sở hữu lực chiến kinh thiên động địa, quét ngang tam giới:\n\n` +
          (listText || '*Chưa có dữ liệu chiến thần.*')
        )
        .setFooter({ text: `Chọn menu bên dưới để đổi danh mục xếp hạng` });
      break;
    }

    // 4. BXH Tàng Kinh Các (Sưu Tầm Công Pháp)
    case 'top_skills': {
      const users = await User.find().lean();
      users.sort((a, b) => {
        const countA = a.skills?.length || 0;
        const countB = b.skills?.length || 0;
        if (countA !== countB) return countB - countA;

        const masteryA = (a.skills || []).reduce((sum, s) => sum + (s.mastery || 0), 0);
        const masteryB = (b.skills || []).reduce((sum, s) => sum + (s.mastery || 0), 0);
        return masteryB - masteryA;
      });

      const top10 = users.slice(0, 10);
      const listText = top10.map((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
        const daoName = u.maskActive ? '🎭 Vô Danh Tà Tôn' : (u.daoName || u.username);
        const fTag = FACTION_TAGS[u.faction] || '⚪ [Tán]';
        const skillCount = u.skills?.length || 0;
        const perfectedCount = (u.skills || []).filter(s => s.mastery >= 100).length;

        return `${medal} **${daoName}** ${fTag}\n` +
          `   • Sở hữu: 📜 **\`${skillCount} Bí Kíp\`** | 🔮 Viên mãn: **\`${perfectedCount} Môn\`**`;
      }).join('\n\n');

      embed
        .setTitle(`📜 [VẠN ĐẠO BẢNG - BẢNG TÀNG KINH CÁC]`)
        .setColor('#9C27B0')
        .setDescription(
          `Top 10 đại sư uyên bác, thông hiểu vạn quyển công pháp và bí thuật thượng thừa:\n\n` +
          (listText || '*Chưa có dữ liệu sưu tầm công pháp.*')
        )
        .setFooter({ text: `Chọn menu bên dưới để đổi danh mục xếp hạng` });
      break;
    }

    // 5. BXH Vạn Phái (Tông Môn)
    case 'top_sects': {
      const sects = await Sect.find().sort({ level: -1, reputation: -1, 'treasury.linhThach': -1 }).limit(10).lean();

      const listText = sects.map((s, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
        return `${medal} **[${s.name}]** (Sơn Môn Cấp ${s.level}) - \`${s.faction}\`\n` +
          `   • Chưởng Môn: **${s.leaderName}** | 👥 Đệ Tử: \`${s.members.length}\`\n` +
          `   • Uy Danh: 🔥 \`${s.reputation}\` | 💎 Ngân Khố: \`${s.treasury.linhThach.toLocaleString()} LT\``;
      }).join('\n\n');

      embed
        .setTitle(`🏛️ [VẠN PHÁI BẢNG - BẢNG XẾP HẠNG TÔNG MÔN]`)
        .setColor('#4CAF50')
        .setDescription(
          `Top 10 môn phái hùng mạnh và danh chấn thiên hạ nhất thế giới tu tiên:\n\n` +
          (listText || '*Chưa có Tông Môn nào được thành lập.*')
        )
        .setFooter({ text: `Chọn menu bên dưới để đổi danh mục xếp hạng` });
      break;
    }
  }

  return embed;
}

export function createTopSelectMenu(selectedCategory = 'top_realm', userId) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`top_category_select_${userId}`)
    .setPlaceholder('👉 Chọn Bảng Xếp Hạng cần xem...');

  const options = [
    { label: '👑 Bảng Cảnh Giới & Tu Vi', value: 'top_realm', desc: 'Top đại năng tu vi cao thâm nhất', emoji: '👑' },
    { label: '💰 Bảng Phú Hào & Tài Phú', value: 'top_wealth', desc: 'Top đại gia nhiều Linh Thạch nhất', emoji: '💰' },
    { label: '⚔️ Bảng Chiến Thần & Lực Chiến', value: 'top_power', desc: 'Top cao thủ có lực chiến khủng nhất', emoji: '⚔️' },
    { label: '📜 Bảng Vạn Đạo & Công Pháp', value: 'top_skills', desc: 'Top người sưu tầm nhiều bí kíp nhất', emoji: '📜' },
    { label: '🏛️ Bảng Vạn Phái Tông Môn', value: 'top_sects', desc: 'Top 10 Tông Môn hùng mạnh nhất', emoji: '🏛️' }
  ];

  for (const opt of options) {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(opt.label)
        .setValue(opt.value)
        .setDescription(opt.desc)
        .setEmoji(opt.emoji)
        .setDefault(opt.value === selectedCategory)
    );
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

// Lệnh chính: !top / !bxh
export async function executeTop(message, args) {
  let category = 'top_realm';
  if (args.length > 0) {
    const sub = args[0].toLowerCase();
    if (sub.includes('tien') || sub.includes('giau') || sub.includes('phu') || sub.includes('wealth')) {
      category = 'top_wealth';
    } else if (sub.includes('luc') || sub.includes('chien') || sub.includes('power')) {
      category = 'top_power';
    } else if (sub.includes('kinh') || sub.includes('phap') || sub.includes('skill')) {
      category = 'top_skills';
    } else if (sub.includes('bang') || sub.includes('phai') || sub.includes('tong') || sub.includes('sect')) {
      category = 'top_sects';
    }
  }

  const embed = await createTopEmbed(category);
  const menuRow = createTopSelectMenu(category, message.author.id);

  await message.reply({ embeds: [embed], components: [menuRow] });
}
