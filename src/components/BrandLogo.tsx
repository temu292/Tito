import React from 'react';

interface BrandLogoProps {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  showTagline = false,
  size = 'md',
  variant = 'full'
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon SVG matching VecinoYa logo */}
      <div className={`relative shrink-0 ${iconSizes[size]} flex items-center justify-center`}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-xs"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* House Silhouette with Chimney & Roof */}
          <path
            d="M 50 12 L 18 38 C 17 39 16 41 16 43 L 16 78 C 16 83 20 87 25 87 L 75 87 C 80 87 84 83 84 78 L 84 43 C 84 41 83 39 82 38 L 74 31.5 L 74 19 C 74 17.5 72.5 16 71 16 L 63 16 C 61.5 16 60 17.5 60 19 L 60 20.3 L 50 12 Z"
            fill="#146C5B"
          />
          {/* 4-Pane Window */}
          <rect x="44" y="24" width="5" height="5" rx="1" fill="#FFFFFF" />
          <rect x="51" y="24" width="5" height="5" rx="1" fill="#FFFFFF" />
          <rect x="44" y="31" width="5" height="5" rx="1" fill="#FFFFFF" />
          <rect x="51" y="31" width="5" height="5" rx="1" fill="#FFFFFF" />
          {/* Two Neighbor Heads */}
          <circle cx="37" cy="46" r="6" fill="#FFFFFF" />
          <circle cx="63" cy="46" r="6" fill="#FFFFFF" />
          {/* Embracing Arms & Hands Forming Protective Arc */}
          <path
            d="M 26 59 C 27 54 33 52 38 55 C 44 58 50 64 50 64 C 50 64 56 58 62 55 C 67 52 73 54 74 59 C 75 66 69 74 61 78 C 55 81 45 81 39 78 C 31 74 25 66 26 59 Z"
            fill="#FFFFFF"
          />
          {/* Inner cutout for embracing curve */}
          <path
            d="M 36 62 C 43 68 57 68 64 62 C 60 70 40 70 36 62 Z"
            fill="#146C5B"
          />
        </svg>
      </div>

      {variant === 'full' && (
        <div className="flex flex-col leading-none">
          <div className={`font-bold tracking-tight text-[#0E5145] ${textSizes[size]} flex items-center`}>
            <span>Vecino</span>
            <span className="text-[#146C5B] font-extrabold">Ya</span>
          </div>
          {showTagline && (
            <span className="text-[10px] tracking-wide text-[#146C5B]/80 font-medium mt-0.5">
              Juntos hacemos barrio
            </span>
          )}
        </div>
      )}
    </div>
  );
};
