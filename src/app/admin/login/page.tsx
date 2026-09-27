import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      {/* Quiet version of the landing page's aurora */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-aqua-400 opacity-30 blur-[100px]" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-lilac-500 opacity-30 blur-[100px]" />
        <div className="absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-blush-400 opacity-20 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/suloai-mark.png" alt="" width={226} height={240} className="h-12 w-auto" priority />
          <h1 className="mt-4 font-display text-[1.5rem] font-bold text-ink-900">
            SULO<span className="text-gradient">AI</span> Admin
          </h1>
          <p className="mt-1 text-[0.85rem] text-ink-500">Sign in to manage leads, billing and projects.</p>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_24px_60px_-28px_rgb(7_38_60_/_0.35)] backdrop-blur-xl">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-400">
          Restricted area · authorised staff only
        </p>
      </div>
    </main>
  );
}
