import { handle } from "@/app/api/_shared"
import { mePayload } from "@/lib/community-data"

export async function GET(request: Request) {
  return handle(request, true, (account) => mePayload(account!))
}
