'use client';

import React from 'react';
import Image from 'next/image';
import { usePlayerStore } from '@/store/usePlayerStore';
import { clsx } from 'clsx';

export default function Background() {
  const { currentSong } = usePlayerStore();
  const picUrl = currentSong?.al?.picUrl ?? currentSong?.album?.picUrl ?? currentSong?.picUrl;
  const safePicUrl = picUrl?.replace(/^http:\/\//, 'https://');

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Fallback Background */}
      <div className="absolute inset-0 bg-background transition-colors duration-500" />
      
      {/* Song Cover Blur Background */}
      {safePicUrl && (
        <div className="absolute inset-0">
          <Image
            src={safePicUrl}
            alt="background"
            fill
            sizes="100vw"
            className="object-cover transition-opacity duration-1000 opacity-100"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      
      {/* Blur & Overlay */}
      {/* Using multiple layers for better effect */}
      <div className={clsx(
        "absolute inset-0 backdrop-blur-[60px] bg-background/30 transition-all duration-1000",
         safePicUrl ? "opacity-100" : "opacity-0"
      )} />
      
      {/* Darken overlay for readability */}
      <div className="absolute inset-0 bg-background/50" />
    </div>
  );
}
