// Mầm's spoken lines for the daily trajectory and for verified events (MB-897). Reviewed copy: Vietnamese,
// tớ/bạn, soft endings, at most 90 characters, no clinical claim, no "khỏi bệnh". The lines never repeat a
// diagnosis, a score or the user's own words; they name the pattern, never the cause.
import type { MamTrajectoryState } from './mam-trajectory'

export const MAM_LINE_MAX = 90
export const MAM_BANNED_WORDS = [
  'khỏi bệnh',
  'chẩn đoán',
  'chữa',
  'đừng buồn',
  'bệnh',
  'điều trị',
  'trầm cảm',
] as const

export const MAM_LINES = {
  FIRST_LOW: [
    'Hôm nay có vẻ hơi nặng nè. Tớ ở đây nếu bạn muốn kể.',
    'Hôm nay không dễ với bạn nhỉ. Mình đi chậm một chút cũng được nha.',
    'Ngày nặng thì cứ nặng thôi. Tớ ngồi cạnh bạn một lát nhé.',
    'Cảm ơn bạn đã ghi lại hôm nay. Mình không vội đâu nha.',
    'Nếu muốn nhẹ bớt, bạn thử viết vài dòng vào nhật ký nha.',
  ],
  PERSISTENT_LOW: [
    'Mấy hôm nay bạn mệt nhiều quá. Mình nói chuyện với ai đó, hoặc xem lại kế hoạch nhỏ nha.',
    'Mấy ngày nay nặng với bạn rồi. Bạn muốn trò chuyện với tớ một lúc không?',
    'Bạn đã gồng nhiều ngày rồi đó. Một việc nhỏ trong kế hoạch hôm nay là đủ nha.',
    'Nếu mấy hôm nay vẫn nặng, nói chuyện với chuyên gia cũng là một lựa chọn nhẹ nhàng nha.',
    'Tớ thấy mấy hôm nay bạn mệt. Mình cùng xem lại kế hoạch nhỏ của bạn nhé?',
  ],
  IMPROVING: [
    'Mấy ngày nay bạn nhẹ nhõm dần lên đó. Tớ thấy rõ luôn.',
    'Mấy hôm nay bạn khá hơn một chút rồi. Mình giữ nhịp nhẹ nhàng nha.',
    'Những ngày gần đây nhẹ hơn dần rồi nè. Bạn bền bỉ lắm đó.',
    'Từng ngày nhích lên một chút. Tớ vui vì điều đó ✨',
    'Nhìn lại mấy hôm nay, bạn nhẹ nhõm hơn rồi nè.',
  ],
  BOUNCE_BACK: [
    'Sau hôm nặng, hôm nay bạn đã khá hơn rồi. Tớ mừng cho bạn ghê.',
    'Sau mấy ngày khó, hôm nay bạn nhẹ hơn rồi nè. Tớ mừng ghê.',
    'Hôm nay bạn khá hơn rồi nè. Cảm ơn bạn đã đi qua mấy hôm nặng nha.',
    'Sau hôm nặng, hôm nay nhẹ hơn rồi. Tớ vui lắm đó.',
    'Có hôm nặng, rồi cũng có hôm nhẹ như hôm nay. Mừng cho bạn nha.',
  ],
  STEADY_GOOD: [
    'Mấy hôm nay bạn giữ nhịp tốt ghê ✨',
    'Mấy ngày liền bạn thấy ổn rồi nè. Tớ vui lắm đó.',
    'Nhịp mấy hôm nay của bạn đều và dễ chịu. Cứ nhẹ nhàng vậy nha ✨',
    'Những hôm bạn ghi lại gần đây đều ổn nè. Tớ vui lắm.',
    'Mấy hôm nay nhìn bạn khá vững đó. Tớ thích lắm.',
  ],
  DIP_AFTER_GOOD: [
    'Một ngày chưa nói lên tất cả đâu. Bạn vẫn đang làm tốt mà.',
    'Hôm nay hơi chùng xuống sau mấy ngày ổn. Tớ vẫn ở đây nha.',
    'Có hôm xuống một chút thôi. Mấy ngày ổn vừa rồi vẫn là của bạn.',
    'Hôm nay nặng hơn một chút nhỉ. Tớ ở đây, mình đi chậm thôi nha.',
    'Sau mấy ngày ổn, hôm nay hơi khó. Nghỉ một chút rồi tính tiếp nhé.',
  ],
  FLAT: [
    'Bạn chịu ghé ghi lại là giỏi lắm rồi đó.',
    'Mấy hôm nay bạn khá đều đều. Chịu ghi lại là tốt rồi nha.',
    'Nhịp mấy hôm nay êm êm nè. Bạn cứ đi từ từ thôi.',
    'Mấy ngày nay không đổi nhiều. Bạn muốn kể gì thì tớ ở đây nha.',
    'Bình bình cũng là một nhịp. Cảm ơn bạn đã ghé nha.',
  ],
  WELCOME_BACK: [
    'Lâu rồi mới gặp lại bạn nè. Mình bắt đầu lại nhẹ nhàng nha.',
    'Bạn quay lại rồi! Tớ vui lắm. Mình đi từng bước nhỏ thôi nha.',
    'Lâu quá mới thấy bạn ghé nè. Hôm nay mình làm nhẹ thôi nhé.',
    'Chào bạn, tớ nhớ bạn đó. Có bạn ghé lại là vui rồi nè.',
    'Quay lại lúc nào cũng được mà. Giờ mình bắt đầu lại từ từ nha.',
  ],
  JOURNAL_SAVED: [
    'Bạn viết xong rồi nè. Tớ mừng vì bạn đã ghé viết.',
    'Nhật ký của bạn đã được lưu. Cảm ơn bạn đã dành thời gian cho mình nha.',
    'Một trang nhật ký mới đã được lưu. Cảm ơn bạn đã viết nha.',
    'Viết xong rồi nè. Bạn muốn nghỉ một chút không?',
    'Cảm ơn bạn đã viết. Mình cứ chậm rãi thôi nha.',
  ],
  JOURNAL_RETURN: [
    'Lâu rồi bạn mới viết nhật ký nè. Tớ vui khi bạn quay lại.',
    'Bạn viết lại rồi nè, sau mấy ngày nghỉ. Hay quá đó.',
    'Mấy ngày rồi mới có trang mới. Cảm ơn bạn đã ghé lại nha.',
    'Quay lại viết nhật ký là bước nhỏ mà quý lắm đó nha.',
    'Trang nhật ký mới đã được lưu. Mừng vì bạn quay lại nè.',
  ],
  SUPPORT_DONE: [
    'Xong một việc nhỏ rồi nè. Làm được là quý lắm đó.',
    'Bạn vừa xong một bước trong kế hoạch. Tớ ghi nhận nha.',
    'Một bước nhỏ nữa đã xong. Cứ từ từ như vậy nha ✨',
    'Bạn chăm chỉ ghê. Nghỉ một nhịp rồi làm tiếp cũng được nè.',
    'Làm xong rồi, giỏi quá. Tớ thấy bạn cố gắng đó.',
  ],
  SUPPORT_THIRD: [
    'Hôm nay bạn làm được kha khá việc nhỏ rồi nè. Tớ vỗ tay cho bạn 👏',
    'Nhiều việc nhỏ trong một ngày, bạn bền bỉ ghê. Tớ mừng lắm.',
    'Hôm nay bạn đi được một đoạn rồi nè. Nghỉ ngơi một chút nha ✨',
    'Từng bước nhỏ cộng lại thành một ngày đáng nhớ. Cảm ơn bạn nha.',
  ],
  RESOURCE_DONE: [
    'Bạn vừa hoàn thành một bài rồi nè. Hay lắm đó.',
    'Xong bài này rồi nè. Điều nào hợp với bạn thì mình giữ lại nha.',
    'Cảm ơn bạn đã dành thời gian cho bài này. Nghỉ một chút nha.',
    'Một bài nhỏ nữa xong rồi nè. Bạn làm tốt đó.',
    'Hoàn thành rồi nè. Lúc nào cần, mình lại ghé thư viện nha.',
  ],
  REASSESSMENT_LOWER: [
    'Lần kiểm tra lại này, điểm tự đánh giá của bạn thấp hơn trước. Đáng ghi nhận lắm.',
    'Điểm tự đánh giá lần này thấp hơn lần trước. Tớ ghi nhận sự cố gắng của bạn nha.',
    'Điểm tự đánh giá thấp hơn lần trước rồi nè. Cảm ơn bạn đã kiên trì.',
    'So với lần trước, điểm tự đánh giá của bạn thấp hơn. Mình giữ nhịp nhẹ nhàng nha.',
  ],
  REASSESSMENT_SAME: [
    'Điểm tự đánh giá lần này gần như giữ nguyên. Mình cứ đi nhẹ nhàng nha.',
    'Lần kiểm tra lại này khá giống lần trước. Bạn đã dành thời gian cho mình rồi nè.',
    'Điểm tự đánh giá vẫn như lần trước. Mình xem kế hoạch hợp với bạn nhé.',
    'Cảm ơn bạn đã kiểm tra lại. Mình cứ giữ nhịp từ từ nha.',
  ],
  // Direction-free: also used when the band is moderate or higher, whatever the change.
  REASSESSMENT_CARE: [
    'Cảm ơn bạn đã kiểm tra lại. Mình cùng xem gợi ý hỗ trợ nhẹ nhàng nha.',
    'Lần kiểm tra lại này không dễ đâu. Mình xem gợi ý hỗ trợ cùng nhau nhé.',
    'Tớ ở đây với bạn. Mở gợi ý hỗ trợ để chọn một bước nhỏ nha.',
    'Bạn đã làm xong phần khó rồi. Giờ mình xem gợi ý hỗ trợ từ từ nha.',
  ],
} as const satisfies Record<string, readonly string[]>

