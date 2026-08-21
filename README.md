# 📜 TU TIÊN DISCORD BOT — Thế Giới Mở Sandbox (v1.0)

> **Cảm hứng cốt truyện:** *Ta Trời Sinh Đã Là Nhân Vật Phản Diện*, *Đại Quản Gia Là Ma Hoàng*, *Ta Là Tà Đế*, *Luyện Khí 100k Năm*.

Bot Discord nhập vai tu tiên: gacha linh căn, tu luyện lên cảnh giới, độ kiếp, luyện đan, đúc pháp bảo, lập tông môn, giao thương chợ trời và tỉ thí PvP ăn cược Linh Thạch.

**Công nghệ:** Node.js ≥ 18 (ESM) · discord.js v14 · MongoDB (mongoose 8) · dotenv · chalk

**Quy mô:** 136 bí danh lệnh `!` + 2 lệnh slash · 13 file cấu hình JSON · 9 tầng kiểm thử tự động

---

## ✨ Mới trong bản phát hành đầu

| Bổ sung | Vì sao có |
|---|---|
| **Chuỗi nhiệm vụ tân thủ `!tanthu`** — 10 bước, thưởng 7.150 LT + 13 NT | Người mới vào không có việc gì để bám: nguồn nhiệm vụ duy nhất là `!nhiemvubang`, mà lệnh đó đòi phải có tông môn |
| **Chỉ số Lực Chiến**, `!top` mặc định xếp theo nó | Xếp theo Tu Vi thì cày thời gian là leo hạng, đầu tư pháp bảo và công pháp lại không được tính vào đâu cả |
| **Nút 🔄 Làm lại** dưới `!tuluyen` · `!lamcong` · `!santhu` · `!daokhoang` | Bốn lệnh hồi chiêu ngắn này chiếm phần lớn thao tác mỗi phiên chơi, gõ lại tay rất mỏi |
| **Nhãn hồi chiêu động** `<t:…:R>` in sẵn mọi màn hình | Trước chỉ ghi "hồi chiêu 30 giây", người chơi phải tự nhẩm từ lúc nào |

---

## 🚀 Cài đặt & khởi chạy

```bash
# 1. Cài thư viện
npm install

# 2. Tạo file cấu hình từ mẫu rồi điền giá trị thật
cp .env.example .env      # Windows: copy .env.example .env

# 3. Chạy các bộ test nội bộ (không cần MongoDB)
npm test                  # 10 bộ kiểm thử hệ thống
npm run test:e2e          # 9 bộ kiểm thử luồng đầu-cuối
npm run test:ui           # dựng thử 349 khung embed, soi trần ký tự của Discord
npm run test:sanitize     # 32 phép kiểm duyệt tên tông môn
npm run test:tutorial     # 45 phép kiểm thử chuỗi nhiệm vụ tân thủ
npm run test:power        # 45 phép kiểm thử Lực Chiến, nút làm lại, nhãn hồi chiêu
npm run test:update       # 79 phép kiểm thử tự cập nhật, dựng kho git thật để thử
npm run audit             # rà soát codebase & 13 file config

# 4. Kiểm thử trên MongoDB thật (cần MONGODB_URI)
npm run smoke:tanthu      # đi trọn 10 bước chuỗi tân thủ trên DB thật
npm run test:race         # bắn thao tác song song, soi đường nhân đôi phần thưởng

# 5. Chạy gộp cả 10 tầng trên — dùng trước mỗi lần phát hành
npm run check:release

# 6. Khởi động bot
npm start                 # chạy qua tiến trình giám sát — xem mục Tự động cập nhật
npm run start:bot         # chạy thẳng bot, không giám sát, không tự cập nhật
npm run dev               # tự reload khi sửa code (chỉ dùng lúc phát triển)
```

> Hai tầng cuối cần MongoDB thật. `test:race` bắn hàng chục thao tác song song
> vào cùng một nhân vật để chứng minh không thể nhân đôi phần thưởng;
> `smoke:tanthu` đi hết 10 bước tân thủ như người chơi thật, kể cả ca hồ sơ cũ
> bị hỏng field. Cả hai chỉ tạo/xoá nhân vật tạm có `userId` bắt đầu bằng
> `__racetest_` / `__smoke_`, không đụng tới dữ liệu người chơi.

