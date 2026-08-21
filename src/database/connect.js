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
        // Hai mốc chờ dưới đây từng là 5s và 10s. Đo trên một đường truyền thật
        // đi qua VPN cho thấy mốc đó quá sát: 20 lần bắt tay TCP liên tiếp tới
        // Atlas thì KHÔNG lần nào sạch gói — 11 lần mất 1 gói SYN, 7 lần mất từ
        // 2 gói trở lên, 2 lần chết hẳn. Windows truyền lại SYN sau 0,5s rồi
        // 1,5s rồi 3,5s, nên chỉ một gói rơi đã ngốn ~4s trong ngân sách 10s.
        // Đây không phải giả định: cùng lúc đó Google và Discord vẫn về trong
        // 200ms, nên là hỏng ở chặng đường chứ không phải máy hay Atlas chậm.
        //
        // Nới ra không làm chậm máy khoẻ — đường tốt vẫn nối xong trong 50ms và
        // trả về ngay. Nó chỉ quyết định bot chịu đựng được bao lâu trước khi
        // bỏ cuộc, mà bỏ cuộc sớm trên mạng rớt gói thì thành vòng lặp sập:
        // supervisor bật lại, lại rớt gói, lại sập. Thà chờ thêm vài giây.
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        maxPoolSize: 50,
        // Mở sẵn 10 kết nối lúc khởi động. Trên đường rớt gói đây là 10 lần
        // gieo xúc xắc cùng lúc, nhưng driver tự thử lại ngầm và không làm hỏng
        // lượt nào của người chơi, nên giữ nguyên để đỡ độ trễ lúc cao điểm.
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
  console.log(chalk.yellow(`[Database] 💡 Đang bật VPN/proxy? Chúng hay làm rớt gói tin tới Atlas — thử tắt rồi chạy lại.`));
  process.exit(1);
}
