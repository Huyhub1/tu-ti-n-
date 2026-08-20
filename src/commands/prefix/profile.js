import { EmbedBuilder } from 'discord.js';
import { User } from '../../database/models/User.js';

import { getRealmDisplayName } from '../../services/cultivationService.js';
import { getTalentPerkText } from '../../services/talentService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const factionsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/factions.json'), 'utf8'));

export function createProfileEmbed(user) {
  const faction = factionsConfig.factions[user.faction] || factionsConfig.factions.TAN_TU;
  const realmInfo = getRealmDisplayName(user.realm.id, user.realm.layer, user.isLuyenKhiVanTang);

  // Hiển thị EXP tối đa 100% trên giao diện (giữ nguyên tính cơ chế ẩn)
  const displayExp = Math.min(user.realm.maxExp, user.realm.exp);
  const progressPercent = Math.min(100, Math.floor((displayExp / user.realm.maxExp) * 100));
  const barLength = 10;
  const filledBars = Math.floor((progressPercent / 100) * barLength);
  const emptyBars = barLength - filledBars;
  const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(emptyBars);

  // Danh xưng / Ẩn danh
  let displayName = user.daoName || user.username;
  if (user.maskActive) {
    displayName = `🎭 [Vô Danh Tà Tôn]`;
  }

  const nguyenThachCount = user.currencies.nguyenThach || 0;
  const goldenCoreText = user.goldenCore && user.goldenCore.name
    ? `\n**Kim Đan:** ✨ **[${user.goldenCore.name}]** *(EXP +${(user.goldenCore.expBonus * 100).toFixed(0)}%)*`
    : '';

  const embed = new EmbedBuilder()
    .setTitle(`🌌 [BẢNG TU CHÂN] - Đạo Hiệu: ${displayName}`)
    .setColor(faction.color || '#9C27B0')
    .setDescription(
      `**Trận Doanh:** ${faction.tag}\n` +

      `**Tư Chất:** 🧬 **[${user.talent.name}]** (*${user.talent.tierName}*)\n` +
      `**Đặc Quyền:** ${getTalentPerkText(user.talent.tier)}\n` +
      `**Cảnh Giới:** ⚡ **${realmInfo}**${goldenCoreText}\n` +
      `**Tu Vi (EXP):** \`${displayExp}/${user.realm.maxExp}\` [${progressBar}] \`${progressPercent}%\``
    )
    .addFields(
      {
        name: `⚔️ Thuộc Tính Chiến Đấu`,
        value: `❤️ **HP:** \`${user.stats.hp}/${user.stats.maxHp}\` | 🔷 **MP:** \`${user.stats.mp ?? user.stats.maxMp ?? 100}/${user.stats.maxMp ?? 100}\`\n🗡️ **Công Kích:** \`${user.stats.atk}\` | 🛡️ **Phòng Ngự:** \`${user.stats.def}\`\n💥 **Bạo Kích:** \`${(user.stats.critRate * 100).toFixed(0)}%\` | 🏃 **Né:** \`${(user.stats.dodgeRate * 100).toFixed(0)}%\``,
        inline: true
      },
      {
        name: `💎 Tài Sản Tu Chân`,
        value: `💎 **Linh Thạch:** \`${user.currencies.linhThach.toLocaleString()}\`\n🔮 **Nguyên Thạch:** \`${nguyenThachCount.toLocaleString()}\`\n☀️ **Công Đức:** \`${user.currencies.congDuc}\` | 🩸 **Tà Tâm:** \`${user.currencies.taTam}\``,
        inline: true
      }
    );

  // Kỹ năng đang trang bị
  const equippedSkills = user.skills.filter(s => s.equipped);
  const skillsText = equippedSkills.length > 0
    ? equippedSkills.map(s => `• **[${s.name}]** (${s.rarity}) - Thuần thục: \`${s.mastery}%\``).join('\n')
    : `*Chưa trang bị công pháp nào. Dùng lệnh !choden để xem.*`;

  embed.addFields({ name: `📚 Công Pháp Đang Kích Hoạt (${equippedSkills.length}/4)`, value: skillsText, inline: false });

  // Trang bị đang đeo
  const equippedGears = (user.equipments || []).filter(e => e.equipped);
  if (equippedGears.length > 0) {
    const gearText = equippedGears.map(g => `• **[${g.name}]** ${g.enhanceLevel > 0 ? `(+${g.enhanceLevel})` : ''} - \`${g.rarityName}\` (🗡️ +${g.stats.atk} | 🛡️ +${g.stats.def})`).join('\n');
    embed.addFields({ name: `🛡️ Pháp Bảo / Binh Khí Đang Mặc`, value: gearText, inline: false });
  }

  if (user.talent.specialSkill) {
    embed.addFields({ name: `⚡ Thần Thông Bẩm Sinh`, value: `✨ **[${user.talent.specialSkill}]**`, inline: true });
  }

  embed.setFooter({ text: `Gõ lệnh help để xem danh sách toàn bộ câu lệnh!` });
  return embed;
}

export async function execute(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId }).lean();

  if (!user) {
    return message.reply({
      content: `❌ Đạo hữu **${message.author.username}** chưa bước chân vào tiên đồ! Hãy gõ \`/khoi-dau\` để tạo nhân vật và thức tỉnh linh căn!`
    });
  }

  const embed = createProfileEmbed(user);
  await message.reply({ embeds: [embed] });
}
