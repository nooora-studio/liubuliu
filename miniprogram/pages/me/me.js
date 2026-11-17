const store = require("../../utils/store")
const { decorate } = require("../../utils/format")

Page({
  data: {
    mine: [],
    helped: [],
  },
  onShow() {
    const all = store.posts().map(decorate)
    this.setData({
      mine: all.filter((post) => post.mine),
      helped: all.filter((post) => !post.mine && (post.myVote || post.opinions.some((opinion) => opinion.mine))),
    })
  },
  open(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` })
  },
  clear() {
    wx.showModal({
      title: "清掉这台手机里的记录",
      content: "你发的帖、投的票、写的意见会消失。示例纠结还在。",
      confirmText: "清掉",
      cancelText: "先留着",
      confirmColor: "#9d3428",
      success: (res) => {
        if (!res.confirm) return
        store.clearMine()
        this.onShow()
      },
    })
  },
})
