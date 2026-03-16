import React from 'react';
import { cn } from '@/lib/utils';

interface MintCircleGraphicProps {
  shareCount: number;
  tier: 'small' | 'medium' | 'large' | 'legendary';
  className?: string;
}

const tierConfig = {
  small: { mintCount: 6, radius: 80 },
  medium: { mintCount: 8, radius: 100 },
  large: { mintCount: 10, radius: 120 },
  legendary: { mintCount: 12, radius: 140 },
};

const MintCircleGraphic: React.FC<MintCircleGraphicProps> = ({
  shareCount,
  tier,
  className,
}) => {
  const { mintCount, radius } = tierConfig[tier];
  const isLegendary = tier === 'legendary';
  const centerX = 150;
  const centerY = 150;

  // Generate positions for each mint
  const mintPositions = Array.from({ length: mintCount }).map((_, i) => {
    const angle = (i * 360) / mintCount - 90; // Start from top
    const rad = (angle * Math.PI) / 180;
    return {
      x: centerX + Math.cos(rad) * radius,
      y: centerY + Math.sin(rad) * radius,
      angle,
    };
  });

  // Generate chain link paths between mints
  const chainLinks = mintPositions.map((pos, i) => {
    const nextPos = mintPositions[(i + 1) % mintCount];
    const midX = (pos.x + nextPos.x) / 2;
    const midY = (pos.y + nextPos.y) / 2;
    
    // Create curved path toward center for chain effect
    const controlX = centerX + (midX - centerX) * 0.85;
    const controlY = centerY + (midY - centerY) * 0.85;
    
    return {
      path: `M ${pos.x} ${pos.y} Q ${controlX} ${controlY} ${nextPos.x} ${nextPos.y}`,
      key: i,
    };
  });

  return (
    <svg
      viewBox="0 0 300 300"
      className={cn(
        'mint-circle-graphic w-full h-full max-w-[300px] max-h-[300px]',
        isLegendary && 'animate-legendary-glow',
        className
      )}
      style={{
        filter: isLegendary 
          ? 'drop-shadow(0 0 20px rgba(88, 252, 89, 0.6))' 
          : undefined,
      }}
    >
      <defs>
        {/* Mint green gradient */}
        <linearGradient id="mintGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2ECC71" />
          <stop offset="100%" stopColor="#27AE60" />
        </linearGradient>

        {/* Metallic chain gradient */}
        <linearGradient id="chainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#BDC3C7" />
          <stop offset="50%" stopColor="#ECF0F1" />
          <stop offset="100%" stopColor="#95A5A6" />
        </linearGradient>

        {/* Swirl pattern for mint */}
        <pattern id="mintSwirl" patternUnits="objectBoundingBox" width="1" height="1">
          <circle cx="16" cy="16" r="16" fill="url(#mintGradient)" />
        </pattern>

        {/* Legendary glow gradient */}
        {isLegendary && (
          <radialGradient id="legendaryGlow">
            <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#2ECC71" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2ECC71" stopOpacity="0" />
          </radialGradient>
        )}

        {/* Medium tier shimmer */}
        {tier === 'medium' && (
          <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0">
              <animate attributeName="offset" values="0;1" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="white" stopOpacity="0.3">
              <animate attributeName="offset" values="0.5;1.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="white" stopOpacity="0">
              <animate attributeName="offset" values="1;2" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        )}
      </defs>

      {/* Legendary glow background */}
      {isLegendary && (
        <circle
          cx={centerX}
          cy={centerY}
          r={radius + 40}
          fill="url(#legendaryGlow)"
          className="animate-pulse"
        />
      )}

      {/* Chain links between mints */}
      {chainLinks.map((link) => (
        <path
          key={link.key}
          d={link.path}
          fill="none"
          stroke="url(#chainGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.9"
        />
      ))}

      {/* Chain link inner highlight */}
      {chainLinks.map((link) => (
        <path
          key={`highlight-${link.key}`}
          d={link.path}
          fill="none"
          stroke="#ECF0F1"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      ))}

      {/* Mint candies arranged in circle */}
      {mintPositions.map((pos, i) => {
        const rotationAngle = pos.angle + 90;
        
        return (
          <g key={i} transform={`rotate(${rotationAngle}, ${pos.x}, ${pos.y})`}>
            {/* Cellophane wrapper - left side */}
            <ellipse
              cx={pos.x - 18}
              cy={pos.y}
              rx="8"
              ry="5"
              fill="white"
              opacity="0.5"
              transform={`rotate(-20, ${pos.x - 18}, ${pos.y})`}
            />
            <ellipse
              cx={pos.x - 20}
              cy={pos.y}
              rx="6"
              ry="3"
              fill="white"
              opacity="0.3"
              transform={`rotate(-30, ${pos.x - 20}, ${pos.y})`}
            />

            {/* Main mint candy circle */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r="14"
              fill="url(#mintGradient)"
            />

            {/* Swirl pattern - multiple curved stripes */}
            <path
              d={`M ${pos.x - 10} ${pos.y - 8} 
                  Q ${pos.x} ${pos.y - 2} ${pos.x + 10} ${pos.y - 6}`}
              fill="none"
              stroke="white"
              strokeWidth="3"
              opacity="0.7"
              strokeLinecap="round"
            />
            <path
              d={`M ${pos.x - 8} ${pos.y + 2} 
                  Q ${pos.x + 2} ${pos.y + 6} ${pos.x + 12} ${pos.y + 4}`}
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              opacity="0.5"
              strokeLinecap="round"
            />
            <path
              d={`M ${pos.x - 6} ${pos.y + 8} 
                  Q ${pos.x + 4} ${pos.y + 12} ${pos.x + 8} ${pos.y + 10}`}
              fill="none"
              stroke="white"
              strokeWidth="2"
              opacity="0.4"
              strokeLinecap="round"
            />

            {/* Glossy shine highlight */}
            <circle
              cx={pos.x - 5}
              cy={pos.y - 5}
              r="4"
              fill="white"
              opacity="0.8"
            />
            <circle
              cx={pos.x - 3}
              cy={pos.y - 3}
              r="2"
              fill="white"
              opacity="0.9"
            />

            {/* Cellophane wrapper - right side */}
            <ellipse
              cx={pos.x + 18}
              cy={pos.y}
              rx="8"
              ry="5"
              fill="white"
              opacity="0.5"
              transform={`rotate(20, ${pos.x + 18}, ${pos.y})`}
            />
            <ellipse
              cx={pos.x + 20}
              cy={pos.y}
              rx="6"
              ry="3"
              fill="white"
              opacity="0.3"
              transform={`rotate(30, ${pos.x + 20}, ${pos.y})`}
            />
          </g>
        );
      })}

      {/* Large tier sparkles */}
      {tier === 'large' && (
        <>
          {[0, 60, 120, 180, 240, 300].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const sparkleX = centerX + Math.cos(rad) * (radius + 25);
            const sparkleY = centerY + Math.sin(rad) * (radius + 25);
            return (
              <g key={`sparkle-${i}`}>
                <circle
                  cx={sparkleX}
                  cy={sparkleY}
                  r="3"
                  fill="#F1C40F"
                  opacity="0.8"
                >
                  <animate
                    attributeName="opacity"
                    values="0.3;1;0.3"
                    dur={`${1 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="r"
                    values="2;4;2"
                    dur={`${1 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}
        </>
      )}

      {/* Center background circle for text readability */}
      <circle
        cx={centerX}
        cy={centerY}
        r={radius * 0.5}
        fill="white"
        opacity="0.95"
      />
      <circle
        cx={centerX}
        cy={centerY}
        r={radius * 0.5}
        fill="none"
        stroke="#E8F5E9"
        strokeWidth="2"
      />

      {/* Center text - Share count */}
      <text
        x={centerX}
        y={centerY - 5}
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-bold"
        style={{
          fontSize: shareCount >= 1000 ? '28px' : shareCount >= 100 ? '32px' : '40px',
          fill: '#2C3E50',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {shareCount}
      </text>
      <text
        x={centerX}
        y={centerY + 20}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '12px',
          fill: '#7F8C8D',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
          letterSpacing: '1px',
        }}
      >
        SHARES
      </text>
    </svg>
  );
};

export default React.memo(MintCircleGraphic);
