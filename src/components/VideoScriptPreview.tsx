'use client';

import { useState } from 'react';
import type { VideoScript } from '@/utils/videoScriptGenerator';

interface VideoScriptPreviewProps {
  videoScript: VideoScript;
  onDownload: (format: 'json' | 'txt') => void;
}

export function VideoScriptPreview({ videoScript, onDownload }: VideoScriptPreviewProps) {
  return (
    <div className="space-y-6">
      {/* Hook */}
      <div className="glass-lg p-8 rounded-lg border border-accent-gold/20 hover:border-accent-gold/50 transition-all">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🎯</div>
          <div className="flex-1">
            <h3 className="text-lg font-serif text-accent-gold mb-2">Hook ({videoScript.hook.duration})</h3>
            <p className="text-white text-lg leading-relaxed">{videoScript.hook.text}</p>
          </div>
        </div>
      </div>

      {/* Scenes */}
      <div className="space-y-6">
        {videoScript.scenes.map((scene, index) => (
          <div key={index} className="glass-lg p-8 rounded-lg border border-accent-neon-blue/20 hover:border-accent-neon-blue/50 transition-all">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🎨</div>
              <div className="flex-1">
                <h3 className="text-lg font-serif text-accent-neon-blue mb-2">
                  Scene {index + 1}: {scene.title} ({scene.duration})
                </h3>
                <p className="text-white text-base leading-relaxed mb-4">{scene.description}</p>
                <div className="flex flex-wrap gap-2">
                  {scene.visualCues.map((cue, i) => (
                    <span key={i} className="px-3 py-1 bg-accent-neon-blue/10 border border-accent-neon-blue/30 rounded-full text-sm text-accent-neon-blue">
                      {cue}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="glass-lg p-8 rounded-lg border border-accent-gold/20 hover:border-accent-gold/50 transition-all">
        <div className="flex items-start gap-4">
          <div className="text-3xl">✨</div>
          <div className="flex-1">
            <h3 className="text-lg font-serif text-accent-gold mb-2">Call-to-Action ({videoScript.cta.duration})</h3>
            <p className="text-white text-lg leading-relaxed">{videoScript.cta.text}</p>
          </div>
        </div>
      </div>

      {/* Aesthetic & Download */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-lg p-8 rounded-lg">
          <h3 className="text-lg font-serif text-white mb-4">Visual Aesthetic</h3>
          <p className="text-foreground-secondary leading-relaxed">{videoScript.aesthetic}</p>
        </div>

        <div className="glass-lg p-8 rounded-lg">
          <h3 className="text-lg font-serif text-white mb-4">Export Script</h3>
          <div className="space-y-3">
            <button
              onClick={() => onDownload('json')}
              className="w-full px-4 py-2 bg-white/5 hover:bg-accent-gold hover:text-black border border-white/10 hover:border-accent-gold text-white font-medium rounded-lg transition-all duration-200"
            >
              📄 Download as JSON
            </button>
            <button
              onClick={() => onDownload('txt')}
              className="w-full px-4 py-2 bg-white/5 hover:bg-accent-neon-blue hover:text-black border border-white/10 hover:border-accent-neon-blue text-white font-medium rounded-lg transition-all duration-200"
            >
              📝 Download as Text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
