import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MODEL_CATALOG, DEFAULT_MODEL } from "@/lib/models";

interface ModelState {
  /** Sticky preference: new conversations default to this. Per-conversation
   *  model is the source of truth once a conversation exists; this only seeds it. */
  lastUsedModelId: string;
  setLastUsedModel: (id: string) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      lastUsedModelId: DEFAULT_MODEL,
      setLastUsedModel: (id) => {
        if (!MODEL_CATALOG[id]) return;
        set({ lastUsedModelId: id });
      },
    }),
    {
      name: "defai-model",
      // If a previously-selected model was removed from the catalog, fall back
      // rather than letting the UI render an unknown ID.
      onRehydrateStorage: () => (state) => {
        if (state && !MODEL_CATALOG[state.lastUsedModelId]) {
          state.lastUsedModelId = DEFAULT_MODEL;
        }
      },
    }
  )
);
