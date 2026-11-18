import Image from "next/image"
import { Garment } from "@/components/garments"
import { isSafeImage } from "@/lib/storage"
import type { Illustration } from "@/lib/types"

export function Look({
  illustration,
  image,
  alt,
  framed = true,
  shape = "portrait",
}: {
  illustration: Illustration
  image?: string
  alt: string
  framed?: boolean
  shape?: "portrait" | "square"
}) {
  const photo = image && isSafeImage(image) ? image : undefined
  const frame = (
    <div className={`relative overflow-hidden bg-[#efe8dc] ${shape === "square" ? "aspect-square" : "aspect-[4/5]"}`}>
      {photo ? (
        <Image src={photo} alt={alt} fill unoptimized className="object-cover" sizes="(min-width: 1024px) 420px, 100vw" />
      ) : (
        <Garment id={illustration} title={alt} />
      )}
    </div>
  )

  if (!framed) return frame

  return (
    <figure className="bg-card p-2 pb-3 shadow-[0_1px_0_rgba(42,38,34,0.05)]">
      {frame}
      <figcaption className="mt-2 flex items-center justify-end px-1 text-[11px] tracking-[0.18em] text-muted-foreground">
        <span>{photo ? "照片" : "示意图"}</span>
      </figcaption>
    </figure>
  )
}
