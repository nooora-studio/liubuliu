import Image from "next/image"
import { Garment } from "@/components/garments"
import { isSafeImage } from "@/lib/storage"
import type { Category, Illustration } from "@/lib/types"

export function Look({
  illustration,
  image,
  alt,
  category,
  framed = true,
}: {
  illustration: Illustration
  image?: string
  alt: string
  category?: Category
  framed?: boolean
}) {
  const photo = image && isSafeImage(image) ? image : undefined
  const frame = (
    <div className="relative aspect-[4/5] overflow-hidden bg-[#efe8dc]">
      {photo ? (
        <Image src={photo} alt={alt} fill unoptimized className="object-cover" sizes="(min-width: 1024px) 420px, 100vw" />
      ) : (
        <Garment id={illustration} title={alt} />
      )}
    </div>
  )

  if (!framed) return frame

  return (
    <figure className="bg-card p-2 pb-3 shadow-[0_1px_0_rgba(28,25,21,0.04)]">
      {frame}
      <figcaption className="mt-2 flex items-center justify-between px-1 text-[11px] tracking-[0.18em] text-muted-foreground">
        <span>{category ?? "衣服"}</span>
        <span>{photo ? "实拍" : "示意图"}</span>
      </figcaption>
    </figure>
  )
}
