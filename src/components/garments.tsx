"use client"

import { useId } from "react"
import type { Illustration } from "@/lib/types"

function Sheet({
  bg,
  title,
  children,
}: {
  bg: string
  title: string
  children: React.ReactNode
}) {
  return (
    <svg viewBox="0 0 320 400" role="img" aria-label={title} className="h-full w-full">
      <rect width="320" height="400" fill={bg} />
      <path d="M0 22 H320" stroke="#1c1915" strokeOpacity="0.06" />
      {children}
      <ellipse cx="160" cy="372" rx="86" ry="8" fill="#1c1915" opacity="0.08" />
    </svg>
  )
}

export function Garment({ id, title }: { id: Illustration; title: string }) {
  const uid = useId().replace(/:/g, "")
  if (id === "knit") return <Knit title={title} />
  if (id === "trousers") return <Trousers title={title} />
  if (id === "coat") return <Coat title={title} />
  if (id === "skirt") return <Skirt title={title} />
  if (id === "shirt") return <Shirt title={title} uid={uid} />
  if (id === "sneakers") return <Sneakers title={title} />
  if (id === "blazer") return <Blazer title={title} />
  if (id === "dress") return <Dress title={title} />
  return <Hoodie title={title} />
}

function Knit({ title }: { title: string }) {
  return (
    <Sheet bg="#f3eee6" title={title}>
      <path d="M78 150c18-28 34-36 82-36s64 8 82 36l22 34-28 16-14-22v118c0 16-18 28-62 28s-62-12-62-28V178l-14 22-28-16z" fill="#f7f3ea" />
      <path d="M104 168c10 34 18 92 18 150h-20c-6-48-12-104-22-136z" fill="#e4d8c6" opacity="0.9" />
      <path d="M216 168c-10 34-18 92-18 150h20c6-48 12-104 22-136z" fill="#e7dccb" />
      <ellipse cx="160" cy="128" rx="28" ry="16" fill="#f3eee6" />
      <path d="M132 128c6 16 16 22 28 22s22-6 28-22" fill="none" stroke="#c9b59a" strokeWidth="6" />
      <path d="M98 292h124" stroke="#ddcfbb" strokeWidth="8" />
      <path d="M102 304h116M108 316h104" stroke="#e7dccb" strokeWidth="4" />
      <path d="M86 176c-8 20-8 34 2 42M234 176c8 20 8 34-2 42" fill="none" stroke="#e4d8c6" strokeWidth="7" />
    </Sheet>
  )
}

function Trousers({ title }: { title: string }) {
  return (
    <Sheet bg="#e5e1d4" title={title}>
      <path d="M102 78h116l10 18H92z" fill="#3f4a32" />
      <path d="M96 96h128l18 236-46 10-22-168-14 168-46-8z" fill="#556244" />
      <path d="M118 108c8 70 10 150 6 214" fill="none" stroke="#3d482f" strokeWidth="8" strokeLinecap="round" />
      <path d="M160 104v168" stroke="#3d482f" strokeWidth="3" opacity="0.5" />
      <path d="M148 92h24v12h-24z" fill="#6d7a58" />
      <circle cx="160" cy="98" r="2" fill="#e5e1d4" />
    </Sheet>
  )
}

function Coat({ title }: { title: string }) {
  return (
    <Sheet bg="#f0e6d4" title={title}>
      <path d="M160 62c-8 10-18 14-28 14-6 18-20 28-28 34l-18 168 36 16 18-120 20 196 20-196 18 120 36-16-18-168c-8-6-22-16-28-34-10 0-20-4-28-14z" fill="#c6a36e" />
      <path d="M132 76c8 22 14 40 14 70 8-20 12-34 14-70-8 8-18 12-28 12z" fill="#f0e6d4" />
      <path d="M188 76c-8 22-14 40-14 70-8-20-12-34-14-70 8 8 18 12 28 12z" fill="#f6efe2" />
      <path d="M148 150h24l-4 150h-16z" fill="#a88450" opacity="0.55" />
      <circle cx="160" cy="176" r="3.2" fill="#5c4630" />
      <circle cx="160" cy="206" r="3.2" fill="#5c4630" />
      <circle cx="160" cy="236" r="3.2" fill="#5c4630" />
      <path d="M118 86c-16 8-24 4-30-8" fill="none" stroke="#8d7048" strokeWidth="3" />
      <path d="M154 48c4 8 8 10 6 18" fill="none" stroke="#8d7048" strokeWidth="3" strokeLinecap="round" />
    </Sheet>
  )
}

function Skirt({ title }: { title: string }) {
  return (
    <Sheet bg="#f6eee8" title={title}>
      <path d="M108 92h104l8 16H100z" fill="#6e2430" />
      <path d="M100 108c8 150 18 196 60 196s52-46 60-196z" fill="#8a3140" />
      <path d="M132 112c6 90 10 160 4 184" fill="none" stroke="#6a2430" strokeWidth="10" strokeLinecap="round" opacity="0.45" />
      <path d="M146 100h28v10h-28z" fill="#f2d3c4" />
    </Sheet>
  )
}

