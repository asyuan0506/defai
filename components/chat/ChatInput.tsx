"use client";

import { useState, useRef, KeyboardEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SendHorizonal } from "lucide-react";

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

  const canSend = !!value.trim() && !disabled && !isStreaming;

  return (
    <InputGroup className="rounded-2xl">
      <InputGroupTextarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="輸入訊息… (Enter 送出，Shift+Enter 換行)"
        rows={1}
        disabled={disabled}
        className="min-h-[44px] max-h-[200px] px-4 text-sm"
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="送出訊息"
        >
          {isStreaming ? <Spinner /> : <SendHorizonal />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
