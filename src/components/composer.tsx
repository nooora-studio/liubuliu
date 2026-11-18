"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Look } from "@/components/look"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCommunity } from "@/lib/community"
import { compressImage } from "@/lib/storage"
import { type Category, CATEGORIES, type CompareOption, type Illustration, type Post } from "@/lib/types"
import { cn } from "cn"

type Mode = "single" | "compare"

const DAYS: { value: number | null; label: string }[] = [
  { value: 1, label: "只剩今天" },
  { value: 2, label: "还剩 2 天" },
  { value: 3, label: "还剩 3 天" },
  { value: 5, label: "还剩 5 天" },
  { value: 7, label: "还有一周" },
  { value: null, label: "已经不能退" },
]

const IMAGE_ERROR: Record<string, string> = {
  type: "只收 jpg、png 或 webp。",
  size: "这张太大了，换一张近一点的，或只截东西那一块。",
  read: "这张照片打不开，换一张试试。",
}

export function Composer() {
  const router = useRouter()
  const { addPost, user, hydrated, error } = useCommunity()
  const [mode, setMode] = useState<Mode>("single")
  const illustration: Illustration = "knit"
  const [category, setCategory] = useState<Category>("其它")
  const [images, setImages] = useState<string[]>([])
  const image = images[0]
  const [imageError, setImageError] = useState<string | null>(null)
  const [readingImage, setReadingImage] = useState(false)
  const [title, setTitle] = useState("")
  const [story, setStory] = useState("")
  const [price, setPrice] = useState("")
  const [daysLeft, setDaysLeft] = useState<number | null>(3)
  const [options, setOptions] = useState<{ id: string; label: string; price: string }[]>([
    { id: crypto.randomUUID(), label: "", price: "" },
    { id: crypto.randomUUID(), label: "", price: "" },
  ])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function addOption() {
    if (options.length >= 6) return
    setOptions((current) => [...current, { id: crypto.randomUUID(), label: "", price: "" }])
  }
  function removeOption(id: string) {
    if (options.length <= 2) return
    setOptions((current) => current.filter((o) => o.id !== id))
  }
  function updateOption(id: string, field: "label" | "price", value: string) {
    setOptions((current) => current.map((o) => (o.id === id ? { ...o, [field]: value } : o)))
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="font-serif text-2xl">正在加载…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">登录后才能发帖</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          你发的、收到的投票和意见都记在账号里，换设备也能看见。先登录，再把那件东西放上来。
        </p>
        <Link href="/login?redirect=/new" className="mt-6 inline-flex h-11 items-center border border-foreground bg-foreground px-5 text-sm text-background">
          去登录
        </Link>
      </div>
    )
  }

  async function onFiles(files: File[]) {
    setImageError(null)
    if (!files.length || readingImage || submitting) return
    if (files.length + images.length > 9) {
      setImageError("一条最多放 9 张照片，先去掉几张。")
      return
    }
    setReadingImage(true)
    try {
      const data = await Promise.all(files.map(compressImage))
      setImages((current) => [...current, ...data])
    } catch (error) {
      const code = error instanceof Error ? error.message : "read"
      setImageError(IMAGE_ERROR[code] ?? IMAGE_ERROR.read)
    } finally {
      setReadingImage(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (readingImage || submitting) return
    const nextErrors: Record<string, string> = {}
    const cleanTitle = title.trim()
    const cleanStory = story.trim()
    if (!images.length) nextErrors.images = "添加至少一张商品或上身照片，大家才好帮你看。"
    if (cleanTitle.length < 4) nextErrors.title = "用一句话写出你在纠结什么。"
    if (cleanStory.length < 12) nextErrors.story = "再多说两句：你哪里看不顺眼，别人才能对着看。"

    const isCompare = mode === "compare"
    let parsedPrice: number | null = null
    if (!isCompare && price.trim()) {
      if (!/^\d{1,6}$/.test(price.trim())) {
        nextErrors.price = "价格填写整数，也可以空着。"
      } else {
        parsedPrice = Number(price.trim())
      }
    }

    let compareOptions: CompareOption[] = []
    if (isCompare) {
      compareOptions = options.map((o, i) => {
        const label = o.label.trim()
        if (!label) nextErrors[`option-${o.id}`] = `选项 ${i + 1} 写个名字。`
        let optPrice: number | null = null
        if (o.price.trim()) {
          if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(o.price.trim())) {
            nextErrors[`option-${o.id}`] = `选项 ${i + 1} 价格填写数字，最多两位小数。`
          } else {
            optPrice = Number(o.price.trim())
          }
        }
        return { id: o.id, label: label.slice(0, 24), price: optPrice }
      })
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    const post: Post = {
      id: crypto.randomUUID(),
      author: "我",
      city: "",
      postedLabel: "刚刚",
      createdAt: Date.now(),
      kind: isCompare ? "compare" : "keep",
      category,
      title: cleanTitle.slice(0, 40),
      story: cleanStory.slice(0, 400),
      item: "",
      price: isCompare ? null : parsedPrice,
      channel: "",
      daysLeft,
      illustration,
      image,
      images,
      keepVotes: 0,
      returnVotes: 0,
      opinions: [],
      decision: null,
      mine: true,
      myVote: null,
      options: isCompare ? compareOptions : undefined,
    }
    const saved = await addPost(post)
    setSubmitting(false)
    if (saved) router.push(`/post/${post.id}`)
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-6xl px-4 py-6 lg:py-8">
      <fieldset disabled={submitting} className="min-w-0">
      <div className="max-w-2xl">
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">
          {mode === "compare" ? "几件里留哪个" : "把那件东西放上来"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "compare"
            ? "拿不准买哪件、留哪件？把候选都列出来，让大家帮你选。纠结点写清楚，比问“哪个好”管用。"
            : "说说你自己拿不准的地方：是不是跟已有的重了、打算配什么、最担心哪里。这些写清楚，比问“好看吗”管用。"}
        </p>
        <div className="mt-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">发帖方式</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              { id: "single", label: "留不留", desc: "一件东西，问留不留、怎么搭" },
              { id: "compare", label: "留哪个", desc: "几件候选，让大家帮选一件" },
            ] as { id: Mode; label: string; desc: string }[]).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
                title={m.desc}
                className={cn(
                  "rounded-md border px-3 py-3 text-left text-sm transition-colors",
                  mode === m.id ? "border-return bg-return/10 text-foreground" : "border-foreground/15 bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="block font-medium">{m.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div>
        {image ? <div className="max-w-[240px] lg:max-w-none"><Look
          illustration={illustration}
          image={image}
          alt={title.trim() || "准备发出去的东西"}
        /></div> : null}
        <div className="mt-4">
          <p className="text-sm font-medium">上传图片（最多 {9} 张）</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {mode === "compare" ? "把候选商品放在一起，照片和选项用同样的名字或顺序，大家更容易比较。" : "可以放上身实拍、细节和不同搭配。第一张当封面。"}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <label
              htmlFor="photo"
              className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-2xl border border-foreground/20 bg-card text-3xl text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              {readingImage ? "…" : "+"}
            </label>
            <input
              id="photo"
              type="file"
              multiple
              disabled={readingImage || submitting || images.length >= 9}
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                void onFiles(files)
                event.target.value = ""
              }}
            />
            {images.map((photo, index) => (
              <div key={photo + index} className="relative h-20 w-20 overflow-hidden rounded-2xl">
                <Look illustration={illustration} image={photo} alt={`照片 ${index + 1}`} framed={false} />
                <button type="button" disabled={readingImage || submitting} aria-label={`删除照片 ${index + 1}`} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/80 text-xs text-background" onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>×</button>
              </div>
            ))}
          </div>
          {imageError || errors.images ? (
            <p className="mt-2 text-sm text-return" role="alert">
              {imageError || errors.images}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <div className="sm:max-w-[220px]">
          <Label htmlFor="category">品类</Label>
          <div className="mt-2 relative">
            <select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
              className="h-11 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">▾</span>
          </div>
        </div>
        {mode === "single" ? (
          <div className="mt-5 sm:max-w-[180px]">
            <Label htmlFor="price">价格</Label>
            <div className="mt-2 flex h-11 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-sm text-muted-foreground">¥</span>
              <input
                id="price"
                inputMode="numeric"
                value={price}
                aria-invalid={Boolean(errors.price)}
                placeholder="199"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            {errors.price ? (
              <p className="mt-1 text-sm text-return" role="alert">{errors.price}</p>
            ) : null}
          </div>
        ) : (
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">
              候选 <span className="text-muted-foreground">· {options.length} / 6</span>
            </legend>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              每件写个名字，价格选填。大家照着这个投票。
            </p>
            <div className="mt-3 space-y-2">
              {options.map((opt, index) => {
                const letter = String.fromCharCode(65 + index)
                return (
                  <div key={opt.id}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-foreground/15 bg-card text-sm font-medium text-muted-foreground">
                      {letter}
                    </span>
                    <Input
                      value={opt.label}
                      aria-label={`选项 ${letter} 名称`}
                      maxLength={24}
                      aria-invalid={Boolean(errors[`option-${opt.id}`])}
                      placeholder={`填写选项${letter}`}
                      className="h-11 min-w-0 flex-1"
                      onChange={(event) => updateOption(opt.id, "label", event.target.value)}
                    />
                    <div className="flex h-11 w-24 shrink-0 items-center gap-1.5 rounded-md border border-input bg-transparent px-2 focus-within:ring-2 focus-within:ring-ring sm:w-28">
                      <span className="text-sm text-muted-foreground">¥</span>
                      <input
                        inputMode="decimal"
                        value={opt.price}
                        placeholder="价格"
                        aria-label={`选项 ${letter} 价格`}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                        onChange={(event) => updateOption(opt.id, "price", event.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`删除选项 ${letter}`}
                      disabled={options.length <= 2}
                      onClick={() => removeOption(opt.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center border border-foreground/15 text-muted-foreground disabled:opacity-30 hover:text-return"
                    >
                      ×
                    </button>
                  </div>
                  {errors[`option-${opt.id}`] ? <p role="alert" className="mt-1 text-sm text-return">{errors[`option-${opt.id}`]}</p> : null}
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={addOption}
              disabled={options.length >= 6}
              className="mt-3 flex h-11 w-full items-center justify-center border border-foreground/15 bg-card text-sm text-foreground/70 disabled:opacity-40 hover:border-foreground/30"
            >
              + 添加选项
            </button>
          </fieldset>
        )}

        <div className="mt-5">
          <Label htmlFor="title">一句话说清</Label>
          <Input
            id="title"
            value={title}
            maxLength={40}
            aria-invalid={Boolean(errors.title)}
            placeholder={mode === "compare" ? "例如：这三件卫衣留哪件？" : "例如：骆驼色大衣到底显不显黑"}
            className="mt-2 h-11"
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title ? (
            <p className="mt-1 text-sm text-return" role="alert">{errors.title}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{title.trim().length}/40</p>
          )}
        </div>

        <div className="mt-5">
          <Label htmlFor="story">{mode === "compare" ? "纠结点" : "说说你的纠结"}</Label>
          <Textarea
            id="story"
            value={story}
            maxLength={400}
            aria-invalid={Boolean(errors.story)}
            placeholder={
              mode === "compare"
                ? "你拿不定主意的地方：是颜色、版型、价格，还是别的？大家照着这个帮你选。"
                : "想要什么效果？放了几张的话，按顺序说说分别想搭什么。"
            }
            className="mt-2 min-h-36"
            onChange={(event) => setStory(event.target.value)}
          />
          {errors.story ? (
            <p className="mt-1 text-sm text-return" role="alert">{errors.story}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{story.trim().length}/400</p>
          )}
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">退货还剩几天</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((option) => {
              const selected = daysLeft === option.value
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDaysLeft(option.value)}
                  className={cn(
                    "border px-3 py-2 text-sm",
                    selected ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card"
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        {error ? (
          <p className="mt-6 text-sm text-return" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-6 h-11 px-5" disabled={readingImage || submitting}>
          {submitting ? "正在发出去…" : readingImage ? "正在处理照片…" : "发出去，让人帮看"}
        </Button>
      </div>
      </div>
      </fieldset>
    </form>
  )
}
