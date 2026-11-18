import type { Account } from "@/lib/account"
import type { Category, Illustration, Kind, Opinion, Post, ReturnStatus, Stance, Vote } from "@/lib/types"
import { allRows, deleteLook, deleteRows, insertRow, LOOK_PREFIX, patchRows, rows, ServiceError, uploadLook } from "@/lib/vectoree"

type Row = Record<string, unknown>
const CATEGORIES = new Set(["数码", "美妆", "家居", "服饰", "食品", "其它"])
const ILLUSTRATIONS = new Set(["knit", "trousers", "coat", "skirt", "shirt", "sneakers", "blazer", "dress", "hoodie"])
const KINDS = new Set(["keep", "style", "both", "compare"])
const STANCES = new Set(["keep", "return", "style"])
const VOTES = new Set(["keep", "return"])
const DEMO_IDS = new Set(["camel-coat", "cream-knit", "olive-trousers", "burgundy-skirt", "stripe-shirt", "white-trainers", "black-blazer", "floral-dress", "grey-hoodie"])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fail(message: string, status = 400, code = "INVALID_INPUT"): never {
  throw new ServiceError(message, status, code)
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function field(value: unknown, max: number, label: string, min = 0) {
  if (value !== undefined && value !== null && typeof value !== "string") fail(`${label}格式不正确。`)
  const result = text(value)
  if (result.length < min || result.length > max) fail(`${label}须为 ${min}–${max} 字。`)
  return result
}

function idValue(value: unknown) {
  const id = text(value)
  if (!/^[a-z0-9_-]{1,80}$/i.test(id)) fail("内容编号无效。")
  return id
}

function visible(row: Row) {
  return !row.deleted_at && !row.hidden_at && row.status !== "deleted" && row.status !== "hidden" &&
    row.status !== "publishing" && row.is_demo !== true && !DEMO_IDS.has(text(row.id))
}

function publishedPost(row: Row) {
  return visible(row) && Boolean(lookUrl(row.image_url))
}

export function validDeadline(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

export function daysUntil(deadline: string, now = Date.now()) {
  const today = new Date(now + 8 * 3_600_000).toISOString().slice(0, 10)
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

function lookUrl(value: unknown) {
  const raw = text(value)
  if (!raw.startsWith(LOOK_PREFIX)) return ""
  const key = raw.slice(LOOK_PREFIX.length).split("?")[0]
  return UUID.test(key.split(".")[0]) && /\.(png|jpe?g|webp)$/i.test(key) ? `/api/looks/${key}` : ""
}

async function postRow(id: string, includeDeleted = false) {
  idValue(id)
  const row = (await rows("posts", `?id=eq.${encodeURIComponent(id)}&limit=1`))[0]
  if (!row || (!includeDeleted && !publishedPost(row))) fail("帖子不存在或已不可用。", 404, "POST_UNAVAILABLE")
  if (row.is_demo === true || DEMO_IDS.has(id)) fail("演示内容不接受真实互动。", 403, "DEMO_READ_ONLY")
  return row
}

function requireOwner(account: Account, row: Row) {
  if (row.user_id !== account.id) fail("只有作者可以操作这条帖子。", 403, "AUTHOR_REQUIRED")
}

function requireVoteOpen(row: Row) {
  if (row.kind === "style") fail("历史搭配帖仅支持评论。", 409, "STYLE_COMMENTS_ONLY")
  if (row.votes_closed_at || row.decision) fail("投票已结束，仍可继续评论。", 409, "VOTES_CLOSED")
}

// 读取时也沿父链验证，历史坏链、循环及隐藏祖先都不能漏出回复。
export function visibleOpinions(opinions: Row[], postId: string) {
  const related = opinions.filter((row) => row.post_id === postId)
  const byId = new Map(related.map((row) => [text(row.id), row]))
  return related.filter((row) => {
    const visited = new Set<string>()
    let current: Row | undefined = row
    while (current) {
      const id = text(current.id)
      if (!id || visited.has(id) || !visible(current)) return false
      visited.add(id)
      if (!current.parent_id) return true
      current = byId.get(text(current.parent_id))
    }
    return false
  })
}

function asPost(row: Row, account: Account | null, votes: Row[], opinions: Row[], images: Row[], options: Row[], now: number): Post {
  const id = text(row.id)
  const kind = KINDS.has(text(row.kind)) ? row.kind as Kind : "keep"
  const relatedVotes = new Map<string, Row>()
  for (const vote of votes) {
    if (vote.post_id === id && visible(vote) && vote.user_id !== row.user_id) {
      if (kind === "compare") {
        // 比较帖的 stance 存的是选项 id
        relatedVotes.set(text(vote.user_id), vote)
      } else if (row.kind !== "style" && VOTES.has(text(vote.stance))) {
        relatedVotes.set(text(vote.user_id), vote)
      }
    }
  }
  const mine = row.user_id === account?.id
  const myVote = account ? relatedVotes.get(account.id)?.stance as Vote | undefined : undefined
  const gallery = images.filter((image) => image.post_id === id)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((image) => lookUrl(image.image_url)).filter(Boolean).slice(0, 9)
  if (!gallery.length && lookUrl(row.image_url)) gallery.push(lookUrl(row.image_url))
  const createdAt = Date.parse(text(row.created_at))
  if (!id || !Number.isFinite(createdAt)) fail("帖子数据不完整，请联系维护者。", 502, "INVALID_POST_DATA")
  const age = Math.max(0, Math.floor((now - createdAt) / 86_400_000))
  const returnStatus: ReturnStatus = ["known", "unknown", "unavailable"].includes(text(row.return_status))
    ? row.return_status as ReturnStatus : "unknown"
  const deadline = returnStatus === "known" && validDeadline(row.return_deadline) ? row.return_deadline : null
  // 比较帖的选项
  const postOptions = kind === "compare"
    ? options.filter((o) => o.post_id === id)
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((o) => ({
          id: text(o.id),
          label: text(o.label),
          price: o.price !== null && o.price !== undefined && Number.isFinite(Number(o.price)) ? Number(o.price) : null,
        }))
    : undefined
  const optionIds = new Set(postOptions?.map((o) => o.id))
  const optionVotes: Record<string, number> = {}
  if (kind === "compare") {
    for (const o of postOptions ?? []) optionVotes[o.id] = 0
    for (const vote of relatedVotes.values()) {
      const optId = text(vote.stance)
      if (optionIds.has(optId)) optionVotes[optId] = (optionVotes[optId] ?? 0) + 1
    }
  }
  const myOption = kind === "compare" && account ? (optionIds.has(text(relatedVotes.get(account.id)?.stance)) ? text(relatedVotes.get(account.id)!.stance) : null) : undefined
  return {
    id, author: text(row.author_name).slice(0, 12) || "用户", city: "",
    postedLabel: age === 0 ? "今天" : age === 1 ? "昨天" : `${age} 天前`, createdAt,
    kind,
    category: CATEGORIES.has(text(row.category)) ? row.category as Category : "其它",
    illustration: ILLUSTRATIONS.has(text(row.illustration)) ? row.illustration as Illustration : "knit",
    title: text(row.title), story: text(row.story), item: text(row.item), channel: text(row.channel),
    price: row.price !== null && row.price !== undefined && Number.isFinite(Number(row.price)) ? Number(row.price) : null,
    brand: text(row.brand), desiredEffect: text(row.desired_effect), returnStatus, returnDeadline: deadline,
    daysLeft: deadline ? daysUntil(deadline, now) : (row.days_left !== null && row.days_left !== undefined && Number.isFinite(Number(row.days_left)) ? Number(row.days_left) : null),
    votesClosedAt: text(row.votes_closed_at) || null, decisionReason: text(row.decision_reason),
    image: gallery[0], images: gallery,
    keepVotes: [...relatedVotes.values()].filter((vote) => vote.stance === "keep").length,
    returnVotes: [...relatedVotes.values()].filter((vote) => vote.stance === "return").length,
    options: postOptions,
    optionVotes: kind === "compare" ? optionVotes : undefined,
    myOption,
    chosenOption: kind === "compare" && optionIds.has(text(row.decision)) ? text(row.decision) : null,
    opinions: visibleOpinions(opinions, id).map((opinion): Opinion => ({
      id: text(opinion.id), parentId: text(opinion.parent_id) || null,
      author: text(opinion.author_name).slice(0, 12) || "用户", city: "",
      stance: STANCES.has(text(opinion.stance)) ? opinion.stance as Stance : "style",
      text: text(opinion.body), mine: account?.id === opinion.user_id, supplement: row.user_id === opinion.user_id,
    })),
    decision: row.decision === "kept" || row.decision === "returned" ? row.decision : null,
    mine, myVote: mine || kind === "compare" ? null : myVote ?? null,
  }
}

async function relatedRows(postId?: string) {
  const query = postId ? `?post_id=eq.${encodeURIComponent(postId)}` : ""
  const [votes, opinions, images, options] = await Promise.all([
    allRows("votes", query), allRows("opinions", query), allRows("post_images", query),
    postId ? allRows("post_options", query) : allRows("post_options"),
  ])
  return { votes, opinions, images, options }
}

export async function communityPayload(account: Account | null) {
  const [posts, related] = await Promise.all([allRows("posts"), relatedRows()])
  const serverNow = Date.now()
  return { user: account, posts: posts.filter(publishedPost).map((row) => asPost(row, account, related.votes, related.opinions, related.images, related.options, serverNow)), serverNow }
}

export async function singlePostPayload(account: Account | null, id: string) {
  await postRow(id)
  const related = await relatedRows(id)
  // 关联数据读取过程中可能删除，下发正文与图片前再次核对。
  const row = await postRow(id)
  const serverNow = Date.now()
  return { post: asPost(row, account, related.votes, related.opinions, related.images, related.options, serverNow), serverNow }
}

export async function mePayload(account: Account) {
  const [postRows, related] = await Promise.all([allRows("posts"), relatedRows()])
  const serverNow = Date.now()
  const available = postRows.filter(publishedPost)
  const ids = new Set(available.map((row) => row.id))
  const byId = new Map(available.map((row) => [row.id, row]))
  const voted = new Set(related.votes.filter((vote) => ids.has(vote.post_id) && vote.user_id === account.id &&
    visible(vote) && byId.get(vote.post_id)?.kind !== "style" &&
    byId.get(vote.post_id)?.user_id !== account.id).map((vote) => vote.post_id))
  const comments = available.flatMap((post) => visibleOpinions(related.opinions, text(post.id))).filter((row) => row.user_id === account.id)
  const participated = new Set([...voted, ...comments.map((row) => row.post_id)])
  const owned = available.filter((row) => row.user_id === account.id)
  return {
    user: account, stats: { published: owned.length, voted: voted.size, comments: comments.length },
    posts: available.filter((row) => row.user_id === account.id || participated.has(row.id))
      .map((row) => asPost(row, account, related.votes, related.opinions, related.images, related.options, serverNow)), serverNow,
  }
}

function imageBytes(value: unknown) {
  if (typeof value !== "string" || value.length > 950_000) return null
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([a-z0-9+/]+={0,2})$/i)
  if (!match) return null
  const bytes = Buffer.from(match[2], "base64")
  if (bytes.length < 32 || bytes.length > 700_000 || bytes.toString("base64") !== match[2]) return null
  const mime = `image/${match[1].toLowerCase()}`
  const valid = mime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8
    : mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
  return valid ? { bytes, mime } : null
}

function saved(result: { ok: boolean; status: number }, message: string) {
  if (!result.ok) fail(message, result.status === 409 ? 409 : 503, result.status === 409 ? "STATE_CONFLICT" : "DATABASE_WRITE_FAILED")
}

export async function createPost(account: Account, input: Row) {
  const id = idValue(input.id)
  if (!UUID.test(id)) fail("发布编号须为 UUID，请重新发布。")
  const story = field(input.story, 400, "具体纠结", 4)
  const title = field(input.title, 40, "一句话说清") || story.split(/\r?\n/)[0].slice(0, 40)
  field(input.brand, 30, "品牌")
  field(input.desiredEffect, 120, "期待效果")
  const kind = KINDS.has(text(input.kind)) ? text(input.kind) as Kind : "keep"
  const isCompare = kind === "compare"
  // 比较帖的选项
  let options: { id: string; label: string; price: number | null }[] = []
  if (isCompare) {
    if (!Array.isArray(input.options) || input.options.length < 2) fail("比较帖至少需要两个选项。")
    if (input.options.length > 6) fail("比较帖最多 6 个选项。")
    options = input.options.map((raw: unknown, i: number) => {
      const opt = raw as Row
      const label = field(opt?.label, 24, `选项 ${i + 1} 名称`, 1)
      let optPrice: number | null = null
      if (opt?.price !== undefined && opt?.price !== null && opt?.price !== "") {
        if (typeof opt.price !== "number" || !Number.isFinite(opt.price) || opt.price < 0 ||
          opt.price > 999999.99) fail(`选项 ${i + 1} 价格须为 0–999999.99。`)
        optPrice = opt.price
      }
      return { id: globalThis.crypto.randomUUID(), label, price: optPrice }
    })
  }
  let price: number | null = null
  if (input.price !== undefined && input.price !== null && input.price !== "") {
    if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price < 0 ||
      input.price > 999999.99 || Math.abs(input.price * 100 - Math.round(input.price * 100)) > 1e-7) fail("价格须为 0–999999.99，最多两位小数。")
    price = input.price
  }
  if (input.images !== undefined && !Array.isArray(input.images)) fail("照片格式不正确。")
  const selected = Array.isArray(input.images) ? input.images : input.image ? [input.image] : []
  if (selected.length < 1 || selected.length > 9) fail("请上传 1–9 张照片。")
  const prepared = selected.map(imageBytes)
  if (prepared.some((image) => !image)) fail("照片无效或超过 700 KB，请重新选择。")
  const existing = (await rows("posts", `?id=eq.${id}&limit=1`))[0]
  if (existing) {
    if (existing.user_id !== account.id) fail("发布编号已被使用。", 409)
    if (publishedPost(existing)) return ""
    fail("该次发布尚未完成或已删除，请稍后重试。", 409, "PUBLISH_PENDING")
  }
  // 数据库未迁移 status 列，用 image_url 是否为 null 区分待发布/已发布。
  const reservation = await insertRow("posts", {
    id, user_id: account.id, author_name: account.name || "用户", title,
    story, price, kind,
    category: CATEGORIES.has(text(input.category)) ? input.category : "其它",
    illustration: ILLUSTRATIONS.has(text(input.illustration)) ? input.illustration : "knit",
    item: isCompare ? "" : field(input.item, 24, "物品名称"),
    channel: field(input.channel, 16, "购买渠道"),
    days_left: input.daysLeft === null || input.daysLeft === undefined ? null :
      (Number.isFinite(Number(input.daysLeft)) ? Number(input.daysLeft) : null),
    decision: null, image_url: null,
  })
  if (!reservation.ok) {
    if (reservation.status === 409) {
      const winner = (await rows("posts", `?id=eq.${id}&limit=1`))[0]
      if (winner?.user_id === account.id && publishedPost(winner)) return ""
      fail("正在发布或编号冲突，请稍后重试。", 409, "PUBLISH_PENDING")
    }
    saved(reservation, "帖子未能创建，请重试。")
  }
  const uploaded: string[] = []
  try {
    for (const [position, image] of prepared.entries()) {
      if (!image) continue
      const extension = image.mime === "image/png" ? "png" : image.mime === "image/webp" ? "webp" : "jpg"
      const objectKey = `${globalThis.crypto.randomUUID()}.${extension}`
      const expectedUrl = `${LOOK_PREFIX}${objectKey}`
      uploaded.push(expectedUrl)
      saved(await insertRow("post_images", { id: globalThis.crypto.randomUUID(), post_id: id, image_url: expectedUrl, position }), "照片关联保存失败。")
      const imageUrl = await uploadLook(image.bytes, image.mime, objectKey)
      if (imageUrl !== expectedUrl) fail("照片上传失败或返回地址不一致。", 503)
    }
    // 保存比较帖选项
    if (isCompare) {
      for (const [position, opt] of options.entries()) {
        saved(await insertRow("post_options", {
          id: opt.id, post_id: id, label: opt.label, price: opt.price, position,
        }), "选项保存失败。")
      }
    }
    saved(await patchRows("posts", `id=eq.${id}&user_id=eq.${encodeURIComponent(account.id)}&image_url=is.null`, {
      image_url: uploaded[0],
    }), "发布失败，请重试。")
    const published = (await rows("posts", `?id=eq.${id}&limit=1`))[0]
    if (!published || published.user_id !== account.id || !publishedPost(published)) fail("发布未完成或已被删除，请刷新确认。", 409, "PUBLISH_CANCELLED")
  } catch (error) {
    const current = (await rows("posts", `?id=eq.${id}&limit=1`))[0]
    // 只有帖子已经完整发布（image_url 已写入）才算成功；否则必须清理未完成的发布。
    if (current?.user_id === account.id && publishedPost(current)) return ""
    if (current && current.user_id === account.id) {
      const cleanup = await Promise.allSettled(uploaded.map(deleteLook))
      if (cleanup.every((result) => result.status === "fulfilled")) {
        saved(await deleteRows("post_images", `post_id=eq.${id}`), "失败照片关联未能清理。")
        if (isCompare) saved(await deleteRows("post_options", `post_id=eq.${id}`), "失败选项未能清理。")
        saved(await deleteRows("posts", `id=eq.${id}&user_id=eq.${encodeURIComponent(account.id)}`), "待发布记录未能清理。")
      }
    }
    throw error
  }
  return ""
}

export async function castVote(account: Account, postId: string, stance: string) {
  const post = await postRow(postId)
  if (post.user_id === account.id) fail("不能给自己的东西投票。", 403, "SELF_VOTE")
  requireVoteOpen(post)
  const isCompare = text(post.kind) === "compare"
  if (isCompare) {
    // 比较帖：stance 是选项 id，须校验属于该帖
    const options = await allRows("post_options", `?post_id=eq.${encodeURIComponent(postId)}`)
    if (!options.some((o) => text(o.id) === stance)) fail("投票选项无效。", 400, "INVALID_OPTION")
  } else {
    if (!VOTES.has(stance)) fail("票只能是建议留或建议退。")
  }
  const query = `post_id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(account.id)}`
  const existing = (await rows("votes", `?${query}&limit=1`))[0]
  let result = existing ? await patchRows("votes", query, { stance }) :
    await insertRow("votes", { id: globalThis.crypto.randomUUID(), post_id: postId, user_id: account.id, stance })
  if (!result.ok && result.status === 409 && !existing) {
    // 数据库唯一约束处理首次投票竞态；触发器在改投时再次锁帖并检查关闭状态。
    const winner = (await rows("votes", `?${query}&limit=1`))[0]
    if (winner) result = await patchRows("votes", query, { stance })
  }
  if (!result.ok) requireVoteOpen(await postRow(postId))
  saved(result, "投票未能保存，请刷新后重试。")
  return ""
}

export async function addCloudOpinion(account: Account, input: Row) {
  const postId = idValue(input.postId)
  const post = await postRow(postId)
  const body = field(input.text, 180, "意见", 4)
  const stance = input.stance ?? "style"
  if (!STANCES.has(String(stance))) fail("意见立场无效。")
  const parentId = input.parentId == null ? null : idValue(input.parentId)
  if (parentId) {
    const opinions = await allRows("opinions", `?post_id=eq.${encodeURIComponent(postId)}`)
    if (!visibleOpinions(opinions, postId).some((row) => row.id === parentId)) fail("回复目标不存在、已隐藏或不属于此帖。", 409, "INVALID_PARENT")
  }
  const id = input.id == null ? globalThis.crypto.randomUUID() : idValue(input.id)
  if (!UUID.test(id)) fail("意见编号须为 UUID。")
  const prior = (await rows("opinions", `?id=eq.${id}&limit=1`))[0]
  if (prior) {
    if (prior.user_id === account.id && prior.post_id === postId && prior.body === body &&
      (prior.parent_id ?? null) === parentId && visible(prior)) return ""
    fail("意见编号已使用。", 409)
  }
  if (parentId === id) fail("不能回复自己形成循环。", 409, "INVALID_PARENT")
  const created = await insertRow("opinions", {
    id, post_id: postId, user_id: account.id, author_name: account.name || "用户",
    stance: post.user_id === account.id || parentId || post.kind === "style" ? "style" : stance,
    body, parent_id: parentId,
  })
  if (!created.ok && created.status === 409) {
    const winner = (await rows("opinions", `?id=eq.${id}&limit=1`))[0]
    if (winner?.user_id === account.id && winner.post_id === postId && winner.body === body &&
      (winner.parent_id ?? null) === parentId && visible(winner)) return ""
  }
  saved(created, "意见未能保存，请重试。")
  return ""
}

export async function removeCloudOpinion(account: Account, opinionId: string) {
  idValue(opinionId)
  const row = (await rows("opinions", `?id=eq.${encodeURIComponent(opinionId)}&limit=1`))[0]
  if (!row) fail("意见不存在。", 404)
  if (row.user_id !== account.id) fail("只能撤回自己写的。", 403)
  await postRow(text(row.post_id))
  saved(await deleteRows("opinions", `id=eq.${encodeURIComponent(opinionId)}&user_id=eq.${encodeURIComponent(account.id)}`), "意见撤回失败，请重试。")
  return ""
}

export async function updatePost(account: Account, postId: string, input: Row) {
  const row = await postRow(postId, input.action === "delete")
  requireOwner(account, row)
  const query = `id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(account.id)}`
  if (input.action === "delete") {
    // 数据库未迁移软删除列，直接清理关联资源后硬删除帖子。
    const images = await allRows("post_images", `?post_id=eq.${encodeURIComponent(postId)}`)
    const urls = new Set([...images.map((image) => text(image.image_url)), text(row.image_url)].filter(Boolean))
    await Promise.allSettled([...urls].map(deleteLook))
    saved(await deleteRows("post_images", `post_id=eq.${encodeURIComponent(postId)}`), "照片关联清理失败。")
    if (text(row.kind) === "compare") saved(await deleteRows("post_options", `post_id=eq.${encodeURIComponent(postId)}`), "选项清理失败。")
    saved(await deleteRows("votes", `post_id=eq.${encodeURIComponent(postId)}`), "投票记录清理失败。")
    saved(await deleteRows("opinions", `post_id=eq.${encodeURIComponent(postId)}`), "评论记录清理失败。")
    saved(await deleteRows("posts", query), "删除失败，请重试。")
    return { deleted: true, cleanupPending: false }
  }
  const changes: Row = {}
  if (input.action === "deadline") {
    // 直接更新 days_left
    const days = input.daysLeft === null ? null : (Number.isFinite(Number(input.daysLeft)) ? Number(input.daysLeft) : null)
    changes.days_left = days
  } else if (input.action === "closeVotes" || input.action === "decision") {
    if (row.kind === "style") fail("历史搭配帖仅支持评论。", 409, "STYLE_COMMENTS_ONLY")
    if (input.action === "decision") {
      if (row.kind === "compare") {
        const options = await allRows("post_options", `?post_id=eq.${encodeURIComponent(postId)}`)
        if (!options.some((option) => option.id === input.optionId)) fail("请选择这条帖子的一个候选。")
        changes.decision = input.optionId
      } else {
        if (input.decision !== "kept" && input.decision !== "returned") fail("结论只能是留下了或退掉了。")
        changes.decision = input.decision
      }
    }
  } else fail("未知的帖子操作。")
  saved(await patchRows("posts", query, changes), "帖子更新失败，请重试。")
  return { updated: true }
}

export async function setDecision(account: Account, postId: string, decision: string, reason?: string) {
  await updatePost(account, postId, { action: "decision", decision, reason })
  return ""
}

export async function reportContent(account: Account, input: Row) {
  const postId = idValue(input.postId)
  await postRow(postId)
  const opinionId = input.opinionId == null ? null : idValue(input.opinionId)
  const reason = text(input.reason)
  if (!["privacy", "harassment", "advertising", "other", "隐私泄露", "辱骂或骚扰", "广告", "其他"].includes(reason)) fail("请选择有效举报原因。")
  if (opinionId) {
    const opinions = await allRows("opinions", `?post_id=eq.${encodeURIComponent(postId)}`)
    if (!visibleOpinions(opinions, postId).some((row) => row.id === opinionId)) fail("举报意见不存在或不属于该帖。", 404)
  }
  const query = `?post_id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(account.id)}&status=eq.pending&${opinionId ? `opinion_id=eq.${encodeURIComponent(opinionId)}` : "opinion_id=is.null"}`
  if ((await rows("reports", `${query}&limit=1`)).length) return { received: true }
  const result = await insertRow("reports", {
    id: globalThis.crypto.randomUUID(), user_id: account.id, post_id: postId, opinion_id: opinionId, reason, status: "pending",
  })
  if (!result.ok && result.status === 409 && (await rows("reports", `${query}&limit=1`)).length) return { received: true }
  saved(result, "举报未能提交，请重试。")
  return { received: true }
}

export async function visibleLook(key: string) {
  const url = `${LOOK_PREFIX}${key}`
  const images = await allRows("post_images", `?image_url=eq.${encodeURIComponent(url)}`)
  for (const image of images) {
    const post = (await rows("posts", `?id=eq.${encodeURIComponent(text(image.post_id))}&limit=1`))[0]
    if (post && publishedPost(post)) return true
  }
  // 历史单图字段也必须经过帖子可见性验证。
  return (await allRows("posts", `?image_url=eq.${encodeURIComponent(url)}`)).some(publishedPost)
}
