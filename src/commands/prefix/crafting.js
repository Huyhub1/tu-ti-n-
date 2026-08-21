import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { User } from '../../database/models/User.js';
import { checkCooldown, formatWait } from '../../utils/cooldown.js';
import { meetsRequirement, requirementLabel } from '../../utils/power.js';
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


  if (!user) return message.reply({ content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` });

  const cd = checkCooldown(user, 'crafting');
  if (!cd.ready) {
    return message.reply({
      content: `🔥 Lò đúc còn đang nguội, chân hỏa chưa nhóm lại được! Vui lòng chờ **${formatWait(cd.waitTime)}**.`
    });
  }

  // 21 công thức mà nhồi hết vào một embed thì vừa vượt trần 6000 ký tự của
  // Discord, vừa bắt tân thủ cuộn qua cả loạt thần binh còn cách họ ba cảnh
  // giới. Chỉ bày những lò đã mở khoá, kèm hai công thức kế tiếp làm mục tiêu.
  const allRecipes = recipesConfig.recipes;
  const unlockedRecipes = allRecipes.filter(r => meetsRequirement(user, r));
  const lockedRecipes = allRecipes.filter(r => !meetsRequirement(user, r)).slice(0, 2);
  const recipes = unlockedRecipes.slice(-8).concat(lockedRecipes);

  const embed = new EmbedBuilder()
    .setTitle(`🔥 [LÒ ĐÚC PHÁP BẢO & THẦN BINH]`)
    .setColor('#FF5722')
    .setDescription(
      `Nơi tôi luyện chân hỏa, rèn đúc Thần Binh và Bản Mệnh Pháp Bảo viễn cổ.\n\n` +
      `💰 **Tài nguyên hiện có:** \`${user.currencies.nguyenThach || 0} Nguyên Thạch\` | \`${user.currencies.linhThach.toLocaleString()} Linh Thạch\`\n` +
      `🧭 **Cảnh giới:** **${user.realm.name} · Tầng ${user.realm.layer}** — đã mở khoá **${unlockedRecipes.length}/${allRecipes.length}** công thức.\n\n` +
      `👉 **Hãy chọn Pháp Bảo muốn đúc ở menu bên dưới để xem công thức:**`
    );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`craft_select_recipe_${userId}`)
    .setPlaceholder('👉 Chọn công thức đúc pháp bảo...');

  recipes.forEach((r, idx) => {
    const locked = !meetsRequirement(user, r);
    const mats = r.requirements.items.map(i => `\`${i.quantity}x ${i.name}\``).join(', ');

    embed.addFields({
      name: `${locked ? '🔒' : '🔨'} ${r.name} [${r.rarity}]`,
      value: locked
        ? `⛔ *Cần đạt* **${requirementLabel(r)}** *— nguyên liệu chỉ rơi ra ở tầng yêu thú đó.*`
        : `📜 \`${r.requirements.nguyenThach} NT\` + \`${r.requirements.linhThach.toLocaleString()} LT\` + ${mats}`,
      inline: false
    });

    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${locked ? '🔒 ' : ''}${r.name}`.slice(0, 100))
        .setDescription(
          (locked
            ? `Cần ${requirementLabel(r)}`
            : `${r.requirements.nguyenThach} NT + ${r.requirements.linhThach.toLocaleString()} LT`
          ).slice(0, 100)
        )
        .setValue(r.id)
        .setEmoji(locked ? '🔒' : '🔨')
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await message.reply({ embeds: [embed], components: [row] });
}
