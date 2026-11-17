import type { Account } from "@/lib/account"
import type { Category, Decision, Illustration, Kind, Opinion, Post, Stance, Vote } from "@/lib/types"
import { deleteLook, deleteRows, insertRow, patchRows, rows, uploadLook } from "@/lib/vectoree"

const CATEGORIES = new Set(["上衣", "裤装", "裙装", "外套", "鞋", "包"])
const ILLUSTRATIONS = new Set(["knit", "trousers", "coat", "skirt", "shirt", "sneakers", "blazer", "dress", "hoodie"])
const KINDS = new Set(["keep", "style", "both"])
const STANCES = new Set(["keep", "return", "style"])
const VOTES = new Set(["keep", "return"])

type SeedOverlay = {
  votes: Record<string, Vote>
  extraKeep: Record<string, number>
  extraReturn: Record<string, number>
  opinions: Record<string, Opinion[]>
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : ""
}

const LOOK_PREFIX = "https://vectoree.ai/api/storage/buckets/looks/objects/"

// 云端桶匿名读会 401，改成走自家代理取图。
function lookUrl(value: unknown) {
  const raw = text(value, 500)
  if (!raw.startsWith(LOOK_PREFIX)) return ""
  const key = raw.slice(LOOK_PREFIX.length).split("?")[0]
  return key ? `/api/looks/${key}` : ""
}

function postedLabel(iso: string) {
  const delta = Date.now() - Date.parse(iso)
  const day = 86_400_000
  if (!Number.isFinite(delta) || delta < 60 * 60 * 1000) return "刚刚"
  if (delta < day) return "今天"
  if (delta < 2 * day) return "昨天"
  return `${Math.floor(delta / day)} 天前`
}

function asPost(row: Record<string, unknown>, account: Account | null, voteRows: Record<string, unknown>[], opinionRows: Record<string, unknown>[], imageRows: Record<string, unknown>[]): Post | null {
  const id = text(row.id, 80)
  const kind = text(row.kind, 16)
  const category = text(row.category, 8)
  const illustration = text(row.illustration, 16)
  if (!id || !KINDS.has(kind) || !CATEGORIES.has(category) || !ILLUSTRATIONS.has(illustration)) return null
  const userId = text(row.user_id, 80)
  const mine = account?.id === userId
  const relatedVotes = voteRows.filter((vote) => text(vote.post_id, 80) === id)
  const myVoteRow = account ? relatedVotes.find((vote) => text(vote.user_id, 80) === account.id) : undefined
  const myVote = myVoteRow && VOTES.has(text(myVoteRow.stance, 16)) ? (text(myVoteRow.stance, 16) as Vote) : null
  const decision = text(row.decision, 16)
  const opinions = opinionRows
    .filter((opinion) => text(opinion.post_id, 80) === id)
    .map((opinion) => toOpinion(opinion, account, userId))
    .filter((opinion): opinion is Opinion => Boolean(opinion))
  const images = imageRows
    .filter((image) => image.post_id === id)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((image) => lookUrl(image.image_url)).filter(Boolean).slice(0, 9)
  if (!images.length && lookUrl(row.image_url)) images.push(lookUrl(row.image_url))
  return {
    id,
    author: text(row.author_name, 12) || "我",
    city: "",
    postedLabel: postedLabel(text(row.created_at, 40)),
    createdAt: Date.parse(text(row.created_at, 40)) || Date.now(),
    kind: kind as Kind,
    category: category as Category,
    title: text(row.title, 40),
    story: typeof row.story === "string" ? row.story : "",
    item: text(row.item, 24),
    price: typeof row.price === "number" ? row.price : null,
    channel: text(row.channel, 16),
    daysLeft: typeof row.days_left === "number" ? row.days_left : null,
    illustration: illustration as Illustration,
    image: images[0],
    images,
    keepVotes: relatedVotes.filter((vote) => vote.stance === "keep").length,
    returnVotes: relatedVotes.filter((vote) => vote.stance === "return").length,
    opinions,
    decision: decision === "kept" || decision === "returned" ? decision : null,
    mine,
    myVote: mine ? null : myVote,
  }
}

