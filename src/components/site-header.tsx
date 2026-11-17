"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "cn"

export function SiteHeader() {
  return (
    <header className="border-b border-foreground/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="group min-w-0">
          <span className="flex items-center gap-3">
            <span className="font-serif text-[1.7rem] leading-none tracking-tight">留不留</span>
            <span className="tape hidden h-2 w-14 sm:block" aria-hidden />
          </span>
          <span className="mt-1 hidden text-xs text-muted-foreground sm:block">
            衣服自己看不出，就让人帮你看。
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/me"
            className="px-2 py-2 text-sm text-foreground/80 hover:text-foreground"
          >
            我的纠结
          </Link>
          <Link href="/new" className={cn(buttonVariants({ size: "lg" }), "h-10 px-3 sm:px-4")}>
            <span className="sm:hidden">发一条</span>
            <span className="hidden sm:inline">发一条纠结</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
