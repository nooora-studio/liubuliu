import { communityPayload, createPost } from "@/lib/community-data"
import { bodyOf, handle } from "@/app/api/_shared"

export async function GET(request: Request) {
  return handle(request, false, communityPayload)
}

export async function POST(request: Request) {
  return handle(request, true, async (account) => {
    await createPost(account!, await bodyOf(request))
    return communityPayload(account)
  })
}
