"use client";

import { useRouter } from "next/navigation";
import PingLogo from "@/components/common/PingLogo";
import useAuthStore from "@/store/authStore";
import InstallAppButton from "@/components/pwa/InstallAppButton";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

/**
 * The feature list, written from what is actually shipped.
 *
 * Kept as data rather than six near-identical JSX blocks so that adding a
 * feature is one line, and so the copy can be read in one place next to the
 * claims it makes. Everything here has working code behind it — a landing page
 * that promises something the app doesn't do is the fastest way to lose the
 * one visitor who tries it.
 */
const BUILT_FEATURES = [
  {
    title: "Real-time messaging",
    body: "Private and group chats over a live connection. Read receipts, unread counts, and who's online — no refreshing.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    title: "Voice notes",
    body: "Hold to record, release to send. For the things that are quicker said than typed.",
    icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0-4a3 3 0 01-3-3V5a3 3 0 116 0v10a3 3 0 01-3 3z",
  },
  {
    title: "Photos, handled safely",
    body: "Every image is checked by its actual content and re-encoded before it's stored, so what reaches the other person is pixels and nothing else.",
    icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  },
  {
    title: "Temporary chats",
    body: "Both people have to agree, then the conversation runs on a clock. When it ends, the messages and the files are actually deleted.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "24-hour status",
    body: "Post a thought or a photo that disappears tomorrow. You choose who sees it, and whether anyone can pass it on.",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  },
  {
    title: "Your room, your rules",
    body: "Block someone and it cuts both ways. Clear a conversation and it clears for you alone — including the files.",
    icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);


  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f7f4ec] text-[#1b2f35]">
      <Toaster position="top-center" />
      <div className="mx-auto min-h-screen max-w-[1440px] bg-[#f7f4ec]">
        {/* Header */}
        <header className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-6 lg:px-10">
          <PingLogo />
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push("/auth/login")}
              className="text-xs font-semibold text-[#546268] transition hover:text-[#1b2f35]"
            >
              I already have a space
            </button>
            <button
              onClick={() => router.push("/auth/login")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1b2f35] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1b2f35]/90 shadow-sm"
            >
              Sign in
              <span aria-hidden="true" className="text-sm leading-none">
                ›
              </span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-[1280px] px-6 pb-16 pt-4 lg:px-10 lg:pt-8">
          {/* Hero Section */}
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Hero Text Left */}
            <section className="lg:col-span-6">
              {/* Green Pill Badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#dcece6] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#226b5d]">
                <span className="h-2 w-2 rounded-full bg-[#2a8f7b]" />
                <span>A PLACE FOR THE PEOPLE YOU MEAN IT WITH</span>
              </div>

              {/* Headline - Preserved per instructions: Say it. Mean it. Ping back. */}
              <h1 className="max-w-[620px] text-[3.8rem] font-black leading-[0.9] tracking-[-0.06em] text-[#1b2f35] sm:text-[5rem] lg:text-[7rem]">
                <span className="block">Say it.</span>
                <span className="block text-[#e86c47]">Mean it.</span>
                <span className="block">Ping back.</span>
              </h1>

              {/* Description */}
              <p className="mt-6 max-w-[480px] text-base leading-relaxed text-[#505e64]">
                Ping is the little room between &ldquo;we should catch up&rdquo; and actually doing it.
                Choose a person, send something real, and let the rest stay quiet.
              </p>

              {/* CTA Row */}
              <div className="mt-8 flex items-center">
                <button
                  onClick={() => router.push("/auth/register")}
                  className="inline-flex items-center gap-2 rounded-full bg-[#e0684b] px-6 py-3.5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(224,104,75,0.25)] transition hover:bg-[#d2593d]"
                >
                  Find your first circle
                  <span aria-hidden="true">→</span>
                </button>
                <span className="ml-5 text-xs font-semibold text-[#738086]">
                  No feed. No noise.
                </span>
              </div>
            </section>

            {/* Hero Mockup Right */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[560px] rounded-[32px] bg-[#ebe3d7] p-3.5 border border-[#dfd5c7] shadow-[0_16px_36px_rgba(27,47,53,0.08)]">
                {/* Floating Badge Top Left */}
                <div className="absolute -top-3.5 left-6 z-20 flex -rotate-3 items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#1b2f35] border border-[#e5ded4] shadow-md">
                  <svg className="h-3.5 w-3.5 text-[#e0684b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Keep it close
                </div>

                {/* Inner Mock UI Container */}
                <div className="rounded-[26px] bg-[#f4efe8] p-4 text-[#1b2f35]">
                  {/* Top Bar inside Mock */}
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#7a888e]">
                        YOUR CIRCLE
                      </p>
                      <p className="text-xs font-bold text-[#1b2f35]">
                        Who would you love to hear from?
                      </p>
                    </div>
                    <button className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ebe4da] text-xs font-bold text-[#5c696e]">
                      •••
                    </button>
                  </div>

                  {/* Two column grid inside mockup */}
                  <div className="grid grid-cols-12 gap-3">
                    {/* Left Column - Contact List */}
                    <div className="col-span-5 flex flex-col justify-between space-y-2">
                      {/* Active Contact - Maya Chen */}
                      <div className="flex items-center justify-between rounded-xl bg-white/80 p-2 border border-[#e2d8cd] shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e0684b] text-[10px] font-bold text-white">
                            MC
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-tight">Maya Chen</p>
                            <p className="text-[9px] text-[#7a888e]">your Friday person</p>
                          </div>
                        </div>
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#e0684b] text-[10px] text-[#e0684b]">
                          ✓
                        </span>
                      </div>

                      {/* Contact - Jon Bell */}
                      <div className="flex items-center justify-between rounded-xl bg-[#ebe4da]/60 p-2 hover:bg-white/50 transition">
                        <div className="flex items-center gap-2">
                          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#7a739f] text-[10px] font-bold text-white">
                            JB
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#2a8f7b] border border-white" />
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-tight">Jon Bell</p>
                            <p className="text-[9px] text-[#7a888e]">the detail catcher</p>
                          </div>
                        </div>
                        <span className="text-xs text-[#9aa4a8]">›</span>
                      </div>

                      {/* Contact - Noor Haddad */}
                      <div className="flex items-center justify-between rounded-xl bg-[#ebe4da]/60 p-2 hover:bg-white/50 transition">
                        <div className="flex items-center gap-2">
                          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#468f85] text-[10px] font-bold text-white">
                            NH
                            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#f4ce62] border border-white" />
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-tight">Noor Haddad</p>
                            <p className="text-[9px] text-[#7a888e]">voice note regular</p>
                          </div>
                        </div>
                        <span className="text-xs text-[#9aa4a8]">›</span>
                      </div>

                      {/* Invite Option */}
                      <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#c7bbb0] p-2 text-xs font-semibold text-[#546268]">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e7ded3] text-xs font-bold text-[#546268]">
                          +
                        </div>
                        <span className="text-[10px] font-bold">Invite someone else</span>
                      </div>

                      {/* Tip Badge */}
                      <div className="mt-2 rounded-xl bg-[#dcece6] p-2.5 text-[10px] leading-snug text-[#1b5e54]">
                        <div className="mb-1 flex items-center gap-1 font-bold">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        Pick a person to see what a quieter inbox feels like.
                      </div>
                    </div>

                    {/* Right Column - Chat View */}
                    <div className="col-span-7 flex flex-col justify-between rounded-2xl bg-[#eae3d9]/70 p-3 border border-[#dfd5c7]">
                      {/* Chat Header */}
                      <div className="mb-3 flex items-center justify-between border-b border-[#d8cdbf] pb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e0684b] text-[9px] font-bold text-white">
                            MC
                          </div>
                          <div>
                            <p className="text-xs font-bold">Maya Chen</p>
                            <p className="text-[9px] font-medium text-[#2a8f7b]">online now</p>
                          </div>
                        </div>
                        <button className="text-xs text-[#89959a] hover:text-[#1b2f35]">✕</button>
                      </div>

                      {/* Messages Stack */}
                      <div className="space-y-2 text-xs">
                        <div className="mr-4 rounded-2xl rounded-tl-sm bg-[#f7f4ec] p-2.5 text-[11px] leading-relaxed text-[#2c3a3f]">
                          I found a little spot near the station for Thursday.
                        </div>
                        <div className="ml-4 rounded-2xl rounded-tr-sm bg-[#226b5d] p-2.5 text-[11px] leading-relaxed text-white">
                          I&apos;m glad you&apos;re here.
                        </div>
                        <div className="mr-4 rounded-2xl rounded-tl-sm bg-[#f7f4ec] p-2.5 text-[11px] leading-relaxed text-[#2c3a3f]">
                          The window seat is ours.
                        </div>
                      </div>

                      {/* Input Bar */}
                      <div className="mt-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm border border-[#e0d6c9]">
                        <input
                          type="text"
                          readOnly
                          placeholder="Write to Maya.."
                          className="w-full bg-transparent text-[11px] text-[#546268] outline-none cursor-default"
                        />
                        <button className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e0684b] text-white">
                          <svg className="h-3 w-3 translate-x-[0.5px]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Badge Bottom Right */}
                <div className="absolute -bottom-3.5 right-4 z-20 rotate-2 rounded-2xl bg-[#f4ce62] px-4 py-2 text-xs font-bold text-[#1b2f35] shadow-md border border-[#e5c252]">
                  A small ping goes a long way.
                </div>
              </div>
            </div>
          </div>

          {/* Lower Section */}
          <div className="mt-24 border-t border-[#dfd5c7] pt-12">
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#226b5d]">
                THE POINT OF THE ROOM
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#1b2f35] sm:text-3xl lg:text-4xl">
                Less &ldquo;keeping up.&rdquo; More &ldquo;good to hear from you.&rdquo;
              </h2>
            </div>

            {/* 3 Feature Cards */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Card 1 */}
              <article className="rounded-3xl bg-[#ece4d8] p-6 border border-[#e0d5c6]">
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4efe8] text-[#e0684b]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="mb-1 text-base font-bold text-[#1b2f35]">Small circles</h3>
                <p className="text-xs leading-relaxed text-[#5c696e]">
                  Keep the room human-sized.
                </p>
              </article>

              {/* Card 2 */}
              <article className="rounded-3xl bg-[#ece4d8] p-6 border border-[#e0d5c6]">
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4efe8] text-[#e0684b]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mb-1 text-base font-bold text-[#1b2f35]">Good timing</h3>
                <p className="text-xs leading-relaxed text-[#5c696e]">
                  Presence without the pressure.
                </p>
              </article>

              {/* Card 3 */}
              <article className="rounded-3xl bg-[#ece4d8] p-6 border border-[#e0d5c6]">
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4efe8] text-[#e0684b]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="mb-1 text-base font-bold text-[#1b2f35]">Private by default</h3>
                <p className="text-xs leading-relaxed text-[#5c696e]">
                  Your people, your pace.
                </p>
              </article>
            </div>
          </div>

          {/* What's actually built — the concrete counterpart to the three cards
              above. Those carry the voice; this one carries the receipts. */}
          <section className="mt-24">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#226b5d] mb-2">
              What&apos;s inside
            </p>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#1b2f35] sm:text-3xl max-w-xl">
              Everything here works today.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#505e64]">
              No waitlist and no placeholder screens — sign in and all of this is there.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BUILT_FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-2xl bg-white/70 p-5 border border-[#e0d5c6]"
                >
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4efe8] text-[#e0684b]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="mb-1 text-sm font-bold text-[#1b2f35]">{feature.title}</h3>
                  <p className="text-xs leading-relaxed text-[#5c696e]">{feature.body}</p>
                </article>
              ))}
            </div>
          </section>

          {/* How it works: Chat → Tasks → Events → Files → Workspace */}
          <div id="how-it-works" className="mt-24 border-t border-[#dfd5c7] pt-12 scroll-mt-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#226b5d]">
                MORE THAN MESSAGES
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#1b2f35] sm:text-3xl lg:text-4xl">
                Turn conversations into action.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#505e64]">
                A message doesn&apos;t have to disappear the moment it&apos;s read. Ping quietly
                turns the useful parts of a conversation — a deadline, a meeting, a decision —
                into something you can actually act on, without ever leaving the chat.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  label: "Chat",
                  desc: "Say what you mean, in real time.",
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  ),
                },
                {
                  label: "Tasks",
                  desc: "“Fix the bug by Friday” becomes a task.",
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ),
                },
                {
                  label: "Events",
                  desc: "“Meeting at 3pm” becomes a real event.",
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  ),
                },
                {
                  label: "Files",
                  desc: "Everything shared stays easy to find.",
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  ),
                },
                {
                  label: "Workspace",
                  desc: "The whole conversation, organized.",
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  ),
                },
              ].map((step, i) => (
                <div key={step.label} className="relative">
                  <div className="rounded-3xl bg-[#ece4d8] p-5 border border-[#e0d5c6] h-full">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1b2f35] text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4efe8] text-[#e0684b]">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {step.icon}
                        </svg>
                      </div>
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-[#1b2f35]">{step.label}</h3>
                    <p className="text-xs leading-relaxed text-[#5c696e]">{step.desc}</p>
                  </div>
                  {i < 4 && (
                    <span
                      aria-hidden="true"
                      className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center text-[#c7bbb0]"
                    >
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Workspace demonstration / product preview */}
          <div className="mt-24 border-t border-[#dfd5c7] pt-12">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#226b5d]">
                  A WORKSPACE FOR EVERY CONVERSATION
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#1b2f35] sm:text-3xl">
                  Every conversation, one tap from organized.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[#505e64]">
                  Switch between Messages, Tasks, Files, Events and Pinned without ever leaving
                  the thread. Nothing important gets buried in the scroll again.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-[#3a474c]">
                  {[
                    "Turn any message into a task, event, or reminder",
                    "Pin decisions so they're never lost",
                    "See who's assigned, what's due, and what's done",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2a8f7b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-[28px] bg-[#ebe3d7] p-3 border border-[#dfd5c7] shadow-[0_16px_36px_rgba(27,47,53,0.08)]">
                  <div className="rounded-[22px] bg-[#f4efe8] p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between px-1 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-400 text-[10px] font-bold text-white">
                          AJ
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1b2f35]">Alex Johnson</p>
                          <p className="text-[10px] font-medium text-[#2a8f7b]">Online</p>
                        </div>
                      </div>
                    </div>
                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-[#e0d5c6] px-1 pb-2 text-[10px] font-bold">
                      <span className="rounded-full bg-white px-3 py-1.5 text-[#1b2f35] shadow-sm">Messages</span>
                      <span className="px-3 py-1.5 text-[#e0684b]">Tasks · 2</span>
                      <span className="hidden sm:inline px-3 py-1.5 text-[#7a888e]">Files</span>
                      <span className="hidden sm:inline px-3 py-1.5 text-[#7a888e]">Events · 1</span>
                    </div>
                    {/* Content: a message becoming a task */}
                    <div className="space-y-2.5 px-1 pt-3">
                      <div className="mr-10 rounded-2xl rounded-tl-sm bg-white p-3 text-[11px] leading-relaxed text-[#2c3a3f] shadow-sm">
                        Please fix the authentication bug before Friday.
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#dcece6] px-2.5 py-1 text-[10px] font-bold text-[#226b5d]">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Create task
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#f4d063]/25 border border-[#f4d063]/50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] font-bold text-[#1b2f35]">Fix authentication bug</p>
                          <span className="rounded-full bg-[#e0684b]/10 px-2 py-0.5 text-[9px] font-bold text-[#e0684b]">High</span>
                        </div>
                        <p className="text-[10px] text-[#7a888e]">Due Friday · Assigned to Alex</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Temporary conversations */}
          <div className="mt-24 border-t border-[#dfd5c7] pt-12">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7 order-2 lg:order-1">
                <div className="rounded-3xl bg-[#1b2f35] p-6 sm:p-8 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Temporary conversation
                  </div>
                  <p className="mt-4 text-lg font-bold">With Priya Nair</p>
                  <p className="mt-1 text-sm text-white/60">Expires in 21h 43m</p>
                  <div className="mt-5 h-px bg-white/10" />
                  <p className="mt-5 text-xs leading-relaxed text-white/50">
                    Once it expires, it&apos;s marked expired and cleared from the inbox. Nothing
                    lingers longer than it needs to.
                  </p>
                </div>
              </div>
              <div className="lg:col-span-5 order-1 lg:order-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#226b5d]">
                  HERE FOR NOW, NOT FOREVER
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#1b2f35] sm:text-3xl">
                  Some conversations should just be for now.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[#505e64]">
                  Spin up a conversation that expires on its own — in an hour, a day, a week, or
                  whatever you choose. Perfect for a quick coordination thread that doesn&apos;t
                  need to live in your inbox forever. Every temporary conversation asks you to
                  confirm before it&apos;s created, and shows its countdown the whole way through.
                </p>
              </div>
            </div>
          </div>

          {/* CTA + Download App */}
          <div className="mt-24 border-t border-[#dfd5c7] pt-12 pb-4">
            <div className="rounded-3xl bg-[#ece4d8] border border-[#e0d5c6] p-8 sm:p-12 text-center">
              <h2 className="text-2xl font-black text-[#1b2f35] sm:text-3xl max-w-lg mx-auto">
                Bring your people. Bring the work. One quiet room for both.
              </h2>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => router.push("/auth/register")}
                  className="inline-flex items-center gap-2 rounded-full bg-[#e0684b] px-6 py-3.5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(224,104,75,0.25)] transition hover:bg-[#d2593d]"
                >
                  Find your first circle
                  <span aria-hidden="true">→</span>
                </button>
                <InstallAppButton />
              </div>
              <p className="mt-3 text-xs text-[#738086]">
                Installs straight from your browser — no App Store, no Play Store, no download.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mx-auto flex max-w-[1280px] flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#dfd5c7] px-6 py-6 text-xs text-[#738086] lg:px-10">
          <p>Built for messages worth opening.</p>
          <div className="flex items-center gap-6">
            <button onClick={scrollToHowItWorks} className="hover:text-[#1b2f35]">
              How it works
            </button>
            <InstallAppButton variant="ghost" />
            <button
              onClick={() => router.push("/auth/register")}
              className="font-semibold text-[#1b2f35] hover:text-[#e0684b]"
            >
              Create your space →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}