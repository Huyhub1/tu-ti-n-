# 📜 TU TIÊN DISCORD BOT — Thế Giới Mở Sandbox (v1.0)

> **Cảm hứng cốt truyện:** *Ta Trời Sinh Đã Là Nhân Vật Phản Diện*, *Đại Quản Gia Là Ma Hoàng*, *Ta Là Tà Đế*, *Luyện Khí 100k Năm*.

Bot Discord nhập vai tu tiên: gacha linh căn, tu luyện lên cảnh giới, độ kiếp, luyện đan, đúc pháp bảo, lập tông môn, giao thương chợ trời và tỉ thí PvP ăn cược Linh Thạch.

**Công nghệ:** Node.js ≥ 18 (ESM) · discord.js v14 · MongoDB (mongoose 8) · dotenv · chalk

---

## 🚀 Cài đặt & khởi chạy

```bash
# 1. Cài thư viện
npm install

# 2. Tạo file cấu hình từ mẫu rồi điền giá trị thật
cp .env.example .env      # Windows: copy .env.example .env

# 3. Chạy 10 bộ test nội bộ (không cần MongoDB)
npm test

# 4. Rà soát toàn bộ codebase & file config
npm run audit

# 5. Khởi động bot
npm start                 # hoặc: npm run dev  (tự reload khi sửa code)
```

### Biến môi trường (`.env`)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token bot lấy ở Discord Developer Portal |
| `CLIENT_ID` | ✅ | Application ID — dùng để đăng ký lệnh slash |
| `MONGODB_URI` | ✅ | Chuỗi kết nối MongoDB (Atlas hoặc local). Thiếu là bot dừng ngay |
| `PREFIX` | ❌ | Prefix lệnh thường, mặc định `!` |
| `ADMIN_ID` | ❌ | Discord ID admin, nhiều người cách nhau bằng dấu phẩy. **Để trống = toàn bộ lệnh `!admin` bị khóa** (mặc định an toàn) |

> ⚠️ File `.env` chứa bí mật thật và đã nằm trong `.gitignore` — tuyệt đối không commit.

### Quyền Discord cần bật
Intents: `Guilds`, `GuildMessages`, **`MessageContent`** (bắt buộc, phải bật thủ công trong Developer Portal), `GuildMembers`.

---

## 🌟 Tính năng

### 🧬 1. Khởi đầu & tư chất bẩm sinh — `/khoi-dau`
Gacha **1 trong 5 bậc linh căn**, mỗi bậc là superset của bậc dưới:

| Bậc | Tỉ lệ | Hệ số EXP | Perk cộng dồn |
|---|---|---|---|
| Phàm Phẩm | 50% | ×1.00 | — |
| Lương Phẩm | 30% | ×1.15 | +10% HP |
| Cực Phẩm | 14% | ×1.35 | +10% HP, +20% sát thương, −15% vạch đột phá |
| Thiên Phẩm | 5% | ×1.70 | +15% HP, +25% sát thương, −15% vạch, luyện công ×2, lôi kiếp −30% |
| Thần Phẩm | 1% | ×2.50 | +20% HP, +35% sát thương, −20% vạch, luyện công ×2.5, lôi kiếp −45% |


Khóa chống gacha lại để giữ giá trị bậc hiếm. Xem tư chất của mình bằng `!tupan` (alias `!profile`, `!status`).

### ⚖️ 2. Ba trận doanh — chọn ngay trong `/khoi-dau`
Buff nội tại **đúng theo `src/config/factions.json`**:

* **Chính Đạo** — +25% tỉ lệ đột phá · +15 khí vận · −10% mọi sát thương nhận vào · +15% hiệu quả đan dược
* **Ma Đạo** — +20% EXP giết quái · +10% EXP bế quan · +25% sát thương bạo kích · +15% tỉ lệ rơi đồ
* **Tán Tu** — 10% né đòn · +20% tiền làm công · +20% sản lượng đào khoáng · **miễn 5% thuế chợ trời**

### 🧘 3. Tu vi, nén khí & thiên lôi độ kiếp
`Phàm Nhân ➜ Luyện Khí Kỳ ➜ Trúc Cơ Kỳ ➜ Kim Đan Kỳ ➜ Nguyên Anh Kỳ`

* `!tuluyen` — bế quan hấp thụ linh khí (hồi chiêu 10s)
* `!dotpha` — công phá cảnh giới; **thất bại mà không có Hộ Mạch Đan sẽ bị tụt tầng**
* **Nén Khí Từ Dương:** tại Luyện Khí Tầng 9 có thể chọn nén lên **Tầng 10 ➜ 50+**, tăng vọt HP/ATK và miễn nhiễm lôi kiếp
* `!dokiep` — tại Kim Đan Đỉnh Phong phải nghênh chiến **3 đạo Thiên Lôi**, chọn 1 trong 4 chiến thuật mỗi đạo
* **5 phẩm Kim Đan** (Hạ ➜ Trung ➜ Thượng ➜ Cực ➜ Thiên Đạo Vô Khuyết) quyết định tiềm lực hậu Nguyên Anh

### 🔮 4. Luyện đan & Chợ Trời
* Nguyên liệu: `!lamcong` hái **Linh Thảo**, `!santhu` lấy **Yêu Đan** (10 loại yêu thú)
* `!luyendan` — **6 phương thuốc**: Hồi Xuân · Tụ Khí · Tẩy Tủy · Trúc Cơ · Kim Đan Cố Bản · Hộ Mạch Đan. `!uongdan` để dùng
* **Chợ Trời:** `!chotroi` xem hàng · `!ban <stt> <giá>` bán công pháp · `!bandan <stt> <giá>` bán đan · `!mua <mã>` · `!huyban <mã>` gỡ hàng
* Luật chợ: **thuế 5%** trừ vào tiền người bán (Tán Tu miễn) · giá **10 – 10.000.000** Linh Thạch · tối đa **10 gian hàng**/người

