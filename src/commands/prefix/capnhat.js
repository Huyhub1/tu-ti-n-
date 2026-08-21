/**
 * LỆNH !capnhat — xem phiên bản đang chạy và kéo bản mới về ngay.
 *
 * Đây là mặt tiền Discord của `services/updateService.js`. Toàn bộ phần nặng
 * (chạy git, cài thư viện, rà soát, quay lui) nằm ở tiến trình bọc ngoài; ở đây
 * chỉ hỏi xem có gì mới, in ra cho người xem, rồi ra hiệu bằng cách thoát với
 * mã `EXIT_UPDATE`.
 *
 * Hai điều buộc phải đúng ở file này:
 *
 *  · Chỉ quản trị được gọi. Lệnh này khiến bot tắt và tải mã mới về máy chủ —
 *    để hở cho người lạ thì bất kỳ ai cũng có thể làm cả server mất bot.
 *  · Không được in URL kho ra chat. Kho riêng tư thì URL đó mang sẵn mã truy
 *    cập; `che()` lo chuyện đó, nhưng mọi chuỗi lấy từ git đều phải đi qua nó.
 */
import { EmbedBuilder } from 'discord.js';

import { isAdmin } from './admin.js';
import { truncate, EMBED_LIMITS } from '../../utils/embedLimits.js';
import { demBanRon, moTaBanRon } from '../../utils/banRon.js';
import {
  EXIT_UPDATE,
  che,
  docCachLy,
  docCauHinh,
  docPhienBan,
  timCapNhat,
  trangThaiKho,
  xoaCachLy
} from '../../services/updateService.js';

/** Chờ chừng này trước khi thoát, để tin nhắn kịp bay tới Discord. */
const HOAN_TRUOC_KHI_THOAT_MS = 2500;

/**
 * Số lượt soát tối đa được phép hoãn vì còn người đang giữa trận.
 *
 * Phải có trần: trận đấu trong RAM tự dọn sau 10 phút không thao tác, nhưng
 * một phòng đông người thay phiên nhau đánh liên tục thì sổ bận rộn không bao
 * giờ rỗng — không có trần là bản vá không bao giờ lên được máy chủ. Sáu lượt
 * ở chu kỳ mặc định 5 phút là nửa tiếng; hết nửa tiếng thì cập nhật vẫn đi,
 * chấp nhận làm phiền số ít người còn đang đánh.
 */
export const SO_LUOT_HOAN_TOI_DA = 6;

/** Bot có đang được tiến trình bọc ngoài trông chừng không. */
export function coGiamSat(env = process.env) {
  return env.BOT_SUPERVISED === '1';
}

function mocThoiGian(iso) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? `<t:${Math.floor(t / 1000)}:R>` : 'không rõ lúc nào';
}

/**
 * Dựng màn hình trạng thái. Thuần tuý — không chạm git, không chạm Discord, chỉ
 * nhận kết quả đã có sẵn. Tách ra để bộ kiểm thử trần giao diện dựng được nó mà
 * không cần kho git thật lẫn mạng.
 */
