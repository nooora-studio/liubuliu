import type { Metadata } from "next"
import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "登录",
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-8"><p className="font-serif text-3xl">登录</p></div>}>
      <LoginForm />
    </Suspense>
  )
}