### Biến môi trường (`.env`)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token bot lấy ở Discord Developer Portal |
| `CLIENT_ID` | ✅ | Application ID — dùng để đăng ký lệnh slash |
| `MONGODB_URI` | ✅ | Chuỗi kết nối MongoDB (Atlas hoặc local). Thiếu là bot dừng ngay |
| `PREFIX` | ❌ | Prefix lệnh thường, mặc định `!` |
| `ADMIN_ID` | ❌ | Discord ID admin, nhiều người cách nhau bằng dấu phẩy. **Để trống = toàn bộ lệnh `!admin` bị khóa** (mặc định an toàn) |
| `AUTO_UPDATE` | ❌ | `true` để bot tự dò và kéo bản mới từ git. Mặc định **tắt** |
| `AUTO_UPDATE_INTERVAL_MINUTES` | ❌ | Bao lâu dò một lần, mặc định `5`. Kẹp trong khoảng 1–1440 |
| `AUTO_UPDATE_REMOTE` | ❌ | Tên remote, mặc định `origin` |
| `AUTO_UPDATE_BRANCH` | ❌ | Nhánh theo dõi. Để trống = nhánh máy chủ đang đứng |
| `AUTO_UPDATE_CHANNEL_ID` | ❌ | Kênh nhận thông báo "bế quan cập nhật". Để trống = cập nhật im lặng |
| `AUTO_UPDATE_VERIFY` | ❌ | `false` để bỏ vòng `npm run audit` sau khi kéo. **Không khuyến khích** |

> ⚠️ File `.env` chứa bí mật thật và đã nằm trong `.gitignore` — tuyệt đối không commit.

### Quyền Discord cần bật
Intents: `Guilds`, `GuildMessages`, **`MessageContent`** (bắt buộc, phải bật thủ công trong Developer Portal), `GuildMembers`.

---

## 🔄 Tự động cập nhật — đẩy code lên git là mọi máy tự lên bản mới

Bot hỏi kho git vài phút một lần. Thấy commit mới thì nó tự tắt, kéo về, tự
nghiệm thu, rồi bật lại. Không phải vào panel bấm gì.

### Cách nó hoạt động

`npm start` **không** chạy thẳng bot mà chạy `scripts/supervisor.js` — một tiến
trình mỏng đứng ngoài trông chừng:

```
npm start
  └─ scripts/supervisor.js          ← panel của nhà cung cấp thấy tiến trình này
       ├─ src/index.js              ← bot thật, chạy với BOT_SUPERVISED=1
       │    └─ thoát với mã 42      ← "có bản mới, kéo giùm"
       ├─ scripts/applyUpdate.js    ← kéo về · nghiệm thu · quay lui nếu hỏng
       └─ bật lại src/index.js
```

`applyUpdate.js` chạy làm **tiến trình riêng** chứ không phải module được
`import`. Lý do rất cụ thể: chính mã cập nhật cũng nằm trong kho và cũng bị
`git pull` thay đổi. Nếu tiến trình bọc ngoài `import` nó thì nó vĩnh viễn chạy
bản đã nạp lúc khởi động — sửa lỗi trong logic cập nhật rồi đẩy lên, đúng chỗ
sửa đó không bao giờ có hiệu lực.

Bot cũng từ chối tự thoát nếu không thấy dấu `BOT_SUPERVISED=1`. Thoát ra mà
không có ai bật lại thì không phải là cập nhật, là mất bot.

### Bốn hàng rào

| Hàng rào | Chặn chuyện gì |
|---|---|
| `git pull --ff-only` | Không bao giờ tự gộp nhánh. Nhánh rẽ đôi thì dừng và báo người xử lý |
| Cây phải sạch | Ai đó vá nóng một file qua panel thì công của họ không bị ghi đè |
| `npm run audit` sau khi kéo | Bản mới phải tự chứng minh nó chạy được mới được nhận |
| `git reset --hard` + cách ly | Trượt thì quay về bản cũ, và **không thử lại vòng vô tận** |

