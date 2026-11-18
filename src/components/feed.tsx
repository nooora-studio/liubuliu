"use client"

import { useMemo } from "react"
import Link from "next/link"
import { PostCard } from "@/components/post-card"
import { buttonVariants } from "@/components/ui/button"
import { useCommunity } from "@/lib/community"
import { cn } from "cn"

export function Feed() {
  const { posts, error, user } = useCommunity()
  const visible = useMemo(() => [...posts].sort((a, b) => b.createdAt - a.createdAt), [posts])

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
      <div className="hidden md:block">
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">还拿不定主意的东西</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          都是别人拿不定主意的东西。先看新发上来的——投一票，或者说一句你实际看到的。
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="mt-8 border border-dashed border-foreground/20 bg-card px-6 py-16 text-center">
          <p className="font-serif text-2xl">还没有人拿不定主意</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            把你那件拿不定的发上来，让别人帮你看一眼。
          </p>
          <Link href="/new" className={cn(buttonVariants(), "mt-5 inline-flex h-10 px-4")}>
            发一条纠结
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {visible.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <p className="mt-10 border-t border-dashed border-foreground/15 pt-4 text-sm leading-6 text-muted-foreground">
        标着「示意图」的是示例。{user ? "你发的、投的、写的，都记在账号里。" : "登录之后，你发的和投的会记在账号里，换设备也还在。"}
        {error ? <span className="mt-2 block text-return">{error}</span> : null}
      </p>
    </div>
  )
}
