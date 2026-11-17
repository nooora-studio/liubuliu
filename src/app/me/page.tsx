import type { Metadata } from "next";
import { MeScreen } from "@/components/me-screen";

export const metadata: Metadata = {
  title: "我的纠结",
};

export default function MePage() {
  return <MeScreen />;
}
