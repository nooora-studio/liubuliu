const store = require("../../utils/store")

const KINDS = [
  { id: "keep", label: "要不要留" },
  { id: "style", label: "怎么搭" },
  { id: "both", label: "两个都纠结" },
]

const CATEGORIES = ["上衣", "裤装", "裙装", "外套", "鞋", "包"]

const ILLUSTRATIONS = [
  { id: "knit", label: "针织" },
  { id: "shirt", label: "衬衫" },
  { id: "trousers", label: "裤子" },
  { id: "skirt", label: "裙子" },
  { id: "dress", label: "连衣裙" },
  { id: "coat", label: "大衣" },
  { id: "blazer", label: "西装" },
  { id: "hoodie", label: "卫衣" },
  { id: "sneakers", label: "鞋" },
]

const DAYS = [
  { value: 1, label: "只剩今天" },
  { value: 2, label: "还剩 2 天" },
  { value: 3, label: "还剩 3 天" },
  { value: 5, label: "还剩 5 天" },
  { value: 7, label: "还有一周" },
  { value: null, label: "已经不能退" },
]

function keepFile(tempPath) {
  return new Promise((resolve) => {
    if (!tempPath) {
      resolve("")
      return
    }
    wx.compressImage({
      src: tempPath,
      quality: 60,
      success(compressed) {
        const src = compressed.tempFilePath || tempPath
        const target = `${wx.env.USER_DATA_PATH}/look-${Date.now()}.jpg`
        wx.getFileSystemManager().saveFile({
          tempFilePath: src,
          filePath: target,
          success: () => resolve(target),
          fail: () => resolve(src),
        })
      },
      fail: () => resolve(tempPath),
    })
  })
}

Page({
  data: {
    kinds: KINDS,
    categories: CATEGORIES,
    illustrations: ILLUSTRATIONS,
    days: DAYS,
    kind: "keep",
    category: "上衣",
    illustration: "knit",
    image: "",
    reading: false,
    title: "",
    story: "",
    item: "",
    price: "",
    channel: "",
    dayIndex: 2,
    errors: {},
  },
  setKind(event) {
    this.setData({ kind: event.currentTarget.dataset.id })
  },
  setCategory(event) {
    this.setData({ category: event.currentTarget.dataset.id })
  },
  setIllustration(event) {
    this.setData({ illustration: event.currentTarget.dataset.id, image: "" })
  },
  setDay(event) {
    this.setData({ dayIndex: Number(event.currentTarget.dataset.index) })
  },
  onTitle(event) {
    this.setData({ title: event.detail.value })
  },
  onStory(event) {
    this.setData({ story: event.detail.value })
  },
  onItem(event) {
    this.setData({ item: event.detail.value })
  },
  onPrice(event) {
    this.setData({ price: event.detail.value })
  },
  onChannel(event) {
    this.setData({ channel: event.detail.value })
  },
  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        this.setData({ reading: true })
        const image = await keepFile(file.tempFilePath)
        this.setData({ image, reading: false })
      },
    })
  },
  clearPhoto() {
    this.setData({ image: "" })
  },
  async submit() {
    const title = this.data.title.trim()
    const story = this.data.story.trim()
    const errors = {}
    if (title.length < 4) errors.title = "用一句话写出你在纠结什么。"
    if (story.length < 12) errors.story = "再多说两句：你哪里看不顺眼，别人才能对着看。"
    let parsedPrice = null
    const price = this.data.price.trim()
    if (price) {
      if (!/^\d{1,6}$/.test(price)) errors.price = "价格写成数字就行，也可以先空着。"
      else parsedPrice = Number(price)
    }
    this.setData({ errors })
    if (Object.keys(errors).length) {
      wx.showToast({ title: "还有没写完的", icon: "none" })
      return
    }
    if (!store.session()) {
      wx.navigateTo({ url: "/pages/login/login" })
      return
    }
    const day = DAYS[this.data.dayIndex]
    let image = ""
    if (this.data.image) {
      image = await new Promise((resolve) => {
        wx.getFileSystemManager().readFile({
          filePath: this.data.image,
          encoding: "base64",
          success: (res) => resolve(`data:image/jpeg;base64,${res.data}`),
          fail: () => resolve(""),
        })
      })
    }
    const post = {
      id: store.uuid(),
      author: "我",
      city: "",
      postedLabel: "刚刚",
      createdAt: Date.now(),
      kind: this.data.kind,
      category: this.data.category,
      title: title.slice(0, 40),
      story: story.slice(0, 400),
      item: this.data.item.trim().slice(0, 24),
      price: parsedPrice,
      channel: this.data.channel.trim().slice(0, 16),
      daysLeft: day ? day.value : 3,
      illustration: this.data.illustration,
      image,
      keepVotes: 0,
      returnVotes: 0,
      opinions: [],
      decision: null,
      mine: true,
      myVote: null,
    }
    const saved = await store.request("/api/community/posts", { method: "POST", data: post })
    if (store.loginWall(saved.statusCode)) return
    if (saved.statusCode >= 400) {
      wx.showToast({ title: (saved.data && saved.data.message) || "没有发出去", icon: "none" })
      return
    }
    wx.redirectTo({ url: `/pages/detail/detail?id=${post.id}` })
  },
})
