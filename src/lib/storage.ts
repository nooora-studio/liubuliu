import {
  CATEGORIES,
  ILLUSTRATIONS,
  type Decision,
  type Illustration,
  type Opinion,
  type Persisted,
  type Post,
  type Stance,
  type Vote,
} from "@/lib/types"

export const EMPTY_PERSISTED: Persisted = {
  posts: [],
  votes: {},
  opinions: {},
  decisions: {},
  displayName: "",
}

export type CommunitySnapshot = Persisted & { hydrated: boolean }

const SERVER_SNAPSHOT: CommunitySnapshot = { ...EMPTY_PERSISTED, hydrated: false }
const listeners = new Set<() => void>()
let storeVersion = 0
let cachedToken = ""
let clientSnapshot: CommunitySnapshot = { ...EMPTY_PERSISTED, hydrated: true }

const KEY = "liubuliu.v1"

const KINDS = new Set(["keep", "style", "both"])
const STANCES = new Set<Stance>(["keep", "return", "style"])
const VOTES = new Set<Vote>(["keep", "return"])
const DECISIONS = new Set<Decision>(["kept", "returned"])

export function isSafeImage(value: string) {
  return (
    value.startsWith("data:image/jpeg;base64,") ||
    value.startsWith("data:image/png;base64,") ||
    value.startsWith("data:image/webp;base64,")
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function cleanOpinion(value: unknown): Opinion | null {
  if (!isRecord(value)) return null
  const stance = value.stance
  const text = cleanText(value.text, 180)
  if (!STANCES.has(stance as Stance) || text.length < 2) return null
  const id = cleanText(value.id, 80)
  if (!id) return null
  return {
    id,
    author: cleanText(value.author, 12) || "路过的人",
    city: cleanText(value.city, 12),
    stance: stance as Stance,
    text,
    mine: true,
  }
}

function cleanPost(value: unknown): Post | null {
  if (!isRecord(value)) return null
  const id = cleanText(value.id, 80)
  if (!id.startsWith("mine-")) return null
  if (!KINDS.has(value.kind as Post["kind"])) return null
  if (!CATEGORIES.includes(value.category as Post["category"])) return null
  if (!ILLUSTRATIONS.includes(value.illustration as Illustration)) return null
  const title = cleanText(value.title, 40)
  const story = typeof value.story === "string" ? value.story.trim().slice(0, 400) : ""
  if (title.length < 2 || story.length < 2) return null
  const image = typeof value.image === "string" && isSafeImage(value.image) ? value.image : undefined
  const price =
    typeof value.price === "number" && Number.isFinite(value.price)
      ? Math.max(0, Math.min(999999, Math.round(value.price)))
      : null
  const daysLeft =
    value.daysLeft === null
      ? null
      : typeof value.daysLeft === "number" && value.daysLeft >= 1 && value.daysLeft <= 30
        ? Math.round(value.daysLeft)
        : 7
  return {
    id,
    author: "我",
    city: cleanText(value.city, 12),
    postedLabel: cleanText(value.postedLabel, 12) || "刚刚",
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    kind: value.kind as Post["kind"],
    category: value.category as Post["category"],
    title,
    story,
    item: cleanText(value.item, 24),
    price,
    channel: cleanText(value.channel, 16),
    daysLeft,
    illustration: value.illustration as Illustration,
    image,
    keepVotes: 0,
    returnVotes: 0,
    opinions: [],
    decision: null,
    mine: true,
    myVote: null,
  }
}

function parsePersisted(raw: string | null): Persisted {
  if (!raw) return EMPTY_PERSISTED
  try {
    const data = JSON.parse(raw) as Partial<Persisted>
    const votes: Persisted["votes"] = {}
    if (isRecord(data.votes)) {
      for (const [id, vote] of Object.entries(data.votes)) {
        if (VOTES.has(vote as Vote)) votes[id.slice(0, 80)] = vote as Vote
      }
    }
    const opinions: Persisted["opinions"] = {}
    if (isRecord(data.opinions)) {
      for (const [id, list] of Object.entries(data.opinions)) {
        if (!Array.isArray(list)) continue
        const cleaned = list.map(cleanOpinion).filter((item) => item !== null).slice(0, 20)
        if (cleaned.length) opinions[id.slice(0, 80)] = cleaned
      }
    }
    const decisions: Persisted["decisions"] = {}
    if (isRecord(data.decisions)) {
      for (const [id, decision] of Object.entries(data.decisions)) {
        if (DECISIONS.has(decision as Decision)) decisions[id.slice(0, 80)] = decision as Decision
      }
    }
    return {
      posts: Array.isArray(data.posts)
        ? data.posts.map(cleanPost).filter((item) => item !== null).slice(0, 40)
        : [],
      votes,
      opinions,
      decisions,
      displayName: cleanText(data.displayName, 12),
    }
  } catch {
    return EMPTY_PERSISTED
  }
}

export function loadPersisted(): Persisted {
  if (typeof window === "undefined") return EMPTY_PERSISTED
  return parsePersisted(window.localStorage.getItem(KEY))
}

export function subscribePersisted(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return
    storeVersion += 1
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function getPersistedSnapshot(): CommunitySnapshot {
  const raw = window.localStorage.getItem(KEY) ?? ""
  const token = `${storeVersion}:${raw}`
  if (token === cachedToken) return clientSnapshot
  cachedToken = token
  clientSnapshot = { ...parsePersisted(raw), hydrated: true }
  return clientSnapshot
}

export function getServerPersistedSnapshot(): CommunitySnapshot {
  return SERVER_SNAPSHOT
}

export function savePersisted(value: Persisted) {
  if (typeof window === "undefined") return
  const stored: Persisted = {
    posts: value.posts,
    votes: value.votes,
    opinions: value.opinions,
    decisions: value.decisions,
    displayName: value.displayName,
  }
  window.localStorage.setItem(KEY, JSON.stringify(stored))
  storeVersion += 1
  cachedToken = ""
  listeners.forEach((listener) => listener())
}

export function compressImage(file: File): Promise<string> {
  const allowed = ["image/jpeg", "image/png", "image/webp"]
  if (!allowed.includes(file.type)) {
    return Promise.reject(new Error("type"))
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const maxEdge = 1200
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error("read"))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      let quality = 0.72
      let data = canvas.toDataURL("image/jpeg", quality)
      while (data.length > 380_000 && quality > 0.42) {
        quality -= 0.08
        data = canvas.toDataURL("image/jpeg", quality)
      }
      URL.revokeObjectURL(url)
      if (!isSafeImage(data) || data.length > 520_000) {
        reject(new Error("size"))
        return
      }
      resolve(data)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("read"))
    }
    image.src = url
  })
}
