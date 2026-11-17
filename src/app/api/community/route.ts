import { communityPayload } from "@/lib/community-data"
import { resolveAccount } from "@/lib/session"
import { vectoreeConfigured } from "@/lib/vectoree"

export async function GET(request: Request) {
  if (!vectoreeConfigured()) {
    return Response.json({ message: "云后端还没有配置密钥。", user: null, posts: [], seed: emptySeed() }, { status: 503 })
  }
  const { account, refreshed } = await resolveAccount(request)
  const payload = await communityPayload(account)
  return Response.json(refreshed ? { ...payload, refreshed } : payload)
}

function emptySeed() {
  return { votes: {}, extraKeep: {}, extraReturn: {}, opinions: {} }
}
