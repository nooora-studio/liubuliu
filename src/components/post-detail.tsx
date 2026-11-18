"use client"

import { useRef, useState } from "react"
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
  optionTotal,
  postBody,
  priceLabel,
  STANCE_LABEL,
  verdict,
} from "@/lib/format"
import type { Decision, Opinion, Post, Stance, Vote } from "@/lib/types"
import type { Account } from "@/lib/account"
import { cn } from "cn"

export function PostDetail({ id }: { id: string }) {
  const { posts, details, hydrated, user, displayName, vote, addOpinion, removeOpinion, decide, updatePost, error } = useCommunity()
  const detail = details[id]
  const post = detail?.loaded ? detail.post : posts.find((item) => item.id === id)

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
          {detail?.error || "这条帖子可能已删除，回社区看看其他纠结。"}
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
    <article className="mx-auto max-w-[660px] px-4 pb-12 pt-5 md:px-6 md:pt-8">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        返回社区
      </Link>
      <div className={cn("mx-auto mt-5", post.kind === "compare" ? "w-full max-w-[460px]" : "w-[55%] min-w-[180px] max-w-[240px]")}>
        <PostGallery key={post.id} post={post} />
      </div>
      <p className="mt-5 text-sm leading-6 md:text-base">
        {post.kind === "compare" ? (
          <>
            {post.options?.length ?? 0} 件候选
            {post.channel ? <span> · {post.channel}</span> : null}
          </>
        ) : (
          <>
            {post.item || "这件东西"}
            {post.price !== null ? <span> · {priceLabel(post.price)}</span> : null}
            {post.channel ? <span> · {post.channel}</span> : null}
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "rounded border px-2 py-0.5",
              tone === "urgent" && "border-return/40 bg-return/10 text-return",
              tone === "done" && "border-keep/30 bg-keep/10 text-keep",
              (tone === "ok" || tone === "late") && "border-foreground/15 text-muted-foreground"
            )}
          >
            {deadlineLabel(post)}
          </span>
          <span className="rounded border border-foreground/15 px-2 py-0.5 text-muted-foreground">{KIND_LABEL[post.kind]}</span>
          <Stamp label={result.label} tone={result.tone} />
      </div>
      <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{post.title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
          {post.author}
          {post.city ? ` · ${post.city}` : ""}
          <span> · {post.postedLabel}</span>
          {post.mine ? <span> · 你发的</span> : null}
      </p>
      <p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8]">{postBody(post)}</p>

      <section aria-label="投票" className="mt-5 rounded-lg border border-foreground/15 bg-card p-3 md:p-4">
        {post.kind === "compare" ? (
          <CompareVote key={post.id} post={post} vote={vote} choose={(optionId) => updatePost(post.id, { action: "decision", optionId })} user={user} />
        ) : (
          <>
            <VoteBar post={post} />
            {post.keepVotes + post.returnVotes > 0 ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {post.keepVotes + post.returnVotes} 个人里，{post.keepVotes} 个说留，{post.returnVotes} 个说退。
              </p>
            ) : null}

            {post.mine ? (
              <DecideBlock
                decision={post.decision}
                onDecide={(decision) => decide(post.id, decision, "")}
              />
            ) : post.decision ? (
              <p className="mt-4 text-sm text-muted-foreground">已经决定了，票就停在那一刻。</p>
            ) : !user ? (
              <div className="mt-4 border-t border-foreground/10 px-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">登录后才能投票、写意见，你的判断会记在账号里。</p>
                <Link href={`/login?redirect=/post/${post.id}`} className="mt-4 inline-flex h-10 items-center rounded-md bg-return px-4 text-sm text-white">
                  去登录
                </Link>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
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
          </>
        )}
      </section>
      {error ? <p role="alert" className="mt-3 text-sm text-return">{error}</p> : null}

      <OpinionSection
          key={post.id}
          postId={post.id}
          opinions={post.opinions}
          displayName={displayName}
          owner={post.mine}
          comparing={post.kind === "compare"}
          loggedIn={Boolean(user)}
          onSubmit={(input) => addOpinion(post.id, input)}
          onRemove={(opinionId) => removeOpinion(post.id, opinionId)}
      />
    </article>
  )
}