export function renderCapnhatView(kho, tin, cauHinh, { daRaHieu = false, giamSat = true, daXoaCachLy = false, banRon = null } = {}) {
  const phienBan = docPhienBan();

  if (!kho?.laKho) {
    return {
      content: `⚙️ Bot đang chạy từ thư mục không phải kho git nên không tự cập nhật được.\n` +
        `Lý do: ${che(kho?.lyDo || 'không rõ')}`
    };
  }

  const embed = new EmbedBuilder()
    .setTitle(truncate(`⚙️ [THIÊN CƠ CÁC] - Phiên Bản Đang Vận Hành`, EMBED_LIMITS.title))
    .setColor(tin?.coMoi ? '#FFA500' : '#57F287')
    .addFields(
      {
        name: '📦 Bản đang chạy',
        value: truncate(
          `${phienBan ? `v${phienBan} · ` : ''}\`${kho.ngan || '???'}\` trên nhánh \`${che(kho.nhanh || '?')}\`\n` +
          `${che(kho.chuThich || '(không có chú thích)')}\n` +
          `— ${che(kho.nguoi || 'không rõ')}, ${mocThoiGian(kho.luc)}`,
          EMBED_LIMITS.fieldValue
        ),
        inline: false
      }
    );

  if (!kho.sach) {
    embed.addFields({
      name: '✋ Có file đang sửa dở trên máy chủ',
      value: truncate(
        `Tự cập nhật bị chặn để khỏi ghi đè mất công ai đó:\n\`\`\`\n` +
        `${che(kho.banBan.slice(0, 8).join('\n'))}\n\`\`\``,
        EMBED_LIMITS.fieldValue
      ),
      inline: false
    });
  }

  if (tin?.coMoi) {
    const dong = (tin.danhSach || []).slice(0, 8).map(d => `· ${che(d)}`).join('\n');
    embed.addFields({
      name: `🆕 Có ${tin.soCommit} commit mới`,
      value: truncate(dong || '(không đọc được danh sách)', EMBED_LIMITS.fieldValue),
      inline: false
    });
    embed.setDescription(
      daRaHieu
        ? `🔄 Đang tắt để kéo bản mới về. Bot quay lại sau khoảng một phút.`
        : giamSat
          ? `Gõ \`!capnhat\` lần nữa để kéo về ngay.`
          : `⚠️ Bot đang chạy KHÔNG có tiến trình giám sát nên không tự bật lại được.\n` +
            `Khởi động bằng \`npm start\` để dùng cơ chế tự cập nhật.`
    );
  } else {
    embed.setDescription(`✅ ${che(tin?.lyDo || 'Đã là bản mới nhất.')}`);
  }

  // Bản mới đã kéo về một lần và trượt vòng nghiệm thu. Phải nói thẳng ra: nếu
  // im lặng thì người xem chỉ thấy "đã là bản mới nhất" trong khi kho thật sự
  // đang có commit mới, rồi ngồi đoán vì sao bot mãi không lên.
  if (tin?.biCachLy) {
    embed.setColor('#ED4245');
    embed.addFields({
      name: '⛔ Bản mới đang bị cách ly',
      value: truncate(
        `Commit \`${che(String(tin.biCachLy.commit || '???').slice(0, 7))}\` đã kéo về một lần và trượt vòng nghiệm thu:\n` +
        `> ${che(tin.biCachLy.lyDo || 'không rõ lý do')}\n` +
        `Đẩy commit sửa lỗi lên là bot tự thử lại. Muốn ép thử ngay thì gõ \`!capnhat thulai\`.`,
        EMBED_LIMITS.fieldValue
      ),
      inline: false
    });
  }

  if (daXoaCachLy) {
    embed.addFields({
      name: '🔓 Đã gỡ cách ly',
      value: truncate('Dấu vết lần hỏng trước đã xoá — bot sẽ thử kéo lại bản mới nhất ngay lượt này.', EMBED_LIMITS.fieldValue),
      inline: false
    });
  }

  embed.addFields({
    name: '🔁 Tự động dò bản mới',
    // Tên nhánh lấy thẳng từ AUTO_UPDATE_BRANCH trong .env, không có trần nào
    // ràng buộc. Đây từng là ô duy nhất quên bọc truncate, và một tên nhánh dài
    // là đủ để discord.js NÉM LỖI — nghĩa là cả lệnh !capnhat chết, đúng lúc
    // người ta cần nó nhất để xem vì sao bot không lên bản mới.
    value: truncate(
      cauHinh.bat
        ? `Đang bật — soát mỗi **${cauHinh.phutMoiLan} phút** trên \`${che(cauHinh.remote)}/${che(cauHinh.nhanh || kho.nhanh)}\``
        : `Đang tắt. Bật bằng cách đặt \`AUTO_UPDATE=true\` trong file \`.env\`.`,
      EMBED_LIMITS.fieldValue
    ),
    inline: false
  });

  // Vòng tự động thì tự biết đợi. Còn quản trị gõ tay `!capnhat` là cố ý muốn
  // cập nhật ngay, nên đây chỉ cảnh báo chứ không chặn — nhưng phải cảnh báo,
  // vì con số này quyết định có nên bấm bây giờ hay đợi năm phút nữa.
  if (daRaHieu && banRon?.tong > 0) {
    embed.addFields({
      name: '⚠️ Còn người đang giữa chừng',
      value: truncate(
        `**${banRon.tong}** đạo hữu đang dở việc (${moTaBanRon(banRon)}). Tắt bot lúc này là ` +
        `họ mất lượt và mất luôn hồi chiêu đã trừ.\n` +
        `👉 *Không gấp thì để vòng tự động lo — nó biết đợi tới lúc vắng người.*`,
        EMBED_LIMITS.fieldValue
      ),
      inline: false
    });
  }

  embed.setFooter({ text: truncate('Chỉ tua nhanh · cây bẩn thì không đụng · bản mới hỏng thì tự quay lui', EMBED_LIMITS.footer) });

  return { embeds: [embed] };
}

