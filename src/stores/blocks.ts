import { create } from 'zustand';
import type { Block, CursorState } from '../engine/types';

interface BlocksStore {
  blocks: Block[];
  activeBlockId: string | null;
  cursor: CursorState | null;

  setBlocks: (blocks: Block[]) => void;
  setActiveBlock: (id: string | null) => void;
  setCursor: (state: CursorState | null) => void;
}

export const useBlocksStore = create<BlocksStore>()((set) => ({
  blocks: [],
  activeBlockId: null,
  cursor: null,

  setBlocks: (blocks) => set({ blocks }),
  setActiveBlock: (id) => set({ activeBlockId: id }),
  setCursor: (cursor) => set({ cursor }),
}));
