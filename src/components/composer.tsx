"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Look } from "@/components/look"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCommunity } from "@/lib/community"
import { compressImage } from "@/lib/storage"
import { CATEGORIES, ILLUSTRATIONS, type Category, type Illustration, type Kind, type Post } from "@/lib/types"
import { cn } from "cn"

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "keep", label: "要不要留", hint: "主要是退不退得下决心" },
  { id: "style", label: "怎么搭", hint: "衣服留下了，不知道怎么穿" },
  { id: "both", label: "两个都纠结", hint: "留不留、好不好看，一起问" },
]

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
  size: "这张太大了，换一张近一点的，或只截衣服那一块。",
  read: "这张照片打不开，换一张试试。",
}

export function Composer() {
  const router = useRouter()
  const { addPost } = useCommunity()
  const [kind, setKind] = useState<Kind>("keep")
  const [category, setCategory] = useState<Category>("上衣")
  const [illustration, setIllustration] = useState<Illustration>("knit")
  const [image, setImage] = useState<string | undefined>(undefined)
  const [imageError, setImageError] = useState<string | null>(null)
  const [readingImage, setReadingImage] = useState(false)
  const [title, setTitle] = useState("")
  const [story, setStory] = useState("")
  const [item, setItem] = useState("")
  const [price, setPrice] = useState("")
  const [channel, setChannel] = useState("")
  const [daysLeft, setDaysLeft] = useState<number | null>(3)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onFile(file: File | undefined) {
    setImageError(null)
    if (!file) return
    setReadingImage(true)
    try {
      const data = await compressImage(file)
      setImage(data)
    } catch (error) {
      const code = error instanceof Error ? error.message : "read"
      setImageError(IMAGE_ERROR[code] ?? IMAGE_ERROR.read)
    } finally {
      setReadingImage(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const cleanTitle = title.trim()
    const cleanStory = story.trim()
    if (cleanTitle.length < 4) nextErrors.title = "用一句话写出你在纠结什么。"
    if (cleanStory.length < 12) nextErrors.story = "再多说两句：你哪里看不顺眼，别人才能对着看。"
    let parsedPrice: number | null = null
    if (price.trim()) {
      if (!/^\d{1,6}$/.test(price.trim())) {
        nextErrors.price = "价格写成数字就行，也可以先空着。"
      } else {
        parsedPrice = Number(price.trim())
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const post: Post = {
      id: crypto.randomUUID(),
      author: "我",
      city: "",
      postedLabel: "刚刚",
      createdAt: Date.now(),
      kind,
      category,
      title: cleanTitle.slice(0, 40),
      story: cleanStory.slice(0, 400),
      item: item.trim().slice(0, 24),
      price: parsedPrice,
      channel: channel.trim().slice(0, 16),
      daysLeft,
      illustration,
      image,
      keepVotes: 0,
      returnVotes: 0,
      opinions: [],
      decision: null,
      mine: true,
      myVote: null,
    }
    const saved = await addPost(post)
    if (saved) router.push(`/post/${post.id}`)
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-6xl px-4 py-6 lg:py-8">
      <div className="max-w-2xl">
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">把那件衣服放上来</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          写你自己看不出来的那一点。已经有的类似单品、准备配什么、最担心哪里，这些比“好看吗”有用。
        </p>
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div>
        <Look
          illustration={illustration}
          image={image}
          alt={title.trim() || "准备发出去的衣服"}
          category={category}
        />
        <div className="mt-4">
          <p className="text-sm font-medium">照片</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            登录之后，照片会上传到云端，别人才能看见。没有照片就先选一张示意图。
          </p>
          <div className="mt-2">
            <label
              htmlFor="photo"
              className="inline-flex h-10 cursor-pointer items-center border border-foreground/20 bg-card px-3 text-sm"
            >
              {readingImage ? "正在处理照片…" : image ? "换一张照片" : "从相册选一张"}
            </label>
            <input
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                void onFile(file)
                event.target.value = ""
              }}
            />
          </div>
          {imageError ? (
            <p className="mt-2 text-sm text-return" role="alert">
              {imageError}
            </p>
          ) : null}
          {image ? (
            <Button type="button" variant="outline" className="mt-3 h-9" onClick={() => setImage(undefined)}>
              去掉照片，改用示意图
            </Button>
          ) : null}
        </div>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">示意图</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ILLUSTRATIONS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={illustration === id}
                onClick={() => setIllustration(id)}
                className={cn(
                  "overflow-hidden border",
                  illustration === id ? "border-brass ring-2 ring-brass/50" : "border-foreground/10"
                )}
              >
                <Look illustration={id} alt="示意图" framed={false} />
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <fieldset>
          <legend className="text-sm font-medium">你在纠结什么</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {KINDS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={kind === option.id}
                onClick={() => setKind(option.id)}
                className={cn(
                  "border px-3 py-3 text-left",
                  kind === option.id ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card"
                )}
              >
                <span className="block text-sm">{option.label}</span>
                <span className={cn("mt-1 block text-xs", kind === option.id ? "text-background/70" : "text-muted-foreground")}>
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <Label htmlFor="title">一句话</Label>
          <Input
            id="title"
            value={title}
            maxLength={40}
            aria-invalid={Boolean(errors.title)}
            placeholder="例如：骆驼色大衣到底显不显黑"
            className="mt-2 h-11"
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title ? (
            <p className="mt-1 text-sm text-return" role="alert">
              {errors.title}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{title.trim().length}/40</p>
          )}
        </div>

        <div className="mt-5">
          <Label htmlFor="story">你自己哪里看不顺眼</Label>
          <Textarea
            id="story"
            value={story}
            maxLength={400}
            aria-invalid={Boolean(errors.story)}
            placeholder="在店里觉得好，回家对着衣柜就不确定了。写你已经有什么、准备配什么、最担心的一点。"
            className="mt-2 min-h-36"
            onChange={(event) => setStory(event.target.value)}
          />
          {errors.story ? (
            <p className="mt-1 text-sm text-return" role="alert">
              {errors.story}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{story.trim().length}/400</p>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="item">单品</Label>
            <Input
              id="item"
              value={item}
              maxLength={24}
              placeholder="米白圆领针织"
              className="mt-2 h-11"
              onChange={(event) => setItem(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="channel">在哪买的</Label>
            <Input
              id="channel"
              value={channel}
              maxLength={16}
              placeholder="优衣库 / 淘宝 / 专柜"
              className="mt-2 h-11"
              onChange={(event) => setChannel(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="price">价格</Label>
            <Input
              id="price"
              inputMode="numeric"
              value={price}
              aria-invalid={Boolean(errors.price)}
              placeholder="199"
              className="mt-2 h-11"
              onChange={(event) => setPrice(event.target.value)}
            />
            {errors.price ? (
              <p className="mt-1 text-sm text-return" role="alert">
                {errors.price}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="category">品类</Label>
            <select
              id="category"
              value={category}
              className="mt-2 h-11 w-full border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {CATEGORIES.map((itemName) => (
                <option key={itemName} value={itemName}>
                  {itemName}
                </option>
              ))}
            </select>
          </div>
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

        <Button type="submit" className="mt-6 h-11 px-5" disabled={readingImage}>
          发出去，让人帮看
        </Button>
      </div>
      </div>
    </form>
  )
}
