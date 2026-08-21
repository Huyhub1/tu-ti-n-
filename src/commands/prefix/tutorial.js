/**
 * LỆNH !tanthu — BẢNG CHUỖI NHIỆM VỤ TÂN THỦ
 *
 * Chỉ hiện đúng một bước đang làm dở chứ không đổ cả mười bước ra màn hình:
 * người mới nhìn danh sách dài mười dòng sẽ không biết phải làm gì trước, còn
 * một mục tiêu duy nhất kèm đúng một lệnh cần gõ thì không thể lạc.
 *
 * Toàn bộ phần dựng màn hình nằm trong buildTanthuView() để nút 🎁 nhận thưởng
 * và lệnh gõ tay dùng chung một đường code — sửa một chỗ là cả hai cùng đổi.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { User } from '../../database/models/User.js';
import { truncate, EMBED_LIMITS } from '../../utils/embedLimits.js';
import {
  TUTORIAL_TOTAL,
  tutorialStep,
  currentQuest,
  progressOf,
  rewardLine,
  claimTutorialReward
} from '../../services/tutorialService.js';

export const TUTORIAL_CLAIM_PREFIX = 'btn_tutorial_claim::';

/** Thanh tiến độ dạng ▰▰▱▱ cho biết còn bao nhiêu bước nữa thì tốt nghiệp. */
function chainBar(step) {
  return '▰'.repeat(step) + '▱'.repeat(Math.max(0, TUTORIAL_TOTAL - step));
}

function claimRow(userId, enabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TUTORIAL_CLAIM_PREFIX + userId)
      .setLabel(enabled ? 'Nhận thưởng' : 'Chưa đủ điều kiện')
      .setEmoji('🎁')
      .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!enabled)
  );
}

/**
 * Dựng màn hình chuỗi nhiệm vụ từ một document đã có sẵn — thuần tuý, không
 * chạm cơ sở dữ liệu. Tách riêng vì hai lý do: sau khi lĩnh thưởng ta đã cầm
 * document mới trong tay nên đọc lại lần nữa là thừa, và bộ kiểm thử trần giao
 * diện (tests/testUiLimits.js) cần dựng được khung này mà không cần MongoDB.
 *
 * `notice` là dòng thông báo chèn lên đầu sau khi vừa bấm nhận thưởng, để người
 * chơi thấy mình vừa được gì rồi mới thấy bước kế tiếp — nếu chỉ nhảy thẳng
 * sang bước mới thì cú bấm trông như không có tác dụng gì.
 */
