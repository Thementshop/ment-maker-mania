export type VisualTier = 'sprouting' | 'growing' | 'thriving' | 'hot' | 'rising-star' | 'epic' | 'legendary' | 'ultimate';

export function getChainTier(shareCount: number): 'small' | 'medium' | 'large' | 'legendary' {
  if (shareCount >= 100) return 'legendary';
  if (shareCount >= 50) return 'large';
  if (shareCount >= 25) return 'medium';
  return 'small';
}

export function getVisualTier(shareCount: number): VisualTier {
  if (shareCount >= 1000) return 'ultimate';
  if (shareCount >= 500) return 'legendary';
  if (shareCount >= 250) return 'epic';
  if (shareCount >= 100) return 'rising-star';
  if (shareCount >= 50) return 'hot';
  if (shareCount >= 25) return 'thriving';
  if (shareCount >= 10) return 'growing';
  return 'sprouting';
}

export const visualTierConfig: Record<VisualTier, {
  label: string;
  emoji: string;
  badge: string;
  cardClass: string;
  showSocialShare: boolean;
}> = {
  sprouting: {
    label: 'Sprouting',
    emoji: '🌱',
    badge: '',
    cardClass: 'chain-sprouting',
    showSocialShare: false,
  },
  growing: {
    label: 'Growing',
    emoji: '💚',
    badge: 'Growing! 💚',
    cardClass: 'chain-growing',
    showSocialShare: false,
  },
  thriving: {
    label: 'Thriving',
    emoji: '✨',
    badge: 'Thriving! ✨',
    cardClass: 'chain-thriving',
    showSocialShare: true,
  },
  hot: {
    label: 'On Fire',
    emoji: '🔥',
    badge: 'On Fire! 🔥',
    cardClass: 'chain-hot',
    showSocialShare: true,
  },
  'rising-star': {
    label: 'Rising Star',
    emoji: '⭐',
    badge: 'Rising Star! ⭐',
    cardClass: 'chain-rising-star',
    showSocialShare: true,
  },
  epic: {
    label: 'Epic',
    emoji: '💎',
    badge: 'EPIC Chain! 💎',
    cardClass: 'chain-epic',
    showSocialShare: true,
  },
  legendary: {
    label: 'Legendary',
    emoji: '🌟',
    badge: 'LEGENDARY! 🌟',
    cardClass: 'chain-legendary-visual',
    showSocialShare: true,
  },
  ultimate: {
    label: 'World-Changer',
    emoji: '🏆',
    badge: '🏆 WORLD-CHANGER',
    cardClass: 'chain-ultimate',
    showSocialShare: true,
  },
};

export const SOCIAL_SHARE_MILESTONES = [25, 50, 100, 250, 500, 1000];

export function isMilestone(shareCount: number): boolean {
  return SOCIAL_SHARE_MILESTONES.includes(shareCount);
}

export const tierConfig = {
  small: { mintCount: 6, radius: 80, label: 'Small Chain', color: '#58fc59', emoji: '🌱' },
  medium: { mintCount: 8, radius: 100, label: 'Medium Chain', color: '#3b82f6', emoji: '🌿' },
  large: { mintCount: 10, radius: 120, label: 'Large Chain', color: '#a855f7', emoji: '🌳' },
  legendary: { mintCount: 12, radius: 140, label: 'Legendary Chain', color: '#f59e0b', emoji: '✨' },
};
