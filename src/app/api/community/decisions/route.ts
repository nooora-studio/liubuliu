import { communityPayload, setDecision } from "@/lib/community-data"
import { bodyOf, handle } from "@/app/api/_shared"

export async function POST(request: Request) {
  return handle(request, true, async (account) => {
    const body = await bodyOf(request)
    await setDecision(account!, typeof body.postId === "string" ? body.postId : "", typeof body.decision === "string" ? body.decision : "", typeof body.reason === "string" ? body.reason : undefined)
    return communityPayload(account)
  })
}