Hàng rào cuối là hàng rào quan trọng nhất. Không có nó, đẩy nhầm một commit hỏng
là bot kéo → trượt → quay lui → 5 phút sau lại thấy "có bản mới" → restart, cứ
thế cho tới khi có người để ý. Commit đã hỏng được ghi vào `.update-quarantine`
(file này nằm trong `.gitignore`) và bị bỏ qua cho tới khi đỉnh kho đổi mã — tức
là cho tới khi bạn đẩy commit sửa lỗi lên.

Toàn bộ bốn hàng rào được `npm run test:update` diễn lại trên kho git thật, kể
cả ca đẩy commit hỏng rồi sửa lại.

### Dựng kho riêng tư trên GitHub

1. Tạo repo **Private** trên GitHub, đừng tick "Add a README".
2. Ở máy này:

```bash
git remote add origin https://github.com/<tên-bạn>/<tên-repo>.git
git push -u origin master
```

3. Tạo **fine-grained personal access token** ở
   `github.com/settings/personal-access-tokens`: chỉ chọn đúng repo này, quyền
   `Contents: Read-only`. Máy chủ chỉ cần đọc, không cần quyền ghi.

### Cài lên host (PikaMC / Pterodactyl)

Trong console của panel:

```bash
git clone https://<user>:<token>@github.com/<tên-bạn>/<tên-repo>.git .
npm install --omit=dev
```

Rồi dùng trình quản lý file của panel tạo `.env` (chép từ `.env.example`, điền
token Discord và `MONGODB_URI` thật), thêm:

```
AUTO_UPDATE=true
AUTO_UPDATE_INTERVAL_MINUTES=5
AUTO_UPDATE_CHANNEL_ID=       # id kênh muốn nhận thông báo, để trống thì im lặng
```

Đặt lệnh khởi động của panel là `npm start`.

> 🔑 Token nằm trong URL remote, nghĩa là nằm trong `.git/config` trên máy chủ —
> **không** nằm trong `.env`, và không bao giờ được commit. Mọi chuỗi bot lấy từ
> git đều đi qua hàm `che()` trước khi ra log hay ra Discord, nên token không lọt
> vào khung chat ngay cả khi git báo lỗi kèm nguyên URL.

> 🌐 MongoDB Atlas: host không có IP cố định, nên phải mở
> `Network Access → 0.0.0.0/0` và bù lại bằng mật khẩu DB thật dài. Whitelist
> từng IP một sẽ hỏng ngay lần host đổi máy.

### Lệnh trong Discord

| Lệnh | Việc |
|---|---|
| `!capnhat` | Xem bản đang chạy; có bản mới thì kéo về luôn |
| `!capnhat xem` | Chỉ xem, không kéo |
| `!capnhat thulai` | Gỡ cách ly, ép thử lại commit đã trượt |

Cả ba đều **chỉ admin** (`ADMIN_ID` trong `.env`). Lệnh này tắt bot và tải mã mới
về máy chủ — để hở cho người lạ là mất bot.

### Một chỗ KHÔNG tự cập nhật được

`scripts/supervisor.js` đã nằm trong bộ nhớ từ lúc panel bấm Start. `git pull`
có thay đổi file đó thì vẫn phải **restart từ panel** mới có hiệu lực. Đó chính
là lý do nó được viết mỏng nhất có thể và không `import` bất cứ thứ gì từ `src/`:
càng ít lý do phải sửa nó thì càng ít lần phải đụng tay vào panel.

---

## 🌟 Tính năng

### 🌱 0. Chuỗi nhiệm vụ tân thủ — `!tanthu`

Mười bước dẫn đạo mở khoá tuần tự: bước sau chỉ hiện khi bước trước đã lĩnh thưởng. Trước đây `!nhiemvubang` là nguồn nhiệm vụ duy nhất, mà lệnh đó lại đòi có tông môn — tốn 500 Linh Thạch — nên người mới không có gì để bám vào trong nửa giờ đầu.

