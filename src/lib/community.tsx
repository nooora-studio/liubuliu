"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Account } from "@/lib/account"
import type { Decision, Post } from "@/lib/types"

type Stats = { published: number; voted: number; comments: number }
type Payload = { user?: Account | null; posts?: Post[]; post?: Post; serverNow?: number; deleted?: boolean; stats?: Stats; message?: string }
type Detail = { post: Post | null; loaded: boolean; error: string }

type Remote = {
  hydrated: boolean
  user: Account | null
  posts: Post[]
  details: Record<string, Detail>
  me: { posts: Post[]; stats: Stats | null; loaded: boolean; error: string }
  serverNow: number
  error: string
  needsLogin: boolean
}

const EMPTY_ME = { posts: [], stats: null, loaded: false, error: "" }
const SERVER_REMOTE: Remote = { hydrated: false, user: null, posts: [], details: {}, me: EMPTY_ME, serverNow: 0, error: "", needsLogin: false }

let remote: Remote = SERVER_REMOTE
const listeners = new Set<() => void>()
const requests = new Map<string, number>()
let generation = 0

function emit(next: Remote) {
  remote = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function request(url: string, init?: RequestInit): Promise<Payload> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json" } })
  const data = await response.json().catch(() => null) as Payload | null
  if (response.status === 401) {
    generation += 1
    emit({ ...SERVER_REMOTE, hydrated: true, needsLogin: true })
  }
  if (!response.ok || !data) throw new Error(data?.message || "服务暂不可用，请重试。")
  return data
}

export async function reloadCommunity() {
  const version = generation
  const sequence = (requests.get("community") ?? 0) + 1
  requests.set("community", sequence)
  try {
    const data = await request("/api/community")
    if (version !== generation || requests.get("community") !== sequence) return
    if (!Array.isArray(data.posts)) throw new Error("社区数据不完整，请重试。")
    const changed = (data.user?.id ?? null) !== (remote.user?.id ?? null)
    emit({
      ...remote, hydrated: true, user: data.user ?? null, posts: data.posts,
      details: changed ? {} : remote.details, me: changed ? EMPTY_ME : remote.me,
      serverNow: data.serverNow ?? remote.serverNow, error: "", needsLogin: false,
    })
  } catch (error) {
    if (version === generation && requests.get("community") === sequence) {
      emit({ ...remote, hydrated: true, error: error instanceof Error ? error.message : "网络没连上，请重试。" })
    }
  }
}

async function reloadPost(id: string) {
  const version = generation
  const key = `post:${id}`
  const sequence = (requests.get(key) ?? 0) + 1
  requests.set(key, sequence)
  try {
    const data = await request(`/api/posts/${encodeURIComponent(id)}`)
    if (version !== generation || requests.get(key) !== sequence) return
    if (!data.post) throw new Error("帖子数据不完整，请重试。")
    emit({ ...remote, details: { ...remote.details, [id]: { post: data.post, loaded: true, error: "" } }, serverNow: data.serverNow ?? remote.serverNow })
  } catch (error) {
    if (version === generation && requests.get(key) === sequence) {
      // 读取失败时不继续展示可能已经被删除的旧正文和图片。
      emit({ ...remote, details: { ...remote.details, [id]: { post: null, loaded: true, error: error instanceof Error ? error.message : "网络没连上，请重试。" } } })
    }
  }
}

async function reloadMe() {
  if (!remote.user) return
  const version = generation
  const userId = remote.user.id
  const sequence = (requests.get("me") ?? 0) + 1
  requests.set("me", sequence)
  try {
    const data = await request("/api/me")
    if (version !== generation || userId !== remote.user?.id || requests.get("me") !== sequence) return
    if (!data.stats || !Array.isArray(data.posts)) throw new Error("参与记录不完整，请重试。")
    emit({ ...remote, me: { posts: data.posts, stats: data.stats, loaded: true, error: "" }, serverNow: data.serverNow ?? remote.serverNow })
  } catch (error) {
    if (version === generation && userId === remote.user?.id && requests.get("me") === sequence) {
      emit({ ...remote, me: { posts: [], stats: null, loaded: true, error: error instanceof Error ? error.message : "网络没连上，请重试。" } })
    }
  }
}