function PostGallery({ post }: { post: Post }) {
  const images = post.images?.length ? post.images : post.image ? [post.image] : []
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  if (!images.length) return <Look illustration={post.illustration} alt={post.title} shape="square" />
  const current = images[index] || images[0]
  return (
    <div>
      <button type="button" className="block w-full" aria-label="查看大图" onClick={() => setOpen(true)}>
        <Look illustration={post.illustration} image={current} alt={`${post.title} · 照片 ${index + 1}`} shape="square" />
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">{index + 1} / {images.length} · 点图片查看大图</p>
      {images.length > 1 ? <div className="mt-3 grid grid-cols-5 gap-2">{images.map((image, i) => (
        <button key={image} type="button" aria-label={`查看照片 ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)} className={cn("border-2", i === index ? "border-foreground" : "border-transparent")}>
          <Look illustration={post.illustration} image={image} alt={`照片 ${i + 1}`} framed={false} shape="square" />
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
        "inline-flex shrink-0 rounded border px-2 py-0.5 text-xs",
        tone === "keep" && "border-keep text-keep",
        tone === "return" && "border-return text-return",
        tone === "split" && "border-brass text-brass",
        tone === "open" && "border-foreground/15 text-muted-foreground"
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
        "min-h-11 rounded-md border px-4 py-2 text-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-return",
        keep
          ? pressed
            ? "border-keep bg-keep text-background"
            : "border-keep/30 bg-card hover:border-keep"
          : pressed
            ? "border-return bg-return text-background"
            : "border-return/30 bg-card hover:border-return"
      )}
    >
      {keep ? "留下" : "退掉"}
    </button>
  )
}

function CompareVote({
  post,
  vote,
  choose,
  user,
}: {
  post: Post
  vote: (id: string, stance: string) => Promise<boolean>
  choose: (optionId: string) => Promise<boolean>
  user: Account | null
}) {
  const total = optionTotal(post)
  const options = post.options ?? []
  const decided = Boolean(post.decision || post.chosenOption || post.votesClosedAt)
  const mine = post.mine
  const [pending, setPending] = useState(false)

  return (
    <div>
      <p className="text-sm font-medium">帮选一个</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {total > 0 ? `${total} 人已选` : "还没有人帮选"}
      </p>
      <div className="mt-3 space-y-2">
        {options.map((opt, index) => {
          const count = post.optionVotes?.[opt.id] ?? 0
          const share = total === 0 ? 0 : (count / total) * 100
          const selected = post.myOption === opt.id
          const letter = String.fromCharCode(65 + index)
          const disabled = mine || decided || !user || pending
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={async () => {
                setPending(true)
                try { await vote(post.id, opt.id) } finally { setPending(false) }
              }}
              className={cn(
                "relative w-full overflow-hidden rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-return disabled:cursor-default",
                selected
                  ? "border-keep bg-keep/10"
                  : "border-foreground/15 bg-card hover:border-foreground/30"
              )}
            >
              <div
                className={cn("absolute inset-y-0 left-0 transition-all", selected ? "bg-keep/15" : "bg-foreground/5")}
                style={{ width: `${share}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-medium",
                      selected ? "bg-keep text-background" : "bg-foreground/10 text-muted-foreground"
                    )}
                  >
                    {letter}
                  </span>
                  <span className="break-words text-sm font-medium">{opt.label}</span>
                  {post.chosenOption === opt.id ? <span className="shrink-0 text-xs text-keep">作者选了</span> : null}
                  {opt.price !== null ? (
                    <span className="text-xs text-muted-foreground">{priceLabel(opt.price)}</span>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  {count} 票 · {Math.round(share)}%
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {mine ? (
        <div className="mt-4 border-t border-foreground/10 pt-4">
          <p className="text-sm text-muted-foreground">听完大家的建议，选一件，给这次纠结一个结论。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((option) => (
              <Button key={option.id} type="button" variant="outline" disabled={pending} onClick={async () => {
                setPending(true)
                try { await choose(option.id) } finally { setPending(false) }
              }}>
                {post.chosenOption === option.id ? `已选 ${option.label}` : `我选 ${option.label}`}
              </Button>
            ))}
          </div>
        </div>
      ) : decided ? (
        <p className="mt-4 text-sm text-muted-foreground">已经决定了，票就停在那一刻。</p>
      ) : !user ? (
        <div className="mt-4 border-t border-foreground/10 px-2 py-4 text-center">
          <p className="text-sm text-muted-foreground">登录后才能投票、写意见，你的判断会记在账号里。</p>
          <Link href={`/login?redirect=/post/${post.id}`} className="mt-4 inline-flex h-10 items-center rounded-md bg-return px-4 text-sm text-white">
            去登录
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {post.myOption ? "改主意了，点另一个选项就行。再补一句你为什么这么看。" : "先选一个。选完再补一句：你为什么选它。"}
        </p>
      )}
    </div>
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
        <DialogTrigger className="mt-3 inline-flex h-10 items-center rounded-md bg-return px-4 text-sm text-white">
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
  comparing,
  loggedIn,
  onSubmit,
  onRemove,
}: {
  postId: string
  opinions: Opinion[]
  displayName: string
  owner: boolean
  comparing: boolean
  loggedIn: boolean
  onSubmit: (input: { id: string; text: string }) => Promise<boolean>
  onRemove: (opinionId: string) => void
}) {
  const [stance, setStance] = useState<Stance>("style")
  const [text, setText] = useState("")
  const [authorDraft, setAuthorDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const pendingId = useRef<string | null>(null)
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
      pendingId.current ??= crypto.randomUUID()
      saved = await onSubmit({ id: pendingId.current, text })
    } catch {
      setError("网络没连上，再试一次。")
    } finally {
      setSending(false)
    }
    if (saved) {
      setText("")
      pendingId.current = null
      setError(null)
    } else setError("没有发出去，内容还在，请重试。")
  }

  return (
    <section className="mt-7">
      <h2 className="text-lg font-semibold text-muted-foreground">评论与补充 <span className="text-xs font-normal">{opinions.length}</span></h2>

      {opinions.length === 0 ? (
        <p className="mt-4 border border-dashed border-foreground/20 px-4 py-8 text-sm leading-6 text-muted-foreground">
          {owner
            ? "还没有人来看。发出去之后，意见会出现在这里。也可以先写一句你最担心的。"
            : "还没人说话。你先看的话，留一句你实际看到的。"}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {opinions.map((opinion) => (
            <li key={opinion.id} className="rounded-lg border border-foreground/15 bg-card px-3 py-3.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span
                  className={cn(
                    "rounded border px-2 py-0.5",
                    opinion.stance === "keep" && "border-keep/40 text-keep",
                    opinion.stance === "return" && "border-return/40 text-return",
                    opinion.stance === "style" && "border-brass/50 text-brass"
                  )}
                >
                  {opinion.supplement ? "作者补充" : comparing ? "帮选建议" : STANCE_LABEL[opinion.stance]}
                </span>
                {opinion.mine ? (
                  <button
                    type="button"
                    className="text-muted-foreground underline underline-offset-4"
                    onClick={() => onRemove(opinion.id)}
                  >
                    撤回
                  </button>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{opinion.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">{opinion.author}{opinion.city ? ` · ${opinion.city}` : ""}{opinion.mine ? " · 你写的" : ""}</p>
            </li>
          ))}
        </ol>
      )}

      {loggedIn ? (
        <form onSubmit={submit} noValidate className="mt-6 border-t border-foreground/15 pt-5">
          <h3 className="text-lg font-semibold">{owner ? "补充想法" : "写评论"}</h3>
          {!owner ? <p className="mt-1 text-sm text-muted-foreground">可以聊版型、颜色或搭配，写你实际看到的。</p> : null}
          {!owner && !comparing ? <fieldset className="mt-3">
            <legend className="sr-only">意见分类</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["keep", "return", "style"] as Stance[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={stance === item}
                  onClick={() => setStance(item)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm",
                    stance === item ? "border-return bg-return text-white" : "border-foreground/15 bg-card"
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
              className="mt-2 min-h-32 rounded-none bg-card"
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
              className="mt-2 h-11 rounded-none bg-card"
              onChange={(event) => setAuthorDraft(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={sending} className="mt-4 h-11 w-full bg-return px-4 text-white hover:bg-return/90">
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
