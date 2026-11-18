import type { Decision, Kind, Post, Stance } from "@/lib/types"

export const KIND_LABEL: Record<Kind, string> = {
  keep: "留不留",
  style: "怎么搭",
  both: "留和搭配都纠结",
  compare: "留哪个",
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

export function verdict(post: Pick<Post, "keepVotes" | "returnVotes" | "decision" | "kind" | "optionVotes" | "options" | "chosenOption">): {
  label: string
  tone: "keep" | "return" | "split" | "open"
} {
  if (post.decision === "kept") return { label: "留下了", tone: "keep" }
  if (post.decision === "returned") return { label: "退掉了", tone: "return" }
  if (post.kind === "compare") {
    if (post.chosenOption) return { label: `选了${post.options?.find((o) => o.id === post.chosenOption)?.label ?? "一个候选"}`, tone: "keep" }
    const total = optionTotal(post)
    if (total < 5) return { label: "帮选的人还少", tone: "open" }
    const [top] = optionRanking(post)
    if (top && (top.count / total) >= 0.6) return { label: `${top.label} 领先`, tone: "keep" }
    return { label: "还没拉开差距", tone: "split" }
  }
  const { total, keepShare } = tally(post)
  if (total < 8) return { label: "票还不够", tone: "open" }
  if (keepShare >= 65) return { label: "多数建议留", tone: "keep" }
  if (keepShare <= 35) return { label: "多数建议退", tone: "return" }
  return { label: "两边都有道理", tone: "split" }
}

export function optionTotal(post: Pick<Post, "optionVotes">) {
  return Object.values(post.optionVotes ?? {}).reduce((sum, n) => sum + n, 0)
}

export function optionRanking(post: Pick<Post, "options" | "optionVotes">) {
  const votes = post.optionVotes ?? {}
  return (post.options ?? [])
    .map((o) => ({ id: o.id, label: o.label, price: o.price, count: votes[o.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
}

export function settled(post: Pick<Post, "decision" | "chosenOption">) {
  return Boolean(post.decision || post.chosenOption)
}

export function deadlineLabel(post: Pick<Post, "daysLeft" | "decision" | "chosenOption">) {
  if (post.chosenOption) return "已经选定"
  if (post.decision === "kept") return "已经留下"
  if (post.decision === "returned") return "已经退掉"
  if (post.daysLeft === null) return "已过退货期"
  if (post.daysLeft <= 1) return "只剩今天能退"
  return `还剩 ${post.daysLeft} 天可退`
}

export function deadlineTone(post: Pick<Post, "daysLeft" | "decision" | "chosenOption">) {
  if (settled(post)) return "done"
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

export function postBody(post: Pick<Post, "title" | "story">) {
  const [first, ...rest] = post.story.split(/\r?\n/)
  if (rest.length && first.trim() === post.title.trim()) return rest.join("\n").trimStart()
  return post.story
}

export function compareHeadline(post: Pick<Post, "title" | "story" | "kind">) {
  const body = postBody(post).trim()
  const stripped = body.replace(/^留哪个[?？：:\s]*/, "").trim()
  const title = post.title.trim()
  const titleIsGeneric = !title || /^留哪个[?？]?$/.test(title)
  if (!titleIsGeneric) return title
  return stripped || body || title
}

export function decisionLabel(decision: Decision) {
  return decision === "kept" ? "留下了" : "退掉了"
}
