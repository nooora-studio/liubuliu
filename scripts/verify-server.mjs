import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

// 所有 HTTP 均被本地模拟接管，不读取 Vectoree 配置或访问远端。
const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL("../", import.meta.url))
const origin = "https://local-backend.invalid"
const prefix = `${origin}/api/storage/buckets/looks/objects/`
const owner = { id: randomUUID(), name: "作者", email: "" }
const visitor = { id: randomUUID(), name: "访客", email: "" }
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII="
const tables = { posts: [], votes: [], opinions: [], post_images: [], reports: [] }
const reads = []
const deleted = []
let account = owner, readFailure = "", malformed = "", uploads = 0, uploadFail = 0, cleanupFail = false
let lostPublish = false, duplicatePage = false, downloadCalls = 0
let lostUpload = false, cancelPublish = false

function filtered(table, url) {
  let result = tables[table].filter((row) => {
    for (const [key, value] of url.searchParams) {
      if (["limit", "offset", "order", "select"].includes(key)) continue
      if (value.startsWith("eq.") && String(row[key]) !== value.slice(3)) return false
      if (value === "is.null" && row[key] != null) return false
    }
    return true
  })
  if (url.searchParams.has("order")) {
    const [field, direction] = url.searchParams.get("order").split(".")
    result = [...result].sort((a, b) => String(a[field]).localeCompare(String(b[field])) * (direction === "desc" ? -1 : 1))
  }
  return result
}

async function fetchMock(raw, init = {}) {
  const url = new URL(raw)
  assert.equal(url.origin, origin, "不得请求真实远端")
  assert.ok(init.headers, "必须经现有 REST BFF")
  if (url.pathname.startsWith("/api/storage/")) {
    if (init.method === "PUT") {
      uploads++
      if (lostUpload) {
        lostUpload = false
        throw new Error("模拟上传响应丢失")
      }
      return uploads === uploadFail ? Response.json({}, { status: 503 }) : Response.json({ url: raw })
    }
    if (init.method === "DELETE") {
      if (cleanupFail) return Response.json({}, { status: 503 })
      deleted.push(raw)
      return Response.json({})
    }
    downloadCalls++
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })
  }
  assert.ok(url.pathname.startsWith("/api/database/records/"), "不允许新增平台接口")
  const table = url.pathname.split("/").at(-1)
  const method = init.method || "GET"
  if (method === "GET") {
    reads.push({ table, query: url.search })
    if (readFailure === table) return Response.json({}, { status: 503 })
    if (malformed === table) return Response.json({ rows: [] })
    const found = filtered(table, url)
    const offset = duplicatePage ? 0 : Number(url.searchParams.get("offset") || 0)
    // 故意小于请求 limit，检验短页之后仍会继续读取。
    return Response.json(found.slice(offset, offset + Math.min(137, Number(url.searchParams.get("limit") || 137))))
  }
  if (method === "POST") {
    const row = JSON.parse(init.body)[0]
    const duplicate = tables[table].some((item) => item.id === row.id ||
      table === "votes" && item.post_id === row.post_id && item.user_id === row.user_id ||
      table === "reports" && item.post_id === row.post_id && item.user_id === row.user_id &&
      item.opinion_id === row.opinion_id && item.status === "pending")
    if (duplicate) return Response.json({}, { status: 409 })
    tables[table].push({ created_at: new Date().toISOString(), ...row })
    return Response.json({})
  }
  if (method === "PATCH") {
    const changes = JSON.parse(init.body)
    if (changes.status === "published" && cancelPublish) {
      cancelPublish = false
      for (const row of filtered(table, url)) Object.assign(row, { status: "deleted", deleted_at: new Date().toISOString() })
      return Response.json({})
    }
    for (const row of filtered(table, url)) Object.assign(row, changes)
    if (changes.status === "published" && lostPublish) {
      lostPublish = false
      throw new Error("模拟发布响应丢失")
    }
    return Response.json({})
  }
  if (method === "DELETE") {
    const removed = new Set(filtered(table, url).map((row) => row.id))
    tables[table] = tables[table].filter((row) => !removed.has(row.id))
    return Response.json({})
  }
  throw new Error(`未模拟的方法 ${method}`)
}

