import { communityPayload } from "@/lib/community-data"
import { resolveAccount } from "@/lib/session"
import { vectoreeConfigured } from "@/lib/vectoree"

export async function GET(request: Request) {
  if (!vectoreeConfigured()) {
    return Response.json({ message: "暂时连不上服务器。", user: null, posts: [], seed: emptySeed() }, { status: 503 })
  }
  const { account, refreshed } = await resolveAccount(request)
  const payload = await communityPayload(account)
  return Response.json(refreshed ? { ...payload, refreshed } : payload)
}

function emptySeed() {
  return { votes: {}, extraKeep: {}, extraReturn: {}, opinions: {} }
}
