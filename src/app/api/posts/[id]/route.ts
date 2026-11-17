import { bodyOf, handle } from "@/app/api/_shared"
import { singlePostPayload, updatePost } from "@/lib/community-data"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  return handle(request, false, async (account) => singlePostPayload(account, (await context.params).id))
}

export async function POST(request: Request, context: Context) {
  return handle(request, true, async (account) => {
    const { id } = await context.params
    const result = await updatePost(account!, id, await bodyOf(request))
    return "deleted" in result ? { ...result, serverNow: Date.now() } : singlePostPayload(account, id)
  })
}
