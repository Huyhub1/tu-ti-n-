# 🌌 THIẾT KẾ DISCORD BOT TU TIÊN: THẾ GIỚI MỞ SANDBOX (TỰ DO CHÍNH - MA)
> **Triết lý thiết kế:** **KHÔNG ÉP CỐT TRUYỆN** — Toàn bộ thế giới là Sandbox mở, ân oán tình thù, lịch sử server và đế chế tông môn hoàn toàn do **chính người chơi tự tay viết nên**!  
> **Lấy cảm hứng từ cơ chế các siêu phẩm:** *Ta Trời Sinh Đã Là Nhân Vật Phản Diện*, *Đại Quản Gia Là Ma Hoàng*, *Ta Là Tà Đế*, *Luyện Khí Đỉnh Phong*.

---

## 🎲 I. KHỞI ĐẦU: QUAY TƯ CHẤT BẨM SINH & CHỌN ĐẠO TÂM (`/khoi-dau`)

Khi gõ `/khoi-dau`, người chơi sẽ trải qua **2 Bước Tạo Nhân Vật**:

```
Bước 1: 🔮 THỨC TỈNH TƯ CHẤT BẨM SINH (Quay ngẫu nhiên Linh Căn & Thể Chất)
       ├── Người chơi được tặng 2 lần [Tẩy Tủy Miễn Phí] nếu muốn quay lại.
       └── Các bậc: Phàm Phẩm (50%) -> Lương Phẩm (30%) -> Cực Phẩm (14%) -> Thiên Phẩm (5%) -> Thần Phẩm (1%)

Bước 2: ⚖️ LỰA CHỌN TRẬN DOANH ĐẠO TÂM (Nhận Bộ Buff Nội Tại)
       ├── ☀️ 1. CHÍNH ĐẠO (Hạo Nhiên Tâm Cảnh)
       ├── 🌘 2. MA ĐẠO (Sát Phạt Quyết Đoán)
       └── 🎭 3. TÁN TU / TRUNG LẬP (Tiêu Dao Tự Tại / Ngụy Quân Tử)
```

---

### 🧬 1. Hệ Thống 5 Bậc Tư Chất Bẩm Sinh (Innate Talent)

| Bậc Tư Chất | Tỉ Lệ | Các Loại Linh Căn / Thể Chất Bẩm Sinh | Hiệu Ứng Bẩm Sinh |
| :--- | :---: | :--- | :--- |
| **Phàm Phẩm** | **50%** | • *Ngũ Hành Tạp Linh Căn*<br>• *Phàm Nhân Chi Thể*<br>• *Khí Hải Bình Phàm* | Tốc độ tu luyện cơ bản (100%). Dễ tiếp thu các công pháp phổ thông. |
| **Lương Phẩm** | **30%** | • *Tam Linh Căn (Kim-Mộc-Thổ)*<br>• *Cương Cốt Thể*<br>• *Dũng Tuyền Khí Hải* | +15% Tốc độ bế quan tu luyện.<br>+10% Máu tối đa (HP). |
| **Cực Phẩm** | **14%** | • *Song Linh Căn (Lôi-Hỏa / Phong-Băng)*<br>• *Thuần Dương Chi Thể*<br>• *Huyền Âm Đạo Thai* | +35% Tốc độ tu luyện.<br>+20% Sát thương nguyên tố tương ứng.<br>Giảm 15% tiêu hao Linh Thạch khi đột phá. |
| **Thiên Phẩm** | **5%** | • *Thiên Linh Căn (Đơn hệ thuần khiết)*<br>• *Lôi Đình Thần Thể*<br>• *Kiếm Tâm Thông Minh* | +70% Tốc độ tu luyện.<br>Học công pháp nhanh x2 lần.<br>Giảm 30% sát thương lôi kiếp. |
| **Thần Phẩm** *(Nghịch Thiên)* | **1%** *(Cực Hiếm)* | • *Chí Tôn Cốt Bẩm Sinh*<br>• *Trọng Đồng Thần Nhãn*<br>• *Tiên Thiên Thánh Thể Đạo Thai*<br>• *Cửu U Ma Thể*<br>• *Hỗn Độn Thể* | +150% Tốc độ tu luyện.<br>Mở khóa ngay **1 Thần Thông Bẩm Sinh Độc Quyền** (Ví dụ: *Chí Tôn Kiếp Quang*, *Ma Nhãn Diệt Hồn*, *Hỗn Độn Thần Lôi*). |

