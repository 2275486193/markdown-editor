import { create } from 'zustand';
import type { Block } from '../engine/types';

interface BlocksStore {
  blocks: Block[];
  setBlocks: (blocks: Block[]) => void;
}

export const useBlocksStore = create<BlocksStore>()((set) => ({
  blocks: [],
  setBlocks: (blocks) => set({ blocks }),
}));
