const store = require("../../utils/store")
const { decorate } = require("../../utils/format")

Page({
  data: {
    missing: false,
    post: null,
    sending: false,
    loggedIn: false,
    photoIndex: 0,
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
      loggedIn: Boolean(loaded.user),
      author: this.data.author || saved || "",
    })
  },
  async vote(event) {
    if (this.data.post.mine || this.data.post.decision) return
    const res = await store.request("/api/community/votes", {
      method: "POST",
      data: { postId: this.id, stance: event.currentTarget.dataset.stance },
    })
    if (store.loginWall(res.statusCode)) return
    if (res.statusCode === 0 || res.statusCode >= 400) {
      wx.showToast({ title: (res.data && res.data.message) || "网络没连上，再试一次", icon: "none" })
      return
    }
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
  onPhotoChange(event) {
    this.setData({ photoIndex: event.detail.current })
  },
  previewPhoto(event) {
    wx.previewImage({ current: event.currentTarget.dataset.url, urls: this.data.post.images })
  },
  login() {
    wx.navigateTo({ url: "/pages/login/login" })
  },
  async send() {
    if (this.data.sending) return
    if (this.data.text.trim().length < 4) {
      this.setData({ error: "再多写几个字，别人才知道你在说哪一件。" })
      return
    }
    this.setData({ sending: true, error: "" })
    const res = await store.request("/api/community/opinions", {
      method: "POST",
      data: { postId: this.id, text: this.data.text, author: this.data.author, stance: this.data.post.mine ? "style" : this.data.stance },
    })
    this.setData({ sending: false })
    if (store.loginWall(res.statusCode)) return
    if (res.statusCode === 0 || res.statusCode >= 400) {
      this.setData({ error: (res.data && res.data.message) || "意见没有写上。" })
      return
    }
    this.setData({ text: "", error: "" })
    this.refresh()
  },
  async withdraw(event) {
    const res = await store.request(`/api/community/opinions?id=${event.currentTarget.dataset.id}`, { method: "DELETE" })
    if (store.loginWall(res.statusCode)) return
    if (res.statusCode === 0 || res.statusCode >= 400) {
      wx.showToast({ title: "没有撤回，再试一次", icon: "none" })
      return
    }
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
        if (saved.statusCode === 0 || saved.statusCode >= 400) {
          wx.showToast({ title: "结论没有记下，再试一次", icon: "none" })
          return
        }
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