| # | Nhiệm vụ | Điều kiện | Thưởng |
|---|---|---|---|
| 1 | Nhập Đạo | `!tuluyen` ×1 | 100 LT |
| 2 | Cần Cù Bù Tư Chất | `!lamcong` ×3 | 200 LT + 2 Linh Thảo |
| 3 | Sơ Chiến Yêu Thú | `!santhu` thắng ×1 | 300 LT + 2 Hồi Xuân Đan |
| 4 | Nhận Lộc Trời | `!diemdanh` ×1 | 250 LT |
| 5 | Khai Sơn Phá Thạch | `!daokhoang` ×3 | 400 LT + 3 Nguyên Thạch |
| 6 | Thoát Phàm Nhập Luyện Khí | Đạt cảnh giới Luyện Khí | 500 LT + Tụ Khí Đan |
| 7 | Sơ Nhập Đan Đạo | Luyện thành công 1 mẻ đan | 600 LT + 3 Linh Thảo |
| 8 | Chấp Chưởng Pháp Bảo | Mặc 1 pháp bảo lên người | 800 LT |
| 9 | Vạn Đạo Khởi Đầu | Sở hữu 2 công pháp | 1.000 LT |
| 10 | Xuất Sư Hạ Sơn | Luyện Khí tầng 5 | 3.000 LT + 10 Nguyên Thạch + Trúc Cơ Đan |

**Tổng cộng 7.150 Linh Thạch + 13 Nguyên Thạch** — đủ vốn để lập tông môn và bước hẳn vào vòng chơi chính.

* `!tanthu` (alias `!nhiemvu` · `!quest` · `!nv` · `!newbie`) mở bảng nhiệm vụ kèm nút **Lĩnh thưởng** bấm tại chỗ
* Đủ điều kiện thì dòng nhắc tự hiện ở cuối kết quả `!tuluyen` / `!lamcong` / `!daokhoang` / `!santhu` — không phải nhớ quay lại gõ
* Nút chỉ nhận đúng chủ nhân, và một lượt lĩnh được chốt bằng update có điều kiện trên `tutorial.step` nên bấm chồng bao nhiêu lần cũng chỉ ăn thưởng một lần
* Toàn bộ cân bằng nằm trong `src/config/tutorialQuests.json` — chỉnh số không cần đụng code

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
* `!dotpha` — công phá cảnh giới. Lên **tiểu cảnh giới** (Sơ Kỳ ➜ Đỉnh Phong) là **chắc chắn thành công**; chỉ khi vượt sang **đại cảnh giới** mới tung xúc xắc (Luyện Khí 60% · Trúc Cơ 45% · Nguyên Anh 25%)
* **Hộ Mạch Đan** là lưới an toàn: trượt mà có đan thì **giữ nguyên cảnh giới**, chỉ hao 15% tu vi; **trượt tay không thì tụt 1 tầng**, EXP còn 40%. Vào canh bạc với túi rỗng, bot chặn lại nhắc một nhịp — cố tình liều thì gõ `!dotpha xacnhan`
* **Ngã Rẽ Đại Đạo:** tại **Luyện Khí Đỉnh Phong**, `!dotpha` mở màn hình chọn nhánh — đột phá Trúc Cơ, hoặc **Nén Khí Từ Dương** lên **Tầng 5 ➜ 50** (chắc chắn thành công, miễn nhiễm lôi kiếp, nhưng là lựa chọn **một chiều**)
* `!dokiep` — tại Kim Đan Đỉnh Phong phải nghênh chiến **3 đạo Thiên Lôi**, chọn 1 trong 4 chiến thuật mỗi đạo (liều tay không: `!dokiep xacnhan`)
* **5 phẩm Kim Đan** (Hạ ➜ Trung ➜ Thượng ➜ Cực ➜ Thiên Đạo Vô Khuyết) quyết định tiềm lực hậu Nguyên Anh

