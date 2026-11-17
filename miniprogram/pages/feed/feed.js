const store = require("../../utils/store")
const { decorate } = require("../../utils/format")

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "keep", label: "要不要留" },
  { id: "style", label: "怎么搭" },
  { id: "urgent", label: "快过期" },
  { id: "decided", label: "已拍板" },
]

const SORTS = [
  { id: "urgent", label: "最紧急" },
  { id: "new", label: "最新" },
  { id: "split", label: "最难选" },
]

function matches(post, filter) {
  if (filter === "keep") return post.kind === "keep" || post.kind === "both"
  if (filter === "style") return post.kind === "style" || post.kind === "both"
  if (filter === "urgent") return !post.decision && post.daysLeft !== null && post.daysLeft <= 3
  if (filter === "decided") return post.decision !== null
  return true
}

function urgencyRank(post) {
  if (!post.decision && post.daysLeft !== null) return 0
  if (!post.decision) return 1
  return 2
}

function splitDistance(post) {
  const total = post.keepVotes + post.returnVotes
  if (post.decision || total < 8) return 2
  return Math.abs(post.keepVotes / total - 0.5)
}

function selectVisible(posts, filter, sort) {
  const next = posts.filter((post) => matches(post, filter))
  next.sort((a, b) => {
    if (sort === "new") return b.createdAt - a.createdAt
    if (sort === "split") {
      return splitDistance(a) - splitDistance(b) || (a.daysLeft == null ? 99 : a.daysLeft) - (b.daysLeft == null ? 99 : b.daysLeft)
    }
    return (
      urgencyRank(a) - urgencyRank(b) ||
      (a.daysLeft == null ? 99 : a.daysLeft) - (b.daysLeft == null ? 99 : b.daysLeft) ||
      b.createdAt - a.createdAt
    )
  })
  return next.map(decorate)
}

Page({
  data: {
    filters: FILTERS,
    sorts: SORTS,
    filter: "all",
    sort: "urgent",
    featured: null,
    rest: [],
    empty: false,
  },
  onShow() {
    this.refresh()
  },
  async refresh() {
    const loaded = await store.loadFeed()
    const visible = selectVisible(loaded.posts, this.data.filter, this.data.sort)
    let featured = null
    if (this.data.filter === "all" && this.data.sort === "urgent") {
      const candidates = visible
        .filter((post) => !post.decision && post.daysLeft !== null && post.keep + post.ret >= 8)
        .slice()
        .sort(
          (a, b) =>
            splitDistance(a) - splitDistance(b) ||
            (a.daysLeft == null ? 99 : a.daysLeft) - (b.daysLeft == null ? 99 : b.daysLeft)
        )
      featured = candidates[0] || null
    }
    const rest = featured ? visible.filter((post) => post.id !== featured.id) : visible
    this.setData({ featured, rest, empty: visible.length === 0 })
  },
  setFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.id }, () => this.refresh())
  },
  setSort(event) {
    this.setData({ sort: event.currentTarget.dataset.id }, () => this.refresh())
  },
  open(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` })
  },
})
