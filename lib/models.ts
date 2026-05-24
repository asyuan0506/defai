export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  inputPricePerToken: number;       // USD per token
  outputPricePerToken: number;      // USD per token
  supportsImages: boolean;
}

// Prices and capabilities sourced from io.net /v1/models API (2026-05-23).
// Update when io.net adds/removes models or changes pricing.
//
// Billing uses a fixed 1M-input + 1M-output ceiling per request as the
// pre-deduct (see app/api/chat/route.ts); the actual charge is computed from
// io.net's reported usage in the final SSE chunk (stream_options.include_usage).
// No client-side token estimation.
export const MODEL_CATALOG: Record<string, ModelInfo> = {
  // ── OpenAI ─────────────────────────────────────────────────────────
  "openai/gpt-oss-20b": {
    id: "openai/gpt-oss-20b",
    name: "OpenAI: gpt-oss-20b",
    contextWindow: 64000,
    inputPricePerToken: 7.3e-8,
    outputPricePerToken: 2.5e-7,
    supportsImages: false,
  },
  "openai/gpt-oss-120b": {
    id: "openai/gpt-oss-120b",
    name: "OpenAI: gpt-oss-120b",
    contextWindow: 131072,
    inputPricePerToken: 1.82e-7,
    outputPricePerToken: 7.9e-7,
    supportsImages: false,
  },

  // ── DeepSeek ───────────────────────────────────────────────────────
  "deepseek-ai/DeepSeek-V4-Flash": {
    id: "deepseek-ai/DeepSeek-V4-Flash",
    name: "DeepSeek: V4 Flash",
    contextWindow: 1048576,
    inputPricePerToken: 1.46e-7,
    outputPricePerToken: 2.94e-7,
    supportsImages: false,
  },
  "deepseek-ai/DeepSeek-V4-Pro": {
    id: "deepseek-ai/DeepSeek-V4-Pro",
    name: "DeepSeek: V4 Pro",
    contextWindow: 1048576,
    inputPricePerToken: 1.778e-6,
    outputPricePerToken: 3.6832e-6,
    supportsImages: false,
  },
  "deepseek-ai/DeepSeek-V3.2": {
    id: "deepseek-ai/DeepSeek-V3.2",
    name: "DeepSeek: V3.2",
    contextWindow: 163840,
    inputPricePerToken: 9.399e-7,
    outputPricePerToken: 1.8383e-6,
    supportsImages: false,
  },
  "deepseek-ai/DeepSeek-R1-0528": {
    id: "deepseek-ai/DeepSeek-R1-0528",
    name: "DeepSeek: R1 0528",
    contextWindow: 128000,
    inputPricePerToken: 5.625e-7,
    outputPricePerToken: 2.245e-6,
    supportsImages: false,
  },

  // ── Qwen ───────────────────────────────────────────────────────────
  "Qwen/Qwen3.6-35B-A3B": {
    id: "Qwen/Qwen3.6-35B-A3B",
    name: "Qwen: Qwen3.6 35B A3B",
    contextWindow: 262140,
    inputPricePerToken: 1.8624e-7,
    outputPricePerToken: 1.20305e-6,
    supportsImages: false,
  },
  "Qwen/Qwen3.6-27B": {
    id: "Qwen/Qwen3.6-27B",
    name: "Qwen: Qwen3.6 27B",
    contextWindow: 262140,
    inputPricePerToken: 4.376e-7,
    outputPricePerToken: 3.02e-6,
    supportsImages: false,
  },
  "Qwen/Qwen3-Next-80B-A3B-Instruct": {
    id: "Qwen/Qwen3-Next-80B-A3B-Instruct",
    name: "Qwen: Qwen3 Next 80B A3B Instruct",
    contextWindow: 262144,
    inputPricePerToken: 1.175e-7,
    outputPricePerToken: 1.136e-6,
    supportsImages: false,
  },
  "Intel/Qwen3-Coder-480B-A35B-Instruct-int4-mixed-ar": {
    id: "Intel/Qwen3-Coder-480B-A35B-Instruct-int4-mixed-ar",
    name: "Intel: Qwen3 Coder 480B A35B (INT4 Mixed AR)",
    contextWindow: 106000,
    inputPricePerToken: 8.55e-7,
    outputPricePerToken: 2.695e-6,
    supportsImages: false,
  },

  // ── MoonshotAI ─────────────────────────────────────────────────────
  "moonshotai/Kimi-K2.6": {
    id: "moonshotai/Kimi-K2.6",
    name: "MoonshotAI: Kimi K2.6",
    contextWindow: 262142,
    inputPricePerToken: 9.94e-7,
    outputPricePerToken: 4.12e-6,
    supportsImages: true,
  },
  "moonshotai/Kimi-K2.5": {
    id: "moonshotai/Kimi-K2.5",
    name: "MoonshotAI: Kimi K2.5",
    contextWindow: 262144,
    inputPricePerToken: 5.22e-7,
    outputPricePerToken: 2.69e-6,
    supportsImages: true,
  },
  "moonshotai/Kimi-K2-Thinking": {
    id: "moonshotai/Kimi-K2-Thinking",
    name: "MoonshotAI: Kimi K2 Thinking",
    contextWindow: 262144,
    inputPricePerToken: 6e-7,
    outputPricePerToken: 2.5e-6,
    supportsImages: false,
  },
  "moonshotai/Kimi-K2-Instruct-0905": {
    id: "moonshotai/Kimi-K2-Instruct-0905",
    name: "MoonshotAI: Kimi K2 Instruct 0905",
    contextWindow: 262144,
    inputPricePerToken: 5.7e-7,
    outputPricePerToken: 2.3e-6,
    supportsImages: false,
  },

  // ── MiniMax ────────────────────────────────────────────────────────
  "MiniMaxAI/MiniMax-M2.7": {
    id: "MiniMaxAI/MiniMax-M2.7",
    name: "MiniMax: M2.7",
    contextWindow: 204800,
    inputPricePerToken: 4.158e-7,
    outputPricePerToken: 1.68e-6,
    supportsImages: false,
  },
  "MiniMaxAI/MiniMax-M2.5": {
    id: "MiniMaxAI/MiniMax-M2.5",
    name: "MiniMax: M2.5",
    contextWindow: 196600,
    inputPricePerToken: 3e-7,
    outputPricePerToken: 1.2e-6,
    supportsImages: false,
  },

  // ── Z.ai (GLM) ─────────────────────────────────────────────────────
  "zai-org/GLM-5.1": {
    id: "zai-org/GLM-5.1",
    name: "Z.ai: GLM 5.1",
    contextWindow: 202750,
    inputPricePerToken: 1.31e-6,
    outputPricePerToken: 4.2e-6,
    supportsImages: false,
  },
  "zai-org/GLM-5": {
    id: "zai-org/GLM-5",
    name: "Z.ai: GLM 5",
    contextWindow: 202752,
    inputPricePerToken: 9.2e-7,
    outputPricePerToken: 2.976e-6,
    supportsImages: false,
  },
  "zai-org/GLM-4.7": {
    id: "zai-org/GLM-4.7",
    name: "Z.ai: GLM 4.7",
    contextWindow: 202752,
    inputPricePerToken: 8.9e-7,
    outputPricePerToken: 2.4e-6,
    supportsImages: false,
  },
  "zai-org/GLM-4.7-Flash": {
    id: "zai-org/GLM-4.7-Flash",
    name: "Z.ai: GLM 4.7 Flash",
    contextWindow: 200000,
    inputPricePerToken: 7.2625e-8,
    outputPricePerToken: 4.075e-7,
    supportsImages: false,
  },
  "zai-org/GLM-4.6": {
    id: "zai-org/GLM-4.6",
    name: "Z.ai: GLM 4.6",
    contextWindow: 131072,
    inputPricePerToken: 8.5e-7,
    outputPricePerToken: 2.75e-6,
    supportsImages: false,
  },

  // ── Meta Llama ─────────────────────────────────────────────────────
  "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": {
    id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    name: "Meta-Llama: Llama 4 Maverick 17B 128E FP8",
    contextWindow: 430000,
    inputPricePerToken: 3.5e-7,
    outputPricePerToken: 1.0625e-6,
    supportsImages: true,
  },
  "meta-llama/Llama-3.3-70B-Instruct": {
    id: "meta-llama/Llama-3.3-70B-Instruct",
    name: "Meta: Llama 3.3 70B Instruct",
    contextWindow: 128000,
    inputPricePerToken: 6.066e-7,
    outputPricePerToken: 1.0386e-6,
    supportsImages: false,
  },
  "meta-llama/Llama-3.2-90B-Vision-Instruct": {
    id: "meta-llama/Llama-3.2-90B-Vision-Instruct",
    name: "Meta-Llama: Llama 3.2 90B Vision Instruct",
    contextWindow: 16000,
    inputPricePerToken: 2.45e-7,
    outputPricePerToken: 2.45e-7,
    supportsImages: true,
  },

  // ── Mistral ────────────────────────────────────────────────────────
  "mistralai/Mistral-Nemo-Instruct-2407": {
    id: "mistralai/Mistral-Nemo-Instruct-2407",
    name: "Mistral: Mistral Nemo Instruct 2407",
    contextWindow: 128000,
    inputPricePerToken: 5.75e-8,
    outputPricePerToken: 9.75e-8,
    supportsImages: false,
  },
  "mistralai/Mistral-Large-Instruct-2411": {
    id: "mistralai/Mistral-Large-Instruct-2411",
    name: "Mistral: Mistral Large Instruct 2411",
    contextWindow: 128000,
    inputPricePerToken: 2e-6,
    outputPricePerToken: 6e-6,
    supportsImages: true,
  },

  // ── Google ─────────────────────────────────────────────────────────
  "google/gemma-4-26b-a4b-it": {
    id: "google/gemma-4-26b-a4b-it",
    name: "Google: Gemma 4 26B A4B IT",
    contextWindow: 262142,
    inputPricePerToken: 1.205e-7,
    outputPricePerToken: 4.28e-7,
    supportsImages: false,
  },

  // ── Baidu ──────────────────────────────────────────────────────────
  // Tier 1, currently free on io.net — keep the per-token fields at 0 so
  // pre-deduct rounds to 0 lamports.
  "baidu/cobuddy": {
    id: "baidu/cobuddy",
    name: "Baidu Qianfan: CoBuddy",
    contextWindow: 131100,
    inputPricePerToken: 0,
    outputPricePerToken: 0,
    supportsImages: false,
  },
};

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
