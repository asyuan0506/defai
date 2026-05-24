"use client";

import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MODEL_CATALOG, DEFAULT_MODEL, type ModelInfo } from "@/lib/models";
import { ChevronDown, Sparkles, Image as ImageIcon } from "lucide-react";

interface ModelPickerProps {
  modelId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  "openai": "OpenAI",
  "deepseek-ai": "DeepSeek",
  "Qwen": "Qwen",
  "Intel": "Intel",
  "moonshotai": "MoonshotAI",
  "MiniMaxAI": "MiniMax",
  "zai-org": "Z.ai",
  "meta-llama": "Meta Llama",
  "mistralai": "Mistral",
  "google": "Google",
  "baidu": "Baidu",
};

function formatPricePerMillion(perToken: number): string {
  const perMillion = perToken * 1_000_000;
  // Sub-dollar values keep 2 decimals (e.g. $0.02); >= $1 trims trailing zero.
  return perMillion >= 1 ? `$${perMillion.toFixed(2)}` : `$${perMillion.toFixed(2)}`;
}

export function ModelPicker({ modelId, onChange, disabled }: ModelPickerProps) {
  const active = MODEL_CATALOG[modelId] ?? MODEL_CATALOG[DEFAULT_MODEL];

  const grouped = useMemo(() => {
    const byProvider = new Map<string, ModelInfo[]>();
    for (const m of Object.values(MODEL_CATALOG)) {
      const provider = m.id.split("/")[0];
      const list = byProvider.get(provider) ?? [];
      list.push(m);
      byProvider.set(provider, list);
    }
    return Array.from(byProvider.entries());
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 rounded-full px-3 text-xs font-medium"
        >
          <Sparkles className="size-3 text-primary" />
          <span className="max-w-[180px] truncate">{active.name}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 max-h-[60vh] !min-w-72"
      >
        <DropdownMenuRadioGroup
          value={modelId}
          onValueChange={(id) => {
            if (id !== modelId) onChange(id);
          }}
        >
          {grouped.map(([provider, models], idx) => (
            <div key={provider}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>
                {PROVIDER_LABELS[provider] ?? provider}
              </DropdownMenuLabel>
              {models.map((m) => (
                <DropdownMenuRadioItem
                  key={m.id}
                  value={m.id}
                  className="flex-col items-start gap-0.5 py-1.5"
                >
                  <div className="flex w-full items-center gap-1.5">
                    <span className="truncate text-sm">{m.name}</span>
                    {m.supportsImages && (
                      <ImageIcon className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatPricePerMillion(m.inputPricePerToken)} in ·{" "}
                    {formatPricePerMillion(m.outputPricePerToken)} out / 1M
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
