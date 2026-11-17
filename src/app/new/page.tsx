import type { Metadata } from "next";
import { Composer } from "@/components/composer";

export const metadata: Metadata = {
  title: "发一条纠结",
};

export default function NewPage() {
  return <Composer />;
}
