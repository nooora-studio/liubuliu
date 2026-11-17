"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import type { Account } from "@/lib/account"
import { SEED } from "@/lib/seed"
import type { Decision, Opinion, Post, Stance, Vote } from "@/lib/types"

type SeedOverlay = {
  votes: Record<string, Vote>
  extraKeep: Record<string, number>
  extraReturn: Record<string, number>
  opinions: Record<string, Opinion[]>
}

type Remote = {
  hydrated: boolean
  user: Account | null
  posts: Post[]
  seed: SeedOverlay
  error: string
  needsLogin: boolean
}

const EMPTY_SEED: SeedOverlay = { votes: {}, extraKeep: {}, extraReturn: {}, opinions: {} }
const SERVER_REMOTE: Remote = { hydrated: false, user: null, posts: [], seed: EMPTY_SEED, error: "", needsLogin: false }

let remote: Remote = SERVER_REMOTE
const listeners = new Set<() => void>()

function emit(next: Remote) {
  remote = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function applySeed(post: Post, overlay: SeedOverlay): Post {
  return {
    ...post,
    keepVotes: post.keepVotes + (overlay.extraKeep[post.id] ?? 0),
    returnVotes: post.returnVotes + (overlay.extraReturn[post.id] ?? 0),
    opinions: [...post.opinions, ...(overlay.opinions[post.id] ?? [])],
    myVote: overlay.votes[post.id] ?? null,
  }
}

function visiblePosts(snapshot: Remote) {
  return [...snapshot.posts, ...SEED.map((post) => applySeed(post, snapshot.seed))]
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as (Remote & { message?: string }) | null
}

export async function reloadCommunity() {
  const response = await fetch("/api/community", { cache: "no-store" })
  const data = await readJson(response)
  if (!response.ok || !data) {
    emit({ ...remote, hydrated: true, needsLogin: false, error: data?.message || "暂时连不上，示例还在。" })
    return
  }
  emit({
    hydrated: true,
    user: data.user ?? null,
    posts: Array.isArray(data.posts) ? data.posts : [],
    seed: data.seed ?? EMPTY_SEED,
    error: "",
    needsLogin: false,
  })
}

async function send(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  })
  if (response.status === 401) {
    emit({ ...remote, needsLogin: true })
    return false
  }
  const data = await readJson(response)
  if (!response.ok || !data?.posts) {
    emit({ ...remote, error: data?.message || "没有写上。" })
    return false
  }
  emit({
    hydrated: true,
    user: data.user ?? remote.user,
    posts: data.posts,
    seed: data.seed ?? EMPTY_SEED,
    error: "",
    needsLogin: false,
  })
  return true
}

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const snapshot = useSyncExternalStore(subscribe, () => remote, () => SERVER_REMOTE)

  useEffect(() => {
    void reloadCommunity()
  }, [])

  useEffect(() => {
    if (!snapshot.needsLogin) return
    emit({ ...remote, needsLogin: false })
    router.push("/login")
  }, [router, snapshot.needsLogin])

  const posts = useMemo(() => visiblePosts(snapshot), [snapshot])
  const value = useMemo(
    () => ({
      posts,
      hydrated: snapshot.hydrated,
      user: snapshot.user,
      displayName: snapshot.user?.name ?? "",
      error: snapshot.error,
      vote: (id: string, stance: Vote) => send("/api/community/votes", { method: "POST", body: JSON.stringify({ postId: id, stance }) }),
      addOpinion: (id: string, input: { author: string; stance: Stance; text: string }) =>
        send("/api/community/opinions", { method: "POST", body: JSON.stringify({ postId: id, ...input }) }),
      removeOpinion: (postId: string, opinionId: string) => {
        void postId
        return send(`/api/community/opinions?id=${encodeURIComponent(opinionId)}`, { method: "DELETE" })
      },
      addPost: (post: Post) =>
        send("/api/community/posts", {
          method: "POST",
          body: JSON.stringify({
            id: post.id,
            title: post.title,
            story: post.story,
            kind: post.kind,
            category: post.category,
            illustration: post.illustration,
            item: post.item,
            price: post.price,
            channel: post.channel,
            daysLeft: post.daysLeft,
            image: post.image,
            images: post.images,
          }),
        }),
      decide: (id: string, decision: Decision) =>
        send("/api/community/decisions", { method: "POST", body: JSON.stringify({ postId: id, decision }) }),
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        await reloadCommunity()
      },
    }),
    [posts, snapshot]
  )

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>
}

type CommunityValue = {
  posts: Post[]
  hydrated: boolean
  user: Account | null
  displayName: string
  error: string
  vote: (id: string, stance: Vote) => Promise<boolean>
  addOpinion: (id: string, input: { author: string; stance: Stance; text: string }) => Promise<boolean>
  removeOpinion: (postId: string, opinionId: string) => Promise<boolean>
  addPost: (post: Post) => Promise<boolean>
  decide: (id: string, decision: Decision) => Promise<boolean>
  logout: () => Promise<void>
}

const CommunityContext = createContext<CommunityValue | null>(null)

export function useCommunity() {
  const value = useContext(CommunityContext)
  if (!value) throw new Error("useCommunity 必须放在 CommunityProvider 里")
  return value
}
