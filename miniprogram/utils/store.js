const { SEED } = require("./seed")

const KEY = "liubuliu.v1"
const seedIds = {}
SEED.forEach((post) => {
  seedIds[post.id] = true
})

function emptyPersisted() {
  return { posts: [], votes: {}, opinions: {}, decisions: {}, displayName: "" }
}

function load() {
  try {
    const saved = wx.getStorageSync(KEY)
    if (!saved || typeof saved !== "object") return emptyPersisted()
    return {
      posts: Array.isArray(saved.posts) ? saved.posts : [],
      votes: saved.votes || {},
      opinions: saved.opinions || {},
      decisions: saved.decisions || {},
      displayName: typeof saved.displayName === "string" ? saved.displayName : "",
    }
  } catch (error) {
    return emptyPersisted()
  }
}

function save(value) {
  wx.setStorageSync(KEY, value)
}

function apply(post, persisted) {
  const myVote = persisted.votes[post.id] || null
  const extra = persisted.opinions[post.id] || []
  const decision = post.mine ? persisted.decisions[post.id] || null : post.decision
  return Object.assign({}, post, {
    keepVotes: post.keepVotes + (myVote === "keep" ? 1 : 0),
    returnVotes: post.returnVotes + (myVote === "return" ? 1 : 0),
    opinions: post.opinions
      .map((opinion) => Object.assign({}, opinion, { mine: false }))
      .concat(extra.map((opinion) => Object.assign({}, opinion, { mine: true }))),
    decision,
    myVote: post.mine ? null : myVote,
  })
}

function merge(persisted) {
  const mine = persisted.posts
    .filter((post) => !seedIds[post.id])
    .map((post) => apply(post, persisted))
  const seed = SEED.map((post) => apply(post, persisted))
  return mine.concat(seed)
}

function posts() {
  return merge(load())
}

function update(mutator) {
  const next = mutator(load())
  save(next)
  return next
}

function vote(id, stance) {
  const current = posts().find((post) => post.id === id)
  if (!current || current.mine || current.decision) return
  update((prev) => {
    if (prev.votes[id] === stance) return prev
    const votes = Object.assign({}, prev.votes)
    votes[id] = stance
    return Object.assign({}, prev, { votes })
  })
}

function addOpinion(id, input) {
  const text = String(input.text || "").trim().slice(0, 180)
  if (text.length < 4) return false
  const author = String(input.author || "").trim().slice(0, 12) || "路过的人"
  const opinion = {
    id: `mine-note-${Date.now()}`,
    author,
    city: "",
    stance: input.stance,
    text,
    mine: true,
  }
  update((prev) => {
    const opinions = Object.assign({}, prev.opinions)
    opinions[id] = (opinions[id] || []).concat(opinion).slice(-20)
    return Object.assign({}, prev, {
      opinions,
      displayName: author === "路过的人" ? prev.displayName : author,
    })
  })
  return true
}

function removeOpinion(postId, opinionId) {
  update((prev) => {
    const opinions = Object.assign({}, prev.opinions)
    opinions[postId] = (opinions[postId] || []).filter((opinion) => opinion.id !== opinionId)
    return Object.assign({}, prev, { opinions })
  })
}

function addPost(post) {
  update((prev) =>
    Object.assign({}, prev, {
      posts: [post].concat(prev.posts.filter((item) => item.id !== post.id)).slice(0, 40),
    })
  )
}

function decide(id, decision) {
  update((prev) => {
    if (!prev.posts.some((post) => post.id === id)) return prev
    const decisions = Object.assign({}, prev.decisions)
    decisions[id] = decision
    return Object.assign({}, prev, { decisions })
  })
}

function clearMine() {
  save(emptyPersisted())
}

module.exports = {
  posts,
  load,
  vote,
  addOpinion,
  removeOpinion,
  addPost,
  decide,
  clearMine,
}
