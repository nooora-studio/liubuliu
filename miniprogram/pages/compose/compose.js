const store = require("../../utils/store")

const CATEGORIES = ["数码", "美妆", "家居", "服饰", "食品", "其它"]

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
    wx.getImageInfo({
      src: tempPath,
      success(info) {
        const scale = Math.min(1, 1200 / Math.max(info.width, info.height))
        wx.compressImage({
          src: tempPath,
          quality: 60,
          compressedWidth: Math.max(1, Math.round(info.width * scale)),
          compressedHeight: Math.max(1, Math.round(info.height * scale)),
          success: (compressed) => resolve(compressed.tempFilePath || tempPath),
          fail: () => resolve(tempPath),
        })
      },
      fail: () => resolve(tempPath),
    })
  })
}

Page({
  data: {
    categories: CATEGORIES,
    illustrations: ILLUSTRATIONS,
    days: DAYS,
    category: "其它",
    illustration: "knit",
    image: "",
    images: [],
    reading: false,
    submitting: false,
    title: "",
    story: "",
    item: "",
    price: "",
    channel: "",
    dayIndex: 2,
    errors: {},
  },
  onShow() {
    // 从登录页回来时，如果有待提交的草稿，自动重提
    if (this.pendingSubmit && store.session()) {
      this.pendingSubmit = false
      this.submit()
    }
  },
  setCategory(event) {
    this.setData({ category: event.currentTarget.dataset.id })
  },
  setIllustration(event) {
    this.setData({ illustration: event.currentTarget.dataset.id })
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
    if (this.data.reading || this.data.submitting || this.data.images.length >= 9) return
    this.setData({ reading: true })
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: async (res) => {
        const files = (res.tempFiles || []).slice(0, 9 - this.data.images.length)
        const added = await Promise.all(files.map((file) => keepFile(file.tempFilePath)))
        const images = this.data.images.concat(added)
        this.setData({ images, image: images[0] || "", reading: false })
      },
      fail: () => this.setData({ reading: false }),
    })
  },
  removePhoto(event) {
    if (this.data.reading || this.data.submitting) return
    const images = this.data.images.filter((_, index) => index !== Number(event.currentTarget.dataset.index))
    this.setData({ images, image: images[0] || "" })
  },
  makeCover(event) {
    if (this.data.reading || this.data.submitting) return
    const images = this.data.images.slice()
    const index = Number(event.currentTarget.dataset.index)
    images.unshift(images.splice(index, 1)[0])
    this.setData({ images, image: images[0] })
  },
  previewPhoto(event) {
    wx.previewImage({ current: event.currentTarget.dataset.url, urls: this.data.images })
  },
  async submit() {
    if (this.data.reading || this.data.submitting) return
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
      this.pendingSubmit = true
      wx.showModal({
        title: "先登录再发帖",
        content: "你发的纠结会记在账号里，换设备也能看见。",
        confirmText: "去登录",
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: "/pages/login/login" })
          else this.pendingSubmit = false
        },
      })
      return
    }
    const day = DAYS[this.data.dayIndex]
    this.setData({ submitting: true })
    let images
    try {
      images = await Promise.all(this.data.images.map((filePath, index) => new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath,
          encoding: "base64",
          success: (res) => {
            if (!res.data || res.data.length > 933_336) {
              reject(new Error(`第 ${index + 1} 张照片太大，压小一点或换一张`))
              return
            }
            const mime = res.data.startsWith("iVBOR") ? "png" : res.data.startsWith("UklGR") ? "webp" : "jpeg"
            resolve(`data:image/${mime};base64,${res.data}`)
          },
          fail: () => reject(new Error(`第 ${index + 1} 张照片读不出来，换一张试试`)),
        })
      })))
    } catch (error) {
      this.setData({ submitting: false })
      wx.showToast({ title: error.message, icon: "none" })
      return
    }
    const post = {
      id: store.uuid(),
      author: "我",
      city: "",
      postedLabel: "刚刚",
      createdAt: Date.now(),
      kind: "keep",
      category: this.data.category,
      title: title.slice(0, 40),
      story: story.slice(0, 400),
      item: this.data.item.trim().slice(0, 24),
      price: parsedPrice,
      channel: this.data.channel.trim().slice(0, 16),
      daysLeft: day ? day.value : 3,
      illustration: this.data.illustration,
      image: images[0] || "",
      images,
      keepVotes: 0,
      returnVotes: 0,
      opinions: [],
      decision: null,
      mine: true,
      myVote: null,
    }
    const saved = await store.request("/api/community/posts", { method: "POST", data: post })
    this.setData({ submitting: false })
    if (store.loginWall(saved.statusCode)) return
    if (saved.statusCode === 0 || saved.statusCode >= 400) {
      wx.showToast({ title: (saved.data && saved.data.message) || "没有发出去", icon: "none" })
      return
    }
    wx.redirectTo({ url: `/pages/detail/detail?id=${post.id}` })
  },
})
