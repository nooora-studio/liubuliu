export const CATEGORIES = ["数码", "美妆", "家居", "服饰", "食品", "其它"] as const
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
export type Kind = "keep" | "style" | "both" | "compare"
export type Stance = "keep" | "return" | "style"
export type Vote = "keep" | "return"
export type Decision = "kept" | "returned"
export type ReturnStatus = "known" | "unknown" | "unavailable"

export type CompareOption = {
  id: string
  label: string
  price: number | null
}

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
  options?: CompareOption[]
  optionVotes?: Record<string, number>
  myOption?: string | null
  chosenOption?: string | null
}

export type Persisted = {
  posts: Post[]
  votes: Record<string, Vote>
  opinions: Record<string, Opinion[]>
  decisions: Record<string, Decision>
  displayName: string
}
