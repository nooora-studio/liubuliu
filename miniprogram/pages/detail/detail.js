const store = require("../../utils/store")
const { decorate } = require("../../utils/format")

const STARTERS = [
  { stance: "keep", text: "颜色比版型更值得留。白天拉到窗边再看一次，别只在暖光下判决。" },
  { stance: "return", text: "和你已经有的太像，留着大概率不会拿出来穿。" },
  { stance: "style", text: "别塞进裤子，下摆盖住胯最宽的位置会好看很多。" },
  { stance: "style", text: "配深色直筒裤和一双乐福，别配运动鞋。" },
  { stance: "keep", text: "肩线是对的。这件的价值在版型，不在花色。" },
  { stance: "return", text: "这个价位如果还要犹豫，通常就是不会常穿。" },
]

Page({
  data: {
    missing: false,
    post: null,
    starters: STARTERS,
    author: "",
    text: "",
    stance: "style",
    stances: [
      { id: "keep", label: "建议留" },
      { id: "return", label: "建议退" },
      { id: "style", label: "只说搭配" },
    ],
    error: "",
  },
  onLoad(query) {
    this.id = query.id || ""
  },
  onShow() {
    this.refresh()
  },
  async refresh() {
    const loaded = await store.loadFeed()
    const found = loaded.posts.find((post) => post.id === this.id)
    if (!found) {
      this.setData({ missing: true, post: null })
      return
    }
    const saved = (loaded.user && loaded.user.name) || store.load().displayName
    this.setData({
      missing: false,
      post: decorate(found),
      author: this.data.author || saved || "",
    })
  },
  async vote(event) {
    const res = await store.request("/api/community/votes", {
      method: "POST",
      data: { postId: this.id, stance: event.currentTarget.dataset.stance },
    })
    if (store.loginWall(res.statusCode)) return
    this.refresh()
  },
  setStance(event) {
    this.setData({ stance: event.currentTarget.dataset.id })
  },
  onAuthor(event) {
    this.setData({ author: event.detail.value })
  },
  onText(event) {
    this.setData({ text: event.detail.value })
  },
  useStarter(event) {
    const index = Number(event.currentTarget.dataset.index)
    const starter = STARTERS[index]
    this.setData({ stance: starter.stance, text: starter.text, error: "" })
  },
  async send() {
    if (this.data.text.trim().length < 4) {
      this.setData({ error: "至少写一句具体的。" })
      return
    }
    const res = await store.request("/api/community/opinions", {
      method: "POST",
      data: { postId: this.id, text: this.data.text, author: this.data.author, stance: this.data.stance },
    })
    if (store.loginWall(res.statusCode)) return
    if (res.statusCode >= 400) {
      this.setData({ error: (res.data && res.data.message) || "意见没有写上。" })
      return
    }
    this.setData({ text: "", error: "" })
    this.refresh()
  },
  async withdraw(event) {
    const res = await store.request(`/api/community/opinions?id=${event.currentTarget.dataset.id}`, { method: "DELETE" })
    if (store.loginWall(res.statusCode)) return
    this.refresh()
  },
  decide() {
    wx.showActionSheet({
      itemList: ["留下了", "退掉了"],
      success: async (res) => {
        const saved = await store.request("/api/community/decisions", {
          method: "POST",
          data: { postId: this.id, decision: res.tapIndex === 0 ? "kept" : "returned" },
        })
        if (store.loginWall(saved.statusCode)) return
        this.refresh()
      },
    })
  },
  back() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: "/pages/feed/feed" })
  },
})
