import { tally } from "@/lib/format"
import type { Post } from "@/lib/types"

export function VoteBar({ post }: { post: Pick<Post, "keepVotes" | "returnVotes"> }) {
  const { keep, ret, total, keepShare } = tally(post)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-keep">留 {keep}</span>
        <span className="text-xs tracking-wide text-muted-foreground">
          {total === 0 ? "还没人表态" : `${total} 人帮看过`}
        </span>
        <span className="text-return">退 {ret}</span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden bg-foreground/10" aria-hidden>
        <div className="bg-keep" style={{ width: `${keepShare}%` }} />
        <div className="bg-return" style={{ width: `${total === 0 ? 0 : 100 - keepShare}%` }} />
      </div>
    </div>
  )
}
