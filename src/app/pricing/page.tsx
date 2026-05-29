'use client';

import { Navigation } from '@/components/Navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function PricingPage() {
  const { isAuthenticated, user } = useAuth();

  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      description: 'Perfect to get started',
      features: [
        '2 PDF summaries included',
        'Basic text summaries',
        'Up to 50 pages per document',
        'Standard processing speed',
        'Email support',
      ],
      cta: 'Get Started',
      ctaLink: '/auth/signup',
      highlighted: false,
    },
    {
      name: 'Professional',
      price: '$9.99',
      period: '/month',
      description: 'For professionals & teams',
      features: [
        'Unlimited PDF summaries',
        'Audio generation (TTS)',
        'Video context animations',
        'Up to 200 pages per document',
        'Priority processing',
        'Advanced formatting options',
        'API access',
        'Priority email & chat support',
      ],
      cta: 'Upgrade Now',
      ctaLink: '/checkout/pro',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations',
      features: [
        'Everything in Professional',
        'White-label solution',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'On-premise deployment',
        'Advanced analytics',
        'Priority phone support',
      ],
      cta: 'Contact Sales',
      ctaLink: '/contact',
      highlighted: false,
    },
  ];

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-black pt-20">
        {/* Hero Section */}
        <section className="section-container text-center mb-16">
          <div className="mb-8 inline-block">
            <span className="badge-gold">💎 Transparent Pricing</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif text-white mb-4">
            Plans for Everyone
          </h1>
          <p className="text-foreground-secondary text-xl max-w-2xl mx-auto">
            Start free with 2 PDF credits. Upgrade anytime to unlock unlimited summaries, audio generation, and video context.
          </p>
        </section>

        {/* Pricing Cards */}
        <section className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`glass-lg p-8 rounded-2xl transition-all duration-300 ${
                  plan.highlighted
                    ? 'ring-2 ring-gold md:scale-105 md:shadow-2xl'
                    : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="mb-4 inline-block">
                    <span className="badge-gold">Most Popular</span>
                  </div>
                )}

                <h3 className="text-3xl font-serif text-white mb-2">{plan.name}</h3>
                <p className="text-foreground-secondary mb-6 text-sm">{plan.description}</p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-serif text-gold">{plan.price}</span>
                    {plan.period && <span className="text-foreground-secondary">{plan.period}</span>}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-gold flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-foreground-secondary text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Link
                  href={plan.ctaLink}
                  className={`w-full text-center py-3 rounded-lg font-semibold transition-all duration-300 block ${
                    plan.highlighted ? 'btn-premium' : 'btn-secondary'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-serif text-white mb-8 text-center">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: 'Can I cancel my subscription anytime?',
                  a: 'Yes, you can cancel at any time with no questions asked. Your access will remain active until the end of your billing period.',
                },
                {
                  q: 'Do you offer discounts for annual billing?',
                  a: 'Yes! Sign up for an annual plan and save 20% compared to monthly billing.',
                },
                {
                  q: 'What happens to my documents after I cancel?',
                  a: 'Your documents and summaries remain in your account archive. You can still download them, but cannot create new summaries without an active subscription.',
                },
                {
                  q: 'Can I upgrade or downgrade my plan?',
                  a: 'Absolutely! You can change your plan anytime. Upgrades take effect immediately, and downgrades apply at the end of your billing cycle.',
                },
              ].map((faq, index) => (
                <div key={index} className="glass p-6 rounded-xl">
                  <h3 className="font-serif text-lg text-white mb-2">{faq.q}</h3>
                  <p className="text-foreground-secondary text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-20 glass-lg p-12 text-center rounded-2xl">
            <h3 className="text-3xl font-serif text-white mb-4">Ready to transform your workflow?</h3>
            <p className="text-foreground-secondary mb-8">
              {isAuthenticated
                ? `Welcome back, ${user?.name}. Start with your ${2 - 1} remaining free credits.`
                : 'Start your free trial today. No credit card required.'}
            </p>
            {!isAuthenticated ? (
              <div className="flex gap-4 justify-center">
                <Link href="/auth/signup" className="btn-premium">
                  Get 2 Free Credits
                </Link>
                <Link href="/auth/login" className="btn-secondary">
                  Already have an account?
                </Link>
              </div>
            ) : (
              <Link href="/upload" className="btn-premium inline-block">
                Start Summarizing
              </Link>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
