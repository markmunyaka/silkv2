# Domain Search Component - Integration Guide & Examples

Complete examples for integrating the premium Domain Search component.

---

## Example 1: Basic Integration

**`app/domains/page.tsx`** — Simple page with domain search

```tsx
import DomainSearch from '@/components/premium/DomainSearch';

export default function DomainsPage() {
  return (
    <main className="min-h-screen bg-black">
      {/* Background effect */}
      <div className="fixed inset-0 bg-gradient-to-b from-zinc-950 via-black to-black pointer-events-none" />

      {/* Content */}
      <div className="relative container mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Find Your Perfect Domain
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Search instantly for available domains and secure your brand identity today.
          </p>
        </div>

        {/* Domain Search Component */}
        <DomainSearch
          showSuggestions={true}
          onDomainSelect={(domain, price) => {
            console.log(`Selected ${domain} for $${price}/year`);
          }}
        />
      </div>
    </main>
  );
}
```

---

## Example 2: Dashboard Integration

**`app/dashboard/workspace/[workspaceId]/domains/page.tsx`** — Domain search within dashboard context

```tsx
'use client';

import { useState } from 'react';
import DomainSearch from '@/components/premium/DomainSearch';
import { DomainPurchaseDialog } from '@/components/premium/DomainPurchaseDialog';

interface DomainsPageProps {
  params: {
    workspaceId: string;
  };
}

export default function WorkspaceDomainPage({ params }: DomainsPageProps) {
  const [selectedDomain, setSelectedDomain] = useState<{
    domain: string;
    price: number;
  } | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

  const handleDomainSelect = (domain: string, price: number) => {
    setSelectedDomain({ domain, price });
    setShowPurchaseDialog(true);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-white/10 pb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Custom Domains</h1>
        <p className="text-zinc-400">
          Register a custom domain and route it to your workspace
        </p>
      </div>

      {/* Existing Domains List (if any) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Your Domains</h2>
        {/* Render existing domains here */}
      </div>

      {/* Domain Search */}
      <div className="py-8">
        <h2 className="text-lg font-semibold text-white mb-6">Register New Domain</h2>
        <DomainSearch
          workspaceId={params.workspaceId}
          onDomainSelect={handleDomainSelect}
          showSuggestions={true}
        />
      </div>

      {/* Purchase Dialog */}
      {selectedDomain && (
        <DomainPurchaseDialog
          domain={selectedDomain.domain}
          price={selectedDomain.price}
          currency="USD"
          isOpen={showPurchaseDialog}
          isLoading={false}
          onClose={() => setShowPurchaseDialog(false)}
          onConfirm={async (data) => {
            console.log('Purchase confirmed:', data);
            // Handle purchase here
          }}
          workspaceId={params.workspaceId}
        />
      )}
    </div>
  );
}
```

---

## Example 3: React Query Integration (Advanced)

**`hooks/useDomainSearchQuery.ts`** — Advanced hook using React Query for caching and background updates

```ts
import { useQuery, UseQueryResult } from '@tanstack/react-query';

interface UseDomainSearchQueryProps {
  query: string;
  enabled?: boolean;
}

interface DomainSearchResult {
  domain: string;
  available: boolean;
  price: number;
  currency: string;
}

export const useDomainSearchQuery = (
  { query, enabled = true }: UseDomainSearchQueryProps
): UseQueryResult<DomainSearchResult[], Error> => {
  return useQuery({
    queryKey: ['domains', query],
    queryFn: async () => {
      if (!query || query.trim().length < 3) {
        return [];
      }

      const response = await fetch(
        `/api/domains/check?domains=${encodeURIComponent(query)}&includePrice=true`
      );

      if (!response.ok) {
        throw new Error('Failed to search domains');
      }

      const data = await response.json();
      return data.data.results;
    },
    enabled: enabled && query.trim().length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

---

## Example 4: Custom Styling & Theming

**Tailwind CSS Custom Config for Premium Effects** — Add to `tailwind.config.ts`

```ts
const tailwindConfig = {
  theme: {
    extend: {
      // Glass morphism backdrop blur
      backdropBlur: {
        glass: '10px',
      },

      // Smooth animations
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },

      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },

      // Premium color palette
      colors: {
        emerald: {
          350: '#6ee7b7',
        },
        zinc: {
          850: '#27272a',
          925: '#14141a',
        },
      },
    },
  },
};
```

---

## Example 5: Full Page Layout with Features

**`app/get-domain/page.tsx`** — Landing page for domain search with features

```tsx
import DomainSearch from '@/components/premium/DomainSearch';
import { Globe, Zap, Shield, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'Instant Search',
    description: 'Check availability across all TLDs in real-time',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Get results in milliseconds with our optimized API',
  },
  {
    icon: Shield,
    title: 'Secure Registration',
    description: 'WHOIS privacy protection and auto-renewal options',
  },
  {
    icon: BarChart3,
    title: 'Smart Suggestions',
    description: 'Get alternative domains and pricing recommendations',
  },
];