function Shirt({ title, uid }: { title: string; uid: string }) {
  const pattern = `stripes-${uid}`
  return (
    <Sheet bg="#e7eef2" title={title}>
      <defs>
        <pattern id={pattern} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#f7fbfd" />
          <rect width="4" height="12" fill="#243e63" />
        </pattern>
      </defs>
      <path d="M96 118c22-28 36-36 64-36s42 8 64 36l24 28-30 18-12-20v150H114V144l-12 20-30-18z" fill={`url(#${pattern})`} />
      <path d="M128 92l32 36 32-36" fill="#f7fbfd" />
      <path d="M128 92l32 36 32-36" fill="none" stroke="#243e63" strokeWidth="4" />
      <path d="M154 128h12v92h-12z" fill="#f7fbfd" />
      <circle cx="160" cy="150" r="2" fill="#243e63" />
      <circle cx="160" cy="170" r="2" fill="#243e63" />
      <circle cx="160" cy="190" r="2" fill="#243e63" />
      <path d="M114 250h92" stroke="#243e63" strokeWidth="6" />
    </Sheet>
  )
}

function Sneakers({ title }: { title: string }) {
  return (
    <Sheet bg="#f4f1ea" title={title}>
      <g transform="translate(28 150)">
        <path d="M18 78c22-8 48-28 78-28 34 0 62 16 92 16 20 0 36 8 48 18 8 18-6 28-22 30H34c-16-2-28-14-16-36z" fill="#fbfaf7" stroke="#1c1915" strokeWidth="3" />
        <path d="M34 86h184c6 14-2 24-16 26H48c-14-2-22-12-14-26z" fill="#c9834a" />
        <path d="M78 58c8 16 8 28 0 36M112 50c8 18 8 32 0 46M146 54c8 16 8 28 0 38" fill="none" stroke="#ded8ce" strokeWidth="3" />
        <path d="M168 48h28l8 20h-30z" fill="#f3efe8" stroke="#1c1915" strokeWidth="3" />
      </g>
      <g transform="translate(78 214)" opacity="0.95">
        <path d="M18 70c20-6 40-22 66-22 28 0 50 12 74 12 16 0 30 6 40 14 6 14-6 22-18 24H32c-14-2-24-12-14-28z" fill="#f7f4ee" stroke="#1c1915" strokeWidth="3" />
        <path d="M30 76h156c4 12-2 18-14 20H42c-12-2-18-8-12-20z" fill="#d9a06a" />
      </g>
    </Sheet>
  )
}

function Blazer({ title }: { title: string }) {
  return (
    <Sheet bg="#eceae6" title={title}>
      <path d="M158 46c6 10 8 16 2 24" fill="none" stroke="#8a8680" strokeWidth="3" strokeLinecap="round" />
      <path d="M92 118h136" stroke="#8a8680" strokeWidth="4" />
      <path d="M78 124c20-34 36-44 82-44s62 10 82 44l16 150-34 18-16-78-16 92H124l-16-92-16 78-34-18z" fill="#2a2927" />
      <path d="M124 96c10 28 16 46 12 78 10-24 14-40 24-78-12 10-24 14-36 14z" fill="#eceae6" />
      <path d="M196 96c-10 28-16 46-12 78-10-24-14-40-24-78 12 10 24 14 36 14z" fill="#d9d6d0" />
      <path d="M154 168h12v70h-12z" fill="#1a1918" />
      <circle cx="160" cy="186" r="2.4" fill="#c2b8a2" />
      <circle cx="160" cy="210" r="2.4" fill="#c2b8a2" />
      <path d="M118 250h84" stroke="#111" strokeWidth="8" opacity="0.35" />
    </Sheet>
  )
}

function Dress({ title }: { title: string }) {
  return (
    <Sheet bg="#f7f1ea" title={title}>
      <path d="M118 86c8-16 18-24 42-24s34 8 42 24l14 28-24 10-8-16-8 150 28 78H116l28-78-8-150-8 16-24-10z" fill="#f4e7dc" />
      <path d="M136 92c6 8 12 12 24 12s18-4 24-12" fill="none" stroke="#e2b5a4" strokeWidth="5" />
      <circle cx="132" cy="168" r="7" fill="#d98472" />
      <circle cx="168" cy="196" r="5" fill="#c46b5e" />
      <circle cx="150" cy="230" r="8" fill="#e7a090" />
      <circle cx="186" cy="246" r="4" fill="#d98472" />
      <circle cx="138" cy="268" r="6" fill="#c46b5e" />
      <circle cx="176" cy="292" r="7" fill="#e7a090" />
      <path d="M150 78c8 6 12 6 20 0" fill="none" stroke="#e2b5a4" strokeWidth="3" />
    </Sheet>
  )
}

function Hoodie({ title }: { title: string }) {
  return (
    <Sheet bg="#ececee" title={title}>
      <path d="M116 118c0-28 18-46 44-46s44 18 44 46c18 8 28 20 28 36l-16 18-18-16v132H122V156l-18 16-16-18c0-16 10-28 28-36z" fill="#c5c6cb" />
      <path d="M124 124c8 22 16 28 36 28s28-6 36-28c-8 10-20 16-36 16s-28-6-36-16z" fill="#ececee" />
      <path d="M122 214h76v46c0 16-14 24-38 24s-38-8-38-24z" fill="#b0b2b8" />
      <path d="M146 228h28" stroke="#8d9098" strokeWidth="4" strokeLinecap="round" />
      <path d="M108 164c-10 18-8 40 4 52M212 164c10 18 8 40-4 52" fill="none" stroke="#b7b9bf" strokeWidth="10" strokeLinecap="round" />
    </Sheet>
  )
}
