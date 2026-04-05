"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function ChatInput({ onSend, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-[#1E3A5F]/60 bg-[#172035] px-4 py-3 transition-all duration-200 focus-within:border-violet-500/40 focus-within:bg-[#1a2540]">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="輸入訊息… (Enter 送出，Shift+Enter 換行)"
        rows={1}
        disabled={disabled}
        className={cn(
          "flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm text-slate-200 min-h-[24px] max-h-[200px]",
          "placeholder:text-slate-600"
        )}
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled || isStreaming}
        aria-label="送出訊息"
        className={cn(
          "shrink-0 flex items-center justify-center rounded-xl h-9 w-9 transition-all duration-200 cursor-pointer",
          value.trim() && !disabled && !isStreaming
            ? "bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]"
            : "bg-slate-800 text-slate-600 cursor-not-allowed"
        )}
      >
        {isStreaming ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SendHorizonal className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
