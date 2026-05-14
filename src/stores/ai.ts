import { create } from "zustand";
import type {
  AIProviderConfig,
  AIStatus,
  OperationType,
  DiffResult,
} from "../types/ai";
import { encrypt, decrypt } from "../services/crypto";
import { useEditorStore } from "./editor";

interface AIStore {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  status: AIStatus;
  operation: OperationType;
  instruction: string;
  selectedText: string;
  streamedText: string;
  diffResult: DiffResult | null;

  addProvider: (config: Omit<AIProviderConfig, "id">) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  updateProvider: (
    id: string,
    patch: Partial<AIProviderConfig>,
  ) => Promise<void>;
  setActiveProvider: (id: string) => void;
  setOperation: (op: OperationType) => void;
  setInstruction: (text: string) => void;
  setSelectedText: (text: string) => void;
  resetGeneration: () => void;
  appendStreamingToken: (token: string) => void;
  setDiffResult: (diff: DiffResult | null) => void;
  acceptDiff: () => void;
  rejectDiff: () => void;
}

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const STORAGE_KEY = "md-editor-ai-providers";

async function persistProviders(providers: AIProviderConfig[]) {
  try {
    const encoded = providers.map(async (p) => ({
      ...p,
      apiKey: await encrypt(p.apiKey),
    }));
    const resolved = await Promise.all(encoded);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
  } catch {
    // localStorage unavailable
  }
}

async function loadProviders(): Promise<AIProviderConfig[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (AIProviderConfig & {
      apiKey: string;
    })[];
    const decoded = await Promise.all(
      parsed.map(async (p) => ({
        ...p,
        apiKey: await decrypt(p.apiKey),
      })),
    );
    return decoded.filter((p) => p.id && p.provider);
  } catch {
    return [];
  }
}

export const useAIStore = create<AIStore>()((set, get) => {
  loadProviders().then((providers) => {
    set({
      providers,
      activeProviderId: providers.length > 0 ? providers[0].id : null,
    });
  });

  return {
    providers: [],
    activeProviderId: null,
    status: "idle",
    operation: "rewrite",
    instruction: "",
    selectedText: "",
    streamedText: "",
    diffResult: null,

    addProvider: async (config) => {
      const id = generateId();
      const newProvider: AIProviderConfig = { id, ...config };
      const providers = [...get().providers, newProvider];
      set({
        providers,
        activeProviderId: get().activeProviderId ?? id,
      });
      await persistProviders(providers);
    },

    removeProvider: async (id) => {
      const providers = get().providers.filter((p) => p.id !== id);
      set({
        providers,
        activeProviderId:
          get().activeProviderId === id
            ? providers[0]?.id ?? null
            : get().activeProviderId,
      });
      await persistProviders(providers);
    },

    updateProvider: async (id, patch) => {
      const providers = get().providers.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      );
      set({ providers });
      await persistProviders(providers);
    },

    setActiveProvider: (id) => set({ activeProviderId: id }),

    setOperation: (op) => set({ operation: op }),
    setInstruction: (text) => set({ instruction: text }),
    setSelectedText: (text) => set({ selectedText: text }),

    resetGeneration: () =>
      set({
        status: "idle",
        streamedText: "",
        instruction: "",
        selectedText: "",
      }),

    appendStreamingToken: (token) => {
      if (get().status === "streaming") {
        set({ streamedText: get().streamedText + token });
      }
    },

    setDiffResult: (diff) =>
      set({
        diffResult: diff,
        status: diff ? "diff-review" : "idle",
      }),

    acceptDiff: () => {
      const diff = get().diffResult;
      if (!diff) return;
      useEditorStore.getState().setContent(diff.modified);
      set({
        diffResult: null,
        streamedText: "",
        instruction: "",
        status: "idle",
      });
    },

    rejectDiff: () =>
      set({
        diffResult: null,
        streamedText: "",
        status: "idle",
      }),
  };
});
