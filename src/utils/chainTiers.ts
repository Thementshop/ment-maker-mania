export function getChainTier(shareCount: number): 'small' | 'medium' | 'large' | 'legendary' {
  if (shareCount >= 100) return 'legendary';
  if (shareCount >= 50) return 'large';
  if (shareCount >= 25) return 'medium';
  return 'small';
}

export const tierConfig = {
  small: { mintCount: 6, radius: 80, label: 'Small Chain' },
  medium: { mintCount: 8, radius: 100, label: 'Medium Chain' },
  large: { mintCount: 10, radius: 120, label: 'Large Chain' },
  legendary: { mintCount: 12, radius: 140, label: 'Legendary Chain' },
};
