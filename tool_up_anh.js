import fs from 'fs';
import path from 'path';

/**
 * 🛠️ TOOL UP ẢNH ĐỘC LẬP (ImgBB & Free Image Host)
 * 
 * Cách dùng:
 *  1. Up toàn bộ ảnh trong thư mục mặc định:
 *     node tool_up_anh.js
 * 
 *  2. Up 1 ảnh lẻ:
 *     node tool_up_anh.js "duong_dan_den_anh.jpg"
 * 
 *  3. Up thư mục tùy chọn:
 *     node tool_up_anh.js "C:/thu_muc_anh"
 * 
 *  4. Dùng với ImgBB API Key riêng:
 *     node tool_up_anh.js --key=YOUR_IMGBB_API_KEY
 */

// Đọc tham số dòng lệnh
const args = process.argv.slice(2);
let customPath = null;
let apiKey = null;

for (const arg of args) {
  if (arg.startsWith('--key=')) {
    apiKey = arg.replace('--key=', '').trim();
  } else if (!arg.startsWith('--')) {
    customPath = arg;
  }
}

// Thư mục mặc định nếu không truyền tham số
const DEFAULT_DIR = 'C:\\game\\id_97_60 vũ khí pháp bảo tu tiên kiếm hiệp\\id_97_60 vũ khí pháp bảo tu tiên kiếm hiệp';
const targetPath = path.resolve(customPath || DEFAULT_DIR);

// Upload lên ImgBB
async function uploadImgBB(filePath, key) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64Image = fileBuffer.toString('base64');
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append('image', base64Image);
  formData.append('name', path.parse(fileName).name);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
    method: 'POST',
    body: formData
  });

  const json = await res.json();
  if (json.success) {
    return json.data.url;
  }
  throw new Error(json.error ? json.error.message : 'Upload ImgBB lỗi');
}

// Upload lên Free Image Host (Catbox)
async function uploadCatbox(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('fileToUpload', blob, fileName);

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error(`Lỗi server: ${res.statusText}`);
  const url = (await res.text()).trim();
  if (!url.startsWith('http')) throw new Error(`Server báo lỗi: ${url}`);
  return url;
}

async function uploadFile(filePath, key) {
  if (key) {
    return await uploadImgBB(filePath, key);
  } else {
    return await uploadCatbox(filePath);
  }
}

async function start() {
  console.log('======================================================');
  console.log('       📸 TOOL TỰ ĐỘNG UP ẢNH LẤY LINK TRỰC TIẾP');
  console.log('======================================================\n');

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Đường dẫn không tồn tại: ${targetPath}`);
    return;
  }

  const stat = fs.statSync(targetPath);
  let filesToUpload = [];

  if (stat.isFile()) {
    filesToUpload.push(targetPath);
  } else if (stat.isDirectory()) {
    const list = fs.readdirSync(targetPath);
    filesToUpload = list
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(f => path.join(targetPath, f));
  }

  if (filesToUpload.length === 0) {
    console.log(`⚠️ Không tìm thấy file ảnh (.jpg, .png, .webp) nào trong: ${targetPath}`);
    return;
  }

  console.log(`🎯 Mục tiêu: ${filesToUpload.length} tệp ảnh.`);
  console.log(`🌐 Phương thức: ${apiKey ? `ImgBB API (Key: ${apiKey.slice(0, 4)}***)` : 'Free Direct Image Host (Catbox)'}\n`);

  const results = [];
  const txtLines = [];

  for (let i = 0; i < filesToUpload.length; i++) {
    const file = filesToUpload[i];
    const fileName = path.basename(file);
    process.stdout.write(`[${i + 1}/${filesToUpload.length}] Đang tải lên: ${fileName}... `);

    try {
      const url = await uploadFile(file, apiKey);
      console.log(`✅ THÀNH CÔNG!\n    🔗 Link: ${url}\n`);
      results.push({ name: fileName, url: url, path: file });
      txtLines.push(`${fileName} ➜ ${url}`);

      // Lưu ngay kết quả ra file
      fs.writeFileSync('danh_sach_link_anh.json', JSON.stringify(results, null, 2), 'utf8');
      fs.writeFileSync('danh_sach_link_anh.txt', txtLines.join('\n'), 'utf8');

      // Giãn cách 400ms tránh bị chặn
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.log(`❌ THẤT BẠI: ${err.message}\n`);
    }
  }

  console.log('======================================================');
  console.log(`🎉 ĐÃ XONG! Đã lưu toàn bộ link ảnh vào 2 file:`);
  console.log(`  📄 danh_sach_link_anh.txt (Xem nhanh)`);
  console.log(`  📊 danh_sach_link_anh.json (Dùng cho lập trình)`);
  console.log('======================================================\n');
}

start();
