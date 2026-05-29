'use client';

import { useState, useEffect, useRef } from 'react';

interface VideoPlayerProps {
  summary: string;
  audioUrl: string;
  fileName: string;
}

export function VideoPlayer({ summary, audioUrl, fileName }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Split summary into key points (by sentences or paragraphs)
  const keyPoints = summary
    .split(/[.!?]+/)
    .map((point) => point.trim())
    .filter((point) => point.length > 0)
    .slice(0, 8); // Limit to 8 points for animation

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Update current point based on playback progress
    if (duration > 0) {
      const progress = currentTime / duration;
      const newIndex = Math.floor(progress * keyPoints.length);
      setCurrentPointIndex(Math.min(newIndex, keyPoints.length - 1));
    }
  }, [currentTime, duration, keyPoints.length]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Video-like container */}
      <div className="glass-lg p-12 rounded-2xl overflow-hidden">
        <div className="relative w-full h-96 bg-gradient-to-br from-gold/10 to-neon-blue/10 rounded-xl overflow-hidden flex items-center justify-center">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-neon-blue/5 animate-pulse" />

          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8">
            {/* Current point display */}
            <div className="text-center space-y-6">
              <div className="h-24 flex items-center justify-center">
                <p className="text-2xl md:text-3xl font-serif text-white leading-relaxed max-w-2xl">
                  {keyPoints[currentPointIndex] || 'Loading...'}
                </p>
              </div>

              {/* Progress indicator */}
              <div className="flex gap-2 justify-center flex-wrap max-w-2xl mx-auto">
                {keyPoints.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 transition-all duration-300 rounded-full ${
                      index <= currentPointIndex
                        ? 'w-8 bg-gradient-to-r from-gold to-neon-blue'
                        : 'w-2 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Play button overlay */}
            {!isPlaying && (
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className="bg-gold/80 group-hover:bg-gold transition-all rounded-full p-6 group-hover:scale-110">
                  <svg
                    className="w-12 h-12 text-black"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audio element (hidden) */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Controls */}
      <div className="glass-lg p-6 rounded-2xl space-y-4">
        {/* Play/Pause Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            className="btn-premium"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Audio'}
          </button>
          <div className="text-foreground-secondary text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Progress slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
            style={{
              backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%`,
            }}
          />
          <div className="flex justify-between text-xs text-foreground-secondary">
            <span>Summary: {keyPoints.length} key points</span>
            <span>Duration: {formatTime(duration)}</span>
          </div>
        </div>

        {/* Download button */}
        <div className="flex gap-3">
          <a
            href={audioUrl}
            download={`${fileName.replace('.pdf', '')}-summary.mp3`}
            className="btn-secondary flex-1 text-center"
          >
            ⬇ Download Audio
          </a>
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            className="btn-secondary"
          >
            ↻ Reset
          </button>
        </div>
      </div>

      {/* Styling for range input */}
      <style>{`
        .slider {
          background: linear-gradient(
            to right,
            rgba(212, 175, 55, 0.5) 0%,
            rgba(212, 175, 55, 0.5) var(--value, 0%),
            rgba(255, 255, 255, 0.1) var(--value, 0%),
            rgba(255, 255, 255, 0.1) 100%
          );
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #00d4ff);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #00d4ff);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
        }
      `}</style>
    </div>
  );
}