> 💡 **Cơ chế Nghịch Thiên Cải Mệnh:** Người chơi quay ra Tư Chất Phàm/Lương Phẩm không hề bị phế! Về sau có thể:
> * Dùng **Tẩy Tủy Đan / Tạo Hóa Đan** luyện từ dược thảo để nâng bậc linh căn.
> * Hoặc dùng **Thôn Thiên Ma Công (Ma Đạo)** để cướp đoạt và dung hợp thể chất kẻ khác!
> * Hoặc dùng **Công Đức Tẩy Lễ (Chính Đạo)** để được Thiên Đạo ban phúc thăng cấp linh căn.

---

### ⚖️ 2. Hệ Thống 3 Lối Đi Đạo Tâm & Buff Khởi Đầu

```mermaid
graph TD
    ChoiceA[☀️ 1. CHÍNH ĐẠO\n(Hạo Nhiên Tâm Cảnh)] --> BuffA[+25% Tỉ Lệ Độ Kiếp An Toàn\n+15% Điểm Khí Vận ban đầu\nGiảm 20% sát thương từ Ma Đạo\nCông Pháp: Hạo Nhiên Kiếm Quyết]
    ChoiceB[🌘 2. MA ĐẠO\n(Sát Phạt Quyết Đoán)] --> BuffB[+20% EXP Thôn Phệ / Săn Quái\n+25% Sát Thương Bạo Kích\n+15% Tỉ Lệ Đoạt Bảo\nCông Pháp: Tàn Trang Huyết Khí Ma Công]
    ChoiceC[🎭 3. TÁN TU / TRUNG LẬP\n(Tiêu Dao / Ngụy Quân Tử)] --> BuffC[+25% Né Tránh & Tốc Độ Chạy Trốn\n+20% Linh Thạch Làm Việc / Chợ Trời\nMở Khóa: Kỹ Năng Đổi Mặt Nạ Ẩn Danh\nCông Pháp: Tiêu Dao Du Thân Pháp]
```

---

## 🌍 II. THẾ GIỚI SANDBOX: NGƯỜI CHƠI TỰ VIẾT LÊN TRUYỀN KỲ

Không có kịch bản định sẵn — Mọi biến động trong server đều do cộng đồng tạo ra:

1. **Ân Oán Cá Nhân & Tỉ Võ Phục Kích (`/khieu-chien`, `/danh-len`):**
   * Người chơi có thể công khai so tài trên Lôi Đài (an toàn, chỉ mất linh thạch cược).
   * Hoặc phục kích đánh lén ngoài dã ngoại (nguy hiểm: kẻ thua bị cướp tài nguyên/trọng thương, kẻ thắng nếu là Ma Đạo sẽ hút được EXP).
2. **Khai Sơn Lập Phái Do Người Chơi Tự Chủ (`/lap-tong-mon`):**
   * Đặt tên môn phái tự do: *Thái Thanh Tiên Tông, Cửu U Ma Cung, Tiêu Dao Thương Hội, Lạc Gia Thế Tộc...*
   * Tự phong chức vị: Chưởng Môn, Đại Trưởng Lão, Chấp Pháp Đường, Dược Đường, Đệ Tử Huyết Tử.
   * Tự đặt quan hệ ngoại giao: **Kết Minh**, **Trung Lập** hoặc **Tuyên Chiến** với Tông Môn khác trong Discord.
3. **Tranh Đoạt Mỏ Quặng & Linh Mạch Server:**
   * Các Tông Môn tranh nhau cắm cờ chiếm giữ các **Linh Mạch Trung Ương** để thu thuế Linh Thạch tự động cho toàn bang.