/**
 * Ra hiệu cho tiến trình bọc ngoài: tắt bot đi, kéo bản mới, bật lại.
 *
 * Ngắt phiên Discord trước khi thoát để bot biến mất khỏi danh sách online ngay
 * thay vì treo "đang trực tuyến" thêm vài chục giây sau khi đã chết.
 */
export async function raHieuCapNhat(client, vi = 'không rõ') {
  console.log(`[Cập nhật] Có bản mới (${vi}) — tắt để tiến trình giám sát kéo về.`);
  try { await client?.destroy(); } catch { /* đang tắt, kệ */ }
  process.exit(EXIT_UPDATE);
}

export async function executeCapnhat(message, args = []) {
  if (!isAdmin(message.author.id)) {
    // Trả lời giống hệt lệnh không tồn tại thì người lạ còn không biết là có
    // lệnh này. Nhưng bot này chỉ chạy trong server của chủ nên nói thẳng cho
    // dễ hiểu, quan trọng là KHÔNG chạy gì cả.
    return message.reply({ content: `❌ Chỉ quản trị tông môn mới xem được Thiên Cơ Các.` });
  }

  const y = String(args[0] || '').toLowerCase();
  const chiXem = ['xem', 'status', 'trangthai', 'info'].includes(y);
  const epThuLai = ['thulai', 'thu-lai', 'retry', 'gocachly'].includes(y);
  const cauHinh = docCauHinh();

  // Gỡ dấu cách ly TRƯỚC khi hỏi kho. `timCapNhat` đọc chính file đó để quyết
  // định có báo "có bản mới" hay không, nên xoá sau thì lượt này vẫn thấy bị
  // chặn và người gõ lệnh phải gõ thêm lần nữa mới ăn thua.
  const daXoaCachLy = epThuLai && !!docCachLy() && xoaCachLy();

  const dangCho = await message.reply({ content: `🔍 Đang hỏi kho mã nguồn...` });

  let kho;
  let tin;
  try {
    kho = await trangThaiKho(cauHinh);
    tin = kho.laKho ? await timCapNhat(cauHinh) : null;
  } catch (e) {
    return dangCho.edit({ content: `❌ Không hỏi được kho: ${che(e?.message || e)}` });
  }

  const giamSat = coGiamSat();
  const seKeo = !chiXem && tin?.coMoi && kho.sach && giamSat;

  await dangCho.edit({
    content: '',
    ...renderCapnhatView(kho, tin, cauHinh, { daRaHieu: seKeo, giamSat, daXoaCachLy, banRon: demBanRon() })
  });

  if (seKeo) {
    setTimeout(() => raHieuCapNhat(message.client, `lệnh !capnhat của ${message.author.tag}`), HOAN_TRUOC_KHI_THOAT_MS);
  }
}

/**
 * Vòng tự dò bản mới. Gọi một lần lúc bot sẵn sàng.
 *
 * Chỉ ĐỌC (`git fetch`) rồi thoát nếu có gì mới — không tự chạy git nào ghi đè
 * file, nên vòng này chạy nền hoàn toàn an toàn. Lần soát đầu tiên hoãn lại một
 * chút để không giành tài nguyên với lúc bot đang đăng ký slash command.
 */
