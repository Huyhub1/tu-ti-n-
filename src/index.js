import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from 'discord.js';
import chalk from 'chalk';
import { connectDB } from './database/connect.js';
import { handleSlashCommand, handlePrefixCommand } from './handlers/commandHandler.js';
import { handleButton } from './handlers/buttonHandler.js';
import { handleSelectMenu } from './handlers/selectMenuHandler.js';
import { User } from './database/models/User.js';
import { MarketItem } from './database/models/MarketItem.js';
import { Sect } from './database/models/Sect.js';
import { data as startData } from './commands/slash/start.js';
import { data as helpData } from './commands/slash/help.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = process.env.PREFIX || '!';
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Đăng ký 2 Slash Commands lên Discord
async function registerSlashCommands() {
  if (!TOKEN || !CLIENT_ID) {
    console.log(chalk.yellow(`[Slash Commands] ⚠️ Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong file .env, tạm thời bỏ qua đăng ký Slash Command.`));
    return;
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [startData.toJSON(), helpData.toJSON()];

  try {
    console.log(chalk.cyan(`[Slash Commands] Đang đăng ký lệnh /khoi-dau và /help lên Discord...`));
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(chalk.green(`[Slash Commands] ✅ Đăng ký 2 Slash Commands thành công!`));
  } catch (error) {
    console.error(chalk.red(`[Slash Commands] ❌ Lỗi đăng ký Slash Commands: ${error.message}`));
  }
}

client.once('ready', async () => {
  console.log(chalk.bold.magenta(`\n======================================================`));
  console.log(chalk.bold.green(`  🌌 DISCORD BOT TU TIÊN SANDBOX ĐÃ SẴN SÀNG!`));
  console.log(chalk.bold.cyan(`  🤖 Tên Bot: ${client.user.tag}`));
  console.log(chalk.bold.yellow(`  ⚡ Prefix lệnh thường: "${PREFIX}"`));
  console.log(chalk.bold.magenta(`======================================================\n`));

  await registerSlashCommands();
});

// Xử lý Interaction (Slash Commands, Buttons, Select Menus, Modals)
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      if (customId.startsWith('modal_sell_submit::') || customId.startsWith('modal_sell_submit_')) {
        let skillIdx, targetUserId;
        if (customId.includes('::')) {
          const parts = customId.split('::');
          const itemKey = parts[1]; // skill_0
          skillIdx = parseInt(itemKey.replace('skill_', ''), 10);
          targetUserId = parts[2];
        } else {
          const parts = customId.split('_');
          targetUserId = parts[parts.length - 1];
          skillIdx = parseInt(parts[parts.length - 2], 10);
        }

        if (interaction.user.id !== targetUserId) {
          return interaction.reply({ content: `⚠️ Thao tác này không thuộc về bạn!`, ephemeral: true });
        }

        const priceStr = interaction.fields.getTextInputValue('sell_price_input');
        const price = parseInt(priceStr, 10);

        if (isNaN(price) || price <= 0) {
          return interaction.reply({ content: `❌ Giá bán phải là một số nguyên dương hợp lệ!`, ephemeral: true });
        }

        const user = await User.findOne({ userId: targetUserId });
        if (!user || isNaN(skillIdx) || skillIdx < 0 || skillIdx >= user.skills.length) {
          return interaction.reply({ content: `❌ Công pháp không còn tồn tại trong Tàng Kinh Các!`, ephemeral: true });
        }

        const skillToSell = user.skills[skillIdx];
        user.skills.splice(skillIdx, 1);
        await user.save();

        const newMarketItem = new MarketItem({
          sellerId: user.userId,
          sellerName: user.daoName || user.username,
          itemName: skillToSell.name,
          itemType: 'BI_KIP',
          skillId: skillToSell.skillId,
          price: price,
          desc: `Bí kíp phẩm cấp ${skillToSell.rarity}`
        });

        await newMarketItem.save();

        const embed = new EmbedBuilder()
          .setTitle(`🏪 [ĐĂNG BÁN THÀNH CÔNG]`)
          .setColor('#4CAF50')
          .setDescription(
            `Đạo hữu đã niêm yết bí kíp **[${skillToSell.name}]** lên Chợ Trời!\n\n` +
            `💎 Giá niêm yết: **${price.toLocaleString()} Linh Thạch**\n` +
            `Người chơi khác có thể xem và mua trực tiếp tại Chợ Trời.`
          );

        return interaction.reply({ embeds: [embed] });
      }

      if (customId.startsWith('modal_sect_donate::')) {
        const parts = customId.split('::');
        const sectId = parts[1];
        const targetUserId = parts[2];

        if (interaction.user.id !== targetUserId) {
          return interaction.reply({ content: `⚠️ Thao tác này không thuộc về bạn!`, ephemeral: true });
        }

        const amountStr = interaction.fields.getTextInputValue('sect_donate_amount_input');
        const amount = parseInt(amountStr, 10);

        if (isNaN(amount) || amount <= 0) {
          return interaction.reply({ content: `❌ Số Linh Thạch cống hiến phải là một số nguyên dương hợp lệ!`, ephemeral: true });
        }

        const user = await User.findOne({ userId: targetUserId });
        const sect = await Sect.findById(sectId);

        if (!user || !sect) {
          return interaction.reply({ content: `❌ Dữ liệu người chơi hoặc môn phái không tồn tại!`, ephemeral: true });
        }

        if (user.currencies.linhThach < amount) {
          return interaction.reply({
            content: `❌ Đạo hữu không đủ ${amount.toLocaleString()} Linh Thạch để cống hiến! (Hiện có: ${user.currencies.linhThach.toLocaleString()} LT)`,
            ephemeral: true
          });
        }

        user.currencies.linhThach -= amount;
        sect.treasury.linhThach += amount;

        const member = sect.members.find(m => m.userId === targetUserId);
        const gainedContrib = Math.floor(amount / 2);
        if (member) {
          member.contribution = (member.contribution || 0) + gainedContrib;
        }

        await user.save();
        await sect.save();

        const embed = new EmbedBuilder()
          .setTitle(`💎 [CỐNG HIẾN MÔN PHÁI THÀNH CÔNG]`)
          .setColor('#4CAF50')
          .setDescription(
            `Đạo hữu **${user.daoName || user.username}** đã quyên góp thành công **${amount.toLocaleString()} Linh Thạch** vào Ngân Khố **[${sect.name}]**!\n\n` +
            `✨ Nhận được: **+${gainedContrib.toLocaleString()} Điểm Cống Hiến**\n` +
            `💰 Ngân Khố Tông Môn hiện tại: **${sect.treasury.linhThach.toLocaleString()} Linh Thạch**`
          );

        return interaction.reply({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error(chalk.red(`[Interaction Error]: ${error.message}`));
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ Có lỗi xảy ra trong quá trình xử lý: ${error.message}`, ephemeral: true });
    }
  }
});

// Xử lý Message Prefix Commands
client.on('messageCreate', async (message) => {
  await handlePrefixCommand(message, PREFIX);
});

// Khởi động bot
async function start() {
  await connectDB();
  if (!TOKEN) {
    console.log(chalk.red(`\n[LƯU Ý QUAN TRỌNG]`));
    console.log(chalk.yellow(`Vui lòng điền DISCORD_TOKEN và CLIENT_ID vào file .env để kết nối Bot với Discord server của bạn!`));
    console.log(chalk.cyan(`Xem hướng dẫn chi tiết tại file: README.md\n`));
  } else {
    try {
      await client.login(TOKEN);
    } catch (err) {
      console.error(chalk.red(`[Login Error] Không thể đăng nhập Discord: ${err.message}`));
    }
  }
}

// Lắng nghe lỗi toàn cục để đảm bảo Bot chạy 24/7 không bị sập bất ngờ
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red(`[Unhandled Rejection]:`), reason);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red(`[Uncaught Exception]:`), error);
});

client.on('error', (error) => {
  console.error(chalk.red(`[Discord Client Error]:`), error);
});

start();
