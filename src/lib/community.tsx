"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react"
import { SEED } from "@/lib/seed"
import {
  EMPTY_PERSISTED,
  getPersistedSnapshot,
  getServerPersistedSnapshot,
  savePersisted,
  subscribePersisted,
} from "@/lib/storage"
import type {
  Decision,
  Opinion,
  Persisted,
  Post,
  Stance,
  Vote,
} from "@/lib/types"

type CommunityValue = {
  posts: Post[]
  hydrated: boolean
  displayName: string
  vote: (id: string, stance: Vote) => void
  addOpinion: (id: string, input: { author: string; stance: Stance; text: string }) => void
  removeOpinion: (postId: string, opinionId: string) => void
  addPost: (post: Post) => void
  decide: (id: string, decision: Decision) => void
  clearMine: () => void
}

const CommunityContext = createContext<CommunityValue | null>(null)

const seedIds = new Set(SEED.map((post) => post.id))

function mergePosts(persisted: Persisted): Post[] {
  const mine = persisted.posts
    .filter((post) => !seedIds.has(post.id))
    .map((post) => applyPersisted(post, persisted))
  const seed = SEED.map((post) => applyPersisted(post, persisted))
  return [...mine, ...seed]
}

function applyPersisted(post: Post, persisted: Persisted): Post {
  const myVote = persisted.votes[post.id] ?? null
  const extra = persisted.opinions[post.id] ?? []
  const decision = post.mine ? (persisted.decisions[post.id] ?? null) : post.decision
  return {
    ...post,
    keepVotes: post.keepVotes + (myVote === "keep" ? 1 : 0),
    returnVotes: post.returnVotes + (myVote === "return" ? 1 : 0),
    opinions: [...post.opinions.map((opinion) => ({ ...opinion, mine: false })), ...extra],
    decision,
    myVote: post.mine ? null : myVote,
  }
}

function withoutHydrated(snapshot: Persisted & { hydrated?: boolean }): Persisted {
  return {
    posts: snapshot.posts,
    votes: snapshot.votes,
    opinions: snapshot.opinions,
    decisions: snapshot.decisions,
    displayName: snapshot.displayName,
  }
}

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribePersisted,
    getPersistedSnapshot,
    getServerPersistedSnapshot
  )
  const persisted = withoutHydrated(snapshot)
  const hydrated = snapshot.hydrated

  const commit = useCallback((updater: (prev: Persisted) => Persisted) => {
    const next = updater(withoutHydrated(getPersistedSnapshot()))
    savePersisted(next)
  }, [])

  const vote = useCallback(
    (id: string, stance: Vote) => {
      const current = withoutHydrated(getPersistedSnapshot())
      const post = mergePosts(current).find((item) => item.id === id)
      if (!post || post.mine || post.decision) return
      commit((prev) => {
        if (prev.votes[id] === stance) return prev
        return { ...prev, votes: { ...prev.votes, [id]: stance } }
      })
    },
    [commit]
  )

  const addOpinion = useCallback(
    (id: string, input: { author: string; stance: Stance; text: string }) => {
      const text = input.text.trim().slice(0, 180)
      if (text.length < 4) return
      const author = input.author.trim().slice(0, 12) || "路过的人"
      const opinion: Opinion = {
        id: `mine-note-${crypto.randomUUID()}`,
        author,
        city: "",
        stance: input.stance,
        text,
        mine: true,
      }
      commit((prev) => ({
        ...prev,
        displayName: author === "路过的人" ? prev.displayName : author,
        opinions: {
          ...prev.opinions,
          [id]: [...(prev.opinions[id] ?? []), opinion].slice(-20),
        },
      }))
    },
    [commit]
  )

  const removeOpinion = useCallback(
    (postId: string, opinionId: string) => {
      commit((prev) => ({
        ...prev,
        opinions: {
          ...prev.opinions,
          [postId]: (prev.opinions[postId] ?? []).filter((opinion) => opinion.id !== opinionId),
        },
      }))
    },
    [commit]
  )

  const addPost = useCallback(
    (post: Post) => {
      commit((prev) => ({
        ...prev,
        posts: [post, ...prev.posts.filter((item) => item.id !== post.id)].slice(0, 40),
      }))
    },
    [commit]
  )

  const decide = useCallback(
    (id: string, decision: Decision) => {
      commit((prev) => {
        if (!prev.posts.some((post) => post.id === id)) return prev
        return { ...prev, decisions: { ...prev.decisions, [id]: decision } }
      })
    },
    [commit]
  )

  const clearMine = useCallback(() => {
    commit(() => EMPTY_PERSISTED)
  }, [commit])

  const posts = useMemo(() => mergePosts(persisted), [persisted])

  const value = useMemo<CommunityValue>(
    () => ({
      posts,
      hydrated,
      displayName: persisted.displayName,
      vote,
      addOpinion,
      removeOpinion,
      addPost,
      decide,
      clearMine,
    }),
    [posts, hydrated, persisted.displayName, vote, addOpinion, removeOpinion, addPost, decide, clearMine]
  )

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>
}

export function useCommunity() {
  const value = useContext(CommunityContext)
  if (!value) {
    throw new Error("useCommunity 必须放在 CommunityProvider 里")
  }
  return value
}
