const store = require("../../utils/store")

Page({
  data: {
    mode: "wechat",
    email: "",
    password: "",
    name: "",
    otp: "",
    message: "",
    pending: false,
  },
  setMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode, message: "" })
  },
  onEmail(event) {
    this.setData({ email: event.detail.value })
  },
  onPassword(event) {
    this.setData({ password: event.detail.value })
  },
  onName(event) {
    this.setData({ name: event.detail.value })
  },
  onOtp(event) {
    this.setData({ otp: event.detail.value })
  },
  async wechat() {
    this.setData({ pending: true, message: "" })
    const login = await new Promise((resolve) => {
      wx.login({ success: resolve, fail: () => resolve(null) })
    })
    if (!login || !login.code) {
      this.setData({ pending: false, message: "微信没有给出登录码。" })
      return
    }
    const res = await store.request("/api/auth/wechat", { method: "POST", data: { code: login.code } })
    this.setData({ pending: false, message: (res.data && res.data.message) || "" })
    if (res.statusCode === 200 && res.data && res.data.user) {
      wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/feed/feed" }) })
    }
  },
  async submit() {
    const mode = this.data.mode
    const path = mode === "register" ? "/api/auth/register" : mode === "verify" ? "/api/auth/verify" : "/api/auth/login"
    this.setData({ pending: true, message: "" })
    const res = await store.request(path, {
      method: "POST",
      data: {
        email: this.data.email,
        password: this.data.password,
        name: this.data.name,
        otp: this.data.otp,
      },
    })
    this.setData({ pending: false })
    if (res.data && res.data.needVerification) {
      this.setData({ mode: "verify", message: "验证码已发到邮箱，填 8 位数字。" })
      return
    }
    if (res.statusCode >= 400 || !res.data) {
      this.setData({ message: (res.data && res.data.message) || "没有成功，再试一次。" })
      return
    }
    wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/feed/feed" }) })
  },
})