function toOpinion(row: Record<string, unknown>, account: Account | null, ownerId?: string): Opinion | null {
  const stance = text(row.stance, 16)
  const body = typeof row.body === "string" ? row.body.trim() : ""
  const id = text(row.id, 80)
  if (!id || !STANCES.has(stance) || body.length < 2) return null
  return {
    id,
    author: text(row.author_name, 12) || "路过的人",
    city: "",
    stance: stance as Stance,
    text: body.slice(0, 180),
    mine: account?.id === text(row.user_id, 80),
    supplement: Boolean(ownerId && ownerId === text(row.user_id, 80)),
  }
}

export async function communityPayload(account: Account | null) {
  const [postRows, voteRows, opinionRows] = await Promise.all([
    rows("posts", "?limit=80&order=created_at.desc"),
    rows("votes", "?limit=1000"),
    rows("opinions", "?limit=1000&order=created_at.asc"),
  ])
  const ids = postRows.map((row) => encodeURIComponent(text(row.id, 80))).filter(Boolean)
  const imageRows = ids.length
    ? await rows("post_images", `?post_id=in.(${ids.join(",")})&limit=720&order=position.asc`)
    : []
  const posts = postRows
    .map((row) => asPost(row, account, voteRows, opinionRows, imageRows))
    .filter((post): post is Post => Boolean(post))
  const seed: SeedOverlay = { votes: {}, extraKeep: {}, extraReturn: {}, opinions: {} }
  const known = new Set(posts.map((post) => post.id))
  for (const vote of voteRows) {
    const postId = text(vote.post_id, 80)
    if (!postId || known.has(postId)) continue
    const stance = text(vote.stance, 16)
    if (stance === "keep") seed.extraKeep[postId] = (seed.extraKeep[postId] ?? 0) + 1
    if (stance === "return") seed.extraReturn[postId] = (seed.extraReturn[postId] ?? 0) + 1
    if (account && text(vote.user_id, 80) === account.id && VOTES.has(stance)) {
      seed.votes[postId] = stance as Vote
    }
  }
  for (const opinion of opinionRows) {
    const postId = text(opinion.post_id, 80)
    if (!postId || known.has(postId)) continue
    const mapped = toOpinion(opinion, account)
    if (!mapped) continue
    seed.opinions[postId] = [...(seed.opinions[postId] ?? []), mapped]
  }
  return { user: account, posts, seed }
}

function imageBytes(value: unknown) {
  if (typeof value !== "string" || value.length > 950_000) return null
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=\s]+)$/i)
  if (!match) return null
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64")
  if (bytes.length < 32 || bytes.length > 700_000) return null
  const mime = match[1].toLowerCase() === "png" ? "image/png" : match[1].toLowerCase() === "webp" ? "image/webp" : "image/jpeg"
  const valid = mime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8
    : mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
  return valid ? { bytes, mime } : null
}

export async function createPost(account: Account, input: Record<string, unknown>) {
  const title = text(input.title, 40)
  const story = typeof input.story === "string" ? input.story.trim().slice(0, 400) : ""
  const kind = text(input.kind, 16)
  const category = text(input.category, 8)
  const illustration = text(input.illustration, 16)
  if (title.length < 4 || story.length < 12) return "标题和纠结都再写清楚一点。"
  if (!KINDS.has(kind) || !CATEGORIES.has(category) || !ILLUSTRATIONS.has(illustration)) return "这件衣服的分类没对上。"
  let price: number | null = null
  if (typeof input.price === "number" && Number.isInteger(input.price) && input.price >= 0 && input.price <= 999999) {
    price = input.price
  }
  const days = input.daysLeft
  const daysLeft = days === null ? null : typeof days === "number" && [1, 2, 3, 5, 7].includes(days) ? days : null
  const id = text(input.id, 40)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return "这条纠结的编号无效，请重新发布。"
  }
  const existing = (await rows("posts", `?id=eq.${encodeURIComponent(id)}&select=user_id&limit=1`))[0]
  if (existing) return existing.user_id === account.id ? "" : "这条纠结的编号已被使用，请重新发布。"
  if (input.images !== undefined && !Array.isArray(input.images)) return "照片没读到，重新选一次。"
  const selected = Array.isArray(input.images) ? input.images : input.image ? [input.image] : []
  if (selected.length > 9) return "一条最多放 9 张照片，先去掉几张。"
  const prepared = selected.map(imageBytes)
  if (prepared.some((image) => !image)) return "有照片读不出来，或者太大了。换一张，或者压小一点再发。"
  const images: string[] = []
  const imageRowIds: string[] = []
  async function cleanup() {
    await Promise.all(imageRowIds.map((rowId) => deleteRows("post_images", `id=eq.${rowId}`).catch(() => undefined)))
    await Promise.all(images.map((url) => deleteLook(url).catch(() => undefined)))
  }
  try {
    for (const image of prepared) {
      if (!image) continue
      const url = await uploadLook(image.bytes, image.mime)
      if (!url) throw new Error("upload")
      images.push(url)
    }
    // 先写图片列表，全部成功后才发布帖子；失败仅回收本次创建的资源。
    for (const [position, image_url] of images.entries()) {
      const rowId = cryptoRandom()
      imageRowIds.push(rowId)
      const saved = await insertRow("post_images", { id: rowId, post_id: id, image_url, position })
      if (!saved.ok) throw new Error("image-row")
    }
  } catch {
    await cleanup()
    return "照片没传完，这条还没发出去。请重试。"
  }
  let created
  try {
    created = await insertRow("posts", {
    id,
    user_id: account.id,
    author_name: account.name || "我",
    title,
    story,
    category,
    kind,
    item: text(input.item, 24),
    price,
    channel: text(input.channel, 16),
    days_left: daysLeft,
    illustration,
    image_url: images[0] || null,
    decision: null,
    })
  } catch {
    // 请求可能已经成功到达云端，先核实，避免清掉已发布帖子的照片。
    const saved = (await rows("posts", `?id=eq.${id}&select=user_id&limit=1`))[0]
    if (saved?.user_id === account.id) return ""
    await cleanup()
    return "这条纠结没有发出去，请重试。"
  }
  if (!created.ok) {
    await cleanup()
  }
  return created.ok ? "" : "这条纠结没有发出去，请重试。"
}

