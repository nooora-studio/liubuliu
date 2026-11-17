import { bodyOf, handle } from "@/app/api/_shared"
import { reportContent } from "@/lib/community-data"

export async function POST(request: Request) {
  return handle(request, true, async (account) => ({
    ...await reportContent(account!, await bodyOf(request)), serverNow: Date.now(),
  }))
}
