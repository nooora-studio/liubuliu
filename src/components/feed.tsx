"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { PostCard } from "@/components/post-card"
import { buttonVariants } from "@/components/ui/button"
import { useCommunity } from "@/lib/community"
import { cn } from "cn"
import type { Post } from "@/lib/types"

type FilterId = "all" | "keep" | "style" | "urgent" | "decided"
type SortId = "urgent" | "new" | "split"

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "keep", label: "要不要留" },
  { id: "style", label: "怎么搭" },
  { id: "urgent", label: "快过期" },
  { id: "decided", label: "已拍板" },
]

const SORTS: { id: SortId; label: string }[] = [
  { id: "urgent", label: "最紧急" },
  { id: "new", label: "最新" },
  { id: "split", label: "最难选" },
]

function matches(post: Post, filter: FilterId) {
  if (filter === "keep") return post.kind === "keep" || post.kind === "both"
  if (filter === "style") return post.kind === "style" || post.kind === "both"
  if (filter === "urgent") return !post.decision && post.daysLeft !== null && post.daysLeft <= 3
  if (filter === "decided") return post.decision !== null
  return true
}

function urgencyRank(post: Post) {
  if (!post.decision && post.daysLeft !== null) return 0
  if (!post.decision) return 1
  return 2
}

function splitDistance(post: Post) {
  const total = post.keepVotes + post.returnVotes
  if (post.decision || total < 8) return 2
  return Math.abs(post.keepVotes / total - 0.5)
}

export function Feed() {
  const { posts, error, user } = useCommunity()
  const [filter, setFilter] = useState<FilterId>("all")
  const [sort, setSort] = useState<SortId>("urgent")

  const visible = useMemo(() => {
    const next = posts.filter((post) => matches(post, filter))
    next.sort((a, b) => {
      if (sort === "new") return b.createdAt - a.createdAt
      if (sort === "split") {
        return splitDistance(a) - splitDistance(b) || (a.daysLeft ?? 99) - (b.daysLeft ?? 99)
      }
      return (
        urgencyRank(a) - urgencyRank(b) ||
        (a.daysLeft ?? 99) - (b.daysLeft ?? 99) ||
        b.createdAt - a.createdAt
      )
    })
    return next
  }, [posts, filter, sort])

  const featured =
    filter === "all" && sort === "urgent"
      ? visible
          .filter(
            (post) => !post.decision && post.daysLeft !== null && post.keepVotes + post.returnVotes >= 8
          )
          .sort(
            (a, b) => splitDistance(a) - splitDistance(b) || (a.daysLeft ?? 99) - (b.daysLeft ?? 99)
          )[0] ?? null
      : null
  const rest = featured ? visible.filter((post) => post.id !== featured.id) : visible

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="max-w-2xl">
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">还挂在门后的衣服</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          都是别人拿不定主意的衣服。快到退货期的排前面，先帮他们看一眼——投一票，或者说一句你实际看到的。
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="toolbar" aria-label="筛选">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                "shrink-0 border px-3 py-2 text-sm",
                filter === item.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/15 bg-card text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2" role="toolbar" aria-label="排序">
          {SORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={sort === item.id}
              onClick={() => setSort(item.id)}
              className={cn(
                "border px-3 py-2 text-sm",
                sort === item.id ? "border-brass text-foreground" : "border-transparent text-muted-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-8 border border-dashed border-foreground/20 bg-card px-6 py-16 text-center">
          <p className="font-serif text-2xl">这里暂时没有这样的衣服</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            换个条件看看，或者把你那件拿不定的发上来。
          </p>
          <Link href="/new" className={cn(buttonVariants(), "mt-5 inline-flex h-10 px-4")}>
            发一条纠结
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {featured ? (
            <section>
              <h2 className="mb-3 text-xs tracking-[0.2em] text-muted-foreground">最难拍板</h2>
              <PostCard post={featured} featured />
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section>
              {featured ? (
                <h2 className="mb-3 text-xs tracking-[0.2em] text-muted-foreground">其他还在犹豫的</h2>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                {rest.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <p className="mt-10 border-t border-dashed border-foreground/15 pt-4 text-sm leading-6 text-muted-foreground">
        标着「示意图」的是示例。{user ? "你发的、投的、写的，都记在账号里。" : "登录之后，你发的和投的会记在账号里，换设备也还在。"}
        {error ? <span className="mt-2 block text-return">{error}</span> : null}
      </p>
    </div>
  )
}