---

## 📚 III. HỆ THỐNG 100+ CÔNG PHÁP & ĐỘ HIẾM TÀNG KINH CÁC

Công pháp chia làm **4 Nhóm** (Tâm Pháp, Quyết Pháp, Thân Pháp, Bí Thuật) với **3 Tầng Độ Hiếm**:

```mermaid
graph TD
    Root[TÀNG KINH CÁC VẠN ĐẠO] --> C1[1. Tâm Pháp: Tăng Tu Vi & HP/Pháp Lực]
    Root --> C2[2. Quyết Pháp: Sát Thương, Kiếm/Đao/Chưởng/Quyền]
    Root --> C3[3. Thân Pháp: Tốc Độ & Né Tránh]
    Root --> C4[4. Bí Thuật: Cấy Ma Hạt, Hộ Thể, Đan Thuật, Luyện Thi]

    C1 & C2 & C3 & C4 --> TierCommon[🟢 100+ CÔNG PHÁP PHỔ THÔNG\n(Dễ kiếm: Chợ trời, Làm công, Quái thường)]
    C1 & C2 & C3 & C4 --> TierRare[🔵 CÔNG PHÁP MẠNH - ĐỊA/THIÊN GIAI\n(Khó kiếm: Boss Bí Cảnh, Đấu Giá, Tông Môn)]
    C1 & C2 & C3 & C4 --> TierLegend[🔴 BÍ TỊCH HIẾM / CẤM KỴ\n(Cực khó: Mảnh Tàn Trang 1/100, Rương Thiên Đạo)]
```

* **Dễ tìm (100+ Bí kíp):** *Trường Xuân Công, Toái Thạch Quyền, Liệt Hỏa Kiếm, Xuyên Vân Chỉ, Lạc Diệp Bộ, Quy Tức Khí Công (Ẩn tu vi), Bách Thảo Kinh...*
* **Khó tìm (Công pháp mạnh):** *Tử Khí Đông Lai, Huyết Ma Trảm Thiên Đao, Vạn Kiếm Quy Tông, Kim Cương Bất Hoại, Huyễn Ảnh Phân Thân...*
* **Cực khó (Bí tịch cấm kỵ / Thần cấp):** *Cửu U Bí Lục (Trác Phàm), Thôn Thiên Ma Công (Cố Trường Ca), Vạn Cổ Luyện Khí Quyết (Từ Dương), Mị Ma Thần Tâm (Tạ Diệm)...*
* **Lò Luyện Vạn Đạo (`/dung-hop`):** Gom **5 công pháp phổ thông đã luyện Viên Mãn** để hợp thành **1 công pháp bậc cao ngẫu nhiên**!

---

## ⚖️ IV. TIẾN TRÌNH TU LUYỆN & CÂN BẰNG PHIÊN BẢN

```
📦 VERSION 1.0 (Hiện tại):
  ├── Cảnh Giới: Phàm Nhân -> Luyện Khí (Tầng 1-50) -> Trúc Cơ -> Kim Đan.
  ├── Nhánh Luyện Khí 100k Năm: Bấm [Nén Khí] lên Luyện Khí Tầng 10 -> 50 (Miễn lôi kiếp).
  ├── Kinh Tế: Làm công (/lam-cong), Bế quan (/tuluyen), Mua bán Chợ trời (/cho-troi).
  └── Bí Tịch: 100+ Hoàng Giai, 20 Huyền Giai, Tàn Trang Mảnh Cấp 1.

📦 VERSION 1.1 (Cập nhật Tông Môn & Thế Lực):
  ├── Cảnh Giới: Mở Nguyên Anh & Hóa Thần (Mở Luyện Khí Tầng 200).
  ├── Mở tính năng: Lập Tông Môn Cấp 1-2, Nuôi Huyết Anh Cấp 1, Boss Thế Giới.

📦 VERSION 1.2 (Chiến Tranh & Đạo Lữ):
  ├── Cảnh Giới: Thần Vương & Bán Thánh.
  ├── Mở tính năng: Tông Môn Đại Chiến, Chiêu mộ Hồng Nhan / Đạo Lữ.
```

