import { communityPayload, createPost } from "@/lib/community-data"
import { resolveAccount } from "@/lib/session"

export async function POST(request: Request) {
  const { account } = await resolveAccount(request)
  if (!account) return Response.json({ message: "先登录，这条纠结才会被别人看到。" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ message: "这条纠结没有传上来。" }, { status: 400 })
  const error = await createPost(account, body)
  if (error) return Response.json({ message: error }, { status: 400 })
  return Response.json(await communityPayload(account))
}