export function batTuDongKiemTra(client) {
  const cauHinh = docCauHinh();

  if (!cauHinh.bat) {
    console.log(`[Cập nhật] Tự động dò bản mới đang TẮT (đặt AUTO_UPDATE=true trong .env để bật).`);
    return null;
  }

  if (!coGiamSat()) {
    console.log(`[Cập nhật] ⚠️ AUTO_UPDATE=true nhưng bot chạy không có tiến trình giám sát.`);
    console.log(`[Cập nhật]    Tắt tự động dò, vì tắt bot lúc này thì không ai bật lại. Dùng "npm start".`);
    return null;
  }

  const chuKy = cauHinh.phutMoiLan * 60_000;

  // Đếm số lượt đã hoãn vì còn người đang đánh, và nhớ đã báo trước chưa để
  // khỏi nhắn cùng một câu vào kênh mỗi 5 phút suốt nửa tiếng.
  let soLuotDaHoan = 0;
  let daBaoTruoc = false;

  const soat = async () => {
    try {
      const tin = await timCapNhat(cauHinh);
      if (!tin.coMoi) {
        // Không còn gì để kéo — có thể quản trị đã tự cập nhật tay, hoặc commit
        // hỏng vừa bị gỡ. Trả bộ đếm về 0 để lần sau lại được hoãn đủ suất.
        soLuotDaHoan = 0;
        daBaoTruoc = false;
        return;
      }

      const kho = await trangThaiKho(cauHinh);
      if (!kho.sach) {
        console.warn(`[Cập nhật] Có ${tin.soCommit} commit mới nhưng máy chủ đang có file sửa dở — bỏ qua lượt này.`);
        return;
      }

      // Trận đấu, phó bản và độ kiếp nằm trong RAM: tắt bot là mất sạch, mà
      // người chơi thì đã bị trừ hồi chiêu rồi. Đợi họ đánh xong đã.
      const ban = demBanRon();
      if (ban.tong > 0 && soLuotDaHoan < SO_LUOT_HOAN_TOI_DA) {
        soLuotDaHoan++;
        console.log(
          `[Cập nhật] Có ${tin.soCommit} commit mới nhưng còn ${ban.tong} người giữa chừng ` +
          `(${moTaBanRon(ban)}) — hoãn lượt ${soLuotDaHoan}/${SO_LUOT_HOAN_TOI_DA}.`
        );
        if (!daBaoTruoc) {
          daBaoTruoc = true;
          await baoKenhSapCapNhat(client, cauHinh, ban);
        }
        return;
      }

      if (ban.tong > 0) {
        console.warn(
          `[Cập nhật] Đã hoãn đủ ${SO_LUOT_HOAN_TOI_DA} lượt mà vẫn còn ${ban.tong} người ` +
          `(${moTaBanRon(ban)}) — cập nhật luôn, không đợi nữa.`
        );
      }

      await baoKenh(client, cauHinh, tin);
      await raHieuCapNhat(client, `${tin.soCommit} commit mới trên ${che(tin.dich)}`);
    } catch (e) {
      // Mạng chập một lượt là chuyện thường. In gọn rồi thôi, đừng đổ stack ra
      // log mỗi vài phút cho tới khi đầy đĩa.
      console.warn(`[Cập nhật] Lượt soát này hỏng: ${che(e?.message || e)}`);
    }
  };

  console.log(`[Cập nhật] Tự động dò bản mới: mỗi ${cauHinh.phutMoiLan} phút trên ${che(cauHinh.remote)}/${che(cauHinh.nhanh || 'nhánh hiện tại')}.`);

  const hen = setInterval(soat, chuKy);
  hen.unref?.();
  setTimeout(soat, 30_000).unref?.();
  return hen;
}

/**
 * Báo trước rằng có bản mới nhưng bot đang đợi mọi người đánh xong.
 *
 * Chỉ nhắn đúng một lần cho mỗi đợt chờ. Người đang đánh dở biết mà kết thúc
 * sớm, người sắp bắt đầu biết mà khoan vào phó bản.
 */
async function baoKenhSapCapNhat(client, cauHinh, ban) {
  if (!cauHinh.kenhBaoTin) return;
  try {
    const kenh = await client.channels.fetch(cauHinh.kenhBaoTin);
    if (!kenh?.isTextBased?.()) return;
    const toiDaPhut = SO_LUOT_HOAN_TOI_DA * cauHinh.phutMoiLan;
    await kenh.send({
      content: truncate(
        `⏳ **Sắp bế quan cập nhật** — có bản mới, nhưng còn **${ban.tong}** đạo hữu đang giữa chừng ` +
        `(${moTaBanRon(ban)}).\n` +
        `Bot sẽ đợi tới khi sân đấu vắng người, chậm nhất là **${toiDaPhut} phút** nữa.\n` +
        `👉 *Đang đánh dở thì kết thúc sớm giúp; khoan vào phó bản mới trong lúc này.*`,
        EMBED_LIMITS.description
      )
    });
  } catch (e) {
    console.warn(`[Cập nhật] Không báo trước được vào kênh ${cauHinh.kenhBaoTin}: ${che(e?.message || e)}`);
  }
}

/** Nhắn vào kênh đã khai trong .env rằng bot sắp tắt để cập nhật. */
async function baoKenh(client, cauHinh, tin) {
  if (!cauHinh.kenhBaoTin) return;
  try {
    const kenh = await client.channels.fetch(cauHinh.kenhBaoTin);
    if (!kenh?.isTextBased?.()) return;
    const dong = (tin.danhSach || []).slice(0, 5).map(d => `· ${che(d)}`).join('\n');
    await kenh.send({
      content: truncate(
        `🔄 **Bế quan cập nhật** — kéo về ${tin.soCommit} commit mới, bot quay lại sau khoảng một phút.\n` +
        (dong ? `\`\`\`\n${dong}\n\`\`\`` : ''),
        EMBED_LIMITS.description
      )
    });
  } catch (e) {
    console.warn(`[Cập nhật] Không báo được vào kênh ${cauHinh.kenhBaoTin}: ${che(e?.message || e)}`);
  }
}
