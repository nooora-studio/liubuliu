import { addCloudOpinion, communityPayload, removeCloudOpinion } from "@/lib/community-data"
import { resolveAccount } from "@/lib/session"

export async function POST(request: Request) {
  const { account } = await resolveAccount(request)
  if (!account) return Response.json({ message: "先登录再写意见。" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const error = await addCloudOpinion(account, body || {})
  if (error) return Response.json({ message: error }, { status: 400 })
  return Response.json(await communityPayload(account))
}

export async function DELETE(request: Request) {
  const { account } = await resolveAccount(request)
  if (!account) return Response.json({ message: "先登录。" }, { status: 401 })
  const id = new URL(request.url).searchParams.get("id") || ""
  const error = await removeCloudOpinion(account, id)
  if (error) return Response.json({ message: error }, { status: 400 })
  return Response.json(await communityPayload(account))
}
