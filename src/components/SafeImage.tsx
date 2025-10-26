'use client';

import { useState } from 'react';
import Image from 'next/image';

interface SafeImageProps {
  src?: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallbackSrc?: string;
  useProxy?: boolean;
}

export default function SafeImage({ 
  src, 
  alt, 
  width, 
  height, 
  className = '', 
  fallbackSrc = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=600&fit=crop',
  useProxy = false 
}: SafeImageProps) {
  const [imageSrc, setImageSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      if (useProxy && src && !imageSrc.includes('/api/image-proxy')) {
        // Try using the proxy
        setImageSrc(`/api/image-proxy?url=${encodeURIComponent(src)}`);
      } else {
        // Use fallback image
        setImageSrc(fallbackSrc);
      }
    }
  };

  // Determine the final image source
  const finalSrc = useProxy && src && !src.includes('/api/image-proxy') 
    ? `/api/image-proxy?url=${encodeURIComponent(src)}`
    : (src || fallbackSrc);

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={handleError}
      unoptimized={useProxy || (finalSrc ? finalSrc.includes('/api/image-proxy') : false)}
    />
  );
}
