"use client"

import { useState } from "react"
import Link from "next/link"
import { Look } from "@/components/look"
import { VoteBar } from "@/components/vote-bar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCommunity } from "@/lib/community"
import {
  deadlineLabel,
  deadlineTone,
  KIND_LABEL,
  priceLabel,
  STANCE_LABEL,
  verdict,
} from "@/lib/format"
import type { Decision, Opinion, Post, Stance, Vote } from "@/lib/types"
import { cn } from "cn"

export function PostDetail({ id }: { id: string }) {
  const { posts, hydrated, user, displayName, vote, addOpinion, removeOpinion, decide } = useCommunity()
  const post = posts.find((item) => item.id === id)

  if (!post && !hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-2xl">正在打开这条纠结</p>
        <p className="mt-2 text-sm text-muted-foreground">稍等一下，马上就好。</p>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-3xl">没找到这条纠结</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          示例一直都在。如果你还没登录，自己发的可能没存下来。
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4">
          回到社区
        </Link>
      </div>
    )
  }

  const result = verdict(post)
  const tone = deadlineTone(post)

  return (
    <article className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-4">
        <PostGallery key={post.id} post={post} />
        <p className="mt-3 text-sm leading-6">
          {post.item || post.category}
          <span className="text-muted-foreground"> · {priceLabel(post.price)}</span>
          {post.channel ? <span className="text-muted-foreground"> · {post.channel}</span> : null}
        </p>
      </div>

      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          返回社区
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "border px-2 py-0.5",
              tone === "urgent" && "border-return/40 bg-return/10 text-return",
              tone === "done" && "border-keep/30 bg-keep/10 text-keep",
              (tone === "ok" || tone === "late") && "border-foreground/15 text-muted-foreground"
            )}
          >
            {deadlineLabel(post)}
          </span>
          <span className="text-muted-foreground">
            {post.category} · {KIND_LABEL[post.kind]}
          </span>
        </div>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {post.author}
          {post.city ? ` · ${post.city}` : ""}
          <span> · {post.postedLabel}</span>
          {post.mine ? <span> · 你发的</span> : null}
        </p>
        <p className="mt-5 whitespace-pre-wrap text-[15px] leading-7">{post.story}</p>

        <section className="mt-8 border border-dashed border-foreground/20 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl">留，还是退</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {post.keepVotes + post.returnVotes === 0
                  ? "还没有人表态。"
                  : `${post.keepVotes + post.returnVotes} 个人里，${post.keepVotes} 个说留，${post.returnVotes} 个说退。`}
              </p>
            </div>
            <Stamp label={result.label} tone={result.tone} />
          </div>
          <div className="mt-4">
            <VoteBar post={post} />
          </div>

          {post.mine ? (
            <DecideBlock
              decision={post.decision}
              onDecide={(decision) => decide(post.id, decision)}
            />
          ) : post.decision ? (
            <p className="mt-4 text-sm text-muted-foreground">已经决定了，票就停在那一刻。</p>
          ) : !user ? (
            <div className="mt-4 border border-dashed border-foreground/20 bg-card px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">登录后才能投票、写意见，你的判断会记在账号里。</p>
              <Link href={`/login?redirect=/post/${post.id}`} className="mt-4 inline-flex h-10 items-center border border-foreground bg-foreground px-4 text-sm text-background">
                去登录
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <VoteButton
                stance="keep"
                pressed={post.myVote === "keep"}
                onClick={() => vote(post.id, "keep")}
              />
              <VoteButton
                stance="return"
                pressed={post.myVote === "return"}
                onClick={() => vote(post.id, "return")}
              />
            </div>
          )}
          {!post.mine && !post.decision ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {post.myVote
                ? "改主意了，点另一边就行。再补一句你为什么这么看。"
                : "先选一边。选完再补一句：你为什么这么看。"}
            </p>
          ) : null}
        </section>

        <OpinionSection
          key={post.id}
          postId={post.id}
          opinions={post.opinions}
          displayName={displayName}
          owner={post.mine}
          loggedIn={Boolean(user)}
          onSubmit={(input) => addOpinion(post.id, input)}
          onRemove={(opinionId) => removeOpinion(post.id, opinionId)}
        />
      </div>
    </article>
  )
}

