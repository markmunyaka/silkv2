'use client';

import { useCallback } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

interface TurnstileWidgetProps {
  siteKey: string;
  onTokenChange: (token: string) => void;
  className?: string;
}

export function TurnstileWidgetComponent({ siteKey, onTokenChange, className = '' }: TurnstileWidgetProps) {
  const handleSuccess = useCallback((token: string) => {
    onTokenChange(token);
  }, [onTokenChange]);

  return (
    <div className={`turnstile-widget ${className}`}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={handleSuccess}
      />
    </div>
  );
}