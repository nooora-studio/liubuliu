const { SEED } = require("./seed")

const KEY = "liubuliu.v1"
const seedIds = {}
SEED.forEach((post) => {
  seedIds[post.id] = true
})

function emptyPersisted() {
  return { posts: [], votes: {}, opinions: {}, decisions: {}, displayName: "" }
}

function load() {
  try {
    const saved = wx.getStorageSync(KEY)
    if (!saved || typeof saved !== "object") return emptyPersisted()
    return {
      posts: Array.isArray(saved.posts) ? saved.posts : [],
      votes: saved.votes || {},
      opinions: saved.opinions || {},
      decisions: saved.decisions || {},
      displayName: typeof saved.displayName === "string" ? saved.displayName : "",
    }
  } catch (error) {
    return emptyPersisted()
  }
}

function save(value) {
  wx.setStorageSync(KEY, value)
}

function apply(post, persisted) {
  const myVote = persisted.votes[post.id] || null
  const extra = persisted.opinions[post.id] || []
  const decision = post.mine ? persisted.decisions[post.id] || null : post.decision
  return Object.assign({}, post, {
    keepVotes: post.keepVotes + (myVote === "keep" ? 1 : 0),
    returnVotes: post.returnVotes + (myVote === "return" ? 1 : 0),
    opinions: post.opinions
      .map((opinion) => Object.assign({}, opinion, { mine: false }))
      .concat(extra.map((opinion) => Object.assign({}, opinion, { mine: true }))),
    decision,
    myVote: post.mine ? null : myVote,
  })
}

function merge(persisted) {
  const mine = persisted.posts
    .filter((post) => !seedIds[post.id])
    .map((post) => apply(post, persisted))
  const seed = SEED.map((post) => apply(post, persisted))
  return mine.concat(seed)
}

function posts() {
  return merge(load())
}

function update(mutator) {
  const next = mutator(load())
  save(next)
  return next
}

function vote(id, stance) {
  const current = posts().find((post) => post.id === id)
  if (!current || current.mine || current.decision) return
  update((prev) => {
    if (prev.votes[id] === stance) return prev
    const votes = Object.assign({}, prev.votes)
    votes[id] = stance
    return Object.assign({}, prev, { votes })
  })
}

function addOpinion(id, input) {
  const text = String(input.text || "").trim().slice(0, 180)
  if (text.length < 4) return false
  const author = String(input.author || "").trim().slice(0, 12) || "路过的人"
  const opinion = {
    id: `mine-note-${Date.now()}`,
    author,
    city: "",
    stance: input.stance,
    text,
    mine: true,
  }
  update((prev) => {
    const opinions = Object.assign({}, prev.opinions)
    opinions[id] = (opinions[id] || []).concat(opinion).slice(-20)
    return Object.assign({}, prev, {
      opinions,
      displayName: author === "路过的人" ? prev.displayName : author,
    })
  })
  return true
}

function removeOpinion(postId, opinionId) {
  update((prev) => {
    const opinions = Object.assign({}, prev.opinions)
    opinions[postId] = (opinions[postId] || []).filter((opinion) => opinion.id !== opinionId)
    return Object.assign({}, prev, { opinions })
  })
}

function addPost(post) {
  update((prev) =>
    Object.assign({}, prev, {
      posts: [post].concat(prev.posts.filter((item) => item.id !== post.id)).slice(0, 40),
    })
  )
}

function decide(id, decision) {
  update((prev) => {
    if (!prev.posts.some((post) => post.id === id)) return prev
    const decisions = Object.assign({}, prev.decisions)
    decisions[id] = decision
    return Object.assign({}, prev, { decisions })
  })
}

function clearMine() {
  save(emptyPersisted())
}

// 云后端：Next.js BFF（密钥只在服务端，内部再调 Vectoree）。本地预览走 127.0.0.1，线上换成部署域名。
const API_BASE = "http://127.0.0.1:4261"
const AUTH_KEY = "liubuliu.auth"

function session() {
  try {
    return wx.getStorageSync(AUTH_KEY) || null
  } catch (error) {
    return null
  }
}

function saveSession(value) {
  if (!value) wx.removeStorageSync(AUTH_KEY)
  else wx.setStorageSync(AUTH_KEY, value)
}

function request(pathname, options) {
  const current = session()
  return new Promise((resolve) => {
    wx.request({
      url: API_BASE + pathname,
      method: (options && options.method) || "GET",
      data: options && options.data,
      header: {
        "content-type": "application/json",
        Authorization: current && current.accessToken ? `Bearer ${current.accessToken}` : "",
        "X-Refresh-Token": current && current.refreshToken ? current.refreshToken : "",
      },
      success(res) {
        const data = res.data || {}
        if (data.refreshed && data.refreshed.accessToken) {
          saveSession({
            accessToken: data.refreshed.accessToken,
            refreshToken: data.refreshed.refreshToken,
            user: current && current.user,
          })
        }
        if (data.accessToken && data.refreshToken) {
          saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user || null })
        }
        resolve(res)
      },
      fail() {
        resolve({ statusCode: 0, data: null })
      },
    })
  })
}

function applySeed(post, seed) {
  return Object.assign({}, post, {
    keepVotes: post.keepVotes + ((seed.extraKeep && seed.extraKeep[post.id]) || 0),
    returnVotes: post.returnVotes + ((seed.extraReturn && seed.extraReturn[post.id]) || 0),
    opinions: (post.opinions || []).concat((seed.opinions && seed.opinions[post.id]) || []),
    myVote: (seed.votes && seed.votes[post.id]) || post.myVote || null,
  })
}

// 取图走自家代理，返回的是相对路径，小程序里要补成绝对地址才能渲染。
function withImageBase(post) {
  const absolute = (image) => image && image.indexOf("/") === 0 ? API_BASE + image : image
  const images = (post.images && post.images.length ? post.images : post.image ? [post.image] : []).map(absolute)
  return Object.assign({}, post, { image: images[0] || "", images })
}

async function loadFeed() {
  const res = await request("/api/community")
  if (!res.data || !Array.isArray(res.data.posts)) {
    return { user: (session() && session().user) || null, posts: posts(), offline: true }
  }
  const seed = res.data.seed || {}
  return {
    user: res.data.user || null,
    posts: res.data.posts.map(withImageBase).concat(SEED.map((post) => applySeed(post, seed))),
    offline: false,
  }
}

function loginWall(status) {
  if (status !== 401) return false
  wx.navigateTo({ url: "/pages/login/login" })
  return true
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0
    const value = char === "x" ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

module.exports = {
  posts,
  load,
  vote,
  addOpinion,
  removeOpinion,
  addPost,
  decide,
  clearMine,
  session,
  saveSession,
  request,
  loadFeed,
  loginWall,
  uuid,
}
