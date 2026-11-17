Component({
  properties: {
    current: { type: String, value: "feed" },
  },
  methods: {
    go(event) {
      const url = event.currentTarget.dataset.url
      const pages = getCurrentPages()
      const current = `/${pages[pages.length - 1].route}`
      if (current === url) return
      wx.reLaunch({ url })
    },
  },
})