function PostGallery({ post }: { post: Post }) {
  const images = post.images?.length ? post.images : post.image ? [post.image] : []
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  if (!images.length) return <Look illustration={post.illustration} alt={post.title} category={post.category} />
  const current = images[index] || images[0]
  return (
    <div>
      <button type="button" className="block w-full" aria-label="查看大图" onClick={() => setOpen(true)}>
        <Look illustration={post.illustration} image={current} alt={`${post.title} · 照片 ${index + 1}`} category={post.category} />
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">{index + 1} / {images.length} · 点图片查看大图</p>
      {images.length > 1 ? <div className="mt-3 grid grid-cols-5 gap-2">{images.map((image, i) => (
        <button key={image} type="button" aria-label={`查看照片 ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)} className={cn("border-2", i === index ? "border-foreground" : "border-transparent")}>
          <Look illustration={post.illustration} image={image} alt={`照片 ${i + 1}`} framed={false} />
        </button>
      ))}</div> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>照片 {index + 1} / {images.length}</DialogTitle><DialogDescription>{post.title}</DialogDescription></DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={post.title} className="max-h-[65vh] w-full object-contain" />
          {images.length > 1 ? <div className="flex justify-between">
            <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>上一张</Button>
            <Button type="button" variant="outline" disabled={index === images.length - 1} onClick={() => setIndex(index + 1)}>下一张</Button>
          </div> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stamp({
  label,
  tone,
}: {
  label: string
  tone: "keep" | "return" | "split" | "open"
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 -rotate-6 border-2 px-2 py-1 font-serif text-sm tracking-widest",
        tone === "keep" && "border-keep text-keep",
        tone === "return" && "border-return text-return",
        tone === "split" && "border-brass text-brass",
        tone === "open" && "border-foreground/25 text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}

function VoteButton({
  stance,
  pressed,
  onClick,
}: {
  stance: Vote
  pressed: boolean
  onClick: () => void
}) {
  const keep = stance === "keep"
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-16 border px-4 py-3 text-left transition-colors",
        keep
          ? pressed
            ? "border-keep bg-keep text-background"
            : "border-keep/30 bg-card hover:border-keep"
          : pressed
            ? "border-return bg-return text-background"
            : "border-return/30 bg-card hover:border-return"
      )}
    >
      <span className="block font-serif text-2xl">{keep ? "留下" : "退掉"}</span>
      <span className={cn("mt-1 block text-xs", pressed ? "text-background/80" : "text-muted-foreground")}>
        {keep ? "这件有留下来的理由" : "别再跟它耗着"}
      </span>
    </button>
  )
}

function DecideBlock({
  decision,
  onDecide,
}: {
  decision: Decision | null
  onDecide: (decision: Decision) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">这是你发的，不用给自己投票。听完别人的，自己拿主意。</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="mt-3 inline-flex h-10 items-center border border-foreground bg-foreground px-4 text-sm text-background">
          {decision ? "改一下结论" : "我决定了"}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">你自己的结论</DialogTitle>
            <DialogDescription>票只是参考，拍板的人是你。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              className="h-11 bg-keep text-background hover:bg-keep/90"
              onClick={() => {
                onDecide("kept")
                setOpen(false)
              }}
            >
              留下了
            </Button>
            <Button
              type="button"
              className="h-11 bg-return text-background hover:bg-return/90"
              onClick={() => {
                onDecide("returned")
                setOpen(false)
              }}
            >
              退掉了
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OpinionSection({
  postId,
  opinions,
  displayName,
  owner,
  loggedIn,
  onSubmit,
  onRemove,
}: {
  postId: string
  opinions: Opinion[]
  displayName: string
  owner: boolean
  loggedIn: boolean
  onSubmit: (input: { author: string; stance: Stance; text: string }) => Promise<boolean>
  onRemove: (opinionId: string) => void
}) {
  const [stance, setStance] = useState<Stance>("style")
  const [text, setText] = useState("")
  const [authorDraft, setAuthorDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const author = authorDraft ?? displayName

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return
    if (text.trim().length < 4) {
      setError("再多写几个字，别人才知道你在说哪一件。")
      return
    }
    setSending(true)
    let saved = false
    try {
      saved = await onSubmit({ author, stance: owner ? "style" : stance, text })
    } catch {
      setError("网络没连上，再试一次。")
    } finally {
      setSending(false)
    }
    if (saved) {
      setText("")
      setError(null)
    } else setError("没有发出去，内容还在，请重试。")
  }

  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl">评论与补充 <span className="text-sm text-muted-foreground">{opinions.length}</span></h2>

      {opinions.length === 0 ? (
        <p className="mt-4 border border-dashed border-foreground/20 px-4 py-8 text-sm leading-6 text-muted-foreground">
          {owner
            ? "还没有人来看。发出去之后，意见会出现在这里。也可以先写一句你最担心的。"
            : "还没人说话。你先看的话，留一句你实际看到的。"}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {opinions.map((opinion) => (
            <li key={opinion.id} className="border border-foreground/10 bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    "border px-1.5 py-0.5",
                    opinion.stance === "keep" && "border-keep/40 text-keep",
                    opinion.stance === "return" && "border-return/40 text-return",
                    opinion.stance === "style" && "border-brass/50 text-brass"
                  )}
                >
                  {opinion.supplement ? "作者补充" : STANCE_LABEL[opinion.stance]}
                </span>
                <span>
                  {opinion.author}
                  {opinion.city ? ` · ${opinion.city}` : ""}
                </span>
                {opinion.mine ? <span className="text-muted-foreground">你写的</span> : null}
              </div>
              <p className="mt-2 text-sm leading-6">{opinion.text}</p>
              {opinion.mine ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() => onRemove(opinion.id)}
                >
                  撤回这句
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {loggedIn ? (
        <form onSubmit={submit} noValidate className="mt-6 border-t border-foreground/20 pt-5">
          <h3 className="font-serif text-xl">{owner ? "补充想法" : "写评论"}</h3>
          {!owner ? <p className="mt-1 text-sm text-muted-foreground">可以聊版型、颜色或搭配，写你实际看到的。</p> : null}
          {!owner ? <fieldset className="mt-3">
            <legend className="sr-only">意见分类</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["keep", "return", "style"] as Stance[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={stance === item}
                  onClick={() => setStance(item)}
                  className={cn(
                    "border px-3 py-2 text-sm",
                    stance === item ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card"
                  )}
                >
                  {STANCE_LABEL[item]}
                </button>
              ))}
            </div>
          </fieldset> : null}
          <div className="mt-3">
            <Label className="sr-only" htmlFor={`note-${postId}`}>{owner ? "补充内容" : "评论内容"}</Label>
            <Textarea
              id={`note-${postId}`}
              value={text}
              maxLength={180}
              aria-invalid={Boolean(error)}
              placeholder={owner ? "补充你的想法…" : "写下你的看法…"}
              className="mt-2 min-h-24"
              onChange={(event) => setText(event.target.value)}
            />
            {error ? (
              <p className="mt-1 text-sm text-return" role="alert">
                {error}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{text.trim().length}/180</p>
            )}
          </div>
          <div className="mt-3">
            <Label htmlFor={`name-${postId}`}>署名</Label>
            <Input
              id={`name-${postId}`}
              value={author}
              maxLength={12}
              placeholder="路过的人"
              className="mt-2 h-10 max-w-xs"
              onChange={(event) => setAuthorDraft(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={sending} className="mt-4 h-11 px-4">
            {sending ? "正在发布…" : owner ? "发布补充" : "发布评论"}
          </Button>
        </form>
      ) : (
        <div className="mt-5 border border-dashed border-foreground/20 bg-card px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">登录后才能留言，你的话会记在账号里。</p>
          <Link href={`/login?redirect=/post/${postId}`} className="mt-4 inline-flex h-10 items-center border border-foreground bg-foreground px-4 text-sm text-background">
            去登录
          </Link>
        </div>
      )}
    </section>
  )
}