### 🛡️ 5. Tàng Bảo Các — 60 pháp bảo
`!baovat` tra cứu · `!xemphapbao` · `!ducphapbao` đúc (hồi chiêu 60s) · `!phapbao` cường hóa `+1, +2, +3…`

Phân bổ 60 món: Hoàng Giai 6 · Huyền Giai 21 · Địa Giai 18 · Thiên Giai 10 · **Thần Giai 5**. Mỗi pháp bảo mang 1 Tuyệt Kỹ, giới hạn **2 lần/trận**.

### 📜 6. Tàng Kinh Các — 76 công pháp
4 hệ: Tâm Pháp · Quyết Pháp · Thân Pháp · Bí Thuật. 6 phẩm cấp: Hoàng ➜ Huyền ➜ Địa ➜ Thiên ➜ Thần ➜ **Cấm Kỵ Tiên Cổ** (×5 EXP).

* `!tangkinhcac` — kho công pháp
* `!kichhoat <stt>` — **khay chiến đấu tối đa 4 công pháp** + 2 tuyệt kỹ trang bị. Chưa chọn thì bot tự lấy 4 bí kíp mạnh nhất
* `!luyencong` — rèn thuần thục lên 100% (Thiên Phẩm ×2, Thần Phẩm ×2.5 tốc độ)
* `!dunghop <phẩm cấp>` — tôi luyện **5 bí kíp viên mãn cùng phẩm** thành 1 bí kíp phẩm cao hơn

### 💰 7. Kiếm tài nguyên & PvP
| Lệnh | Hồi chiêu | Nội dung |
|---|---|---|
| `!tuluyen` | 10s | Bế quan nhận EXP |
| `!luyencong` | 10s | Rèn thuần thục công pháp |
| `!lamcong` | 30s | 4 nghề, nhận Linh Thạch + Linh Thảo |
| `!santhu` | 30s | Săn yêu thú lấy EXP + Yêu Đan |
| `!daokhoang` | 45s | Đào Nguyên Thạch |
| `!dothach` | 20s | Đổ thạch ăn may |
| `!ducphapbao` | 60s | Đúc pháp bảo |
| `!nhiemvubang` | 60s | Nhiệm vụ tông môn |
| `!phoban` | 120s | 2 ải phó bản |

| `!khieuchien <@đối thủ> [cược]` | 20s | **PvP:** cược 50 – 20.000 LT · chênh tối đa 1 đại cảnh giới · lời mời sống 90s · tối đa 12 hiệp |

`!diemdanh` / `!boique` — bói quẻ Thiên Cơ mỗi ngày (Đại Cát 15%: 500–800 LT) + chuỗi streak 7 ngày, ngày 7 nhận Hồi Xuân Đan + Hộ Mạch Đan + 500 LT + 10 Nguyên Thạch.

### 🏛️ 8. Tông môn & bảng xếp hạng
* `!laptongmon <tên>` khai sơn lập phái · `!tongmon` · `!moivaobang` · `!conghien <số>` đóng góp ngân khố · `!phongchuc` / `!khuctruc`
* **5 cấp sơn môn:** Cấp 1 (10 đệ tử, +5% EXP) ➜ Cấp 5 (60 đệ tử, +25% EXP, mở khóa Thần Thú Hộ Tông)
* `!top` / `!bxh` — 5 bảng: Tu Vi · Phú Hào · Lực Chiến · Tàng Kinh · Vạn Phái (`!bxhtongmon`)

### 🎒 Khác

`!tupan` hồ sơ & tư chất · `!tuido` / `!cankhon` túi đồ · `!matna` đổi đạo hiệu · `!help` mở cẩm nang 9 chuyên mục · `!admin` (chỉ ID trong `ADMIN_ID`)

Hầu hết lệnh đều có alias tiếng Anh (`!cultivate`, `!market`, `!sect`, `!top`…) — gõ `!help` mục 9 để xem bảng đầy đủ.

---

## 📂 Cấu trúc thư mục

```
src/
  index.js                 # Bootstrap: đăng nhập, đăng ký slash command, định tuyến interaction
  commands/
    slash/                 # /khoi-dau, /help
    prefix/                # Toàn bộ lệnh ! (tu luyện, chợ, tông môn, admin…)
  handlers/                # prefixHandler, buttonHandler, selectMenuHandler, modalHandler
  services/                # economyService (trừ tài nguyên atomic), pvpService, sectService…
  database/models/         # User, Sect, MarketItem
  config/                  # 12 file JSON: realms, skills, equipment, talents, factions…
  utils/                   # cooldown, format, random…
scripts/                   # auditCodebase, rebalanceEquipments, resolveAndMapImgbb
tests/                     # testBot.js (10 bộ), testFullE2E.js
```

## 🔒 Ghi chú vận hành

* Mọi giao dịch tiêu tài nguyên (mua bán chợ, luyện đan, đúc/cường hóa pháp bảo, lập tông môn, cống hiến) đều đi qua **atomic update có điều kiện `$gte`** kèm đường hoàn tác — spam click không nhân đôi được vật phẩm hay Linh Thạch.
* Lệnh gõ tay và nút bấm/modal dùng **chung một hàm nghiệp vụ**, nên không lệch luật giữa hai đường.
* `!admin` mặc định khóa cho tới khi `ADMIN_ID` được điền.
