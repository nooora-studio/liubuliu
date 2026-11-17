export const CATEGORIES = ["上衣", "裤装", "裙装", "外套", "鞋", "包"] as const
export const ILLUSTRATIONS = [
  "knit",
  "trousers",
  "coat",
  "skirt",
  "shirt",
  "sneakers",
  "blazer",
  "dress",
  "hoodie",
] as const

export type Category = (typeof CATEGORIES)[number]
export type Illustration = (typeof ILLUSTRATIONS)[number]
export type Kind = "keep" | "style" | "both"
export type Stance = "keep" | "return" | "style"
export type Vote = "keep" | "return"
export type Decision = "kept" | "returned"
export type ReturnStatus = "known" | "unknown" | "unavailable"

export type Opinion = {
  id: string
  author: string
  city: string
  stance: Stance
  text: string
  mine?: boolean
  supplement?: boolean
  parentId?: string | null
}

export type Post = {
  id: string
  author: string
  city: string
  postedLabel: string
  createdAt: number
  kind: Kind
  category: Category
  title: string
  story: string
  item: string
  price: number | null
  channel: string
  daysLeft: number | null
  illustration: Illustration
  image?: string
  images?: string[]
  keepVotes: number
  returnVotes: number
  opinions: Opinion[]
  decision: Decision | null
  mine: boolean
  myVote: Vote | null
  brand?: string
  desiredEffect?: string
  returnStatus?: ReturnStatus
  returnDeadline?: string | null
  votesClosedAt?: string | null
  decisionReason?: string
}

export type Persisted = {
  posts: Post[]
  votes: Record<string, Vote>
  opinions: Record<string, Opinion[]>
  decisions: Record<string, Decision>
  displayName: string
}
