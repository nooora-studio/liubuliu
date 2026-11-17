import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL("../", import.meta.url))

function loadPage(name, store, wx) {
  let page
  vm.runInNewContext(fs.readFileSync(`${root}/miniprogram/pages/${name}/${name}.js`, "utf8"), {
    Page: (value) => { page = value },
    require: (path) => path.includes("store") ? store : require(`${root}/miniprogram/utils/format.js`),
    wx, console,
  })
  page.data = structuredClone(page.data)
  page.setData = (value) => Object.assign(page.data, value)
  return page
}

async function miniChecks() {
  let selected, submitted, failRead = false, requests = 0, statusCode = 200
  const store = {
    session: () => ({ user: { name: "验证" } }), uuid: randomUUID,
    loginWall: () => false,
    request: async (_, options) => {
      requests++
      submitted = options.data
      return { statusCode, data: {} }
    },
  }
  const wx = {
    chooseMedia: (options) => { selected = options },
    getImageInfo: (options) => options.success({ width: 2400, height: 3600 }),
    compressImage: (options) => {
      assert.equal(options.compressedWidth, 800)
      assert.equal(options.compressedHeight, 1200)
      options.success({ tempFilePath: options.src })
    },
    getFileSystemManager: () => ({
      readFile: (options) => failRead ? options.fail() : options.success({ data: "a".repeat(64) }),
    }),
    showToast() {}, redirectTo() {}, previewImage(options) { assert.equal(options.urls.length, 2) },
  }
  const page = loadPage("compose", store, wx)
  page.choosePhoto()
  assert.equal(selected.count, 9)
  await selected.success({ tempFiles: [{ tempFilePath: "a.jpg" }, { tempFilePath: "b.jpg" }] })
  assert.equal(page.data.images.length, 2)
  page.makeCover({ currentTarget: { dataset: { index: 1 } } })
  assert.equal(page.data.image, "b.jpg")
  page.previewPhoto({ currentTarget: { dataset: { url: "b.jpg" } } })
  page.choosePhoto()
  assert.equal(selected.count, 7)
  selected.fail()
  assert.equal(page.data.reading, false)
  page.data.title = "想问不同搭配"
  page.data.story = "第一张是自己穿的效果，第二张是想参考的风格。"
  await page.submit()
  assert.equal(submitted.images.length, 2)
  failRead = true
  const before = requests
  await page.submit()
  assert.equal(requests, before, "照片读取失败应阻止发布，不能悄悄丢掉图片")
  assert.equal(page.data.images.length, 2)
  assert.equal(page.data.submitting, false)
  page.removePhoto({ currentTarget: { dataset: { index: 0 } } })
  assert.equal(page.data.image, "a.jpg")

  const detail = loadPage("detail", store, wx)
  detail.data.post = { mine: true, decision: null }
  detail.data.text = "我想补充一下自己的想法"
  detail.data.stance = "return"
  detail.refresh = () => {}
  await detail.vote({ currentTarget: { dataset: { stance: "keep" } } })
  assert.equal(requests, before, "发起人不能投票")
  await detail.send()
  assert.equal(submitted.stance, "style", "作者留言不能发送建议留退立场")
  assert.equal(detail.data.text, "")
  detail.data.text = "断网时我的内容需要保留"
  statusCode = 0
  await detail.send()
  assert.equal(detail.data.text, "断网时我的内容需要保留")
  assert.ok(detail.data.error)
  console.log("PASS mini: multi-select, cover, removal, preview, cancel, read failure, owner supplement, network failure")
}

async function serverChecks() {
  const tables = { posts: [], post_images: [], opinions: [], votes: [] }
  let uploadCalls = 0, failAt = 0
  const removed = []
  const backend = {
    rows: async (table, query = "") => {
      const id = query.match(/[?&]id=eq\.([^&]+)/)?.[1]
      return tables[table].filter((row) => !id || row.id === id)
    },
    insertRow: async (table, row) => { tables[table].push(row); return { ok: true } },
    deleteRows: async (table, query) => {
      const id = query.slice("id=eq.".length)
      tables[table] = tables[table].filter((row) => row.id !== id)
      return { ok: true }
    },
    uploadLook: async () => ++uploadCalls === failAt ? "" : `https://vectoree.ai/api/storage/buckets/looks/objects/${randomUUID()}.png`,
    deleteLook: async (url) => removed.push(url),
  }
  const loadedModule = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(`${root}/src/lib/community-data.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: () => backend, Buffer, crypto: { randomUUID }, Date })
  const api = loadedModule.exports
  const account = { id: "test-owner", name: "作者", email: "" }
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII="
  const post = { id: randomUUID(), title: "多图测试帖子", story: "第一张是试穿的效果，第二张是目标风格。", category: "上衣", illustration: "knit", kind: "both", images: [png, png] }
  assert.equal(await api.createPost(account, post), "")
  assert.equal(tables.post_images.length, 2)
  let payload = await api.communityPayload(account)
  assert.equal(payload.posts[0].images.length, 2)
  assert.equal(payload.posts[0].image, payload.posts[0].images[0])
  assert.equal(await api.addCloudOpinion(account, { postId: post.id, stance: "return", text: "补充我的想法" }), "")
  payload = await api.communityPayload(null)
  assert.equal(payload.posts[0].opinions[0].supplement, true, "访客也应看到作者补充标记")
  assert.equal(await api.castVote(account, post.id, "keep"), "不能给自己的衣服投票。")
  assert.equal(await api.createPost(account, post), "", "重复提交不增加图片")
  assert.equal(tables.post_images.length, 2)
  const baseline = uploadCalls
  assert.ok(await api.createPost(account, { ...post, id: randomUUID(), images: [png, "broken"] }))
  assert.equal(uploadCalls, baseline, "全部图片需先验证再上传")
  assert.ok(await api.createPost(account, { ...post, id: randomUUID(), images: Array(10).fill(png) }))
  failAt = uploadCalls + 2
  assert.ok(await api.createPost(account, { ...post, id: randomUUID() }))
  assert.equal(tables.posts.length, 1)
  assert.equal(removed.length, 1, "后续上传失败应回收本次已上传图片")
  assert.equal(tables.post_images.length, 2, "失败不能删掉其他帖子的图片")
  tables.posts.push({ ...tables.posts[0], id: randomUUID(), image_url: tables.post_images[0].image_url })
  payload = await api.communityPayload(account)
  assert.equal(payload.posts[1].images.length, 1, "旧单图帖兼容")
  console.log("PASS server: gallery persistence, owner label, vote guard, retry, validation, rollback, legacy image")
}

miniChecks().then(serverChecks).catch((error) => { console.error(error); process.exitCode = 1 })
