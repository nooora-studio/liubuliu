import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import { execFileSync } from "node:child_process"
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
  // 独立服务端套件完全接管 HTTP，保留原小程序回归入口。
  execFileSync(process.execPath, [`${root}/scripts/verify-server.mjs`], { stdio: "inherit" })
}

miniChecks().then(serverChecks).catch((error) => { console.error(error); process.exitCode = 1 })