const cache = new Map()
function load(relative) {
  if (cache.has(relative)) return cache.get(relative)
  const module = { exports: {} }
  cache.set(relative, module.exports)
  const code = ts.transpileModule(fs.readFileSync(`${root}/${relative}`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      if (name === "@/lib/session") return { resolveAccount: async () => ({ account, refreshed: null }) }
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`)
      return require(name)
    },
    process: { env: { VECTOREE_API_URL: origin, VECTOREE_API_KEY: "local-test-only" }, cwd: () => { throw new Error("不得读取本地连接配置") } },
    fetch: fetchMock, Response, Request, Headers, URL, URLSearchParams, Buffer, FormData, Blob,
    Date, crypto: { randomUUID }, console,
  })
  return module.exports
}
const api = load("src/lib/community-data.ts")
const ve = load("src/lib/vectoree.ts")
const request = (body, method = "POST", path = "/api/community") =>
  new Request(`https://app.invalid${path}`, { method, ...(method === "GET" ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }) })
const input = () => ({ id: randomUUID(), story: "试穿效果拿不准", images: [png], brand: " Uniqlo ", desiredEffect: "通勤利落", price: 0, returnStatus: "known", returnDeadline: "2026-11-17" })
const rejected = (fn, status) => assert.rejects(fn, (error) => error.status === status)
function fixture(extra = {}) {
  return { id: randomUUID(), user_id: owner.id, author_name: owner.name, story: "历史试穿内容", title: "历史帖子",
    created_at: "2026-11-16T00:00:00Z", kind: "both", category: "上衣", illustration: "knit", decision: null, ...extra }
}

async function run() {
  const post = input()
  assert.equal(await api.createPost(owner, post), "")
  assert.equal(tables.posts[0].status, "published")
  assert.equal(tables.posts[0].brand, "Uniqlo")
  assert.equal(tables.posts[0].price, 0)
  const uploadBaseline = uploads
  await Promise.all([api.createPost(owner, post), api.createPost(owner, post)])
  assert.equal(uploads, uploadBaseline)
  assert.equal(tables.posts.length, 1)
  await rejected(() => api.createPost(visitor, post), 409)
  for (const changes of [
    { images: [] }, { images: Array(10).fill(png) }, { images: ["broken"] },
    { story: "短" }, { story: "字".repeat(401) }, { brand: "字".repeat(31) },
    { desiredEffect: "字".repeat(121) }, { price: -1 }, { price: 999999.991 }, { price: 1.001 },
    { returnStatus: undefined, returnDeadline: null },
    { returnDeadline: "2026-02-30" }, { returnStatus: "unknown", returnDeadline: "2026-11-17" },
  ]) await rejected(() => api.createPost(owner, { ...input(), ...changes }), 400)
  assert.equal(uploads, uploadBaseline, "验证失败不能上传图片")
  await api.createPost(owner, { ...input(), price: 999999.99, returnStatus: "unavailable", returnDeadline: null })
  const legacy = fixture({ days_left: 7, channel: "优衣库", image_url: tables.post_images[0].image_url })
  tables.posts.push(legacy)
  const mapped = (await api.singlePostPayload(null, legacy.id)).post
  assert.equal(mapped.returnStatus, "unknown")
  assert.equal(mapped.returnDeadline, null)
  assert.equal(mapped.daysLeft, null)
  assert.equal(mapped.brand, "")
  assert.equal(mapped.images.length, 1)
  assert.equal(api.daysUntil("2026-11-17", Date.parse("2026-11-16T15:59:59Z")), 1)
  assert.equal(api.daysUntil("2026-11-17", Date.parse("2026-11-16T16:00:00Z")), 0)
  assert.equal(api.daysUntil("2026-11-17", Date.parse("2026-11-17T16:00:00Z")), -1)
  console.log("PASS 任务1/2：新旧字段、照片与价格边界、北京时间跨日、发布重试")

  const missing = randomUUID()
  await rejected(() => api.castVote(visitor, missing, "keep"), 404)
  await rejected(() => api.castVote(owner, post.id, "keep"), 403)
  await Promise.all([api.castVote(visitor, post.id, "keep"), api.castVote(visitor, post.id, "keep")])
  assert.equal(tables.votes.length, 1)
  await api.castVote(visitor, post.id, "return")
  assert.equal(tables.votes.length, 1)
  assert.equal((await api.singlePostPayload(visitor, post.id)).post.returnVotes, 1)
  await rejected(() => api.updatePost(visitor, post.id, { action: "closeVotes" }), 403)
  await api.updatePost(owner, post.id, { action: "closeVotes" })
  assert.equal((await api.singlePostPayload(null, post.id)).post.decision, null)
  await rejected(() => api.castVote(visitor, post.id, "keep"), 409)
  const closedAt = tables.posts[0].votes_closed_at
  await api.updatePost(owner, post.id, { action: "decision", decision: "returned", reason: "不符合期待" })
  await api.updatePost(owner, post.id, { action: "decision", decision: "kept", reason: "重新试穿" })
  assert.equal(tables.posts[0].votes_closed_at, closedAt)
  assert.equal(tables.votes.length, 1)
  await api.updatePost(owner, post.id, { action: "deadline", returnStatus: "unknown", returnDeadline: null })
  assert.equal(tables.posts[0].return_deadline, null)
  await rejected(() => api.updatePost(visitor, post.id, { action: "deadline", returnStatus: "unknown" }), 403)
  const style = fixture({ kind: "style" })
  const demo = fixture({ is_demo: true })
  tables.posts.push(style, demo)
  await rejected(() => api.castVote(visitor, style.id, "keep"), 409)
  await rejected(() => api.updatePost(owner, style.id, { action: "decision", decision: "kept" }), 409)
  await rejected(() => api.addCloudOpinion(visitor, { postId: demo.id, text: "测试演示意见" }), 404)
  await rejected(() => api.addCloudOpinion(visitor, { postId: missing, text: "测试不存在帖" }), 404)
  console.log("PASS 任务2：真实存在性、作者权限、唯一投票/改投、关闭与结论独立、style/演示隔离")

  const parentId = randomUUID(), replyId = randomUUID()
  await api.addCloudOpinion(visitor, { id: parentId, postId: post.id, text: "建议看看肩线", author: "伪造姓名" })
  await api.addCloudOpinion(owner, { id: replyId, postId: post.id, text: "补充自然光图", parentId, stance: "return" })
  await api.addCloudOpinion(visitor, { id: randomUUID(), postId: post.id, text: "回复继续看看", parentId: replyId })
  assert.equal(tables.opinions[0].author_name, visitor.name)
  assert.equal(tables.opinions[1].stance, "style")
  assert.equal(tables.votes.length, 1, "回复不应产生票")
  await api.addCloudOpinion(owner, { id: replyId, postId: post.id, text: "补充自然光图", parentId })
  assert.equal(tables.opinions.length, 3)
  await rejected(() => api.addCloudOpinion(visitor, { postId: style.id, text: "跨帖子错误回复", parentId }), 409)
  const cycleId = randomUUID()
  tables.opinions.push({ id: cycleId, parent_id: cycleId, post_id: post.id, user_id: visitor.id, body: "历史循环回复" })
  await rejected(() => api.addCloudOpinion(visitor, { postId: post.id, text: "不能回复循环", parentId: cycleId }), 409)
  await rejected(() => api.removeCloudOpinion(owner, parentId), 403)
  await api.removeCloudOpinion(visitor, parentId)
  assert.equal((await api.singlePostPayload(owner, post.id)).post.opinions.length, 0)
  assert.equal((await api.mePayload(owner)).stats.comments, 0)
  await rejected(() => api.addCloudOpinion(visitor, { postId: post.id, text: "不能回复撤回意见", parentId: replyId }), 409)
  console.log("PASS 任务2/6.1：关闭后多层回复、身份署名、跨帖/循环/撤回祖先、有效统计")

  for (let i = 0; i < 1100; i++) tables.posts.push(fixture({ user_id: visitor.id }))
  const me = await api.mePayload(visitor)
  assert.equal(me.stats.published, 1100)
  assert.equal(me.stats.voted, 1, "关闭后的历史票仍计入")
  assert.ok(reads.filter((item) => item.table === "posts" && item.query.includes("offset=")).length > 8)
  duplicatePage = true
  await rejected(() => ve.allRows("posts"), 503)
  duplicatePage = false
  console.log("PASS 任务6.1：1100 条超首屏统计、短页继续读取、重复分页明确失败")

  await Promise.all([api.reportContent(visitor, { postId: post.id, reason: "privacy" }), api.reportContent(visitor, { postId: post.id, reason: "privacy" })])
  assert.equal(tables.reports.length, 1)
  await rejected(() => api.reportContent(visitor, { postId: post.id, opinionId: replyId, reason: "privacy" }), 404)
  await rejected(() => api.updatePost(visitor, post.id, { action: "delete" }), 403)
  const key = tables.post_images[0].image_url.slice(prefix.length)
  assert.equal(await api.visibleLook(key), true)
  // 去掉共享历史图，确保删除后此图确无其他可见所属帖。
  delete legacy.image_url
  cleanupFail = true
  assert.equal((await api.updatePost(owner, post.id, { action: "delete" })).cleanupPending, true)
  assert.equal(await api.visibleLook(key), false)
  await rejected(() => api.singlePostPayload(null, post.id), 404)
  assert.equal((await api.mePayload(visitor)).stats.voted, 0)
  cleanupFail = false
  assert.equal((await api.updatePost(owner, post.id, { action: "delete" })).cleanupPending, false)
  const looks = load("src/app/api/looks/[key]/route.ts")
  const downloadsBefore = downloadCalls
  const response = await looks.GET(request(null, "GET"), { params: Promise.resolve({ key }) })
  assert.equal(response.status, 404)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(downloadCalls, downloadsBefore, "删除图不能向存储请求原文")
  console.log("PASS 任务7：举报幂等、作者删除、图片所属与 no-store、清理失败不恢复可见性")

  const failedPost = { ...input(), images: [png, png] }
  uploadFail = uploads + 2
  await rejected(() => api.createPost(owner, failedPost), 503)
  assert.ok(!tables.posts.some((row) => row.id === failedPost.id))
  assert.ok(!tables.post_images.some((row) => row.post_id === failedPost.id))
  assert.ok(deleted.length)
  uploadFail = 0
  lostPublish = true
  const lostPost = input()
  await api.createPost(owner, lostPost)
  assert.equal((await api.singlePostPayload(null, lostPost.id)).post.images.length, 1)
  lostUpload = true
  const lostUploadPost = input()
  const beforeLostCleanup = deleted.length
  await rejected(() => api.createPost(owner, lostUploadPost), 503)
  assert.equal(deleted.length, beforeLostCleanup + 1, "上传响应丢失后仍有对象键可回收")
  cancelPublish = true
  const cancelled = input()
  await rejected(() => api.createPost(owner, cancelled), 409)
  await rejected(() => api.singlePostPayload(owner, cancelled.id), 404)
  const concurrent = input()
  const outcomes = await Promise.allSettled([api.createPost(owner, concurrent), api.createPost(owner, concurrent)])
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(tables.posts.filter((row) => row.id === concurrent.id).length, 1)

  const community = load("src/app/api/community/route.ts")
  const meRoute = load("src/app/api/me/route.ts")
  account = null
  assert.equal((await meRoute.GET(request(null, "GET", "/api/me"))).status, 401)
  assert.equal((await community.POST(request(input()))).status, 401)
  const guest = await community.GET(request(null, "GET"))
  assert.equal(guest.status, 200)
  assert.equal("seed" in await guest.json(), false)
  account = owner
  readFailure = "posts"
  const failed = await community.GET(request(null, "GET"))
  assert.equal(failed.status, 503)
  const failureBody = await failed.json()
  assert.equal("posts" in failureBody, false, "读取失败不得伪装空列表")
  assert.equal((await meRoute.GET(request(null, "GET", "/api/me"))).status, 503)
  readFailure = ""
  malformed = "posts"
  await rejected(() => ve.rows("posts"), 502)
  malformed = ""
  assert.equal((await community.POST(request([]))).status, 400)
  const detailRoute = load("src/app/api/posts/[id]/route.ts")
  const beforeDetail = reads.length
  const detailResponse = await detailRoute.GET(request(null, "GET"), { params: Promise.resolve({ id: lostPost.id }) })
  assert.equal(detailResponse.status, 200)
  const detailBody = await detailResponse.json()
  assert.equal(detailBody.post.id, lostPost.id)
  assert.equal(typeof detailBody.serverNow, "number")
  assert.ok(reads.slice(beforeDetail).filter((entry) => entry.table === "posts").every((entry) => entry.query.includes("id=eq.")), "单帖不得依赖完整社区")
  const decisionResponse = await detailRoute.POST(request({ action: "decision", decision: "returned", reason: "版型不合适" }), { params: Promise.resolve({ id: lostPost.id }) })
  assert.equal(decisionResponse.status, 200)
  assert.equal((await decisionResponse.json()).post.decisionReason, "版型不合适")
  const meResponse = await meRoute.GET(request(null, "GET", "/api/me"))
  assert.equal(meResponse.status, 200)
  assert.equal(typeof (await meResponse.json()).stats.published, "number")
  account = null
  for (const route of ["votes", "opinions", "reports"]) {
    const handler = load(`src/app/api/${route}/route.ts`)
    assert.equal((await handler.POST(request({}))).status, 401)
    if (route === "reports") assert.equal(handler.GET, undefined, "普通账号不能获取举报队列")
  }
  for (const [route, bad] of [["login", { email: {} }], ["register", { email: [] }], ["verify", { otp: 8 }], ["wechat", { code: 8 }]]) {
    const handler = load(`src/app/api/auth/${route}/route.ts`)
    assert.equal((await handler.POST(request(bad))).status, 400)
  }
  console.log("PASS 路由/失败恢复：上传回收、响应丢失核实、游客浏览、写入身份、无 seed、失败非空列表")
  console.log("待远端验收：SQL 应用/真实事务并发、Auth/微信、存储私有权限、REST 分页一致性与运营角色")
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
