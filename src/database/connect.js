import mongoose from 'mongoose';
import chalk from 'chalk';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('error', (err) => {
    console.error(chalk.red(`[Database] ❌ Lỗi kết nối MongoDB: ${err.message}`));
  });

  mongoose.connection.on('disconnected', () => {
    console.warn(chalk.yellow(`[Database] ⚠️ Mất kết nối MongoDB — driver đang tự thử kết nối lại...`));
  });

  mongoose.connection.on('reconnected', () => {
    console.log(chalk.green(`[Database] ✅ Đã kết nối lại MongoDB.`));
  });

  const shutdown = async (signal) => {
    try {
      await mongoose.connection.close();
      console.log(chalk.cyan(`[Database] Đã đóng kết nối MongoDB (${signal}).`));
    } catch {
      /* đang tắt máy, bỏ qua */
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Kết nối MongoDB. Bản cũ nuốt lỗi rồi return bình thường, khiến bot vẫn
 * khởi động và mọi lệnh đều ném lỗi timeout khó hiểu. Giờ thử lại vài lần,
 * hết lượt thì thoát hẳn để process manager (pm2/systemd) restart sạch sẽ.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(chalk.red(`[Database] ❌ Thiếu biến môi trường MONGODB_URI.`));
    console.log(chalk.yellow(`[Database] 💡 Hãy sao chép .env.example thành .env rồi điền MONGODB_URI (MongoDB Atlas hoặc local).`));
    process.exit(1);
  }

  attachListeners();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(chalk.cyan(`[Database] Đang kết nối tới MongoDB... (lần ${attempt}/${MAX_RETRIES})`));
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 50,
        minPoolSize: 10,
        family: 4 // Ép IPv4 để tránh Windows DNS IPv6 delay 300ms
      });
      console.log(chalk.green(`[Database] ✅ Kết nối MongoDB thành công!`));
      return;
    } catch (error) {
      console.error(chalk.red(`[Database] ❌ Lần ${attempt} thất bại: ${error.message}`));
      if (attempt < MAX_RETRIES) {
        console.log(chalk.yellow(`[Database] ⏳ Thử lại sau ${RETRY_DELAY_MS / 1000}s...`));
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.error(chalk.red(`[Database] 💀 Không thể kết nối MongoDB sau ${MAX_RETRIES} lần thử. Dừng bot.`));
  console.log(chalk.yellow(`[Database] 💡 Kiểm tra MONGODB_URI, whitelist IP trên Atlas, hoặc dịch vụ MongoDB local.`));
  process.exit(1);
}