### 🔮 4. Luyện đan & Chợ Trời
* Nguyên liệu: `!lamcong` hái **Linh Thảo**, `!santhu` thu **Yêu Đan + Linh Thảo** (**20 loài yêu thú**, mỗi loài rơi một loại Yêu Đan riêng)
* `!luyendan` — **10 phương thuốc** trải 5 phẩm cấp Hoàng ➜ Thần Giai. Mỗi phương có **ngưỡng cảnh giới** riêng, chưa đủ hỏa hầu thì khoá lò. `!uongdan` để dùng
* Thuộc tính vĩnh viễn từ đan có **trần hấp thụ theo cảnh giới** — đột phá xong mới nới thêm được
* **Trúc Cơ Đan** nhân tỉ lệ đột phá kế tiếp lên **×1,30** — tức tăng 30% *so với tỉ lệ đang có*, không phải cộng thẳng 30 điểm (60% ➜ 78%). Dùng một lần, cộng dồn tối đa ×1,30
* **Chợ Trời:** `!chotroi` xem hàng · `!ban <stt> <giá>` bán công pháp · `!bandan <stt> <giá>` bán đan · `!mua <mã>` · `!huyban <mã>` gỡ hàng
* Luật chợ: **thuế 5%** trừ vào tiền người bán (Tán Tu miễn) · giá **10 – 10.000.000** Linh Thạch · tối đa **10 gian hàng**/người

### 🛡️ 5. Tàng Bảo Các — 60 pháp bảo
`!baovat` tra cứu · `!xemphapbao` · `!ducphapbao` chế tác (hồi chiêu 60s) · `!phapbao` cường hóa `+1, +2, +3…`

**21 công thức chế tác** trải đủ 5 phẩm cấp, mở khoá dần theo cảnh giới; nguyên liệu là Yêu Đan của đúng loài yêu thú tương ứng.

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
| `!santhu` | 30s | Săn yêu thú lấy EXP + Yêu Đan + Linh Thảo |
| `!daokhoang` | 45s | Đào Nguyên Thạch |
| `!dothach` | 20s | Đổ thạch ăn may |
| `!ducphapbao` | 60s | Đúc pháp bảo |
| `!nhiemvubang` | 60s | Nhiệm vụ tông môn |
| `!phoban` | 120s | **8 ải phó bản** |

| `!khieuchien <@đối thủ> [cược]` | 20s | **PvP:** cược 50 – 20.000 LT · chênh tối đa 1 đại cảnh giới · lời mời sống 90s · tối đa 12 hiệp |

**Bấm lại, khỏi gõ lại:** kết quả của `!tuluyen` · `!lamcong` · `!santhu` · `!daokhoang` đều kèm nút **🔄 Làm lại** (nút chỉ nghe lời chủ nhân của nó). Mọi màn hình cũng in sẵn mốc sẵn sàng bằng đồng hồ đếm ngược của Discord — `Hồi chiêu: <t:…:R>` hiện thành "còn 24 giây" ngay trong client, không phải tự nhẩm.

`!diemdanh` / `!boique` — bói quẻ Thiên Cơ mỗi ngày (Đại Cát 15%: 500–800 LT) + chuỗi streak 7 ngày, ngày 7 nhận Hồi Xuân Đan + Hộ Mạch Đan + 500 LT + 10 Nguyên Thạch.

