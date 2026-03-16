export interface JarTier {
  tier: number;
  name: string;
  levels: number[];
  minMints: number;
  maxMints: number;
  image: string;
}

export const JAR_TIERS: JarTier[] = [
  {
    tier: 1,
    name: 'Basic',
    levels: [1, 2, 3, 4, 5],
    minMints: 0,
    maxMints: 99,
    image: '/images/jar-tier-1.png',
  },
  {
    tier: 2,
    name: 'Premium',
    levels: [6, 7, 8, 9, 10],
    minMints: 100,
    maxMints: 249,
    image: '/images/jar-tier-2.png',
  },
  {
    tier: 3,
    name: 'Deluxe',
    levels: [11, 12, 13, 14, 15],
    minMints: 250,
    maxMints: 499,
    image: '/images/jar-tier-3.png',
  },
  {
    tier: 4,
    name: 'Elite',
    levels: [16, 17, 18, 19, 20],
    minMints: 500,
    maxMints: 999,
    image: '/images/jar-tier-4.png',
  },
  {
    tier: 5,
    name: 'Treasure',
    levels: [21, 22, 23, 24, 25],
    minMints: 1000,
    maxMints: Infinity,
    image: '/images/jar-tier-5.png',
  },
];

export function getCurrentTier(jarCount: number): JarTier {
  return (
    JAR_TIERS.find(
      (tier) => jarCount >= tier.minMints && jarCount <= tier.maxMints
    ) || JAR_TIERS[0]
  );
}

export function getNextTier(jarCount: number): JarTier | null {
  const current = getCurrentTier(jarCount);
  if (current.tier >= 5) return null;
  return JAR_TIERS[current.tier]; // tier is 1-indexed, array is 0-indexed, so tier points to next
}

export function getTierProgress(jarCount: number): number {
  const current = getCurrentTier(jarCount);
  const next = getNextTier(jarCount);
  if (!next) return 100;
  return ((jarCount - current.minMints) / (next.minMints - current.minMints)) * 100;
}

export function getMintsToNextTier(jarCount: number): number {
  const next = getNextTier(jarCount);
  if (!next) return 0;
  return next.minMints - jarCount;
}
