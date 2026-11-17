import { addCloudOpinion, communityPayload, removeCloudOpinion } from "@/lib/community-data"
import { bodyOf, handle } from "@/app/api/_shared"

export async function POST(request: Request) {
  return handle(request, true, async (account) => {
    await addCloudOpinion(account!, await bodyOf(request))
    return communityPayload(account)
  })
}

export async function DELETE(request: Request) {
  return handle(request, true, async (account) => {
    await removeCloudOpinion(account!, new URL(request.url).searchParams.get("id") || "")
    return communityPayload(account)
  })
}
