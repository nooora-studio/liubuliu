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
import type { Decision, Stance, Vote } from "@/lib/types"
import { cn } from "cn"

const STARTERS: { stance: Stance; text: string }[] = [
  { stance: "keep", text: "颜色比版型更值得留。白天拉到窗边再看一次，别只在暖光下判决。" },
  { stance: "return", text: "和你已经有的太像，留着大概率不会拿出来穿。" },
  { stance: "style", text: "别塞进裤子，下摆盖住胯最宽的位置会好看很多。" },
  { stance: "style", text: "配深色直筒裤和一双乐福，别配运动鞋。" },
  { stance: "keep", text: "肩线是对的。这件的价值在版型，不在花色。" },
  { stance: "return", text: "这个价位如果还要犹豫，通常就是不会常穿。" },
]

export function PostDetail({ id }: { id: string }) {
  const { posts, hydrated, displayName, vote, addOpinion, removeOpinion, decide } = useCommunity()
  const post = posts.find((item) => item.id === id)

  if (!post && !hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-2xl">正在从这台浏览器里找这条纠结</p>
        <p className="mt-2 text-sm text-muted-foreground">你自己发的帖子存在本地，打开需要一瞬间。</p>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-3xl">这条纠结不在这台浏览器里</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          示例帖子一直都在。你自己发的如果清掉了，或者换了浏览器，就找不回来。
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
        <Look
          illustration={post.illustration}
          image={post.image}
          alt={post.title}
          category={post.category}
        />
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
            <p className="mt-4 text-sm text-muted-foreground">已经拍板了，票停在当时的样子。</p>
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
                ? "你改主意了可以再点另一边。票和意见是两件事，下面补一句具体的。"
                : "先选一边。只说好看帮不上忙，选完可以补一句为什么。"}
            </p>
          ) : null}
        </section>

        <OpinionSection
          postId={post.id}
          opinions={post.opinions}
          displayName={displayName}
          owner={post.mine}
          onSubmit={(input) => addOpinion(post.id, input)}
          onRemove={(opinionId) => removeOpinion(post.id, opinionId)}
        />
      </div>
    </article>
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
      <p className="text-sm text-muted-foreground">这是你的帖子，你不给自己投票。听完意见，自己拍板。</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="mt-3 inline-flex h-10 items-center border border-foreground bg-foreground px-4 text-sm text-background">
          {decision ? "改一下结论" : "我决定了"}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">你自己的结论</DialogTitle>
            <DialogDescription>大家的票只是帮你下嘴。拍板的人是你。</DialogDescription>
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
  onSubmit,
  onRemove,
}: {
  postId: string
  opinions: { id: string; author: string; city: string; stance: Stance; text: string; mine?: boolean }[]
  displayName: string
  owner: boolean
  onSubmit: (input: { author: string; stance: Stance; text: string }) => void
  onRemove: (opinionId: string) => void
}) {
  const [stance, setStance] = useState<Stance>("style")
  const [text, setText] = useState("")
  const [authorDraft, setAuthorDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const author = authorDraft ?? displayName

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (text.trim().length < 4) {
      setError("至少写一句具体的。四个字看不出你在说哪一件。")
      return
    }
    onSubmit({ author, stance, text })
    setText("")
    setError(null)
  }

  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl">具体意见</h2>
      <p className="mt-1 text-sm text-muted-foreground">版型、颜色、和已有衣服重不重、怎么搭。比“好看”有用。</p>

      {opinions.length === 0 ? (
        <p className="mt-4 border border-dashed border-foreground/20 px-4 py-8 text-sm leading-6 text-muted-foreground">
          {owner
            ? "还没有人来看。发出去之后，别人的意见会出现在这里。你也可以先补一句自己最担心的点。"
            : "还没有人说话。你要是先看了，就留一句具体的。"}
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
                  {STANCE_LABEL[opinion.stance]}
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

      <form onSubmit={submit} noValidate className="mt-5 border border-dashed border-foreground/20 p-4">
        <fieldset>
          <legend className="text-sm font-medium">你站哪边</legend>
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
        </fieldset>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((starter) => (
            <button
              key={starter.text}
              type="button"
              className="border border-foreground/10 bg-card px-2 py-1 text-left text-xs leading-5 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              onClick={() => {
                setStance(starter.stance)
                setText(starter.text)
                setError(null)
              }}
            >
              {starter.text}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label htmlFor={`note-${postId}`}>你的一句</Label>
          <Textarea
            id={`note-${postId}`}
            value={text}
            maxLength={180}
            aria-invalid={Boolean(error)}
            placeholder="说版型、颜色，或者直接告诉对方怎么搭。"
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
          <Label htmlFor={`name-${postId}`}>怎么称呼你</Label>
          <Input
            id={`name-${postId}`}
            value={author}
            maxLength={12}
            placeholder="路过的人"
            className="mt-2 h-10 max-w-xs"
            onChange={(event) => setAuthorDraft(event.target.value)}
          />
        </div>
        <Button type="submit" className="mt-4 h-10 px-4">
          写下这句
        </Button>
      </form>
    </section>
  )
}
