import { readLook } from "@/lib/vectoree"

const SAFE_KEY = /^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/i

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params
  if (!SAFE_KEY.test(key)) return new Response("Not found", { status: 404 })
  const look = await readLook(key)
  if (!look) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(look.bytes), {
    headers: {
      "content-type": look.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  })
}
