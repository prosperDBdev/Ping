"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import useChatStore from "@/store/chatStore";
import useMemoryStore from "@/store/memoryStore";
import NavSidebar from "@/components/sidebar/NavSidebar";
import { CATEGORY_META, MEMORY_CATEGORIES } from "@/lib/memoryMeta";
import { MemoryCategory } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function MemoriesPage() {
  const router = useRouter();
  const { conversations, fetchConversations, setActiveConversation } = useChatStore();
  const {
    memories,
    isLoading,
    categoryFilter,
    searchQuery,
    fetchMemories,
    setCategoryFilter,
    setSearchQuery,
    deleteMemory,
  } = useMemoryStore();

  useEffect(() => {
    fetchConversations();
    fetchMemories();
    // Intentionally only on mount — setCategoryFilter/setSearchQuery already
    // trigger their own re-fetch when the user changes them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof memories>();
    for (const m of memories) {
      const key = formatDate(m.createdAt);
      map.set(key, [...(map.get(key) || []), m]);
    }
    return Array.from(map.entries());
  }, [memories]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      toast.success("Memory deleted");
    } catch {
      toast.error("Couldn't delete that memory — try again.");
    }
  };

  const goToConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) setActiveConversation(conv);
    router.push("/chat");
  };

  return (
    <div className="h-screen bg-ping-cream dark:bg-ping-night-bg flex overflow-hidden font-sans text-ping-dark dark:text-ping-night-text">
      <NavSidebar
        activeView="memories"
        onGoDashboard={() => router.push("/dashboard")}
        onGoMemories={() => {}}
        onGoStatus={() => router.push("/status")}
        onSelectConversations={() => router.push("/chat")}
        onNewChat={() => router.push("/chat?view=new-private")}
        onNewGroup={() => router.push("/chat?view=new-group")}
        onOpenSettings={() => router.push("/settings")}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b border-ping-sand/60 dark:border-ping-night-border flex-shrink-0">
          <button
            onClick={() => router.push("/dashboard")}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card transition flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-teal dark:text-ping-teal-light">
              🧠 Memories
            </p>
            <h1 className="text-lg font-black text-ping-dark dark:text-ping-night-text">
              Things you don&apos;t have to remember
            </h1>
          </div>
        </div>

        <div className="px-4 sm:px-8 pt-4 flex-shrink-0">
          <div className="relative mb-3">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ping-text-light dark:text-ping-night-text-light" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your memories..."
              className="w-full max-w-md pl-10 pr-4 py-2.5 bg-[#EFEAE2] dark:bg-ping-night-card border border-ping-sand/60 dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                categoryFilter === null
                  ? "bg-ping-dark dark:bg-ping-orange text-white"
                  : "bg-ping-cream-dark dark:bg-ping-night-card text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-sand/60"
              }`}
            >
              All
            </button>
            {MEMORY_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(active ? null : (cat as MemoryCategory))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    active ? `${meta.bg} ${meta.text}` : "bg-ping-cream-dark dark:bg-ping-night-card text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-sand/60"
                  }`}
                >
                  <span>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
            </div>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6 max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-ping-cream-dark dark:bg-ping-night-card flex items-center justify-center mb-4 text-2xl">
                🧠
              </div>
              <p className="text-ping-dark dark:text-ping-night-text font-bold text-sm mb-1">
                Nothing saved yet
              </p>
              <p className="text-ping-text-light dark:text-ping-night-text-light text-xs leading-relaxed">
                Use &ldquo;Save to Memory&rdquo; from any message&apos;s action menu to keep the important
                bits findable, separate from the scroll.
              </p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              {grouped.map(([date, items]) => (
                <div key={date}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-2.5">
                    {date}
                  </p>
                  <div className="space-y-2.5">
                    {items.map((memory) => {
                      const meta = CATEGORY_META[memory.category];
                      return (
                        <div
                          key={memory.id}
                          className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${meta.bg} ${meta.text}`}>
                              <span>{meta.emoji}</span>
                              {meta.label}
                            </span>
                            <button
                              onClick={() => handleDelete(memory.id)}
                              aria-label="Delete memory"
                              className="text-ping-text-light dark:text-ping-night-text-light hover:text-red-500 transition flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                          <button
                            onClick={() => goToConversation(memory.conversationId)}
                            className="mt-2.5 text-left text-sm text-ping-dark/80 dark:text-ping-night-text/80 leading-relaxed hover:text-ping-teal dark:hover:text-ping-teal-light transition"
                          >
                            &ldquo;{memory.content}&rdquo;
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
