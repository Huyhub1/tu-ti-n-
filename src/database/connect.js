import mongoose from 'mongoose';
import chalk from 'chalk';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tutien_bot';
  try {
    console.log(chalk.cyan(`[Database] Đang kết nối tới MongoDB...`));
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50,
      minPoolSize: 10,
      family: 4 // Ép IPv4 để tránh Windows DNS IPv6 delay 300ms
    });
    console.log(chalk.green(`[Database] ✅ Kết nối MongoDB thành công!`));
  } catch (error) {
    console.error(chalk.red(`[Database] ❌ Lỗi kết nối MongoDB: ${error.message}`));
    console.log(chalk.yellow(`[Database] 💡 Lưu ý: Hãy đảm bảo bạn đã cài đặt MongoDB local hoặc cấu hình MONGODB_URI (MongoDB Atlas) trong file .env`));
  }
}