export type MamLineKey = keyof typeof MAM_LINES
// A state without lines is silent: NO_DATA.
export const lineKeyOfState = (state: MamTrajectoryState): MamLineKey | null =>
  state === 'NO_DATA' ? null : state

const RECENT_STORE = 'mentalbridge_mam_lines'
const RECENT_KEPT = 2
// Per account, and only line numbers by state: nothing of the user's own, and no history shared on a device.
const memory = new Map<string, Record<string, number[]>>()
const storeKey = (accountId: string) => `${RECENT_STORE}:${accountId}`

function readRecent(accountId: string): Record<string, number[]> {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(storeKey(accountId)) ?? 'null',
    )
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Record<string, number[]>
  } catch {
    // Storage is blocked or damaged: this tab's own memory is enough.
  }
  return memory.get(accountId) ?? {}
}

/**
 * A random line for the key, never one of the last two it showed this account. They are kept in storage, so the
 * same state does not open with yesterday's sentence either; with storage blocked they last for this tab.
 */
export function pickMamLine(
  key: MamLineKey,
  accountId: string,
  random = Math.random,
): string {
  const lines: readonly string[] = MAM_LINES[key]
  const recent = readRecent(accountId)
  const seen = Array.isArray(recent[key]) ? recent[key] : []
  const fresh = lines.flatMap((_line, index) =>
    seen.includes(index) ? [] : [index],
  )
  const pool = fresh.length ? fresh : lines.map((_line, index) => index)
  const index =
    pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
  const next = { ...recent, [key]: [...seen, index].slice(-RECENT_KEPT) }
  memory.set(accountId, next)
  try {
    window.localStorage.setItem(storeKey(accountId), JSON.stringify(next))
  } catch {
    // Not stored; the tab keeps its own copy.
  }
  return lines[index]
}

/** How long a line stays without hover or focus: a few seconds to read it, 6 s at least. */
export const mamHoldMs = (text: string) =>
  Math.max(6000, 4000 + 60 * text.length)

/** Tests only: forget what was shown. */
export function resetMamLines() {
  memory.clear()
  try {
    for (const key of Object.keys(window.localStorage))
      if (key.startsWith(RECENT_STORE)) window.localStorage.removeItem(key)
  } catch {
    // Nothing to forget.
  }
}
