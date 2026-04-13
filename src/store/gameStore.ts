import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface PendingMent {
  id: string;
  category: string;
  complimentText: string;
  expiresAt: Date;
  status: 'pending' | 'passed' | 'expired';
  recipientType: string;
  recipientValue?: string;
}

export interface GameState {
  jarCount: number;
  totalSent: number;
  currentLevel: number;
  pendingMents: PendingMent[];
  worldKindnessCount: number;
  isLoading: boolean;
  userId: string | null;
  
  // Actions
  loadGameState: (userId: string) => Promise<void>;
  sendMent: (mentData: { category: string; complimentText: string; recipientType: string; recipientValue?: string }) => Promise<{ leveledUp: boolean; bonusMints: number }>;
  addPendingMent: (ment: Omit<PendingMent, 'id' | 'expiresAt' | 'status'>) => Promise<void>;
  passMent: (id: string) => Promise<void>;
  expireMent: (id: string) => Promise<void>;
  subscribeToWorldCounter: () => void;
  unsubscribeFromWorldCounter: () => void;
  resetState: () => void;
}

export const LEVELS = [
  // Tier 1: Basic Jar (0-99)
  { level: 1, name: "Ment Maker", minMents: 0, maxMents: 19, reward: 5 },
  { level: 2, name: "Encourage-Ment", minMents: 20, maxMents: 39, reward: 8 },
  { level: 3, name: "Compli-Mentor", minMents: 40, maxMents: 59, reward: 10 },
  { level: 4, name: "Senti-Mental", minMents: 60, maxMents: 79, reward: 12 },
  { level: 5, name: "Mo-Ment Maker", minMents: 80, maxMents: 99, reward: 15 },
  // Tier 2: Premium Jar (100-249)
  { level: 6, name: "Excite-Ment", minMents: 100, maxMents: 129, reward: 18 },
  { level: 7, name: "Engage-Ment Pro", minMents: 130, maxMents: 159, reward: 20 },
  { level: 8, name: "Fulfill-Ment", minMents: 160, maxMents: 194, reward: 25 },
  { level: 9, name: "Amaze-Ment", minMents: 195, maxMents: 224, reward: 28 },
  { level: 10, name: "Empower-Ment", minMents: 225, maxMents: 249, reward: 30 },
  // Tier 3: Deluxe Jar (250-499)
  { level: 11, name: "Enlighten-Ment", minMents: 250, maxMents: 299, reward: 35 },
  { level: 12, name: "Accomplish-Ment", minMents: 300, maxMents: 349, reward: 40 },
  { level: 13, name: "Astonish-Ment", minMents: 350, maxMents: 399, reward: 45 },
  { level: 14, name: "Enchant-Ment", minMents: 400, maxMents: 449, reward: 50 },
  { level: 15, name: "Embodi-Ment", minMents: 450, maxMents: 499, reward: 55 },
  // Tier 4: Elite Jar (500-999)
  { level: 16, name: "Enrich-Ment", minMents: 500, maxMents: 599, reward: 60 },
  { level: 17, name: "Endow-Ment", minMents: 600, maxMents: 699, reward: 70 },
  { level: 18, name: "Achieve-Ment", minMents: 700, maxMents: 799, reward: 80 },
  { level: 19, name: "Refine-Ment", minMents: 800, maxMents: 899, reward: 90 },
  { level: 20, name: "Entertain-Ment", minMents: 900, maxMents: 999, reward: 100 },
  // Tier 5: Treasure Jar (1000+)
  { level: 21, name: "Environ-Ment", minMents: 1000, maxMents: 1249, reward: 125 },
  { level: 22, name: "Establish-Ment", minMents: 1250, maxMents: 1499, reward: 150 },
  { level: 23, name: "Transcend-Ment", minMents: 1500, maxMents: 1999, reward: 200 },
  { level: 24, name: "Monumen-Tal", minMents: 2000, maxMents: 2499, reward: 300 },
  { level: 25, name: "Ment Legend", minMents: 2500, maxMents: Infinity, reward: 500 },
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

let worldCounterChannel: ReturnType<typeof supabase.channel> | null = null;

const initialState = {
  jarCount: 25,
  totalSent: 0,
  currentLevel: 1,
  pendingMents: [],
  worldKindnessCount: 0,
  isLoading: false,
  userId: null,
};

export const useGameStore = create<GameState>()((set, get) => ({
  ...initialState,
  
  loadGameState: async (userId: string) => {
    set({ isLoading: true, userId });

    const queryWithTimeout = async <T>(query: Promise<T>, label: string, timeoutMs = 10000): Promise<T> => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      try {
        return await Promise.race([
          query,
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(`${label} load timeout after ${timeoutMs}ms`)), timeoutMs);
          }),
        ]);
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    };

    try {
      const gameStatePromise = queryWithTimeout(
        (async () => {
          return await supabase
            .from('user_game_state')
            .select('jar_count, total_sent, current_level')
            .eq('user_id', userId)
            .maybeSingle();
        })(),
        'game state'
      );

      const pendingMentsPromise = queryWithTimeout(
        (async () => {
          return await supabase
            .from('pending_ments')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending');
        })(),
        'pending ments'
      );

      const worldCounterPromise = queryWithTimeout(
        (async () => {
          return await supabase
            .from('world_kindness_counter')
            .select('count')
            .eq('id', 1)
            .maybeSingle();
        })(),
        'world counter'
      );

      const gameStateResult = await gameStatePromise;
      const { data: gameState, error: gameError } = gameStateResult;

      if (gameError) {
        console.error('Error loading game state:', gameError);
      } else {
        console.log('[MINT DEBUG] loadGameState setting jar_count:', gameState?.jar_count ?? 25, 'total_sent:', gameState?.total_sent ?? 0);
        set({
          jarCount: gameState?.jar_count ?? 25,
          totalSent: gameState?.total_sent ?? 0,
          currentLevel: gameState?.current_level ?? 1,
        });
        console.log('[MINT DEBUG] loadGameState applied primary state, store jarCount now:', get().jarCount);
      }

      const [pendingMentsResult, worldCounterResult] = await Promise.allSettled([
        pendingMentsPromise,
        worldCounterPromise,
      ]);

      if (pendingMentsResult.status === 'fulfilled') {
        const { data: pendingMentsData, error: pendingError } = pendingMentsResult.value;

        if (pendingError) {
          console.error('Error loading pending ments:', pendingError);
        } else {
          const pendingMents: PendingMent[] = (pendingMentsData || []).map(m => ({
            id: m.id,
            category: m.category,
            complimentText: m.compliment_text,
            expiresAt: new Date(m.expires_at),
            status: m.status as 'pending' | 'passed' | 'expired',
            recipientType: m.recipient_type,
            recipientValue: m.recipient_value || undefined,
          }));

          set({ pendingMents });
        }
      } else {
        console.error('Error loading pending ments:', pendingMentsResult.reason);
      }

      if (worldCounterResult.status === 'fulfilled') {
        const { data: worldCounter, error: worldError } = worldCounterResult.value;

        if (worldError) {
          console.error('Error loading world counter:', worldError);
        } else {
          set({ worldKindnessCount: worldCounter?.count ?? 0 });
        }
      } else {
        console.error('Error loading world counter:', worldCounterResult.reason);
      }
    } catch (error) {
      console.error('Error loading game state:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  sendMent: async (mentData) => {
    const state = get();
    const userId = state.userId;
    
    if (!userId) {
      return { leveledUp: false, bonusMints: 0 };
    }
    
    const prevLevel = getCurrentLevel(state.totalSent);
    const newTotalSent = state.totalSent + 1;
    const newLevel = getCurrentLevel(newTotalSent);
    
    let bonusMints = 0;
    const leveledUp = newLevel.level > prevLevel.level;
    if (leveledUp) {
      bonusMints = newLevel.reward;
    }
    
    const newJarCount = state.jarCount + 1 + bonusMints;
    
    // Optimistic update
    set({
      jarCount: newJarCount,
      totalSent: newTotalSent,
      currentLevel: newLevel.level,
    });
    
    try {
      // Update game state in database
      const { error: updateError } = await supabase
        .from('user_game_state')
        .update({
          jar_count: newJarCount,
          total_sent: newTotalSent,
          current_level: newLevel.level,
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('Error updating game state:', updateError);
      }
      
      // Insert sent ment
      const { error: sentError } = await supabase
        .from('sent_ments')
        .insert({
          sender_id: userId,
          category: mentData.category,
          compliment_text: mentData.complimentText,
          recipient_type: mentData.recipientType,
        });
      
      if (sentError) {
        console.error('Error inserting sent ment:', sentError);
      }
      
      // Increment world counter (this will broadcast via realtime)
      const { data: newCount, error: counterError } = await supabase
        .rpc('increment_world_counter');
      
      if (counterError) {
        console.error('Error incrementing world counter:', counterError);
      } else if (newCount) {
        set({ worldKindnessCount: newCount });
      }
    } catch (error) {
      console.error('Error sending ment:', error);
    }
    
    return { leveledUp, bonusMints };
  },
  
  addPendingMent: async (ment) => {
    const userId = get().userId;
    if (!userId) return;
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);
    
    const { data, error } = await supabase
      .from('pending_ments')
      .insert({
        user_id: userId,
        category: ment.category,
        compliment_text: ment.complimentText,
        recipient_type: ment.recipientType,
        recipient_value: ment.recipientValue,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding pending ment:', error);
      return;
    }
    
    set((state) => ({
      pendingMents: [
        ...state.pendingMents,
        {
          id: data.id,
          category: data.category,
          complimentText: data.compliment_text,
          expiresAt: new Date(data.expires_at),
          status: 'pending' as const,
          recipientType: data.recipient_type,
          recipientValue: data.recipient_value || undefined,
        },
      ],
    }));
  },
  
  passMent: async (id) => {
    const userId = get().userId;
    if (!userId) return;
    
    const { error } = await supabase
      .from('pending_ments')
      .update({ status: 'passed' })
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error passing ment:', error);
      return;
    }
    
    // Update jar count
    const newJarCount = get().jarCount + 1;
    
    const { error: updateError } = await supabase
      .from('user_game_state')
      .update({ jar_count: newJarCount })
      .eq('user_id', userId);
    
    if (updateError) {
      console.error('Error updating jar count:', updateError);
    }
    
    set((state) => ({
      pendingMents: state.pendingMents.map((m) =>
        m.id === id ? { ...m, status: 'passed' as const } : m
      ),
      jarCount: newJarCount,
    }));
  },
  
  expireMent: async (id) => {
    const userId = get().userId;
    if (!userId) return;
    
    const { error } = await supabase
      .from('pending_ments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting expired ment:', error);
      return;
    }
    
    set((state) => ({
      pendingMents: state.pendingMents.filter((m) => m.id !== id),
    }));
  },
  
  subscribeToWorldCounter: () => {
    if (worldCounterChannel) return;
    
    worldCounterChannel = supabase
      .channel('world-counter-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'world_kindness_counter',
        },
        (payload) => {
          const newCount = (payload.new as { count: number }).count;
          set({ worldKindnessCount: newCount });
        }
      )
      .subscribe();
  },
  
  unsubscribeFromWorldCounter: () => {
    if (worldCounterChannel) {
      supabase.removeChannel(worldCounterChannel);
      worldCounterChannel = null;
    }
  },
  
  resetState: () => {
    set({
      ...initialState,
      isLoading: false, // Override to prevent infinite loading on re-login
    });
  },
}));
