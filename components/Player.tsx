'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Play, Pause, SkipBack, SkipForward, Repeat1, Volume2, VolumeX, Mic2 } from 'lucide-react';
import { clsx } from 'clsx';

export default function Player() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rateMenuRef = useRef<HTMLDivElement>(null);
  const {
    isPlaying,
    currentSong,
    playbackRate,
    loopMode,
    volume,
    currentTime,
    duration,
    lyrics,
    currentLyricIndex,
    isLyricLooping,
    seekTime,
    setPlaying,
    setCurrentTime,
    setDuration,
    setLoopMode,
    setPlaybackRate,
    setVolume,
    setCurrentLyricIndex,
    toggleLyricLoop,
    requestSeek,
    clearSeek
  } = usePlayerStore();

  const [isSeeking, setIsSeeking] = useState(false);
  const [isRateMenuOpen, setIsRateMenuOpen] = useState(false);

  useEffect(() => {
    if (audioRef.current && seekTime !== null) {
      audioRef.current.currentTime = seekTime;
      clearSeek();
    }
  }, [seekTime, clearSeek]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Play error", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!isRateMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!rateMenuRef.current) return;
      if (!rateMenuRef.current.contains(event.target as Node)) {
        setIsRateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRateMenuOpen]);

  const handleTimeUpdate = () => {
    if (!audioRef.current || isSeeking) return;
    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    // Lyric Loop Logic
    if (isLyricLooping && currentLyricIndex >= 0 && lyrics.length > 0) {
      const currentLine = lyrics[currentLyricIndex];
      const nextLine = lyrics[currentLyricIndex + 1];
      const endTime = nextLine ? nextLine.time : duration;
      
      if (time >= endTime) {
        audioRef.current.currentTime = currentLine.time;
        // Optionally play immediately if it paused (shouldn't happen)
      }
    }

    // Sync Lyric Index
    // Find the last lyric that has time <= current time
    // Optimization: start searching from currentLyricIndex
    let newIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= time) {
        newIndex = i;
      } else {
        break;
      }
    }
    if (newIndex !== currentLyricIndex) {
      setCurrentLyricIndex(newIndex);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    if (loopMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      setPlaying(false);
      // Implement 'list' loop logic here if we have a playlist
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    // setCurrentTime(time); // Do not set directly, let requestSeek handle or audio update handle
    // If dragging, we might want to update UI but not seek yet?
    // Actually, requestSeek updates currentTime in store too.
    requestSeek(time);
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;
  const rawCoverUrl = currentSong.al?.picUrl ?? currentSong.album?.picUrl ?? currentSong.picUrl;
  const coverUrl = rawCoverUrl?.replace(/^http:\/\//, 'https://');

  return (
    <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[90%] md:max-w-4xl bg-card/90 backdrop-blur-2xl border border-border/50 p-4 shadow-2xl z-50 transition-all rounded-[2rem]">
      <audio
        ref={audioRef}
        src={currentSong.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => setIsSeeking(true)}
            onMouseUp={() => setIsSeeking(false)}
            className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary hover:h-2 transition-all"
          />
          <span className="min-w-[40px] text-right">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between px-2">
          {/* Song Info */}
          <div className="flex items-center gap-4 w-1/4 truncate">
            {coverUrl && (
              <Image
                src={coverUrl}
                alt="cover"
                width={48}
                height={48}
                className="rounded-xl object-cover shadow-md"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm truncate text-foreground">{currentSong.name}</span>
              <span className="text-xs text-muted-foreground truncate">{currentSong.ar?.map(a => a.name).join(', ')}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setLoopMode(loopMode === 'off' ? 'single' : 'off')}
              className={clsx("p-2 rounded-full hover:bg-muted transition-colors", loopMode === 'single' && "text-primary bg-primary/10")}
              title="Repeat One"
            >
              <Repeat1 size={20} className={loopMode !== 'single' ? "opacity-50" : ""} />
            </button>

            <button className="text-foreground hover:scale-110 transition-transform hidden sm:block">
              <SkipBack size={24} />
            </button>
            
            <button 
              onClick={() => setPlaying(!isPlaying)}
              className="w-12 h-12 flex items-center justify-center bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 hover:brightness-110 hover:scale-105 transition-all"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>

             <button className="text-foreground hover:scale-110 transition-transform hidden sm:block">
              <SkipForward size={24} />
            </button>

            <button 
              onClick={toggleLyricLoop}
              className={clsx("p-2 rounded-full hover:bg-muted", isLyricLooping && "text-primary bg-primary/10")}
              title="Loop Current Line"
            >
              <Mic2 size={20} />
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4 w-1/4 justify-end">
            {/* Speed Control */}
            <div className="relative" ref={rateMenuRef}>
              <button
                onClick={() => setIsRateMenuOpen((prev) => !prev)}
                className="text-xs font-bold bg-muted px-2 py-1 rounded-lg hover:brightness-95 transition-colors w-12 text-foreground"
              >
                {playbackRate}x
              </button>
              {isRateMenuOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col bg-card/90 backdrop-blur-xl rounded-xl shadow-xl border border-border/50 p-1 min-w-[60px] gap-0.5">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        setPlaybackRate(rate);
                        setIsRateMenuOpen(false);
                      }}
                      className={clsx(
                        "px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors text-center font-medium",
                        playbackRate === rate ? "text-primary bg-primary/10" : "text-muted-foreground"
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <button onClick={() => setVolume(volume === 0 ? 1 : 0)}>
                {volume === 0 ? <VolumeX size={18} className="text-muted-foreground" /> : <Volume2 size={18} className="text-muted-foreground" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
