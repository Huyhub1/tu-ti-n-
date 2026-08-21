import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import chalk from 'chalk';
import { connectDB } from './database/connect.js';
import { handleSlashCommand, handlePrefixCommand } from './handlers/commandHandler.js';
import { handleButton } from './handlers/buttonHandler.js';
import { handleSelectMenu } from './handlers/selectMenuHandler.js';
import { handleModalSubmit } from './handlers/modalHandler.js';
import { data as startData } from './commands/slash/start.js';
import { data as helpData } from './commands/slash/help.js';
import { batTuDongKiemTra } from './commands/prefix/capnhat.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  // Chặn cứng @everyone / @here / ping role ở tầng thấp nhất: dù có chuỗi nào
  // do người chơi đặt lọt qua khâu kiểm duyệt (tên tông môn chẳng hạn), Discord
  // cũng sẽ không biến nó thành lời gọi toàn server. Vẫn cho phép 'users' vì
  // chiến thư PvP cần gọi đích danh đối thủ mới có tác dụng.
  allowedMentions: { parse: ['users'] }
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

// discord.js v15 bo ten 'ready'; dung hang so Events de khoi phai sua lai sau.
client.once(Events.ClientReady, async () => {
  console.log(chalk.bold.magenta(`\n======================================================`));
  console.log(chalk.bold.green(`  🌌 DISCORD BOT TU TIÊN SANDBOX ĐÃ SẴN SÀNG!`));
  console.log(chalk.bold.cyan(`  🤖 Tên Bot: ${client.user.tag}`));
  console.log(chalk.bold.yellow(`  ⚡ Prefix lệnh thường: "${PREFIX}"`));
  console.log(chalk.bold.magenta(`======================================================\n`));

  await registerSlashCommands();

  // Bật sau khi đã sẵn sàng: vòng này có thể tắt bot để cập nhật, nên đừng
  // để nó chen vào lúc đang đăng ký slash command dở dang.
  batTuDongKiemTra(client);
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
      await handleModalSubmit(interaction);
    }
  } catch (error) {
    console.error(chalk.red(`[Interaction Error] ${interaction.customId || interaction.commandName || "?"}:`), error);

    // Ba điều bản cũ làm sai: đẩy nguyên `error.message` ra chat (có thể lộ URI
    // database), bỏ mặc interaction đã defer nên người chơi ngồi nhìn "đang
    // suy nghĩ..." vĩnh viễn, và bản thân lời gọi reply cũng có thể ném lỗi.
    if (!interaction.isRepliable()) return;
    const notice = {
      content: `❌ Thiên cơ hỗn loạn, thao tác này chưa hoàn thành được.\n` +
        `Đạo hữu thử lại sau giây lát; nếu vẫn lỗi xin báo quản trị tông môn.`,
      flags: MessageFlags.Ephemeral
    };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(notice);
      } else {
        await interaction.reply(notice);
      }
    } catch (replyErr) {
      console.error(chalk.red(`[Interaction Error] không gửi nổi thông báo lỗi: ${replyErr.message}`));
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
  // Không thoát process: một lỗi lẻ ở một lệnh không đáng để cả server mất bot.
  // Nhưng phải in nguyên stack, vì đây là loại lỗi không ai bắt được ở tầng dưới.
  console.error(chalk.red(`[Uncaught Exception]:`), error);
});

// connect.js đã lo đóng MongoDB khi nhận tín hiệu tắt; ở đây ngắt thêm phiên
// Discord để bot biến mất khỏi danh sách online ngay thay vì chờ gateway timeout.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.log(chalk.cyan(`\n[Shutdown] Nhận ${signal}, đang thu hồi pháp lực...`));
    client.destroy().catch(() => { /* đang tắt máy, bỏ qua */ });
  });
}

client.on('error', (error) => {
  console.error(chalk.red(`[Discord Client Error]:`), error);
});

start();
