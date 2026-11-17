import type { Decision, Kind, Post, Stance } from "@/lib/types"

export const KIND_LABEL: Record<Kind, string> = {
  keep: "要不要留",
  style: "怎么搭",
  both: "留和搭配都纠结",
}

export const STANCE_LABEL: Record<Stance, string> = {
  keep: "建议留",
  return: "建议退",
  style: "只说搭配",
}

export function tally(post: Pick<Post, "keepVotes" | "returnVotes">) {
  const keep = post.keepVotes
  const ret = post.returnVotes
  const total = keep + ret
  const keepShare = total === 0 ? 0 : (keep / total) * 100
  return { keep, ret, total, keepShare }
}

export function verdict(post: Pick<Post, "keepVotes" | "returnVotes" | "decision">): {
  label: string
  tone: "keep" | "return" | "split" | "open"
} {
  if (post.decision === "kept") return { label: "留下了", tone: "keep" }
  if (post.decision === "returned") return { label: "退掉了", tone: "return" }
  const { total, keepShare } = tally(post)
  if (total < 8) return { label: "票还不够", tone: "open" }
  if (keepShare >= 65) return { label: "多数建议留", tone: "keep" }
  if (keepShare <= 35) return { label: "多数建议退", tone: "return" }
  return { label: "两边都有道理", tone: "split" }
}

export function deadlineLabel(post: Pick<Post, "daysLeft" | "decision">) {
  if (post.decision === "kept") return "已经留下"
  if (post.decision === "returned") return "已经退掉"
  if (post.daysLeft === null) return "已过退货期"
  if (post.daysLeft <= 1) return "只剩今天能退"
  return `还剩 ${post.daysLeft} 天可退`
}

export function deadlineTone(post: Pick<Post, "daysLeft" | "decision">) {
  if (post.decision) return "done"
  if (post.daysLeft === null) return "late"
  if (post.daysLeft <= 2) return "urgent"
  return "ok"
}

export function priceLabel(price: number | null) {
  if (price === null) return "价格没写"
  return `¥${price}`
}

export function excerpt(text: string, length = 68) {
  const flat = text.replace(/\s+/g, "")
  if (flat.length <= length) return flat
  return `${flat.slice(0, length)}…`
}

export function decisionLabel(decision: Decision) {
  return decision === "kept" ? "留下了" : "退掉了"
}
