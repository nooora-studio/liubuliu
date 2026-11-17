"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register" | "verify">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [otp, setOtp] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage("")
    const path = mode === "register" ? "/api/auth/register" : mode === "verify" ? "/api/auth/verify" : "/api/auth/login"
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name, otp }),
    })
    const data = (await response.json().catch(() => null)) as { message?: string; needVerification?: boolean } | null
    setPending(false)
    if (data?.needVerification) {
      setMode("verify")
      setMessage("验证码已发到邮箱，填 8 位数字。")
      return
    }
    if (!response.ok) {
      setMessage(data?.message || "没有完成。")
      return
    }
    router.push("/me")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-serif text-3xl tracking-tight">{mode === "register" ? "注册" : mode === "verify" ? "验证邮箱" : "登录"}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        登录之后，你发的纠结、投的票和写的意见会记在云端，换一台设备还能看见。示例帖子不用登录也能看。
      </p>
      <div className="mt-6 flex gap-2 text-sm">
        <button type="button" className={mode === "login" ? "underline" : "text-muted-foreground"} onClick={() => setMode("login")}>
          登录
        </button>
        <button type="button" className={mode === "register" ? "underline" : "text-muted-foreground"} onClick={() => setMode("register")}>
          注册
        </button>
      </div>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        {mode === "register" ? (
          <div className="grid gap-2">
            <Label htmlFor="name">怎么称呼你</Label>
            <Input id="name" value={name} maxLength={12} onChange={(event) => setName(event.target.value)} />
          </div>
        ) : null}
        {mode !== "verify" ? (
          <div className="grid gap-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="otp">8 位验证码</Label>
            <Input id="otp" inputMode="numeric" value={otp} maxLength={8} onChange={(event) => setOtp(event.target.value)} required />
          </div>
        )}
        {message ? <p className="text-sm text-return">{message}</p> : null}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "正在提交…" : mode === "register" ? "注册并收验证码" : mode === "verify" ? "验证并进入" : "登录"}
        </Button>
      </div>
    </form>
  )
}
