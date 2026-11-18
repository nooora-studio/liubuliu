const KIND_LABEL = {
  keep: "留不留",
  style: "怎么搭",
  both: "留和搭配都纠结",
}

const STANCE_LABEL = {
  keep: "建议留",
  return: "建议退",
  style: "只说搭配",
}

function tally(post) {
  const keep = post.keepVotes
  const ret = post.returnVotes
  const total = keep + ret
  const keepShare = total === 0 ? 0 : (keep / total) * 100
  return { keep, ret, total, keepShare }
}

function verdict(post) {
  if (post.decision === "kept") return { label: "留下了", tone: "keep" }
  if (post.decision === "returned") return { label: "退掉了", tone: "return" }
  const { total, keepShare } = tally(post)
  if (total < 8) return { label: "票还不够", tone: "open" }
  if (keepShare >= 65) return { label: "多数建议留", tone: "keep" }
  if (keepShare <= 35) return { label: "多数建议退", tone: "return" }
  return { label: "两边都有道理", tone: "split" }
}

function deadlineLabel(post) {
  if (post.decision === "kept") return "已经留下"
  if (post.decision === "returned") return "已经退掉"
  if (post.daysLeft === null) return "已过退货期"
  if (post.daysLeft <= 1) return "只剩今天能退"
  return `还剩 ${post.daysLeft} 天可退`
}

function deadlineTone(post) {
  if (post.decision) return "done"
  if (post.daysLeft === null) return "late"
  if (post.daysLeft <= 2) return "urgent"
  return "ok"
}

function priceLabel(price) {
  if (price === null || price === undefined) return "价格没写"
  return `¥${price}`
}

function excerpt(text, length = 68) {
  const flat = String(text || "").replace(/\s+/g, "")
  if (flat.length <= length) return flat
  return `${flat.slice(0, length)}…`
}

function decorate(post) {
  const count = tally(post)
  const result = verdict(post)
  return Object.assign({}, post, {
    image: post.image || "",
    images: post.images && post.images.length ? post.images : post.image ? [post.image] : [],
    kindLabel: KIND_LABEL[post.kind],
    deadline: deadlineLabel(post),
    tone: deadlineTone(post),
    priceText: priceLabel(post.price),
    blurb: excerpt(post.story),
    keep: count.keep,
    ret: count.ret,
    total: count.total,
    keepShare: count.keepShare,
    returnShare: count.total === 0 ? 0 : 100 - count.keepShare,
    voteLine:
      count.total === 0
        ? "还没有人表态。"
        : `${count.total} 个人里，${count.keep} 个说留，${count.ret} 个说退。`,
    peopleLine: count.total === 0 ? "还没人表态" : `${count.total} 人帮看过`,
    verdictLabel: result.label,
    verdictTone: result.tone,
    myVoteLabel: post.myVote === "keep" ? "你投了留" : post.myVote === "return" ? "你投了退" : "",
    who: `${post.author}${post.city ? ` · ${post.city}` : ""} · ${post.postedLabel}`,
    opinions: (post.opinions || []).map((opinion) =>
      Object.assign({}, opinion, {
        stanceLabel: opinion.supplement ? "作者补充" : STANCE_LABEL[opinion.stance],
        who: `${opinion.author}${opinion.city ? ` · ${opinion.city}` : ""}`,
      })
    ),
  })
}

module.exports = {
  KIND_LABEL,
  STANCE_LABEL,
  tally,
  verdict,
  deadlineLabel,
  decorate,
  excerpt,
}
