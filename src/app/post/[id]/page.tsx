import { Suspense } from "react";
import { PostDetail } from "@/components/post-detail";
import { SEED } from "@/lib/seed";

export function generateStaticParams() {
  return SEED.map((post) => ({ id: post.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = SEED.find((item) => item.id === id);
  return { title: post?.title ?? "一条纠结" };
}

export default function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16">
          <p className="font-serif text-2xl">正在打开这件东西</p>
        </div>
      }
    >
      {params.then(({ id }) => (
        <PostDetail id={id} />
      ))}
    </Suspense>
  );
}
