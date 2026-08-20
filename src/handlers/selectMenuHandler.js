import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { User } from '../database/models/User.js';
import { MarketItem } from '../database/models/MarketItem.js';
import { createHelpSelectMenuRow } from '../commands/slash/help.js';
import { createPublicGearListEmbed, createPublicGearSelectMenu, createPublicGearButtons } from '../commands/prefix/baovat.js';
import { createTopEmbed, createTopSelectMenu } from '../commands/prefix/top.js';
import { getPillById, createAlchemySelectMenu } from '../commands/prefix/alchemy.js';

import { combatSessions } from '../commands/prefix/hunting.js';
import { purchaseListing, buildPurchaseEmbed } from '../commands/prefix/market.js';
import { dungeonCombatSessions } from '../commands/prefix/dungeon.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monstersConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/monsters.json'), 'utf8'));
const dungeonsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/dungeons.json'), 'utf8'));
const recipesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/recipes.json'), 'utf8'));
const equipmentConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/equipment.json'), 'utf8'));

export async function handleSelectMenu(interaction) {
  const customId = interaction.customId;
  const selected = interaction.values[0];
  const clickerId = interaction.user.id;

  // 1. Menu Tra Cứu Help
  if (customId === 'help_select_category') {
    const embed = new EmbedBuilder().setColor('#9C27B0');
    const menuRow = createHelpSelectMenuRow();

    switch (selected) {
      case 'help_talent':
        embed
          .setTitle(`🧬 [CẨM NANG] - 1. Tư Chất Bẩm Sinh & Linh Căn`)
          .setDescription(
            `Khi dùng lệnh \`/khoi-dau\`, thiên đạo sẽ ngẫu nhiên ban cho bạn 1 trong 5 bậc Tư Chất Bẩm Sinh duy nhất (không được quay lại để chống spam và giữ độ hiếm):\n\n` +

            `• ⬜ **Phàm Phẩm (50%):** *Ngũ Hành Tạp Linh Căn, Phàm Nhân Chi Thể* ➜ EXP **x1.00**, căn cơ bình phàm.\n` +
            `• 🟩 **Lương Phẩm (30%):** *Tam Linh Căn, Cương Cốt Thể* ➜ EXP **x1.15**, HP tối đa **+10%**.\n` +
            `• 🟦 **Cực Phẩm (14%):** *Song Linh Căn Lôi-Hỏa, Thuần Dương Thể* ➜ EXP **x1.35**, HP **+10%**, sát thương **+20%**, vạch tu vi mỗi tầng **-15%**.\n` +
            `• 🟪 **Thiên Phẩm (5%):** *Thiên Linh Căn, Lôi Đình Thần Thể, Kiếm Tâm* ➜ EXP **x1.70**, HP **+15%**, sát thương **+25%**, vạch tu vi **-15%**, luyện công **x2** thuần thục, chịu lôi kiếp **-30%**.\n` +
            `• 🟨 **Thần Phẩm (1% - Nghịch Thiên):** *Chí Tôn Cốt, Trọng Đồng, Tiên Thiên Đạo Thai, Cửu U Ma Thể, Hỗn Độn Thể* ➜ EXP **x2.50**, HP **+20%**, sát thương **+35%**, vạch tu vi **-20%**, luyện công **x2.5**, chịu lôi kiếp **-45%** + 1 **Thần Thông Bẩm Sinh Độc Quyền**.\n\n` +
            `📌 *Bậc sau luôn bao trọn ưu đãi của bậc trước — không có chuyện tư chất hiếm hơn lại yếu hơn.*\n` +
            `👉 Gõ \`!tupan\` để xem đúng dòng đặc quyền tư chất của mình.`
          );
        break;

      case 'help_faction':
        embed
          .setTitle(`⚖️ [CẨM NANG] - 2. Trận Doanh & Đạo Tâm`)
          .setDescription(
            `Có 3 con đường đạo tâm để bạn tự do lựa chọn:\n\n` +

            `☀️ **CHÍNH ĐẠO (Danh Môn Tiên Đạo)**\n` +
            `• **Buff nội tại:** Tỉ lệ đột phá **+25%**, khí vận **+15**, giảm **10%** mọi sát thương nhận vào, hiệu quả đan dược **+15%**.\n` +
            `• **Tài nguyên:** Thu thập **Điểm Công Đức** qua việc làm việc thiện, cứu nhân độ thế ➜ Đổi Thần Phù, Hộ Thể Kim Thân.\n\n` +
            `🌘 **MA ĐẠO (Sát Phạt Đoạt Mệnh)**\n` +
            `• **Buff nội tại:** EXP giết quái **+20%**, EXP bế quan **+10%**, sát thương bạo kích **+25%**, tỉ lệ rớt đồ hiếm **+15%**.\n` +
            `• **Tài nguyên:** Thu thập **Điểm Tà Tâm & Thiên Mệnh** qua chèn ép kẻ khác, cấy Ma Hạt, luyện Huyết Anh ➜ Đổi Cấm Kỵ Ma Công Cửu U.\n\n` +
            `🎭 **TÁN TU (Tiêu Dao / Ngụy Quân Tử)**\n` +
            `• **Buff nội tại:** Né đòn **10%**, Linh Thạch làm công **+20%**, đào khoáng **+20%**, **miễn hoàn toàn thuế chợ 5%** khi bán hàng.\n` +
            `• **Kỹ năng độc quyền:** \`!matna\` (Đổi Mặt Nạ Ẩn Danh) để làm cả việc xấu của Ma Đạo lẫn việc tốt của Chính Đạo mà không bị lộ!`
          );
        break;

      case 'help_cultivation':
        embed
          .setTitle(`🧘 [CẨM NANG] - 3. Bế Quan Tu Luyện & Thiên Lôi Độ Kiếp`)
          .setDescription(
            `• **Bế Quan (\`!tuluyen\` - Delay 10s):** Nhận EXP Tu Vi theo thời gian.\n` +
            `• **Đột Phá (\`!dotpha\`):** Khi EXP đầy, tiến hành đột phá cảnh giới.\n` +
            `• **Thiên Lôi Độ Kiếp (\`!dokiep\`):** Khi đạt Kim Đan Đỉnh Phong viên mãn, lệnh \`!dotpha\` sẽ khóa lại, tu sĩ bắt buộc phải gõ \`!dokiep\` để nghênh chiến 3 Đạo Thiên Lôi xé trời phá đan hóa Nguyên Anh!\n` +
            `*(⚡ Cách thức hóa giải và sinh tồn trước thiên uy là bí mật của Thiên Đạo, tu sĩ phải tự mình chuẩn bị và đúc kết kinh nghiệm sinh tử!)*\n\n` +
            `🌟 **2 Lối Đi Cảnh Giới Độc Đáo:**\n` +
            `1. **Lối Đi Truyền Thống:** Phàm Nhân ➜ Luyện Khí ➜ Trúc Cơ ➜ Kim Đan ➜ **Nguyên Anh Kỳ**.\n` +
            `2. **Lối Đi Vạn Cổ Luyện Khí (Kế thừa Từ Dương - 100k Năm):**\n` +
            `   - Ở Luyện Khí Tầng 9, tiếp tục **Nén Khí Hải** lên Luyện Khí Tầng 10 ➜ 50+.\n` +
            `   - **Ưu điểm:** Khí hải vô tận, tăng vọt HP và Sát Thương, **miễn nhiễm 100% Thiên Kiếp Lôi Phạt**!`
          );
        break;

      case 'help_alchemy_market':
        embed
          .setTitle(`🔮 [CẨM NANG] - 4. Lò Luyện Đan Vạn Cổ & Chợ Trời Giao Thương`)
          .setDescription(
            `🧪 **Lò Luyện Đan (\`!luyendan\` / \`!alchemy\`):**\n` +
            `• **Thu hái dược liệu:** Đi làm công (\`!lamcong\`) để nhặt **Linh Thảo**, săn quái (\`!santhu\`) để lấy **Yêu Đan**.\n` +
            `• **6 Phương Thuốc Cực Phẩm:**\n` +
            `  1. **Hồi Xuân Đan:** Hồi phục ngay 500 HP.\n` +
            `  2. **Tụ Khí Đan:** Nuốt vào nhận ngay +200 EXP Tu Vi.\n` +
            `  3. **Tẩy Tủy Đan:** Tăng vĩnh viễn +10 ATK, +5 DEF và +350 EXP.\n` +
            `  4. **Trúc Cơ Đan:** +30% tỉ lệ thành công khi Đột Phá + 200 HP + 500 EXP.\n` +
            `  5. **Kim Đan Cố Bản Đan:** Tăng vĩnh viễn +25 ATK, +500 HP, +15 DEF và +1200 EXP.\n` +
            `  6. **Hộ Mạch Đan:** Bảo vệ kinh mạch, miễn trừ mất EXP khi độ kiếp thất bại.\n` +
            `• **Nuốt Đan Dược (\`!uongdan <tên/stt>\`):** Sử dụng đan dược trong túi.\n\n` +

            `🏪 **Chợ Trời Tu Chân Giới (\`!chotroi\` / \`!choden\`):**\n` +
            `• Đăng bán Công Pháp: \`!ban <stt_kỹ_năng> <giá_LT>\`\n` +
            `• Đăng bán Đan Dược: \`!bandan <tên_đan_hoặc_stt> <số_lượng> <tổng_giá_LT>\`\n` +
            `• Mua hàng từ người chơi: \`!mua <mã_số>\`\n` +
            `• Thu hồi gian hàng: \`!huyban <mã_số>\` (nhận lại nguyên vật phẩm)\n` +
            `• **Thuế chợ 5%:** người bán nhận 95% giá niêm yết — **Tán Tu được miễn thuế**.\n` +
            `• Giới hạn: giá **10 ➜ 10.000.000 LT**, tối đa **10 gian hàng** mở cùng lúc mỗi người.`
          );
        break;

      case 'help_gears':
        embed
          .setTitle(`🛡️ [CẨM NANG] - 5. Tàng Bảo Các & 60 Pháp Bảo Thần Giai`)
          .setDescription(
            `• **Tàng Bảo Các (\`!baovat\`):** Tra cứu công khai 60 pháp bảo chia theo 5 phẩm cấp (Hoàng, Huyền, Địa, Thiên, Thần) kèm ảnh banner to HD.\n` +
            `• **Xem Chi Tiết (\`!xemphapbao <tên/id>\`):** Xem chỉ số, điển tích, Tuyệt Kỹ chiến đấu & nội tại VIP.\n` +
            `• **Lò Đúc Thần Binh (\`!ducphapbao\`):** Dùng Nguyên Thạch & Linh Thạch nung đúc Binh Khí / Pháp Bảo mới.\n` +
            `• **Trang Bị & Cường Hóa (\`!phapbao\`):** Mặc đồ tối ưu vào người và đập búa cường hóa (+1, +2, +3...) gia tăng sức mạnh vượt bậc!\n` +
            `• **Sức Mạnh Thần Giai:** Miễn nhiễm 35% sát thương, buff +150% EXP tu luyện vĩnh viễn, Tuyệt kỹ x7.5 sát thương!`
          );
        break;

      case 'help_skills':
        embed
          .setTitle(`📜 [CẨM NANG] - 6. Tàng Kinh Các 100+ Bí Kíp & Lò Vạn Đạo`)
          .setDescription(

            `• **Tàng Kinh Các (
\`!tangkinhcac\` / \`!bikip\`):** Xem danh sách công pháp đã học, độ thuần thục (%) và chỉ số cộng thêm.\n` +
            `• **Khay Chiến Đấu (\`!kichhoat <stt>\`):** Bật/tắt công pháp mang theo khi giao chiến, **tối đa 4 bí kíp** + 2 tuyệt kỹ pháp bảo. Chưa chọn gì thì bot tự lấy 4 bí kíp phẩm cao nhất trong kho.\n` +
            `• **Rèn Luyện (\`!luyencong <stt>\`):** Luyện tăng độ thuần thục của bí kíp (+15% Mastery, Delay 10s). Tư chất Thiên/Thần Phẩm luyện nhanh **x2 ➜ x2.5**.\n` +
            `• **Lò Luyện Vạn Đạo (\`!dunghop [phẩm cấp]\`):** Nấu chảy 5 công pháp Viên Mãn (100%) cùng phẩm cấp thành 1 công pháp phẩm cấp cao hơn ngẫu nhiên!`
          );
        break;

      case 'help_economy':
        embed
          .setTitle(`💰 [CẨM NANG] - 7. Săn Thú, Khai Khoáng, Đổ Thạch & Phó Bản`)
          .setDescription(
            `• **Làm Công (\`!lamcong\` - Delay 30s):** Kiếm Linh Thạch và có 50% tỉ lệ hái được **Linh Thảo** luyện đan.\n` +
            `• **Đào Khoáng (\`!daokhoang\` - Delay 45s):** Khai thác linh mạch kiếm Nguyên Thạch & Linh Thạch đúc đồ.\n` +

            `• **Đổ Thạch (\`!dothach <cược>\` - Delay 20s):** Cắt đá may rủi tìm Nguyên Thạch quý.\n` +
            `• **Săn Yêu Thú (\`!santhu\` - Delay 30s):** Giao chiến turn-based với yêu thú, nhận Yêu Đan, Linh Thạch & Nguyên Thạch.\n` +
            `• **Phó Bản Bí Cảnh (\`!phoban\` - Delay 120s):** Trảm Boss cổ đại mở rương bí kíp & bảo vật hiếm!\n` +
            `• **Đúc Pháp Bảo (\`!ducphapbao\` - Delay 60s):** Nung đúc thần binh từ Nguyên Thạch, Linh Thạch và Yêu Đan.\n` +
            `• **Lôi Đài PvP (\`!khieuchien @user <cược>\` - Delay 20s):** Cược **50 ➜ 20.000 LT**, chỉ đấu được với người chênh **tối đa 1 đại cảnh giới**, chiến thư hết hạn sau **90s**, trận tối đa **12 hiệp**.`
          );
        break;

      case 'help_sect_top':
        embed
          .setTitle(`👑 [CẨM NANG] - 8. Tông Môn 2.0 & Bảng Xếp Hạng Vạn Giới`)
          .setDescription(
            `🏛️ **Hệ Thống Tông Môn 2.0:**\n` +
            `• **Lập Môn Phái (\`!laptongmon <Tên>\`):** Chi ra 500 Linh Thạch để khai sơn lập phái.\n` +
            `• **Bảng Quản Lý Bang (\`!tongmon\`):** Xem cấp độ Sơn Môn, ngân khố và bấm nút **[💎 Cống Hiến LT]** để nhập số tiền đóng góp tùy ý.\n` +
            `• **Nhiệm Vụ Bang (\`!nhiemvubang\` - Delay 60s):** Tuần tra trừ yêu nhận EXP, LT, cống hiến & uy danh.\n` +
            `• **Phúc Lợi Sơn Môn 5 Cấp:** Tăng từ **+5% đến +25% EXP Tu Luyện**, giảm phí đột phá, mở khóa **Thần Thú Hộ Tông Vạn Cổ**.\n\n` +
            `🏆 **Bảng Xếp Hạng Vạn Giới (\`!top\` / \`!bxh\`):**\n` +
            `Menu Dropdown chuyển đổi 5 bảng vinh danh toàn server: Cảnh Giới, Phú Hào, Lực Chiến, Tàng Kinh, Vạn Phái!`
          );
        break;

      case 'help_commands_list':
        embed
          .setTitle(`⚡ [CẨM NANG] - 9. Danh Sách Đầy Đủ Tất Cả Lệnh`)
          .setDescription(

            `**👤 Nhân Vật & Tu Vi:**\n` +
            `• \`/khoi-dau\` : Tạo nhân vật, gacha tư chất bẩm sinh, chọn phe.\n` +
            `• \`!profile\` / \`!tupan\` : Mở Bảng Tu Chân.\n` +
            `• \`!tuido\` / \`!cankhon\` : Mở Túi Càn Khôn, dùng vật phẩm.\n` +
            `• \`!diemdanh\` / \`!daily\` : Điểm danh nhận lộc ngày (Streak 7 ngày).\n` +
            `• \`!boique\` / \`!que\` : Bói Quẻ Thiên Cơ đổi vận khí.\n` +
            `• \`!tuluyen\` : Bế quan nhận EXP (Delay 10s).\n` +
            `• \`!dotpha\` : Đột phá cảnh giới / nén khí Từ Dương.\n` +
            `• \`!dokiep\` : Nghênh chiến Thiên Lôi Kiếp (Kim Đan ➜ Nguyên Anh).\n` +
            `• \`!matna\` : *(Tán Tu)* Đeo mặt nạ ẩn danh.\n\n` +
            `**📜 Công Pháp:**\n` +
            `• \`!tangkinhcac\` : Xem kho bí kíp & độ thuần thục.\n` +
            `• \`!kichhoat <stt>\` : Bật/tắt bí kíp cho khay chiến đấu (tối đa 4).\n` +
            `• \`!luyencong <stt>\` : Luyện tăng thuần thục (Delay 10s).\n` +
            `• \`!dunghop [phẩm cấp]\` : Nấu 5 bí kíp Viên Mãn thành 1 bí kíp cao hơn.\n\n` +
            `**🔮 Luyện Đan & Chợ Trời:**\n` +
            `• \`!luyendan\` : Mở Lò Luyện Đan Vạn Cổ.\n` +
            `• \`!uongdan <tên/stt>\` : Nuốt linh đan tăng HP, EXP & chỉ số vĩnh viễn.\n` +
            `• \`!chotroi\` : Mở Chợ Trời giao thương Công Pháp & Đan Dược.\n` +
            `• \`!ban <stt_kỹ_năng> <giá>\` : Đăng bán công pháp.\n` +
            `• \`!bandan <tên> <số_lượng> <giá>\` : Đăng bán đan dược.\n` +
            `• \`!mua <mã_số>\` : Mua hàng *(thuế chợ 5%, Tán Tu miễn thuế)*.\n` +
            `• \`!huyban <mã_số>\` : Thu hồi gian hàng, lấy lại vật phẩm.\n\n` +
            `**🛡️ Pháp Bảo & Trang Bị:**\n` +
            `• \`!baovat\` : Tàng Bảo Các tra cứu 60 pháp bảo.\n` +
            `• \`!xemphapbao <tên/id>\` : Xem chi tiết bảo vật & Tuyệt Kỹ.\n` +
            `• \`!ducphapbao\` : Lò đúc vũ khí & pháp bảo (Delay 60s).\n` +
            `• \`!phapbao\` : Mặc trang bị và đập búa cường hóa.\n\n` +
            `**⚔️ Chiến Đấu & Khai Thác:**\n` +
            `• \`!lamcong\` : Kiếm Linh Thạch & hái Linh Thảo (Delay 30s).\n` +
            `• \`!daokhoang\` : Đào mỏ kiếm Nguyên Thạch (Delay 45s).\n` +
            `• \`!dothach <cược>\` : Đổ thạch tìm ngọc quý (Delay 20s).\n` +
            `• \`!santhu\` : Săn quái turn-based lấy Yêu Đan (Delay 30s).\n` +
            `• \`!phoban\` : Vượt ải chiến Boss Bí Cảnh (Delay 120s).\n` +
            `• \`!khieuchien @user <cược>\` : Lôi đài PvP, cược 50–20.000 LT (Delay 20s).\n\n` +
            `**🏛️ Tông Môn & Xếp Hạng:**\n` +
            `• \`!laptongmon <tên>\` : Sáng lập môn phái riêng (500 LT).\n` +
            `• \`!tongmon\` : Bảng điều khiển Tông Môn & cống hiến quỹ bang.\n` +
            `• \`!moivaobang @user\` : Chiêu mộ đệ tử.\n` +
            `• \`!conghien <số_LT>\` : Nạp Linh Thạch vào ngân khố.\n` +
            `• \`!nhiemvubang\` : Làm nhiệm vụ tông môn (Delay 60s).\n` +
            `• \`!phongchuc @user <chức>\` / \`!khuctruc @user\` : Quản lý nhân sự.\n` +
            `• \`!top\` / \`!bxh\` : Bảng Xếp Hạng Vạn Giới (5 bảng).\n` +
            `• \`!bxhtongmon\` : Bảng xếp hạng các tông môn.`
          );
        break;
    }

    return interaction.update({ embeds: [embed], components: [menuRow] });
  }

  // 1.1. Menu Lọc Phẩm Cấp Bảo Vật (!baovat)
  if (customId.startsWith('gear_filter_rarity_')) {
    const targetUserId = customId.replace('gear_filter_rarity_', '');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Menu này không thuộc về bạn!`, ephemeral: true });
    }

    const rarity = selected;
    const { embed, page, totalPages } = createPublicGearListEmbed(rarity, 1);
    const menuRow = createPublicGearSelectMenu(rarity, clickerId);
    const buttonsRow = createPublicGearButtons(rarity, page, totalPages, clickerId);

    return interaction.update({ embeds: [embed], components: [menuRow, buttonsRow] });
  }

  // 1.2. Menu Chọn Danh Mục Bảng Xếp Hạng (!top / !bxh)
  if (customId.startsWith('top_category_select_')) {
    const targetUserId = customId.replace('top_category_select_', '');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Menu này không thuộc về bạn!`, ephemeral: true });
    }

    const category = selected;
    const embed = await createTopEmbed(category);
    const menuRow = createTopSelectMenu(category, clickerId);

    return interaction.update({ embeds: [embed], components: [menuRow] });
  }

  // 2. Menu Chọn Công Thức Đúc Pháp Bảo (!ducphapbao)
  if (customId.startsWith('craft_select_recipe_')) {
    const recipeId = selected;
    const recipe = recipesConfig.recipes.find(r => r.id === recipeId);
    if (!recipe) return interaction.reply({ content: `❌ Công thức không tồn tại!`, ephemeral: true });

    const user = await User.findOne({ userId: clickerId });
    if (!user) return interaction.reply({ content: `❌ Chưa tạo nhân vật!`, ephemeral: true });

    const targetGear = equipmentConfig.equipments.find(e => e.id === recipe.targetEquipmentId);

    // Kiểm tra nguyên liệu
    let hasEnoughItems = true;
    let missingInfo = '';

    if ((user.currencies.nguyenThach || 0) < recipe.requirements.nguyenThach) {
      hasEnoughItems = false;
      missingInfo += `\n❌ Thiếu Nguyên Thạch: Cần \`${recipe.requirements.nguyenThach}\` (Hiện có: \`${user.currencies.nguyenThach || 0}\`)`;
    }
    if (user.currencies.linhThach < recipe.requirements.linhThach) {
      hasEnoughItems = false;
      missingInfo += `\n❌ Thiếu Linh Thạch: Cần \`${recipe.requirements.linhThach}\` (Hiện có: \`${user.currencies.linhThach}\`)`;
    }

    recipe.requirements.items.forEach(req => {
      const invItem = user.inventory.find(i => i.itemId === req.itemId);
      const count = invItem ? invItem.quantity : 0;
      if (count < req.quantity) {
        hasEnoughItems = false;
        missingInfo += `\n❌ Thiếu ${req.name}: Cần \`${req.quantity}\` (Hiện có: \`${count}\`)`;
      }
    });

    const embed = new EmbedBuilder()
      .setTitle(`🔨 [CHI TIẾT CÔNG THỨC ĐÚC] - ${recipe.name}`)
      .setColor(recipe.rarity === 'DIA_GIAI' ? '#9C27B0' : '#00BCD4')
      .setDescription(
        `**Mục Tiêu:** **[${targetGear ? targetGear.name : recipe.name}]** (*${recipe.rarity}*)\n` +
        `📖 **Mô Tả:** *${recipe.desc}*\n\n` +
        `📋 **Yêu Cầu Nguyên Liệu:**\n` +
        `• 🔮 Nguyên Thạch: \`${recipe.requirements.nguyenThach}\`\n` +
        `• 💎 Linh Thạch: \`${recipe.requirements.linhThach.toLocaleString()}\`\n` +
        `• 🎁 Vật phẩm: ${recipe.requirements.items.map(i => `\`${i.quantity}x ${i.name}\``).join(', ')}\n` +
        `${hasEnoughItems ? '\n✅ **ĐÃ ĐỦ NGUYÊN LIỆU! Có thể tiến hành tôi rèn ngay!**' : missingInfo}`
      );

    if (targetGear && targetGear.imageUrl && (targetGear.imageUrl.startsWith('http://') || targetGear.imageUrl.startsWith('https://'))) {
      embed.setImage(targetGear.imageUrl);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_start_craft::${recipe.id}::${clickerId}`)
        .setLabel('🔥 Nhóm Lửa Tôi Rèn')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasEnoughItems),
      new ButtonBuilder()
        .setCustomId(`btn_cancel_craft::${clickerId}`)
        .setLabel('❌ Hủy Bỏ')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // 3. Menu Chọn Món Đồ Để Quản Lý Trong !phapbao (!trangbi)
  if (customId.startsWith('gear_select_action_')) {
    const targetUserId = customId.replace('gear_select_action_', '');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Kho trang bị này không thuộc về bạn!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Chưa tạo nhân vật!`, ephemeral: true });

    // selected: gear_<gearId>_<idx>
    const parts = selected.split('_');
    const idx = parseInt(parts[parts.length - 1], 10);
    const gear = user.equipments[idx];

    if (!gear) return interaction.reply({ content: `❌ Trang bị không tồn tại!`, ephemeral: true });

    // Tìm ảnh từ equipment.json nếu gear chưa có ảnh hoặc ảnh là file name cũ
    const baseGear = equipmentConfig.equipments.find(e => e.id === gear.gearId);
    let imageUrl = (gear && gear.imageUrl) || (baseGear && baseGear.imageUrl) || '';
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      if (baseGear && baseGear.imageUrl && (baseGear.imageUrl.startsWith('http://') || baseGear.imageUrl.startsWith('https://'))) {
        imageUrl = baseGear.imageUrl;
      } else {
        imageUrl = '';
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ [THÔNG TIN PHÁP BẢO] - ${gear.name} ${gear.enhanceLevel > 0 ? `(+${gear.enhanceLevel})` : ''}`)
      .setColor(gear.slot === 'weapon' ? '#E91E63' : '#9C27B0')
      .setDescription(
        `**Phân Loại:** \`${gear.type}\` (${gear.slot === 'weapon' ? 'Binh Khí Chính' : 'Bản Mệnh Pháp Bảo'})\n` +
        `**Phẩm Cấp:** \`${gear.rarityName}\`\n` +
        `**Trạng Thái:** ${gear.equipped ? '✅ **[Đang Trang Bị]**' : '⭕ **[Trong Kho]**'}\n\n` +
        `📊 **Chỉ Số Gia Tăng:**\n` +
        `🗡️ **Công Kích (ATK):** \`+${gear.stats.atk}\`\n` +
        `🛡️ **Phòng Ngự (DEF):** \`+${gear.stats.def}\`\n` +
        `❤️ **Sinh Mệnh (HP):** \`+${gear.stats.maxHp}\`\n` +
        `💥 **Bạo Kích:** \`+${(gear.stats.critRate * 100).toFixed(0)}%\`\n\n` +
        `🔥 **Tuyệt Kỹ Trang Bị:** **[${gear.combatSkill ? gear.combatSkill.name : 'Vô'}]**\n` +
        `*${gear.combatSkill ? gear.combatSkill.desc : 'Không có tuyệt kỹ'}*`
      );

    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      embed.setImage(imageUrl);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_equip_gear::${idx}::${targetUserId}`)
        .setLabel(gear.equipped ? '📤 Tháo Ra' : '📥 Mặc Vào')
        .setStyle(gear.equipped ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`btn_enhance_gear::${idx}::${targetUserId}`)
        .setLabel(`🔨 Cường Hóa (+${gear.enhanceLevel + 1})`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`btn_cancel_gear::${targetUserId}`)
        .setLabel('❌ Đóng')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // 4. Menu Chọn Yêu Thú Săn Bắt (!santhu)
  if (customId.startsWith('hunt_select_beast_')) {
    const targetUserId = customId.replace('hunt_select_beast_', '');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Menu này không thuộc về bạn!`, ephemeral: true });
    }

    if (combatSessions && combatSessions[clickerId]) {
      return interaction.reply({
        content: `⚔️ Đạo hữu đang trong trận chiến với **[${combatSessions[clickerId].beastName}]**! Hãy hoàn thành trận đấu hiện tại trước.`,
        ephemeral: true
      });
    }
    if (dungeonCombatSessions && dungeonCombatSessions[clickerId]) {
      return interaction.reply({
        content: `⛩️ Đạo hữu đang khiêu chiến Boss trong bí cảnh! Hãy hoàn thành hoặc rút lui trước khi săn thú.`,
        ephemeral: true
      });
    }

    const beastId = selected.replace('beast_', '');
    const beast = monstersConfig.beasts.find(b => b.id === beastId);
    if (!beast) return interaction.reply({ content: `❌ Không tìm thấy thông tin thú!`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`🐾 [DO THÁM THÀNH CÔNG] - ${beast.name}`)
      .setColor('#FF9800')
      .setDescription(
        `**Miêu Tả:** *${beast.desc}*\n\n` +
        `📊 **Thuộc Tính Yêu Thú:**\n` +
        `❤️ **Sinh Mệnh (HP):** \`${beast.hp}\`\n` +
        `🗡️ **Công Kích (ATK):** \`${beast.atk}\`\n` +
        `🛡️ **Phòng Ngự (DEF):** \`${beast.def}\`\n\n` +
        `🎁 **Phần Thưởng Khi Trảm Sát:**\n` +
        `✨ \`+${beast.exp} EXP\` | 💎 \`+${beast.linhThach} Linh Thạch\` | 🔮 \`+${beast.nguyenThach} Nguyên Thạch\` | 🎁 **1 Yêu Đan**\n\n` +
        `👉 **Bạn có muốn tiến vào tấn công ngay bây giờ?**`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`btn_start_hunt::${beast.id}::${clickerId}`).setLabel('⚔️ Tấn Công (Vào Trận)').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`btn_cancel_hunt::${clickerId}`).setLabel('🏃 Bỏ Qua (Không Đánh)').setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // 5. Menu Chọn Ải Phó Bản (!phoban)
  if (customId.startsWith('dungeon_select_stage_')) {
    const targetUserId = customId.replace('dungeon_select_stage_', '');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Menu này không thuộc về bạn!`, ephemeral: true });
    }

    if (dungeonCombatSessions && dungeonCombatSessions[clickerId]) {
      return interaction.reply({
        content: `⛩️ Đạo hữu đang khiêu chiến Boss **[${dungeonCombatSessions[clickerId].bossName}]**! Hãy hoàn thành hoặc rút lui trước.`,
        ephemeral: true
      });
    }
    if (combatSessions && combatSessions[clickerId]) {
      return interaction.reply({
        content: `⚔️ Đạo hữu đang trong trận săn thú! Hãy hoàn thành trận đấu trước khi vào phó bản.`,
        ephemeral: true
      });
    }

    const dungeonId = selected.replace('dungeon_', '');
    const dungeon = dungeonsConfig.dungeons.find(d => d.id === dungeonId);
    if (!dungeon) return interaction.reply({ content: `❌ Không tìm thấy thông tin ải!`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`⛩️ [DO THÁM ẢI BÍ CẢNH] - ${dungeon.name}`)
      .setColor('#9C27B0')
      .setDescription(
        `**Miêu Tả:** *${dungeon.desc}*\n` +
        `📜 **Yêu Cầu:** \`${dungeon.minLevel} [Tầng ${dungeon.minLayer}+]\`\n\n` +
        `👹 **THÔNG TIN BOSS TRẤN GIỮ:**\n` +
        `👑 **Danh Xưng:** **${dungeon.boss.name}**\n` +
        `❤️ **Sinh Mệnh (HP):** \`${dungeon.boss.hp}\`\n` +
        `🗡️ **Công Kích (ATK):** \`${dungeon.boss.atk}\`\n` +
        `🛡️ **Phòng Ngự (DEF):** \`${dungeon.boss.def}\`\n\n` +
        `🎁 **Phần Thưởng Vượt Ải:**\n` +
        `✨ \`+${dungeon.exp} EXP\` | 💎 \`+${dungeon.linhThach} LT\` | 🔮 \`+${dungeon.nguyenThachMin}-${dungeon.nguyenThachMax} Nguyên Thạch\` | 🎁 Tỉ lệ rớt Bí Kíp: \`${dungeon.rareDropRate * 100}%\`\n\n` +
        `👉 **Bạn có muốn xông vào khiêu chiến Boss ngay bây giờ?**`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`btn_start_dungeon::${dungeon.id}::${clickerId}`).setLabel('⚔️ Khiêu Chiến Boss').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`btn_cancel_dungeon::${clickerId}`).setLabel('🏃 Rút Lui').setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // 6. Menu Chọn Đồ Trong Túi Đồ (!tuido) Để Nuốt
  if (customId.startsWith('inv_select_item_')) {
    const targetUserId = customId.replace('inv_select_item_', '');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Túi đồ này không thuộc về bạn!`, ephemeral: true });
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) return interaction.reply({ content: `❌ Chưa tạo nhân vật!`, ephemeral: true });

    const parts = selected.split('_');
    const idx = parseInt(parts[parts.length - 1], 10);
    const item = user.inventory[idx];

    if (!item) return interaction.reply({ content: `❌ Vật phẩm không tồn tại!`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`💊 [VẬT PHẨM] - ${item.name}`)
      .setColor('#FF9800')
      .setDescription(
        `**Loại:** \`${item.type}\` | **Số lượng còn:** \`x${item.quantity}\`\n` +
        `**Miêu tả:** *${item.desc || 'Vật phẩm tu chân'}*\n\n` +
        `💡 **Công Dụng:**\n` +
        `• Nuốt/Hấp thu sẽ nhận **EXP Tu Vi** và hồi phục **Máu (HP)** tức thì!\n\n` +
        `👉 **Bạn có muốn sử dụng 1 ${item.name} ngay bây giờ?**`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`btn_use_item::${item.itemId}::${idx}::${targetUserId}`).setLabel('💊 Nuốt / Sử Dụng').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`btn_cancel_inv::${targetUserId}`).setLabel('❌ Đóng Lại').setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // 7. Menu Chọn Đồ Cần Bán Lên Chợ Đen
  if (customId.startsWith('sell_select_item_')) {
    const targetUserId = customId.replace('sell_select_item_', '');
    if (clickerId !== targetUserId) {
      return interaction.reply({ content: `⚠️ Menu này không thuộc về bạn!`, ephemeral: true });
    }

    const itemKey = selected;

    const modal = new ModalBuilder()
      .setCustomId(`modal_sell_submit::${itemKey}::${clickerId}`)
      .setTitle(`Đăng Bán Lên Chợ Đen`);

    const priceInput = new TextInputBuilder()
      .setCustomId('sell_price_input')
      .setLabel('Nhập giá bán (Linh Thạch):')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ví dụ: 300')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(8);

    const firstActionRow = new ActionRowBuilder().addComponents(priceInput);
    modal.addComponents(firstActionRow);

    return interaction.showModal(modal);
  }

  // 8. Menu Chọn Mua Hàng Trực Tiếp Trên Chợ Đen
  if (customId.startsWith('market_buy_select_')) {
    const marketItemId = selected;
    const user = await User.findOne({ userId: clickerId });
    if (!user) return interaction.reply({ content: `❌ Hãy gõ \`/khoi-dau\` trước!`, ephemeral: true });


    const item = await MarketItem.findById(marketItemId);
    if (!item) {
      return interaction.reply({ content: `❌ Mặt hàng này đã được bán hoặc không còn tồn tại!`, ephemeral: true });
    }

    // Đi chung một đường với `!mua`: khoá gian hàng bằng atomic update, thu
    // thuế chợ, giữ đúng phẩm cấp gốc và hoàn tiền nếu giao hàng hỏng. Bản tự
    // viết cũ ở đây cho phép hai người cùng mua một món và trả tiền người bán
    // hai lần.
    const result = await purchaseListing(user.userId, item);
    if (!result.ok) {
      return interaction.reply({ content: result.message, ephemeral: true });
    }

    return interaction.update({ embeds: [buildPurchaseEmbed(item, result)], components: [] });
  }

  // 6. Xử lý Menu Lò Luyện Đan
  if (customId.startsWith('alchemy_select_pill_')) {
    const targetUserId = customId.replace('alchemy_select_pill_', '');
    if (clickerId !== targetUserId) return interaction.reply({ content: `⚠️ Đây không phải lò luyện đan của bạn!`, ephemeral: true });

    const pill = getPillById(selected);
    if (!pill) return interaction.reply({ content: `❌ Không tìm thấy thông tin phương thuốc!`, ephemeral: true });

    const user = await User.findOne({ userId: clickerId }).lean();
    const linhThaoItem = (user.inventory || []).find(i => i.itemId === 'linh_thao');
    const linhThaoCount = linhThaoItem ? linhThaoItem.quantity : 0;

    const yeuDanList = (user.inventory || []).filter(i => i.itemId.startsWith('yeu_dan_'));
    const totalYeuDan = yeuDanList.reduce((sum, i) => sum + i.quantity, 0);

    const hasEnoughLinhThao = linhThaoCount >= pill.recipe.linhThao;
    const hasEnoughYeuDan = totalYeuDan >= pill.recipe.yeuDanCount;
    const hasEnoughLt = user.currencies.linhThach >= pill.recipe.linhThach;
    const canBrew = hasEnoughLinhThao && hasEnoughYeuDan && hasEnoughLt;

    const embed = new EmbedBuilder()
      .setTitle(`🔮 [PHƯƠNG THUỐC] - ${pill.name} [${pill.tierName}]`)
      .setColor('#9C27B0')
      .setDescription(
        `*${pill.desc}*\n\n` +
        `📊 **HIỆU QUẢ LINH ĐAN:**\n` +
        `  • ❤️ Hồi phục Sinh Mệnh: \`+${pill.healHp} HP\`\n` +
        `  • ⚡ Tăng Cường Chân Khí: \`+${pill.expGain} EXP\`\n` +
        (pill.statBonus?.atk ? `  • 🗡️ Thuộc tính vĩnh viễn: \`+${pill.statBonus.atk} ATK\` | \`+${pill.statBonus.def || 0} DEF\`\n` : '') +
        `\n🧪 **DƯỢC LIỆU YÊU CẦU:**\n` +
        `  • 🌿 Linh Thảo: \`${linhThaoCount}/${pill.recipe.linhThao} nhánh\` ${hasEnoughLinhThao ? '✅' : '❌'}\n` +
        `  • 🐾 Yêu Đan: \`${totalYeuDan}/${pill.recipe.yeuDanCount} viên\` ${hasEnoughYeuDan ? '✅' : '❌'}\n` +
        `  • 💎 Linh Thạch: \`${user.currencies.linhThach.toLocaleString()}/${pill.recipe.linhThach.toLocaleString()} LT\` ${hasEnoughLt ? '✅' : '❌'}\n\n` +
        (canBrew ? `✨ **Đủ điều kiện nhóm lửa khai lò!**` : `⚠️ **Chưa đủ dược liệu để luyện chế.**`)
      );

    const selectRow = createAlchemySelectMenu(clickerId, pill.id);
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_brew_pill::${pill.id}::${clickerId}`)
        .setLabel(`🔥 Khởi Hỏa Luyện [${pill.name}]`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canBrew)
    );

    return interaction.update({ embeds: [embed], components: [selectRow, buttonRow] });
  }
}
