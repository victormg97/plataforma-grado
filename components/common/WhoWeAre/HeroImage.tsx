'use client';

interface HeroImageProps {
  url: string;
  className?: string;
}

export function HeroImage({ url, className }: HeroImageProps) {
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <img
        src={url}
        alt=""
        aria-hidden="true"
        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
      />
    </div>
  );
}
