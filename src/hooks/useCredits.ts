import { useState, useCallback, useEffect } from 'react';

export function useCredits(userId: string | undefined) {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch credits on mount or userId change
  useEffect(() => {
    if (userId) {
      fetchCredits();
    }
  }, [userId]);

  const fetchCredits = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/credits/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch credits');

      const data = await res.json();
      setCredits(data.credits ?? 2); // Default to 2 trial credits
    } catch (err) {
      console.error('Error fetching credits:', err);
      setError(err instanceof Error ? err.message : 'Error fetching credits');
      setCredits(2); // Default to 2 trial credits on error
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const deductCredit = useCallback(async (amount = 1) => {
    if (!userId) return false;
    setError(null);

    try {
      const res = await fetch(`/api/credits/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', amount }),
      });

      if (res.status === 402) {
        setError('Insufficient credits. Please upgrade your plan.');
        return false;
      }

      if (!res.ok) throw new Error('Failed to deduct credit');

      const data = await res.json();
      setCredits(data.credits ?? (credits ?? 2) - amount);
      return true;
    } catch (err) {
      console.error('Error deducting credit:', err);
      setError(err instanceof Error ? err.message : 'Error deducting credit');
      return false;
    }
  }, [userId, credits]);

  const addCredits = useCallback(async (amount = 1) => {
    if (!userId) return false;
    setError(null);

    try {
      const res = await fetch(`/api/credits/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', amount }),
      });

      if (!res.ok) throw new Error('Failed to add credits');

      const data = await res.json();
      setCredits(data.credits);
      return true;
    } catch (err) {
      console.error('Error adding credits:', err);
      setError(err instanceof Error ? err.message : 'Error adding credits');
      return false;
    }
  }, [userId]);

  return {
    credits: credits ?? 2,
    loading,
    error,
    fetchCredits,
    deductCredit,
    addCredits,
    hasCredits: (credits ?? 0) > 0,
  };
}
