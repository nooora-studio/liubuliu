import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { CommunityProvider } from "@/lib/community";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "留不留",
    template: "%s · 留不留",
  },
  description: "买了衣服不知道该不该留、搭得好不好看，发上来让大家帮你看一眼。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <CommunityProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </CommunityProvider>
      </body>
    </html>
  );
}
