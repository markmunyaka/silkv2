// DomainManager – UI for checking and purchasing a domain via Name.com
// ------------------------------------------------------------------------
// This component lets a logged‑in user:
//   1. Enter a domain name.
//   2. Check its availability (calls GET /api/domains/check).
//   3. If available, purchase it (calls POST /api/domains/purchase).
//   4. Shows loading states, success messages and error handling.
//
// Tailwind classes follow the visual style used elsewhere in the app.

import { useState, useEffect, useRef } from 'react';

interface CheckResult {
  available: boolean;
  price?: string;
  domain: string;
}

export default function DomainManager() {
  const [domain, setDomain] = useState('');
  const [checking, setChecking] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const resetMessages = () => {
    setError('');
    setSuccess('');
    setCheckResult(null);
  };

  // Debounced availability check as the user types
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!domain.trim()) {
      setCheckResult(null);
      setError('');
      return;
    }
    // Clear any existing timer
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      setError('');
      try {
        const res = await fetch(`/api/domains/check?query=${encodeURIComponent(domain)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to check domain');
        }
        setCheckResult({ available: data.available, price: data.price, domain: data.domain });
      } catch (e: any) {
        setError(e.message);
        setCheckResult(null);
      } finally {
        setChecking(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [domain]);

  const handleCheck = async () => {
    // Manual trigger (useful if user clicks button)
    setError('');
    if (!domain.trim()) {
      setError('Please enter a domain name');
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/api/domains/check?query=${encodeURIComponent(domain)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to check domain');
      }
      setCheckResult({ available: data.available, price: data.price, domain: data.domain });
    } catch (e: any) {
      setError(e.message);
      setCheckResult(null);
    } finally {
      setChecking(false);
    }
  };


  const handlePurchase = async () => {
    if (!checkResult?.available) return;
    setPurchasing(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/domains/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: checkResult.domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Purchase failed');
      }
      // Purchase succeeded – show success and any DNS result
      const dnsInfo = data.dnsResult ? ` (Vercel DNS configured)` : '';
      setSuccess(`Domain ${checkResult.domain} purchased successfully${dnsInfo}.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="glass-lg p-8 rounded-xl max-w-2xl mx-auto animate-fade-in-up">
      <h2 className="text-2xl font-serif text-white mb-4">Domain Manager</h2>
      <p className="text-foreground-secondary mb-6">Enter a domain to see if it’s available and purchase it instantly.</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="example.com"
          value={domain}
          onChange={e => setDomain(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:bg-white/8 focus:border-accent-neon-blue outline-none"
          disabled={checking || purchasing}
        />
        <button
          onClick={handleCheck}
          disabled={checking || purchasing}
          className="px-4 py-2.5 bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold rounded-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checking ? 'Checking…' : 'Check'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/80 border border-red-700/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {checkResult && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-white">
            Domain <span className="font-medium">{checkResult.domain}</span> is{' '}
            {checkResult.available ? (
              <span className="text-green-400 font-medium">available</span>
            ) : (
              <span className="text-red-400 font-medium">unavailable</span>
            )}.
          </p>
          {checkResult.available && checkResult.price && (
            <p className="text-foreground-secondary mt-1">Price: <span className="font-medium">${checkResult.price}</span> / year</p>
          )}
        </div>
      )}

      {checkResult?.available && (
        <button
          onClick={handlePurchase}
          disabled={purchasing}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold rounded-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {purchasing ? 'Purchasing…' : 'Purchase Domain'}
        </button>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-950/10 border border-green-500/30 rounded-lg text-green-300">
          {success}
        </div>
      )}
    </div>
  );
}
