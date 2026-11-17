import { castVote, communityPayload } from "@/lib/community-data"
import { resolveAccount } from "@/lib/session"

export async function POST(request: Request) {
  const { account } = await resolveAccount(request)
  if (!account) return Response.json({ message: "先登录再投票。" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { postId?: string; stance?: string } | null
  const error = await castVote(account, body?.postId || "", body?.stance || "")
  if (error) return Response.json({ message: error }, { status: 400 })
  return Response.json(await communityPayload(account))
}
