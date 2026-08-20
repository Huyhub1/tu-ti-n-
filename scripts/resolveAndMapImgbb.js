import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawLinks = [
  "https://ibb.co/spBvX44K",
  "https://ibb.co/SX2BPp10",
  "https://ibb.co/rfR6xHXr",
  "https://ibb.co/SwGPVG67",
  "https://ibb.co/QFd5Ws4h",
  "https://ibb.co/Zz90HwD6",
  "https://ibb.co/rGC1WLfq",
  "https://ibb.co/6JGgsrsF",
  "https://ibb.co/gMSnddjC",
  "https://ibb.co/YBjf1wFS",
  "https://ibb.co/Zz2gDQ58",
  "https://ibb.co/CDJdWQ9",
  "https://ibb.co/ccd1sVKK",
  "https://ibb.co/s90vbC2x",
  "https://ibb.co/1G7b2L8N",
  "https://ibb.co/tTSGXr2Z",
  "https://ibb.co/Kc557tdM",
  "https://ibb.co/7NdRMw11",
  "https://ibb.co/21dkcJBx",
  "https://ibb.co/sMfcgLm",
  "https://ibb.co/99G44W0V",
  "https://ibb.co/wFqmcpLV",
  "https://ibb.co/prbWj4P2",
  "https://ibb.co/1YFKtwTr",
  "https://ibb.co/R40dWxdC",
  "https://ibb.co/JWfpQkKG",
  "https://ibb.co/j9cByM6r",
  "https://ibb.co/ycSdfz4g",
  "https://ibb.co/RGmkBN13",
  "https://ibb.co/spRXRZxw",
  "https://ibb.co/vxbPJq9Q",
  "https://ibb.co/spmyH4jn",
  "https://ibb.co/2mWtPK8",
  "https://ibb.co/jvR1hdMy",
  "https://ibb.co/W4dF0yx5",
  "https://ibb.co/JjHZxwMy",
  "https://ibb.co/XxsmBdkp",
  "https://ibb.co/ns4QRXPM",
  "https://ibb.co/LdRTtq7n",
  "https://ibb.co/5hVbFPpS",
  "https://ibb.co/3YpTH4hM",
  "https://ibb.co/DHGWyr5m",
  "https://ibb.co/pjLf4FjX",
  "https://ibb.co/CKh0phvB",
  "https://ibb.co/FLhr7BYy",
  "https://ibb.co/xSmdHGY5",
  "https://ibb.co/0p5K5y5n",
  "https://ibb.co/pv2qzYxc",
  "https://ibb.co/5h8gTncX",
  "https://ibb.co/pjsTn9LT",
  "https://ibb.co/Vctsph4b",
  "https://ibb.co/vvXJn4NW",
  "https://ibb.co/b5wYKn5h",
  "https://ibb.co/hx88Vvnk",
  "https://ibb.co/fYq2h4z5",
  "https://ibb.co/nMBs1xbm",
  "https://ibb.co/9k4YSw3Q",
  "https://ibb.co/zhn8PQT2",
  "https://ibb.co/cS7xNCyM"
];

async function fetchPageInfo(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await res.text();
    
    // Tìm og:title hoặc title
    let title = '';
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(' - ImgBB', '').trim();
    }

    // Tìm direct image url
    let directImg = '';
    const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i) || html.match(/<link rel="image_src" href="([^"]+)"/i);
    if (imgMatch) {
      directImg = imgMatch[1];
    }

    return { url, title, directImg };
  } catch (err) {
    return { url, error: err.message };
  }
}

async function run() {
  console.log(`Đang đọc thông tin từ ${rawLinks.length} link ImgBB...`);
  const resolved = [];
  
  for (let i = 0; i < rawLinks.length; i++) {
    const link = rawLinks[i];
    process.stdout.write(`[${i + 1}/${rawLinks.length}] Đang lấy: ${link}... `);
    const info = await fetchPageInfo(link);
    if (info.directImg) {
      console.log(`✅ [${info.title}] ➜ ${info.directImg}`);
      resolved.push(info);
    } else {
      console.log(`❌ Không lấy được`);
      resolved.push({ url: link, title: 'Unknown', directImg: link });
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Đọc equipment.json
  const equipPath = path.resolve(__dirname, '../src/config/equipment.json');
  const equipData = JSON.parse(fs.readFileSync(equipPath, 'utf8'));

  // Normalize string for fuzzy matching
  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');

  let matchedCount = 0;
  const unmatchedImages = [];
  const matchedEquipmentIds = new Set();

  for (const item of resolved) {
    const normTitle = normalize(item.title);
    
    // Tìm item trong equipment.json
    let match = equipData.equipments.find(e => {
      const normName = normalize(e.name);
      const normFile = normalize(e.imageFile || '');
      return normName === normTitle || normFile.includes(normTitle) || normTitle.includes(normName);
    });

    if (match) {
      match.imageUrl = item.directImg;
      match.pageUrl = item.url;
      matchedEquipmentIds.add(match.id);
      matchedCount++;
    } else {
      unmatchedImages.push(item);
    }
  }

  // Ghi lại equipment.json
  fs.writeFileSync(equipPath, JSON.stringify(equipData, null, 2), 'utf8');

  // Kiểm tra xem thiếu pháp bảo nào
  const missingEquips = equipData.equipments.filter(e => !matchedEquipmentIds.has(e.id));

  console.log('\n======================================================');
  console.log(`🎯 KẾT QUẢ ÁNH XẠ:`);
  console.log(`  ✅ Đã gắn thành công: ${matchedCount}/${equipData.equipments.length} pháp bảo!`);
  console.log(`  ⚠️ Số pháp bảo còn thiếu ảnh: ${missingEquips.length}`);
  if (missingEquips.length > 0) {
    console.log('\n📋 DANH SÁCH PHÁP BẢO CHƯA CÓ LINK ẢNH:');
    missingEquips.forEach((e, idx) => {
      console.log(`   ${idx + 1}. [${e.name}] (${e.rarityName}) - File gốc: ${e.imageFile}`);
    });
  }

  if (unmatchedImages.length > 0) {
    console.log('\n⚠️ CÁC LINK ẢNH CHƯA KHỚP ĐƯỢC TÊN:');
    unmatchedImages.forEach((img, idx) => {
      console.log(`   ${idx + 1}. Tiêu đề: "${img.title}" | Link: ${img.url}`);
    });
  }
  console.log('======================================================\n');
}

run();
