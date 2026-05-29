'use client';

import { useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';
import Link from 'next/link';
import VoiceCommandButton from '@/components/VoiceCommandButton';

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Navigation />
      
      <main className="min-h-screen bg-black text-white pt-20">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
          {/* Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/landing-bg.png')" }}
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70" />
          
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden z-[1]">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-yellow-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
            <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-900 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-5xl mx-auto text-center animate-fade-in-up">
            <div className="mb-6 inline-block">
              <span className="badge-gold">✨ Powered by Advanced AI</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-serif text-white mb-6 leading-tight">
              Transform Your <span className="text-gold">Documents</span> Into Elegance
            </h1>

            <p className="text-xl text-foreground-secondary mb-8 max-w-2xl mx-auto leading-relaxed">
              Silk Road V2 delivers premium PDF intelligence with a touch of luxury. Let our advanced AI 
              transform lengthy documents into concise, elegant summaries in seconds.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              {isAuthenticated ? (
                <>
                  <Link href="/upload" className="btn-premium inline-block">
                    Start Summarizing
                  </Link>
                  <Link href="/dashboard" className="btn-secondary inline-block">
                    View Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signup" className="btn-premium inline-block">
                    Get Started Free
                  </Link>
                  <Link href="/auth/login" className="btn-secondary inline-block">
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="glass p-6 text-center rounded-xl">
                <div className="text-3xl font-serif text-gold mb-2">99.8%</div>
                <p className="text-foreground-secondary">Accuracy Rate</p>
              </div>
              <div className="glass p-6 text-center rounded-xl">
                <div className="text-3xl font-serif text-neon-blue mb-2">{'<2s'}</div>
                <p className="text-foreground-secondary">Average Processing</p>
              </div>
              <div className="glass p-6 text-center rounded-xl">
                <div className="text-3xl font-serif text-gold mb-2">∞</div>
                <p className="text-foreground-secondary">No Limits</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-serif text-white mb-4">Why Choose Silk Road V2</h2>
            <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
              Experience the perfect blend of technology and elegance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '⚡',
                title: 'Lightning Fast',
                description: 'Advanced algorithms process documents in seconds, not minutes'
              },
              {
                icon: '🎨',
                title: 'Premium Design',
                description: 'Luxury interface that respects your time and aesthetic sensibilities'
              },
              {
                icon: '🔒',
                title: 'Secure & Private',
                description: 'Enterprise-grade encryption keeps your documents completely private'
              },
              {
                icon: '🧠',
                title: 'AI-Powered',
                description: 'Cutting-edge machine learning understands context and nuance'
              },
              {
                icon: '📊',
                title: 'Smart Insights',
                description: 'Extract key points, metrics, and actionable insights automatically'
              },
              {
                icon: '∞',
                title: 'Unlimited Scale',
                description: 'Process documents of any size without limitations'
              },
            ].map((feature, index) => (
              <div key={index} className="glass-lg p-8 text-center hover:shadow-2xl transition-all duration-300 group">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-xl font-serif text-white mb-3">{feature.title}</h3>
                <p className="text-foreground-secondary text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <section className="section-container">
          <div className="glass-lg p-12 text-center rounded-2xl">
            <h3 className="text-3xl font-serif text-white mb-4">Ready to Elevate Your Workflow?</h3>
            <p className="text-foreground-secondary mb-8 text-lg">
              Join thousands of professionals using Silk Road V2 for intelligent document processing
            </p>
            {!isAuthenticated && (
              <Link href="/auth/signup" className="btn-premium inline-block">
                Create Your Account
              </Link>
            )}
          </div>
        </section>

        {/* Voice Command Button */}
        <div className="flex justify-center my-8">
          <VoiceCommandButton />
        </div>

        {/* About Section */}
        <section className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-serif text-white mb-4">About Silk Road V2</h2>
            <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
              We turn static files into dynamic media, making information effortless to consume. Whether it's a PDF, spreadsheet, or slide deck, our platform extracts core insights and instantly delivers them as engaging audio, video, or interactive summaries. By automating the transformation of raw data into rich, consumable formats, we free you from endless scrolling and reading. Our mission is simple: turn every document into a conversation, so knowledge flows as naturally as dialogue.
            </p>
          </div>
        </section>

        {/* Blog Section */}
        <section className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-serif text-white mb-4">Blog</h2>
            <p className="text-foreground-secondary text-lg max-w-2xl mx-auto mb-6">Insights, trends, and deep dives from our team.</p>
            <ul className="space-y-4">
              <li><a href="#" className="text-accent-gold hover:underline">When AI Meets Audio: How Generative Models Are Redefining Sound</a></li>
              <li><a href="#" className="text-accent-gold hover:underline">Streamlined Success: Productivity Hacks for the Modern Knowledge Worker</a></li>
              <li><a href="#" className="text-accent-gold hover:underline">The Minimalist Tech Movement: Stripping Down to Essentials for Maximum Impact</a></li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 mt-20 py-12">
          <div className="max-w-7xl mx-auto px-6 text-center text-foreground-secondary text-sm">
            <p>© 2026 Silk Road V2. Crafted with elegance.</p>
          </div>
        </footer>
      </main>
    </>
  );
}