export async function castVote(account: Account, postId: string, stance: string) {
  if (!VOTES.has(stance)) return "票只能是留下或退掉。"
  const own = await rows("posts", `?id=eq.${encodeURIComponent(postId)}&select=user_id,decision&limit=1`)
  const post = own[0]
  if (post && text(post.user_id, 80) === account.id) return "不能给自己的衣服投票。"
  if (post && (post.decision === "kept" || post.decision === "returned")) return "作者已经拍板了。"
  const query = `post_id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(account.id)}`
  const existing = await rows("votes", `?${query}&limit=1`)
  const result = existing[0]
    ? await patchRows("votes", query, { stance })
    : await insertRow("votes", { id: cryptoRandom(), post_id: postId, user_id: account.id, stance })
  return result.ok ? "" : "票没有记上。"
}

export async function addCloudOpinion(account: Account, input: Record<string, unknown>) {
  const postId = text(input.postId, 80)
  const stance = text(input.stance, 16)
  const body = typeof input.text === "string" ? input.text.trim().slice(0, 180) : ""
  const author = text(input.author, 12) || account.name || "路过的人"
  if (!postId || !STANCES.has(stance) || body.length < 4) return "至少写一句具体的。"
  const post = (await rows("posts", `?id=eq.${encodeURIComponent(postId)}&select=user_id&limit=1`))[0]
  const supplement = post && text(post.user_id, 80) === account.id
  const created = await insertRow("opinions", {
    id: cryptoRandom(),
    post_id: postId,
    user_id: account.id,
    author_name: author,
    stance: supplement ? "style" : stance,
    body,
  })
  return created.ok ? "" : "意见没有写上。"
}

export async function removeCloudOpinion(account: Account, opinionId: string) {
  const existing = await rows("opinions", `?id=eq.${encodeURIComponent(opinionId)}&limit=1`)
  const row = existing[0]
  if (!row || text(row.user_id, 80) !== account.id) return "只能撤回自己写的。"
  const removed = await deleteRows("opinions", `id=eq.${encodeURIComponent(opinionId)}`)
  return removed.ok ? "" : "没有撤回。"
}

export async function setDecision(account: Account, postId: string, decision: string) {
  if (decision !== "kept" && decision !== "returned") return "结论只能是留下了或退掉了。"
  const existing = await rows("posts", `?id=eq.${encodeURIComponent(postId)}&limit=1`)
  const row = existing[0]
  if (!row || text(row.user_id, 80) !== account.id) return "只有作者能拍板。"
  const updated = await patchRows("posts", `id=eq.${encodeURIComponent(postId)}`, { decision: decision as Decision })
  return updated.ok ? "" : "结论没有记下。"
}

function cryptoRandom() {
  return globalThis.crypto.randomUUID()
}
