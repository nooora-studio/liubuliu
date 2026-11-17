import { castVote, communityPayload } from "@/lib/community-data"
import { bodyOf, handle } from "@/app/api/_shared"

export async function POST(request: Request) {
  return handle(request, true, async (account) => {
    const body = await bodyOf(request)
    await castVote(account!, typeof body.postId === "string" ? body.postId : "", typeof body.stance === "string" ? body.stance : "")
    return communityPayload(account)
  })
}
