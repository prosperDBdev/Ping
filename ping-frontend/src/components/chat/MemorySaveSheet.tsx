"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@/components/common/Sheet";
import useMemoryStore from "@/store/memoryStore";
import { MemoryCategory } from "@/types";
import { CATEGORY_META, MEMORY_CATEGORIES } from "@/lib/memoryMeta";

interface MemorySaveSheetProps {
  open: boolean;
  onClose: () => void;
  messageId: string;
  messageSnippet: string;
}

export default function MemorySaveSheet({ open, onClose, messageId, messageSnippet }: MemorySaveSheetProps) {
  const { saveMemory } = useMemoryStore();
  const [category, setCategory] = useState<MemoryCategory>("IMPORTANT");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMemory(messageId, category);
      toast.success("Saved to Memory");
      onClose();
    } catch {
      toast.error("Couldn't save that memory — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="🧠 Save to Memory"
      title="What kind of memory is this?"
      widthClass="sm:max-w-sm"
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl bg-ping-dark dark:bg-ping-orange text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-ping-sage dark:bg-ping-night-sage border border-ping-sage-border dark:border-ping-night-border px-3.5 py-2.5 text-xs text-ping-dark/80 dark:text-ping-night-text/80 italic">
          &ldquo;{messageSnippet}&rdquo;
        </div>

        <div className="grid grid-cols-2 gap-2">
          {MEMORY_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  active
                    ? `${meta.bg} ${meta.text} border-transparent`
                    : "border-ping-sand dark:border-ping-night-border text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
                }`}
              >
                <span>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
