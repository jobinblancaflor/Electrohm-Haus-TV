import { useState } from 'react';

interface ChannelLogoProps {
  src: string;
  name: string;
  className?: string;
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** Channel logos are mostly transparent marks, so they sit contained on a plate; a monogram stands in when one is missing. */
export function ChannelLogo({ src, name, className = '' }: ChannelLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && failedSrc !== src;

  return (
    <div className={`flex items-center justify-center overflow-hidden ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className="max-h-full max-w-full object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.35)]"
        />
      ) : (
        <span aria-hidden className="font-display text-[2.2em] leading-none font-extrabold tracking-tight text-dim/70">
          {initials(name)}
        </span>
      )}
    </div>
  );
}
