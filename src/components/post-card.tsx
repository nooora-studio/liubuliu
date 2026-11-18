import Link from "next/link"
import { Look } from "@/components/look"
import { VoteBar } from "@/components/vote-bar"
import {
  compareHeadline,
  deadlineLabel,
  deadlineTone,
  excerpt,
  KIND_LABEL,
  optionTotal,
  postBody,
  priceLabel,
} from "@/lib/format"
import { cn } from "cn"
import type { Post } from "@/lib/types"

export function PostCard({ post }: { post: Post }) {
  const tone = deadlineTone(post)
  const isCompare = post.kind === "compare"
  const myPick = isCompare ? post.myOption : post.myVote
  const gallery = post.images?.length ? post.images : post.image ? [post.image] : []
  const shown = gallery.slice(0, 4)
  const more = gallery.length - shown.length
  const multiple = shown.length > 1
  const headline = isCompare ? compareHeadline(post) : post.title

  return (
    <Link
      href={`/post/${post.id}`}
      className="group flex items-start gap-3 rounded-lg border border-foreground/15 bg-card p-2.5 shadow-[0_1px_1px_rgba(42,38,34,0.04)] transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-return"
    >
      {!multiple ? (
        <div className="w-[86px] shrink-0 overflow-hidden rounded sm:w-[116px]">
          <Look
            illustration={post.illustration}
            image={shown[0]}
            alt={headline}
            framed={false}
            shape="square"
          />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 py-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5",
              tone === "urgent" && "border-return/40 bg-return/10 text-return",
              tone === "ok" && "border-foreground/15 text-muted-foreground",
              tone === "late" && "border-foreground/15 text-muted-foreground",
              tone === "done" && "border-keep/30 bg-keep/10 text-keep"
            )}
          >
            {deadlineLabel(post)}
          </span>
          <span className="text-muted-foreground">{KIND_LABEL[post.kind]}</span>
          {post.mine ? <span className="text-brass">你发的</span> : null}
          {myPick ? (
            <span className="text-foreground/70">
              {isCompare
                ? `你选了 ${post.options?.find((o) => o.id === myPick)?.label ?? ""}`
                : `你投了${myPick === "keep" ? "留" : "退"}`}
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug tracking-tight">{headline}</h2>
        {!isCompare ? (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{excerpt(postBody(post), 82)}</p>
        ) : null}
        {multiple ? (
          <div className={cn("mt-3 grid max-w-[360px] gap-2", shown.length === 2 ? "grid-cols-2" : shown.length === 3 ? "grid-cols-3" : "grid-cols-4")}>
            {shown.map((photo, i) => (
              <div key={photo + i} className="relative">
                <Look illustration={post.illustration} image={photo} alt={`${headline} 照片 ${i + 1}`} framed={false} shape="square" />
                {i === shown.length - 1 && more > 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-foreground/55 text-xs font-medium text-background">
                    +{more}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3">{isCompare ? <CompareSummary post={post} /> : <VoteBar post={post} />}</div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {post.opinions.length} 条评论与补充
          <span className="px-1">·</span>
          {post.author}
          {post.city ? ` · ${post.city}` : ""}
          <span className="px-1">·</span>
          {post.postedLabel}
        </p>
      </div>
    </Link>
  )
}

function CompareSummary({ post }: { post: Post }) {
  const options = post.options ?? []
  const total = optionTotal(post)
  const chosen = post.chosenOption ? options.find((o) => o.id === post.chosenOption) : null
  const ranking = options
    .map((o) => ({ id: o.id, label: o.label, count: post.optionVotes?.[o.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const leader = ranking[0]
  const tied = leader && ranking[1]?.count === leader.count

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {options.map((option, index) => {
          const count = post.optionVotes?.[option.id] ?? 0
          const share = total === 0 ? 0 : (count / total) * 100
          const isLeader = !chosen && leader && leader.id === option.id && count > 0 && !tied
          const isChosen = chosen?.id === option.id
          return (
            <div
              key={option.id}
              className={cn(
                "relative overflow-hidden rounded border px-2.5 py-2",
                isChosen
                  ? "border-keep/40 bg-keep/10"
                  : isLeader
                    ? "border-keep/30 bg-keep/[0.06]"
                    : "border-foreground/10"
              )}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 break-words">
                  <span className={cn("shrink-0", isChosen ? "text-keep" : "text-muted-foreground")}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0 break-words">{option.label}</span>
                  {isChosen ? (
                    <span className="shrink-0 rounded bg-keep/20 px-1 py-0.5 text-[10px] font-medium text-keep">已选</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {option.price !== null ? <span className="text-xs text-return">{priceLabel(option.price)}</span> : null}
                  <span className={cn("text-xs", count > 0 ? "text-foreground/70" : "text-muted-foreground")}>{count} 票</span>
                </span>
              </div>
              {total > 0 ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={cn("h-full", isChosen ? "bg-keep" : isLeader ? "bg-keep/70" : "bg-foreground/20")}
                    style={{ width: `${share}%` }}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {chosen ? (
        <div className="flex items-center gap-1.5 rounded bg-keep/10 px-2.5 py-1.5 text-xs text-keep">
          <span className="font-medium">最终选了 {chosen.label}</span>
          <span className="text-keep/60">· {total} 人参与</span>
        </div>
      ) : total === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">还没人帮选，来投一票</p>
      ) : tied ? (
        <p className="px-1 text-xs text-muted-foreground">暂时并列 · {total} 人已选</p>
      ) : leader && leader.count > 0 ? (
        <p className="px-1 text-xs text-keep">{leader.label} 领先 · {total} 人已选</p>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">{total} 人已选</p>
      )}
    </div>
  )
}