async function send(url: string, init: RequestInit, id?: string) {
  try {
    const data = await request(url, init)
    if (!Array.isArray(data.posts) && !data.post && !data.deleted) throw new Error("未收到保存确认，请刷新后重试。")
    generation += 1
    const posts = data.posts ?? (data.deleted ? remote.posts.filter((post) => post.id !== id) : remote.posts.map((post) => post.id === data.post?.id ? data.post : post))
    const details = { ...remote.details }
    for (const post of posts) if (details[post.id]) details[post.id] = { post, loaded: true, error: "" }
    if (data.post) details[data.post.id] = { post: data.post, loaded: true, error: "" }
    if (data.deleted && id) details[id] = { post: null, loaded: true, error: "这条纠结已删除。" }
    emit({ ...remote, posts, details, user: data.user === undefined ? remote.user : data.user, serverNow: data.serverNow ?? remote.serverNow, error: "", needsLogin: false })
    if (id && !data.deleted && !data.post) await reloadPost(id)
    if (remote.user) void reloadMe()
    return true
  } catch (error) {
    emit({ ...remote, error: error instanceof Error ? error.message : "网络没连上，内容未保存，请重试。" })
    return false
  }
}

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const snapshot = useSyncExternalStore(subscribe, () => remote, () => SERVER_REMOTE)

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      void reloadCommunity()
      if (pathname === "/me") void reloadMe()
      const id = pathname.startsWith("/post/") ? pathname.slice(6) : ""
      if (id) void reloadPost(id)
    }
    refresh()
    document.addEventListener("visibilitychange", refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      document.removeEventListener("visibilitychange", refresh)
      window.clearInterval(timer)
    }
  }, [pathname])

  useEffect(() => {
    if (!snapshot.needsLogin) return
    emit({ ...remote, needsLogin: false })
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
  }, [router, pathname, snapshot.needsLogin])

  const value = useMemo(
    () => ({
      posts: snapshot.posts,
      details: snapshot.details,
      me: snapshot.me,
      serverNow: snapshot.serverNow,
      reloadCommunity,
      reloadPost,
      reloadMe,
      hydrated: snapshot.hydrated,
      user: snapshot.user,
      displayName: snapshot.user?.name ?? "",
      error: snapshot.error,
      vote: (id: string, stance: string) => send("/api/votes", { method: "POST", body: JSON.stringify({ postId: id, stance }) }, id),
      addOpinion: (id: string, input: { id: string; text: string; parentId?: string }) =>
        send("/api/opinions", { method: "POST", body: JSON.stringify({ postId: id, ...input, stance: "style" }) }, id),
      removeOpinion: (postId: string, opinionId: string) => {
        return send(`/api/opinions?id=${encodeURIComponent(opinionId)}`, { method: "DELETE" }, postId)
      },
      addPost: (post: Post) =>
        send("/api/community/posts", {
          method: "POST",
          body: JSON.stringify({
            id: post.id,
            title: post.title,
            story: post.story,
            kind: post.kind,
            price: post.price,
            brand: post.brand,
            desiredEffect: post.desiredEffect,
            returnStatus: post.returnStatus,
            returnDeadline: post.returnDeadline,
            daysLeft: post.daysLeft,
            category: post.category,
            illustration: post.illustration,
            item: post.item,
            channel: post.channel,
            options: post.options,
            images: post.images,
          }),
        }, post.id),
      decide: (id: string, decision: Decision, reason: string) =>
        send(`/api/posts/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ action: "decision", decision, reason }) }, id),
      updatePost: (id: string, input: Record<string, unknown>) =>
        send(`/api/posts/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(input) }, id),
      logout: async () => {
        try {
          await request("/api/auth/logout", { method: "POST" })
          generation += 1
          emit({ ...SERVER_REMOTE, hydrated: true })
          await reloadCommunity()
        } catch (error) {
          emit({ ...remote, error: error instanceof Error ? error.message : "退出失败，请重试。" })
        }
      },
    }),
    [snapshot]
  )

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>
}

type CommunityValue = {
  posts: Post[]
  details: Record<string, Detail>
  me: Remote["me"]
  serverNow: number
  reloadCommunity: () => Promise<void>
  reloadPost: (id: string) => Promise<void>
  reloadMe: () => Promise<void>
  hydrated: boolean
  user: Account | null
  displayName: string
  error: string
  vote: (id: string, stance: string) => Promise<boolean>
  addOpinion: (id: string, input: { id: string; text: string; parentId?: string }) => Promise<boolean>
  removeOpinion: (postId: string, opinionId: string) => Promise<boolean>
  addPost: (post: Post) => Promise<boolean>
  decide: (id: string, decision: Decision, reason: string) => Promise<boolean>
  updatePost: (id: string, input: Record<string, unknown>) => Promise<boolean>
  logout: () => Promise<void>
}

const CommunityContext = createContext<CommunityValue | null>(null)

export function useCommunity() {
  const value = useContext(CommunityContext)
  if (!value) throw new Error("useCommunity 必须放在 CommunityProvider 里")
  return value
}
