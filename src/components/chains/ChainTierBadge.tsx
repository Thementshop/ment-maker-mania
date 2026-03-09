import React from 'react';
import { Badge } from '@/components/ui/badge';
import { type VisualTier, visualTierConfig } from '@/utils/chainTiers';

interface ChainTierBadgeProps {
  visualTier: VisualTier;
  shareCount?: number;
}

const ChainTierBadge: React.FC<ChainTierBadgeProps> = ({ visualTier, shareCount }) => {
  const tierInfo = visualTierConfig[visualTier];
  if (!tierInfo.badge) return null;

  const badgeClasses: Record<string, string> = {
    growing: 'bg-green-100 text-green-700 border-green-300',
    thriving: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    hot: 'bg-orange-100 text-orange-700 border-orange-300',
    'rising-star': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    epic: 'bg-purple-100 text-purple-700 border-purple-300',
    legendary: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    ultimate: 'bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200 text-yellow-900 border-yellow-400 font-extrabold',
  };

  return (
    <Badge
      variant="outline"
      className={`text-xs ${badgeClasses[visualTier] || ''}`}
    >
      {tierInfo.badge}
      {visualTier === 'ultimate' && shareCount && (
        <span className="ml-1">{shareCount.toLocaleString()} people touched! 🌍</span>
      )}
    </Badge>
  );
};

export default ChainTierBadge;
