import { readLook } from "@/lib/vectoree"
import { visibleLook } from "@/lib/community-data"
import { apiError } from "@/app/api/_shared"

const SAFE_KEY = /^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/i

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params
  try {
    if (!SAFE_KEY.test(key) || !await visibleLook(key)) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } })
    const look = await readLook(key)
    if (!look) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } })
    // 下载期间可能发生删除，在发送内容前再次检查可见性。
    if (!await visibleLook(key)) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } })
    return new Response(new Uint8Array(look.bytes), {
      headers: { "content-type": look.contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" },
    })
  } catch (error) {
    return apiError(error)
  }
}
