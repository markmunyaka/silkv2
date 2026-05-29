#!/bin/bash
# Video Script Generator - Quick Setup Script
# Usage: bash video-script-setup.sh

echo "🎬 Video Script Generator - Setup"
echo "=================================="

# Create directories
echo "Creating directories..."
mkdir -p src/app/api/generate-video-script
mkdir -p src/app/video-script

# Create API route
echo "Creating API route..."
cat > src/app/api/generate-video-script/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { generateVideoScript } from '@/utils/videoScriptGenerator';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { summary, text } = body;

    const summaryText = summary || text;

    if (!summaryText || typeof summaryText !== 'string' || summaryText.trim().length === 0) {
      return NextResponse.json({ error: 'Summary text is required' }, { status: 400 });
    }

    if (summaryText.length > 5000) {
      return NextResponse.json({ error: 'Summary text exceeds maximum length of 5000 characters' }, { status: 400 });
    }

    const videoScript = await generateVideoScript(summaryText);

    return NextResponse.json(videoScript, { status: 200 });
  } catch (error: any) {
    console.error('Video script generation error:', error);

    if (error.message.includes('Invalid PDF buffer') || error.message.includes('requires the key')) {
      return NextResponse.json({ error: 'Invalid request or missing API credentials' }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Failed to generate video script' }, { status: 500 });
  }
}
EOF

# Create page route
echo "Creating page route..."
cat > src/app/video-script/page.tsx << 'EOF'
'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navigation } from '@/components/Navigation';
import { VideoScriptPreview } from '@/components/VideoScriptPreview';
import type { VideoScript } from '@/utils/videoScriptGenerator';

interface GenerationState {
  isLoading: boolean;
  error: string | null;
  videoScript: VideoScript | null;
}

export default function VideoScriptPage() {
  const [summaryInput, setSummaryInput] = useState('');
  const [generation, setGeneration] = useState<GenerationState>({
    isLoading: false,
    error: null,
    videoScript: null,
  });

  const handleGenerateScript = async () => {
    if (!summaryInput.trim()) {
      setGeneration({ ...generation, error: 'Please enter a summary text' });
      return;
    }

    setGeneration({ isLoading: true, error: null, videoScript: null });

    try {
      const response = await fetch('/api/generate-video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summaryInput }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate video script');
      }

      const videoScript = await response.json();
      setGeneration({ isLoading: false, error: null, videoScript });
    } catch (error: any) {
      setGeneration({ isLoading: false, error: error.message || 'Failed to generate video script', videoScript: null });
    }
  };

  const downloadScript = (format: 'json' | 'txt') => {
    if (!generation.videoScript) return;

    let content: string;
    let filename: string;

    if (format === 'json') {
      content = JSON.stringify(generation.videoScript, null, 2);
      filename = 'video-script.json';
    } else {
      const script = generation.videoScript;
      content = `VIDEO SCRIPT - 60 SECONDS
=====================================

HOOK (${script.hook.duration})
${script.hook.text}

---

SCENE 1: ${script.scenes[0].title} (${script.scenes[0].duration})
${script.scenes[0].description}

Visual Cues: ${script.scenes[0].visualCues.join(', ')}

---

SCENE 2: ${script.scenes[1].title} (${script.scenes[1].duration})
${script.scenes[1].description}

Visual Cues: ${script.scenes[1].visualCues.join(', ')}

---

SCENE 3: ${script.scenes[2].title} (${script.scenes[2].duration})
${script.scenes[2].description}

Visual Cues: ${script.scenes[2].visualCues.join(', ')}

---

CALL-TO-ACTION (${script.cta.duration})
${script.cta.text}

---

AESTHETIC: ${script.aesthetic}
TOTAL DURATION: ${script.totalDuration}`;
      filename = 'video-script.txt';
    }

    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background via-background-secondary to-background">
        {/* Header */}
        <section className="section-container mt-12">
          <div className="glass-lg p-8 animate-fade-in-up mb-12">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-3xl">
                🎬
              </div>
              <div>
                <h1 className="text-4xl font-serif text-white mb-2">Video Script Generator</h1>
                <p className="text-foreground-secondary text-lg">
                  Convert document summaries into cinematic 60-second video scripts for HeyGen, Sora, or Veo
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Input Section */}
        <section className="section-container mb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-serif text-white mb-2">Create Video Script</h2>
            <p className="text-foreground-secondary">Paste your document summary to generate a structured video script</p>
          </div>

          <div className="glass-lg p-8 rounded-lg">
            <textarea
              value={summaryInput}
              onChange={(e) => setSummaryInput(e.target.value)}
              placeholder="Paste your document summary here... (max 5000 characters)"
              maxLength={5000}
              className="w-full h-64 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-foreground-secondary focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/20 resize-none"
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-foreground-secondary">{summaryInput.length} / 5000 characters</span>
              <button
                onClick={handleGenerateScript}
                disabled={generation.isLoading || !summaryInput.trim()}
                className="px-8 py-3 bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              >
                {generation.isLoading ? 'Generating...' : 'Generate Video Script'}
              </button>
            </div>

            {generation.error && <p className="text-sm text-red-400 mt-4">{generation.error}</p>}
          </div>
        </section>

        {/* Video Script Preview */}
        {generation.videoScript && (
          <section className="section-container pb-16">
            <div className="mb-6">
              <h2 className="text-2xl font-serif text-white mb-2">Your Video Script</h2>
              <p className="text-foreground-secondary">Ready for AI video generation with cinematic visuals</p>
            </div>

            <VideoScriptPreview videoScript={generation.videoScript} onDownload={downloadScript} />
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add navigation link to /video-script in src/components/Navigation.tsx"
echo "2. Run: npm run dev"
echo "3. Visit: http://localhost:3000/video-script"
echo ""
echo "📚 For detailed information, see VIDEO_SCRIPT_SETUP.md"