---

## 🤖 V. DANH SÁCH LỆNH SLASH (`/`) BẢN V1.0

### 👤 Nhóm Khởi Tạo & Thông Tin
* `/khoi-dau` - Tạo nhân vật: Quay Tư Chất Bẩm Sinh (Linh Căn/Thể Chất) + Chọn Trận Doanh (Chính/Ma/Tán Tu).
* `/tay-tuy` - Dùng Tẩy Tủy Đan để quay lại Tư Chất Bẩm Sinh.
* `/tupan` - Mở Bảng Tu Chân (hiển thị Cảnh giới, Tư chất bẩm sinh, Buff trận doanh, Linh thạch, Điểm riêng).
* `/mat-na` - [Dành cho Tán Tu/Ngụy Quân Tử] Đổi danh tính Ẩn Danh / Minh Diện.
* `/tui-do` - Mở kho đồ chứa pháp bảo, đan dược, bí kíp.

### 🧘 Nhóm Tu Hành & Công Pháp
* `/tuluyen` - Bế quan tích lũy EXP Tu Vi (Idle AFK có giới hạn chống spam).
* `/dotpha` - Đột phá cảnh giới mới (hoặc chọn [Nén Khí Hải Tầng]).
* `/tang-kinh-cac` - Xem và trang bị công pháp (Tâm Pháp, Quyết Pháp, Thân Pháp, Bí Thuật).
* `/luyen-cong` - Rèn luyện tăng độ thuần thục công pháp (Sơ Thành $\rightarrow$ Viên Mãn).
* `/dung-hop` - Dung hợp 5 công pháp phẩm thấp thành công pháp phẩm cao.

### 💰 Nhóm Kinh Tế & Tương Tác Sandbox
* `/lam-cong` - Làm việc kiếm Linh Thạch (Đốn củi, Hái thuốc, Đào khoáng, Bắt yêu).
* `/cho-troi` - Mua bán trao đổi bí kíp, đan dược tự do giữa người chơi.
* `/khieu-chien @user` - Tỉ võ lôi đài cá cược Linh Thạch an toàn.
* `/danh-len @user` - Phục kích cướp đoạt tài nguyên (có rủi ro bị phản sát/truy nã).
* `/lap-tong-mon <Tên> <Tôn Chỉ>` - Tạo môn phái / thế gia riêng trong Server.

---

## 📱 VI. GIAO DIỆN TƯƠNG TÁC BUTTONS (V1.0 SANDBOX)

```
┌─────────────────────────────────────────────────────────────┐
│ 🌌 [BẢNG TU CHÂN SANDBOX] - Đạo Hiệu: Diệp Vô Trần          │
│ ─────────────────────────────────────────────────────────── │
│ 🧬 Tư Chất:    ⚡ [Lôi Đình Thần Thể] (Thiên Phẩm - +70% EXP)│
│ 🔸 Trận Doanh: 🌘 MA ĐẠO (Buff: +20% EXP, +25% Bạo Kích)    │
│ 🔸 Cảnh Giới:  Luyện Khí Tầng 9 (EXP: 520/600)              │
│ 🔸 Công Pháp:  [Huyết Khí Quyết] - Đại Thành (80%)          │
│ 🔸 Tông Môn:   Chưa gia nhập                                │
│ 🔸 Tài Sản:    💎 320 Linh Thạch | 🩸 45 Tà Tâm             │
└─────────────────────────────────────────────────────────────┘
 [ 🧘 Tu Luyện ]   [ 🔨 Làm Công ]   [ 📚 Tàng Kinh Các ] [ 📦 Túi Đồ ]
 [ ⚡ Đột Phá ]    [ ⚔️ Khiêu Chiến ] [ 🏪 Chợ Trời ]     [ 🏛️ Tông Môn ]
```