export function renderTanthuView(user, notice = '') {
  if (!user) {
    return { content: `🌱 Đạo hữu chưa bước chân vào tiên đồ!\nGõ \`/khoi-dau\` để thức tỉnh linh căn bẩm sinh và mở đầu hành trình tu tiên.` };
  }

  const step = tutorialStep(user);
  const quest = currentQuest(user);

  if (!quest) {
    const embed = new EmbedBuilder()
      // Đạo hiệu là chuỗi do người chơi mang vào. Hiện tại nó chỉ được gán từ
      // username Discord (trần 32 ký tự) nên chưa thể vỡ, nhưng discord.js
      // NÉM LỖI chứ không cắt bớt khi tiêu đề quá 256 — nghĩa là cả lệnh
      // !tanthu chết chứ không phải chỉ xấu chữ. Cắt sẵn cho khỏi phụ thuộc
      // vào một trần nằm ngoài tầm kiểm soát của mình.
      .setTitle(truncate(`🎓 [XUẤT SƯ] - ${user.daoName || user.username}`, EMBED_LIMITS.title))
      .setColor('#FFD700')
      .setDescription(
        `${notice}Đạo hữu đã đi hết ${TUTORIAL_TOTAL} bước dẫn đạo, không còn gì để tân thủ chỉ dạy nữa.\n\n` +
        `${chainBar(TUTORIAL_TOTAL)} **${TUTORIAL_TOTAL}/${TUTORIAL_TOTAL}**\n\n` +
        `**Đường tiếp theo tự chọn lấy:**\n` +
        `• \`!laptongmon <tên>\` — lập bang của riêng mình (500 Linh Thạch)\n` +
        `• \`!nhiemvubang\` — nhiệm vụ tông môn, thưởng hậu hơn hẳn\n` +
        `• \`!phoban\` · \`!tivo\` · \`!bicanh\` — nội dung cuối game`
      )
      .setFooter({ text: 'Gõ !help để xem toàn bộ lệnh.' });
    return { embeds: [embed], components: [] };
  }

  const progress = progressOf(user, quest);
  const embed = new EmbedBuilder()
    .setTitle(`📜 [DẪN ĐẠO TÂN THỦ] - Bước ${step + 1}/${TUTORIAL_TOTAL}`)
    .setColor(progress.done ? '#4CAF50' : '#03A9F4')
    .setDescription(
      `${notice}${chainBar(step)} **${step}/${TUTORIAL_TOTAL} bước đã xong**\n\n` +
      `### ${progress.done ? '✅' : '🎯'} ${quest.title}\n` +
      `*${quest.desc}*\n\n` +
      `**Tiến độ:** \`${progress.label}\`\n` +
      `**Cần gõ:** \`${quest.hint}\`\n` +
      `**Phần thưởng:** ${rewardLine(quest.reward)}`
    )
    .setFooter({
      text: progress.done
        ? 'Bấm nút bên dưới để lĩnh thưởng và mở bước kế tiếp.'
        : 'Làm xong điều kiện rồi quay lại gõ !tanthu để lĩnh thưởng.'
    });

  return { embeds: [embed], components: [claimRow(user.userId, progress.done)] };
}

/** Đọc document rồi dựng màn hình. Dùng cho lệnh gõ tay `!tanthu`. */
export async function buildTanthuView(userId, notice = '') {
  return renderTanthuView(await User.findOne({ userId }), notice);
}

/**
 * Xử lý cú bấm nút 🎁: nhận thưởng rồi dựng lại đúng màn hình đó với bước mới.
 *
 * Thất bại (chưa đủ điều kiện, hoặc bị cú bấm khác giành mất) thì trả về
 * `{ content }` để nơi gọi báo riêng cho người bấm — thay nguyên tin nhắn sẽ
 * nuốt mất cái nút và họ không còn chỗ nào để bấm lại.
 */
export async function claimAndBuildView(userId) {
  const result = await claimTutorialReward(userId);

  if (!result.ok) {
    if (result.reason === 'NO_CHARACTER') {
      return { content: `🌱 Đạo hữu chưa bước chân vào tiên đồ! Gõ \`/khoi-dau\` trước đã.` };
    }
    if (result.reason === 'ALL_DONE') {
      return { content: `🎓 Đạo hữu đã tốt nghiệp chuỗi dẫn đạo từ lâu rồi.` };
    }
    if (result.reason === 'RACED') {
      return { content: `⏳ Bước này vừa được lĩnh xong. Gõ \`!tanthu\` để xem bước kế tiếp.` };
    }
    const label = result.progress ? ` (hiện \`${result.progress.label}\`)` : '';
    return { content: `❌ Chưa đủ điều kiện bước **${result.quest?.title || '???'}**${label}. Gõ \`${result.quest?.hint || '!tanthu'}\` cho đủ rồi quay lại.` };
  }

  const head = result.graduated
    ? `🎓 **HOÀN THÀNH BƯỚC CUỐI [${result.quest.title}]!** Nhận: ${rewardLine(result.reward)}\n\n`
    : `🎁 **Đã lĩnh thưởng [${result.quest.title}]:** ${rewardLine(result.reward)}\n\n`;

  // result.user là document vừa cập nhật xong, dựng thẳng từ đó cho đỡ một
  // lượt đọc — và tránh cửa sổ hiếm khi bản đọc lại chưa kịp thấy thay đổi.
  return renderTanthuView(result.user, head);
}

export async function executeTanthu(message) {
  await message.reply(await buildTanthuView(message.author.id));
}
