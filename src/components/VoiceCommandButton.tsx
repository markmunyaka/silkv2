'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Simple voice‑command button using the Web Speech API.
 * Recognises two demo commands:
 *   • “summarize this pdf” – navigates to the upload page
 *   • “play the audio version” – navigates to the dashboard (where audio can be played)
 *
 * In a production app you would tie the commands to actual UI actions
 * (e.g., trigger a hidden file input or start audio playback on a specific item).
 */
export default function VoiceCommandButton() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const router = useRouter();

  // Browser SpeechRecognition support detection
  const SpeechRecognition =
    (typeof window !== 'undefined' &&
      (window.SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
    null;

  const startListening = () => {
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser');
      return;
    }
    const recognizer = new SpeechRecognition();
    recognizer.lang = 'en-US';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    recognizer.onstart = () => setListening(true);
    recognizer.onend = () => setListening(false);
    recognizer.onerror = (e) => {
      console.error('SpeechRecognition error', e);
      setListening(false);
    };
    recognizer.onresult = (event: SpeechRecognitionEvent) => {
      const spoken = event.results[0][0].transcript.trim();
      setTranscript(spoken);
    };
    recognizer.start();
  };

  // Effect to act on recognized transcript
  useEffect(() => {
    if (!transcript) return;
    const cmd = transcript.toLowerCase();
    if (cmd.includes('summarize this pdf')) {
      router.push('/upload');
    } else if (cmd.includes('play the audio version')) {
      router.push('/dashboard');
    } else {
      console.log('Unrecognized voice command:', transcript);
    }
    // Reset after handling
    setTranscript('');
  }, [transcript, router]);

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={listening}
      className="flex items-center gap-2 bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-2 px-4 rounded-lg hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-60"
    >
      {listening ? 'Listening…' : '🎙️ Talk to the app'}
    </button>
  );
}