export default function GetDomainPage() {
  return (
    <main className="min-h-screen bg-black">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-black to-black pointer-events-none" />

      <div className="relative">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Your Brand Deserves <br />
              <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                The Perfect Domain
              </span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
              Search for available domains, get instant pricing, and register with privacy
              protection. All in one place.
            </p>
          </div>

          {/* Search Component */}
          <div className="max-w-2xl mx-auto mb-20">
            <DomainSearch showSuggestions={true} />
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <Icon className="w-8 h-8 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-zinc-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-20 border-t border-white/10">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">
            Frequently Asked Questions
          </h2>

          <div className="max-w-2xl mx-auto space-y-4">
            {[
              {
                q: 'How long does registration take?',
                a: 'Most domains activate within 15-30 minutes. SSL certificates typically issue within 5-15 minutes.',
              },
              {
                q: 'Can I use auto-renewal?',
                a: 'Yes! Auto-renewal is optional and can be toggled in your domain settings at any time.',
              },
              {
                q: 'Is WHOIS privacy included?',
                a: 'WHOIS privacy protection is optional but recommended. It hides your personal information from public registries.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and digital payment methods through Stripe.',
              },
            ].map((item, idx) => (
              <details
                key={idx}
                className="group p-4 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/8 transition-colors"
              >
                <summary className="font-medium text-white flex items-center justify-between">
                  {item.q}
                  <span className="text-zinc-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="mt-4 text-zinc-400 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
```

---

## Example 6: Component Usage Patterns

### Pattern 1: With Loading & Error Boundaries

```tsx
export function DomainSearchWithBoundary() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <React.Suspense fallback={<LoadingSpinner />}>
        <DomainSearch />
      </React.Suspense>
    </ErrorBoundary>
  );
}
```

### Pattern 2: With Analytics Tracking

```tsx
export function DomainSearchWithTracking() {
  const handleDomainSelect = (domain: string, price: number) => {
    gtag.event('domain_selected', {
      domain,
      price,
      timestamp: new Date().toISOString(),
    });
  };

  return <DomainSearch onDomainSelect={handleDomainSelect} />;
}
```

### Pattern 3: With A/B Testing

```tsx
export function DomainSearchWithABTest() {
  const isVariant = useABTest('domain-search-v2');

  return isVariant ? <DomainSearch /> : <LegacyDomainSearch />;
}
```

---

## Styling Reference

**Key Tailwind Classes Used in Components:**

### Glassmorphism
- `bg-white/5` to `bg-white/30` (transparency levels)
- `border-white/10` to `border-white/30` (border opacity)
- `backdrop-blur-xl` (glass effect)
- `backdrop-saturate-150` (color depth)

### Gradients
- `bg-gradient-to-r from-emerald-500 to-blue-500`
- `from-emerald-500/20 via-blue-500/20 to-purple-500/20`

### Animations
- `animate-spin` (loading)
- `animate-pulse` (skeleton)
- `animate-in fade-in` (entrance)

### Responsive
- `text-sm sm:text-base md:text-lg` (font scaling)
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (grid layout)
- `hidden sm:flex` (show/hide by breakpoint)
