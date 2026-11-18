const store = require("../../utils/store")
const { decorate } = require("../../utils/format")

Page({
  data: {
    posts: [],
    empty: false,
  },
  onShow() {
    this.refresh()
  },
  async refresh() {
    const loaded = await store.loadFeed()
    const posts = loaded.posts
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(decorate)
    this.setData({ posts, empty: posts.length === 0 })
  },
  open(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` })
  },
})
