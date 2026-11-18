"use client"

import Link from "next/link"
import { PostCard } from "@/components/post-card"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { useCommunity } from "@/lib/community"
import { cn } from "cn"

export function MeScreen() {
  const { posts, hydrated, user, logout, serverNow } = useCommunity()
  const mine = posts.filter((post) => post.mine)
  const helped = posts.filter(
    (post) => !post.mine && (post.myVote || post.myOption || post.opinions.some((opinion) => opinion.mine))
  )

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-2xl">正在打开你的记录</p>
        <p className="mt-2 text-sm text-muted-foreground">你投的票、写的意见、发过的帖，都跟账号走。</p>
      </div>
    )
  }

  // 纠结统计
  const submitted = mine.length
  const kept = mine.filter((p) => p.decision === "kept").length
  const returned = mine.filter((p) => p.decision === "returned").length

  // 广场数据
  const receivedOpinions = mine.reduce((sum, p) => sum + p.opinions.length, 0)

  // 我决定不留的东西省下的钱
  const savedMoney = mine.reduce((sum, post) => {
    if (post.kind === "compare") {
      if (!post.chosenOption) return sum
      return (
        sum +
        (post.options ?? [])
          .filter((o) => o.id !== post.chosenOption)
          .reduce((s, o) => s + (o.price ?? 0), 0)
      )
    }
    if (post.decision === "returned") return sum + (post.price ?? 0)
    return sum
  }, 0)

  // 坚持天数：从最早一条发帖算起
  const earliest = mine.length ? Math.min(...mine.map((p) => p.createdAt)) : null
  const daysStreak = earliest ? Math.max(1, Math.floor((serverNow - earliest) / 86_400_000) + 1) : 0

  // 我的记录子项
  const handledCount = posts.filter(
    (p) => !p.mine && (p.myVote || p.myOption)
  ).length
  const watchedCount = posts.filter(
    (p) => !p.mine && p.opinions.some((o) => o.mine)
  ).length

  const displayName = user?.name || "理性消费者"
  const avatarChar = displayName.slice(0, 1)

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:px-6 md:pb-10 md:pt-8">
      {/* 顶部用户区 */}
      <div className="flex flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-keep text-4xl font-medium text-white">
          {avatarChar}
        </div>
        <h1 className="mt-4 font-serif text-2xl tracking-tight sm:text-3xl">{displayName}</h1>
        {user?.id ? (
          <p className="mt-1 text-xs text-muted-foreground">ID：{user.id.slice(0, 8)}</p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          已坚持理性消费 <span className="font-medium text-foreground">{daysStreak}</span> 天
        </p>
      </div>

      {/* 省钱金额 */}
      <div className="mt-6 rounded-2xl border border-foreground/10 bg-card p-5">
        <p className="text-sm text-muted-foreground">我决定不留的东西，给我省下了</p>
        <p className="mt-2 font-serif text-4xl tracking-tight text-keep">
          ¥{savedMoney.toLocaleString("zh-CN")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          退掉 {returned} 件，省下的钱够再买一件真正想要的。
        </p>
      </div>

      {/* 两个数据卡 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-foreground/10 bg-card p-4">
          <p className="text-sm font-medium">我的纠结</p>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="text-center">
              <p className="font-serif text-2xl">{submitted}</p>
              <p className="mt-1 text-xs text-muted-foreground">总提交</p>
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl text-keep">{kept}</p>
              <p className="mt-1 text-xs text-muted-foreground">留下</p>
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl text-return">{returned}</p>
              <p className="mt-1 text-xs text-muted-foreground">退掉</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-card p-4">
          <p className="text-sm font-medium">我的广场</p>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="text-center">
              <p className="font-serif text-2xl">{submitted}</p>
              <p className="mt-1 text-xs text-muted-foreground">发布</p>
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl text-keep">{receivedOpinions}</p>
              <p className="mt-1 text-xs text-muted-foreground">收到回应</p>
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl">{helped.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">帮人处理</p>
            </div>
          </div>
        </div>
      </div>

      {/* 我的记录 */}
      <div className="mt-4 rounded-2xl border border-foreground/10 bg-card p-5">
        <p className="text-sm font-medium">我的记录</p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <RecordItem label="我提交的" count={submitted} />
          <RecordItem label="我处理的" count={handledCount} />
          <RecordItem label="我围观的" count={watchedCount} />
          <RecordItem label="草稿箱" count={0} />
        </div>
      </div>

      {/* 菜单项 */}
      <div className="mt-4 space-y-3">
        <MenuItem label="屏蔽词库" />
        <MenuItem label="黑名单" />
      </div>

      {/* 意见反馈 */}
      <Button type="button" className="mt-6 h-12 w-full rounded-full bg-foreground text-background hover:bg-foreground/90">
        意见反馈
      </Button>

      {/* 登录 / 退出 */}
      <div className="mt-6 flex justify-center">
        {user ? (
          <Button type="button" variant="ghost" className="h-9 text-sm text-muted-foreground" onClick={() => void logout()}>
            退出登录
          </Button>
        ) : (
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-9 text-sm text-muted-foreground")}>
            微信登录
          </Link>
        )}
      </div>

      {/* 我发出去的 */}
      <section className="mt-10">
        <h2 className="text-xs tracking-[0.2em] text-muted-foreground">我发出去的</h2>
        {mine.length === 0 ? (
          <div className="mt-3 border border-dashed border-foreground/20 bg-card px-6 py-12">
            <p className="font-serif text-2xl">你还没往这里放过东西</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              那件看了三天的，拍张照片，说说你拿不准的地方。
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

      {/* 我帮别人看过的 */}
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

function RecordItem({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5 text-lg font-medium text-foreground/70">
        {count}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function MenuItem({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-card px-5 py-4">
      <span className="text-sm">{label}</span>
      <span className="text-muted-foreground">›</span>
    </div>
  )
}
