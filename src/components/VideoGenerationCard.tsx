'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GenerationStatus = 'idle' | 'queued' | 'processing' | 'succeeded' | 'failed';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoGenerationCard() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/video/status?taskId=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Polling failed');

      const { status: taskStatus, videoUrl: url, thumbnailUrl: thumb, errorMessage } = json.data;

      if (taskStatus === 'SUCCEEDED') {
        setStatus('succeeded');
        setVideoUrl(url ?? null);
        setThumbnailUrl(thumb ?? null);
        stopPolling();
      } else if (taskStatus === 'FAILED') {
        setStatus('failed');
        setError(errorMessage || 'Video generation failed');
        stopPolling();
      } else {
        setStatus('processing');
      }
    } catch (e) {
      // Swallow polling errors — we'll retry on the next interval
      console.warn('[VideoGenerationCard] Poll error:', e);
    }
  }, [stopPolling]);

  const handleGenerate = async () => {
    if (!prompt.trim() || !user?.id || loading) return;

    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setThumbnailUrl(null);
    setTaskId(null);
    setStatus('idle');
    stopPolling();

    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          workspaceId: user.id,
          duration: 5,
          aspect_ratio: '16:9',
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to queue video generation');

      const id = json.data.taskId;
      setTaskId(id);
      setStatus('queued');

      // Start polling every 6 seconds
      pollRef.current = setInterval(() => pollStatus(id), 6_000);

      // Also poll immediately
      await pollStatus(id);
    } catch (e) {
      setError((e as Error).message);
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!taskId || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/video/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to save video');
      setSavedFilePath(json.data.savedFilePath);
      setSavedLocally(true);
    } catch (e) {
      console.error('[VideoGenerationCard] Save error:', e);
    } finally {
      setSaving(false);
      setSaveDisabled(true);
    }
  };

  const handleReset = () => {
    stopPolling();
    setPrompt('');
    setStatus('idle');
    setTaskId(null);
    setVideoUrl(null);
    setThumbnailUrl(null);
    setSavedFilePath(null);
    setSavedLocally(false);
    setSaving(false);
    setSaveDisabled(false);
    setError(null);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <section className="rounded-lg border bg-white/5 glass-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <span>🎬</span> AI Video Generation
      </h3>
      <p className="text-foreground-secondary text-sm mb-4">
        Generate cinematic short videos from text using Kling 3.0 AI
      </p>

      {/* Prompt Input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the video you want to generate… e.g. 'A cinematic aerial shot of a futuristic city at sunset, neon lights reflecting off glass buildings'"
        disabled={loading || status === 'queued' || status === 'processing'}
        rows={3}
        className="w-full rounded-lg px-4 py-3 bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent-gold resize-none text-sm mb-4"
      />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim() || !user?.id}
          className="flex-1 bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold py-2.5 px-4 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? 'Submitting…' : status === 'queued' || status === 'processing' ? 'Generating…' : '🎬 Generate Video'}
        </button>

        {(status === 'succeeded' || status === 'failed') && (
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Status Indicator */}
      {status === 'queued' && (
        <div className="mt-4 p-3 rounded-lg bg-white/5 border border-accent-gold/30 text-sm text-accent-gold flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-accent-gold animate-pulse" />
          Video generation queued — processing shortly…
        </div>
      )}

      {status === 'processing' && (
        <div className="mt-4 p-3 rounded-lg bg-white/5 border border-accent-neon-blue/30 text-sm text-accent-neon-blue flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-accent-neon-blue animate-pulse" />
          Rendering your video (this may take up to 90 seconds)…
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Success — Video Preview with Silk Road V2 Watermark */}
      {status === 'succeeded' && videoUrl && (
        <div className="mt-4 space-y-3">
          {/* Video container with watermark overlay */}
          <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/50">
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="w-full aspect-video object-cover"
              />
            )}
            <div className="relative">
              <video
                src={savedFilePath || videoUrl}
                controls
                autoPlay
                playsInline
                className="w-full aspect-video"
              >
                Your browser does not support the video tag.
              </video>
              {/* "Silk Road V2" watermark overlay */}
              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 pointer-events-none select-none">
                <span className="text-xs font-semibold text-white/80 tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-accent-gold" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Silk Road V2
                </span>
              </div>
            </div>
          </div>

          {/* Action row: external link + save button */}
          <div className="flex items-center gap-3">
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent-gold hover:text-accent-gold-light underline"
            >
              Open video in new tab ↗
            </a>

            {!savedLocally ? (
              <button
                onClick={handleSave}
                disabled={saving || saveDisabled}
                className="ml-auto flex items-center gap-1.5 bg-gradient-to-r from-accent-gold/20 to-accent-neon-blue/20 hover:from-accent-gold/30 hover:to-accent-neon-blue/30 text-accent-gold text-xs font-medium py-1.5 px-3 rounded-lg border border-white/10 hover:border-accent-gold/40 transition-all disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-accent-gold border-t-transparent animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Save Permanently
                  </>
                )}
              </button>
            ) : (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Saved locally
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}