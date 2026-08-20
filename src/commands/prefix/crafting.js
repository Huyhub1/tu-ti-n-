import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { User } from '../../database/models/User.js';
import { checkCooldown, formatWait } from '../../utils/cooldown.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const recipesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/recipes.json'), 'utf8'));
const equipmentConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/equipment.json'), 'utf8'));

export async function executeDucphapbao(message) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });


  if (!user) return message.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!` });

  const cd = checkCooldown(user, 'crafting');
  if (!cd.ready) {
    return message.reply({
      content: `🔥 Lò đúc còn đang nguội, chân hỏa chưa nhóm lại được! Vui lòng chờ **${formatWait(cd.waitTime)}**.`
    });
  }

  const recipes = recipesConfig.recipes;

  const embed = new EmbedBuilder()
    .setTitle(`🔥 [LÒ ĐÚC PHÁP BẢO & THẦN BINH]`)
    .setColor('#FF5722')
    .setDescription(
      `Nơi tôi luyện chân hỏa, rèn đúc Thần Binh và Bản Mệnh Pháp Bảo viễn cổ.\n\n` +
      `💰 **Tài nguyên hiện có:** \`${user.currencies.nguyenThach || 0} Nguyên Thạch\` | \`${user.currencies.linhThach.toLocaleString()} Linh Thạch\`\n\n` +
      `👉 **Hãy chọn Pháp Bảo muốn đúc ở menu bên dưới để xem công thức:**`
    );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`craft_select_recipe_${userId}`)
    .setPlaceholder('👉 Chọn công thức đúc pháp bảo...');

  recipes.forEach((r, idx) => {
    embed.addFields({
      name: `${idx + 1}. **${r.name}** [${r.rarity}]`,
      value: `📜 Yêu cầu: \`${r.requirements.nguyenThach} Nguyên Thạch\` + \`${r.requirements.linhThach} LT\` + ${r.requirements.items.map(i => `\`${i.quantity}x ${i.name}\``).join(', ')}\n*${r.desc}*`,
      inline: false
    });

    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${idx + 1}. ${r.name}`)
        .setDescription(`Cần ${r.requirements.nguyenThach} NT + ${r.requirements.linhThach} LT`)
        .setValue(r.id)
        .setEmoji('🔨')
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await message.reply({ embeds: [embed], components: [row] });
}
