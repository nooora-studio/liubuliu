const store = require("../../utils/store")
const { decorate } = require("../../utils/format")

Page({
  data: {
    mine: [],
    helped: [],
    user: null,
  },
  async onShow() {
    const loaded = await store.loadFeed()
    const all = loaded.posts.map(decorate)
    this.setData({
      user: loaded.user,
      mine: all.filter((post) => post.mine),
      helped: all.filter((post) => !post.mine && (post.myVote || post.opinions.some((opinion) => opinion.mine))),
    })
  },
  open(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` })
  },
  logout() {
    store.saveSession(null)
    store.request("/api/auth/logout", { method: "POST" })
    this.onShow()
  },
})
