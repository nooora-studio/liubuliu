"use client"

import { useState } from "react"
import Link from "next/link"
import { PostCard } from "@/components/post-card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { buttonVariants } from "@/components/ui/button"
import { useCommunity } from "@/lib/community"
import { cn } from "cn"

export function MeScreen() {
  const { posts, hydrated, clearMine } = useCommunity()
  const [open, setOpen] = useState(false)
  const mine = posts.filter((post) => post.mine)
  const helped = posts.filter(
    (post) => !post.mine && (post.myVote || post.opinions.some((opinion) => opinion.mine))
  )

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-2xl">正在翻你这台浏览器里的记录</p>
        <p className="mt-2 text-sm text-muted-foreground">投票、意见和你发过的帖子都在本地。</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">我的纠结</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            这里只有这台浏览器记得的东西。示例帖子不算你的。清掉之后，你发的、投的、写的都会消失。
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex h-10 items-center border border-foreground/20 px-3 text-sm">
            清掉本地记录
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">清掉这台浏览器里的记录</DialogTitle>
              <DialogDescription>
                你发的帖、投的票、写的意见会消失。示例纠结还在。
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(false)}>
                先留着
              </Button>
              <Button
                type="button"
                className="h-10 bg-return text-background hover:bg-return/90"
                onClick={() => {
                  clearMine()
                  setOpen(false)
                }}
              >
                清掉
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <section className="mt-8">
        <h2 className="text-xs tracking-[0.2em] text-muted-foreground">我发出去的</h2>
        {mine.length === 0 ? (
          <div className="mt-3 border border-dashed border-foreground/20 bg-card px-6 py-12">
            <p className="font-serif text-2xl">你还没往这里放过衣服</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              那件看了三天的，拍一张就行。没有照片也可以，先用示意图把纠结说清楚。
            </p>
            <Link href="/new" className={cn(buttonVariants(), "mt-5 inline-flex h-10 px-4")}>
              发一条纠结
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {mine.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs tracking-[0.2em] text-muted-foreground">我帮别人看过的</h2>
        {helped.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            你还没投过票，也没写过意见。回到社区，挑一件快过期的看一眼。
          </p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {helped.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
