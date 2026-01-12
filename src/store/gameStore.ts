import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PendingMent {
  id: string;
  category: string;
  complimentText: string;
  expiresAt: Date;
  status: 'pending' | 'passed' | 'expired';
}

export interface GameState {
  jarCount: number;
  totalSent: number;
  pendingMents: PendingMent[];
  worldKindnessCount: number;
  
  // Actions
  sendMent: () => void;
  addPendingMent: (ment: Omit<PendingMent, 'id' | 'expiresAt' | 'status'>) => void;
  passMent: (id: string) => void;
  expireMent: (id: string) => void;
  incrementWorldCounter: () => void;
}

export const LEVELS = [
  { level: 1, name: "Mint Maker", minMents: 0, maxMents: 24, reward: 10 },
  { level: 2, name: "Candy Crafter", minMents: 25, maxMents: 49, reward: 15 },
  { level: 3, name: "Sweet Starter", minMents: 50, maxMents: 99, reward: 20 },
  { level: 4, name: "Kindness Keeper", minMents: 100, maxMents: 174, reward: 25 },
  { level: 5, name: "Joy Spreader", minMents: 175, maxMents: 274, reward: 30 },
  { level: 6, name: "Positivity Pro", minMents: 275, maxMents: 399, reward: 40 },
  { level: 7, name: "Sweet Spreader", minMents: 400, maxMents: 549, reward: 50 },
  { level: 8, name: "Compliment Captain", minMents: 550, maxMents: 724, reward: 60 },
  { level: 9, name: "Kindness Connoisseur", minMents: 725, maxMents: 924, reward: 75 },
  { level: 10, name: "Gratitude Guru", minMents: 925, maxMents: 1149, reward: 100 },
  { level: 11, name: "Encouragement Expert", minMents: 1150, maxMents: 1399, reward: 125 },
  { level: 12, name: "Compassion Champion", minMents: 1400, maxMents: 1699, reward: 150 },
  { level: 13, name: "Empathy Elite", minMents: 1700, maxMents: 2049, reward: 200 },
  { level: 14, name: "Positivity Prodigy", minMents: 2050, maxMents: 2499, reward: 250 },
  { level: 15, name: "Compliment Legend", minMents: 2500, maxMents: Infinity, reward: 500 },
];

export const getCurrentLevel = (totalSent: number) => {
  return LEVELS.find(l => totalSent >= l.minMents && totalSent <= l.maxMents) || LEVELS[0];
};

export const getNextLevel = (totalSent: number) => {
  const currentLevel = getCurrentLevel(totalSent);
  return LEVELS.find(l => l.level === currentLevel.level + 1);
};

export const getMentsToNextLevel = (totalSent: number) => {
  const currentLevel = getCurrentLevel(totalSent);
  return currentLevel.maxMents - totalSent + 1;
};

export const getLevelProgress = (totalSent: number) => {
  const currentLevel = getCurrentLevel(totalSent);
  const levelRange = currentLevel.maxMents - currentLevel.minMents + 1;
  const progressInLevel = totalSent - currentLevel.minMents;
  return (progressInLevel / levelRange) * 100;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      jarCount: 25, // Start with 25 mints
      totalSent: 0,
      pendingMents: [],
      worldKindnessCount: 1234567, // Simulated world count
      
      sendMent: () => {
        const state = get();
        const prevLevel = getCurrentLevel(state.totalSent);
        const newTotalSent = state.totalSent + 1;
        const newLevel = getCurrentLevel(newTotalSent);
        
        let bonusMints = 0;
        if (newLevel.level > prevLevel.level) {
          bonusMints = newLevel.reward;
        }
        
        set({
          jarCount: state.jarCount + 1 + bonusMints,
          totalSent: newTotalSent,
          worldKindnessCount: state.worldKindnessCount + 1,
        });
        
        return { leveledUp: newLevel.level > prevLevel.level, newLevel, bonusMints };
      },
      
      addPendingMent: (ment) => {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        
        set((state) => ({
          pendingMents: [
            ...state.pendingMents,
            {
              ...ment,
              id: crypto.randomUUID(),
              expiresAt,
              status: 'pending' as const,
            },
          ],
        }));
      },
      
      passMent: (id) => {
        set((state) => ({
          pendingMents: state.pendingMents.map((m) =>
            m.id === id ? { ...m, status: 'passed' as const } : m
          ),
          jarCount: state.jarCount + 1,
        }));
      },
      
      expireMent: (id) => {
        set((state) => ({
          pendingMents: state.pendingMents.filter((m) => m.id !== id),
        }));
      },
      
      incrementWorldCounter: () => {
        set((state) => ({
          worldKindnessCount: state.worldKindnessCount + 1,
        }));
      },
    }),
    {
      name: 'ment-shop-storage',
    }
  )
);
