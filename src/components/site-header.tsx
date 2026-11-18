"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { useCommunity } from "@/lib/community"
import { cn } from "cn"

export function SiteHeader() {
  const { user } = useCommunity()
  const pathname = usePathname()
  const home = pathname === "/"
  const detail = pathname.startsWith("/post/")
  const showDock = home || pathname === "/me"

  return (
    <>
      <header className="border-b border-foreground/10 md:border-b-0">
        <div className="mx-auto grid h-14 max-w-3xl grid-cols-3 items-center px-4 md:hidden">
          {home ? <span /> : (
            <Link href="/" aria-label="返回社区" className="w-fit rounded-md px-2 py-2 text-xl leading-none focus-visible:outline-2 focus-visible:outline-return">
              ←
            </Link>
          )}
          <Link href="/" className="justify-self-center whitespace-nowrap text-base font-medium">
            {detail ? "这条纠结" : pathname === "/new" ? "发一条" : pathname === "/me" ? "我的" : "留不留"}
          </Link>
          <span />
        </div>
        <div className="mx-auto hidden max-w-5xl items-center justify-between gap-4 px-6 py-5 md:flex">
          <Link href="/" className="group min-w-0">
            <span className="font-serif text-[1.7rem] leading-none tracking-tight">留不留</span>
            <span className="mt-1 block text-xs text-muted-foreground">东西自己看不出，就让人帮你看。</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-3">
            <Link href={user ? "/me" : "/login"} className="px-2 py-2 text-sm text-foreground/80 hover:text-foreground">
              {user ? user.name : "登录"}
            </Link>
            <Link href="/new" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>发一条纠结</Link>
          </nav>
        </div>
      </header>
      {showDock ? (
        <nav aria-label="底部导航" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 items-center border-t border-foreground/10 bg-card px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:hidden">
          <Link href="/" aria-current={home ? "page" : undefined} className={cn("py-3 text-center text-sm", home ? "font-semibold" : "text-muted-foreground")}>社区</Link>
          <Link href="/new" className="rounded-full bg-return px-3 py-3 text-center text-sm font-medium text-white">发一条</Link>
          <Link href={user ? "/me" : "/login?redirect=/me"} aria-current={pathname === "/me" ? "page" : undefined} className={cn("py-3 text-center text-sm", pathname === "/me" ? "font-semibold" : "text-muted-foreground")}>我的</Link>
        </nav>
      ) : null}
    </>
  )
}
