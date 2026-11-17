"use client"

import Link from "next/link"
import { PostCard } from "@/components/post-card"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { useCommunity } from "@/lib/community"
import { cn } from "cn"

export function MeScreen() {
  const { posts, hydrated, user, logout } = useCommunity()
  const mine = posts.filter((post) => post.mine)
  const helped = posts.filter(
    (post) => !post.mine && (post.myVote || post.opinions.some((opinion) => opinion.mine))
  )

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-2xl">正在打开你的记录</p>
        <p className="mt-2 text-sm text-muted-foreground">你投的票、写的意见、发过的帖，都跟账号走。</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">我的纠结</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {user
              ? `${user.name}，${user.email}。你发的、投的、写的都记在这个账号里。退出后内容还在，重新登录就能看见。`
              : "还没登录。示例不算你的。登录之后，你发的就跟着账号。"}
          </p>
        </div>
        {user ? (
          <Button type="button" variant="outline" className="h-10" onClick={() => void logout()}>
            退出登录
          </Button>
        ) : (
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "inline-flex h-10 px-3")}>
            登录
          </Link>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-xs tracking-[0.2em] text-muted-foreground">我发出去的</h2>
        {mine.length === 0 ? (
          <div className="mt-3 border border-dashed border-foreground/20 bg-card px-6 py-12">
            <p className="font-serif text-2xl">你还没往这里放过衣服</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              那件看了三天的，拍张照就行。没有照片，用示意图也能说清。
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
            你还没投过票，也没写过意见。回社区挑一件快到期的看看。
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
