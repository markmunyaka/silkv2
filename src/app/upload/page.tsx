'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navigation } from '@/components/Navigation';
import DragDropUpload from '@/components/DragDropUpload';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useAuth } from '@/context/AuthContext';
import { useCredits } from '@/hooks/useCredits';
import Link from 'next/link';

export default function UploadPage() {
  const { user } = useAuth();
  const { credits, fetchCredits, deductCredit } = useCredits(user?.id);
  const [summary, setSummary] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [error, setError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  // Fetch credits on mount
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const handleFileSelect = async (file: File) => {
    setError('');
    setLoading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('userId', user?.id || '');

      const response = await fetch('/api/summarize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to summarize document');
      }

      const result = await response.json();
      setSummary(result.summary || 'No summary generated');
      setAudioUrl(result.audioUrl || '');

      if (user?.id) {
        await deductCredit(1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process document');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!summary) return;
    
    setGeneratingAudio(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summary }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const result = await response.json();
      setAudioUrl(result.audioUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate audio');
    } finally {
      setGeneratingAudio(false);
    }
  };

  return (
    <ProtectedRoute>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background via-background-secondary to-background py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8">
            <Link href="/dashboard" className="text-accent-gold hover:text-accent-gold-light transition-colors">
              ← Back to Dashboard
            </Link>
          </div>

          <div className="glass-lg p-8 rounded-lg mb-8">
            <h1 className="text-3xl font-serif text-white mb-4">Upload PDF</h1>
            <p className="text-foreground-secondary mb-6">Upload a PDF to summarize</p>
            
            <DragDropUpload onFileSelect={handleFileSelect} isProcessing={loading} />
            
            {error && (
              <div className="mt-4 p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
          </div>

          {summary && (
            <div className="glass-lg p-8 rounded-lg">
              <h2 className="text-2xl font-serif text-white mb-4">Summary</h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-white whitespace-pre-wrap">{summary}</p>
              </div>
              
              {audioUrl && (
                <div className="mt-8">
                  <h3 className="text-xl font-serif text-white mb-4">Audio</h3>
                  <audio controls className="w-full">
                    <source src={audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {!audioUrl && (
                <button
                  onClick={handleGenerateAudio}
                  disabled={generatingAudio}
                  className="mt-6 bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-3 px-6 rounded-lg hover:shadow-xl hover:shadow-accent-gold/40 transition-all disabled:opacity-50"
                >
                  {generatingAudio ? 'Generating...' : 'Generate Audio'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}