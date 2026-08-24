"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗",
      "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝",
      "🤑", "🤗", "🤭", "🫢", "🤫", "🤔", "🫡", "🤐",
      "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬",
      "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒",
      "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯",
      "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟",
    ],
  },
  {
    name: "Gestures",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳",
      "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️",
      "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏",
      "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾",
    ],
  },
  {
    name: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗",
      "💖", "💘", "💝", "💟", "♥️", "💋", "🫂", "👩‍❤️‍👨",
      "👩‍❤️‍👩", "👨‍❤️‍👨", "💑", "💏", "🥰", "😍", "😘", "😻",
    ],
  },
  {
    name: "Animals",
    icon: "🐶",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
      "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤",
      "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗",
      "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞",
    ],
  },
  {
    name: "Food",
    icon: "🍔",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓",
      "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝",
      "🍅", "🥑", "🍕", "🍔", "🍟", "🌭", "🍿", "🧂",
      "🥓", "🥚", "🍳", "🥞", "🧇", "🥩", "🍗", "🍖",
      "☕", "🍵", "🧃", "🥤", "🍺", "🍷", "🥂", "🧊",
    ],
  },
  {
    name: "Activities",
    icon: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉",
      "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🥊", "🥋",
      "🎯", "⛳", "🪃", "🏹", "🎣", "🤿", "🎮", "🎲",
      "🧩", "🎭", "🎨", "🎤", "🎧", "🎼", "🎹", "🥁",
      "🎸", "🎺", "🎻", "🏆", "🥇", "🥈", "🥉", "🏅",
    ],
  },
  {
    name: "Objects",
    icon: "💡",
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "💾",
      "💿", "📷", "📹", "🎥", "📽️", "📺", "📻", "🎙️",
      "💡", "🔦", "🕯️", "📷", "🔮", "🧿", "🪬", "🎮",
      "🕹️", "🎰", "🔑", "🗝️", "🚪", "📦", "📫", "📮",
      "✏️", "✒️", "🖊️", "🖋️", "📝", "📁", "📂", "📅",
    ],
  },
  {
    name: "Symbols",
    icon: "💯",
    emojis: [
      "💯", "🔥", "✨", "🌟", "💫", "⚡", "💥", "🎉",
      "🎊", "🎈", "🎁", "🎀", "🏆", "🏅", "⭐", "✅",
      "❌", "⚠️", "🚫", "🔴", "🟠", "🟡", "🟢", "🔵",
      "🟣", "⚫", "⚪", "♻️", "🔰", "⚜️", "🔱", "📛",
      "💤", "💬", "💭", "🗯️", "♠️", "♣️", "♥️", "♦️",
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    const q = search.toLowerCase();
    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((e) => e.includes(q)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-80 bg-(--color-surface) rounded-xl shadow-2xl border border-(--color-border) overflow-hidden z-50"
      style={{ maxHeight: "360px" }}
    >
      {/* Search */}
      <div className="p-2 border-b border-(--color-border)">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-(--color-background) border border-(--color-border) rounded-lg outline-none focus:border-(--color-primary)"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 text-(--color-text-muted) hover:text-(--color-text-primary)"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex border-b border-(--color-border) px-1 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(i)}
              className={cn(
                "flex-shrink-0 px-2 py-2 text-lg transition-colors rounded",
                activeCategory === i
                  ? "bg-(--color-elevated)"
                  : "hover:bg-(--color-elevated)/50"
              )}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="overflow-y-auto p-2" style={{ maxHeight: "240px" }}>
        {filteredCategories.map((cat, catIdx) => (
          <div key={cat.name}>
            <p className="text-[11px] font-semibold text-(--color-text-muted) uppercase tracking-wider mb-1 px-1">
              {cat.name}
            </p>
            <div className="grid grid-cols-9 gap-0.5 mb-2">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-(--color-elevated) rounded transition-colors cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
        {filteredCategories.length === 0 && (
          <p className="text-center text-(--color-text-muted) text-sm py-8">
            No emoji found
          </p>
        )}
      </div>
    </div>
  );
}
