import Link from "next/link"
import { Look } from "@/components/look"
import { VoteBar } from "@/components/vote-bar"
import { deadlineLabel, deadlineTone, excerpt, KIND_LABEL, priceLabel } from "@/lib/format"
import { cn } from "cn"
import type { Post } from "@/lib/types"

export function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const tone = deadlineTone(post)
  return (
    <Link
      href={`/post/${post.id}`}
      className={cn(
        "group block border border-dashed border-foreground/20 bg-card p-3 transition-colors hover:border-foreground/40",
        featured && "lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-6 lg:p-4"
      )}
    >
      <div className="overflow-hidden">
        <div className="transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <Look
            illustration={post.illustration}
            image={post.image}
            alt={post.title}
            category={post.category}
          />
        </div>
      </div>
      <div className={cn("flex flex-col px-1 pt-3", featured && "lg:justify-center lg:py-2 lg:pr-2")}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "border px-2 py-0.5",
              tone === "urgent" && "border-return/40 bg-return/10 text-return",
              tone === "ok" && "border-foreground/15 text-muted-foreground",
              tone === "late" && "border-foreground/15 text-muted-foreground",
              tone === "done" && "border-keep/30 bg-keep/10 text-keep"
            )}
          >
            {deadlineLabel(post)}
          </span>
          <span className="text-muted-foreground">{KIND_LABEL[post.kind]}</span>
          {(post.images?.length ?? 0) > 1 ? <span className="text-muted-foreground">{post.images?.length} 张照片</span> : null}
          {post.mine ? <span className="text-brass">你发的</span> : null}
          {post.myVote ? (
            <span className="text-foreground/70">你投了{post.myVote === "keep" ? "留" : "退"}</span>
          ) : null}
        </div>
        <h2
          className={cn(
            "mt-2 font-serif text-xl leading-snug tracking-tight",
            featured && "lg:text-3xl"
          )}
        >
          {post.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{excerpt(post.story)}</p>
        <p className="mt-3 text-sm">
          {post.item || post.category}
          <span className="text-muted-foreground"> · {priceLabel(post.price)}</span>
          {post.channel ? <span className="text-muted-foreground"> · {post.channel}</span> : null}
        </p>
        <div className="mt-4">
          <VoteBar post={post} />
        </div>
        <p className="mt-3 text-xs tracking-wide text-muted-foreground">
          {post.opinions.length} 条评论
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