### 🏛️ 8. Tông môn & bảng xếp hạng
* `!laptongmon <tên>` khai sơn lập phái · `!tongmon` · `!moivaobang` · `!conghien <số>` đóng góp ngân khố · `!phongchuc` / `!khuctruc`
* **Luật đặt tên tông môn** (tên bang là chuỗi tự do duy nhất hiện lại cho người khác đọc): 2–32 ký tự · cấm dấu `@` · cấm ký tự định dạng markdown · cấm ký tự ẩn · trùng tên không phân biệt hoa thường
* **5 cấp sơn môn:** Cấp 1 (10 đệ tử, +5% EXP) ➜ Cấp 5 (60 đệ tử, +25% EXP, mở khóa Thần Thú Hộ Tông)
* `!top` / `!bxh` — **mặc định xếp theo Lực Chiến**, đổi bảng bằng menu ngay dưới embed: Tu Vi · Phú Hào · Tàng Kinh · Vạn Phái (`!bxhtongmon`)
* **Lực Chiến** `= ATK×4 + DEF×3 + Máu×0,5 + Bạo Kích×1000`, làm tròn xuống. Tu sĩ vừa khai đạo bắt đầu ở **184 điểm**
  * Tính trên `user.stats` — chỉ số pháp bảo đã được cộng vào đó ngay lúc mặc, nên bảng xếp hạng **không duyệt lại `equipments`**; cộng thêm lần nữa là ai đeo nhiều đồ càng leo hạng ảo
  * Chỉ một công thức duy nhất ở `src/utils/power.js`, khung tỉ võ (`pvpService`) gọi lại chính hàm đó — hai màn hình không bao giờ hiện hai con số khác nhau cho cùng một người

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
  services/                # economyService (trừ tài nguyên atomic), pvpService, sectService,
                           #   tutorialService (tiến độ & lĩnh thưởng chuỗi tân thủ)
                           #   updateService (dò git, kéo về, nghiệm thu, quay lui, cách ly)
  database/models/         # User, Sect, MarketItem
  config/                  # 13 file JSON: realms, skills, equipment, talents, factions, tutorialQuests…
  utils/                   # cooldown (nhãn hồi chiêu động) · power (Lực Chiến) · repeatButton (nút Làm lại)
                           #   sanitize (kiểm duyệt tên) · embedLimits (trần ký tự Discord)
scripts/
  supervisor.js            # Điểm khởi động thật của `npm start`: trông bot, bật lại, gọi cập nhật
  applyUpdate.js           # Thi hành một lượt cập nhật (tiến trình riêng, xem mục Tự động cập nhật)
                           # auditCodebase, rebalanceEquipments, resolveAndMapImgbb
tests/                     # testBot · testFullE2E · testUiLimits · testSanitize
                           # testTutorial · testBattlePower · testUpdateService
                           # testRaceConditions · smokeTanthu  (cần MongoDB thật)
start.bat                  # Bấm đôi để chạy trên Windows (kiểm .env, cài thư viện, npm start)
```

## 🔒 Ghi chú vận hành

* Mọi giao dịch tiêu tài nguyên (mua bán chợ, luyện đan, đúc/cường hóa pháp bảo, lập tông môn, cống hiến) đều đi qua **atomic update có điều kiện `$gte`** kèm đường hoàn tác — spam click không nhân đôi được vật phẩm hay Linh Thạch.
* Lệnh gõ tay và nút bấm/modal dùng **chung một hàm nghiệp vụ**, nên không lệch luật giữa hai đường.
* Client bật `allowedMentions: { parse: ['users'] }` — mọi chuỗi do người chơi đặt đều không thể biến thành lời gọi `@everyone` / `@here` hay ping role, kể cả khi một khâu kiểm duyệt nào đó bị bỏ sót. Vẫn cho ping đích danh người dùng vì chiến thư PvP cần.
* Phần thưởng vật phẩm đi qua `grantItems` — `$inc` vào ngăn sẵn có, `$push` kèm filter `$ne` khi chưa có ngăn, rồi `$inc` lại nếu bị chen ngang. Cố tình **không** dùng `save()`: `save()` kiểm tra hợp lệ toàn bộ document, nên một bản ghi cũ hỏng ở chỗ chẳng liên quan cũng đủ làm cú trao vật phẩm ném lỗi *sau khi* Linh Thạch đã trao.
* Chuỗi nhiệm vụ tân thủ lĩnh thưởng bằng `findOneAndUpdate` lọc theo đúng `tutorial.step` hiện tại — cú bấm thứ hai không khớp bộ lọc nên trả về `null`, không cần khoá hay cờ "đang xử lý". `tests/testRaceConditions.js` bắn 15 lượt lĩnh song song để chứng minh chỉ đúng một lượt ăn thưởng.
* `progressOf` **mặc định trả `done: false`** khi gặp `goal.type` lạ: gõ sai một chữ trong `tutorialQuests.json` sẽ làm chuỗi đứng lại chứ không phát không toàn bộ phần thưởng.
* `!admin` mặc định khóa cho tới khi `ADMIN_ID` được điền.
