'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ApiResponse {
  ok: boolean;
  message?: ChatMessage;
  error?: string;
}

// Suggested quick actions
const QUICK_ACTIONS = [
  { label: '💡 How do I summarize a PDF?', message: 'How do I summarize a PDF?' },
  { label: '🔍 How to extract data from PDFs?', message: 'How do I extract structured data from a PDF?' },
  { label: '📧 How does the mailer work?', message: 'How does the Silk Mailer work?' },
  { label: '💰 How do I get credits?', message: 'How do I get more credits?' },
];

export function ChatSupport() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '✨ Welcome to **Silk Support**! I\'m here to help you with anything about the platform — from PDF summarization to email campaigns. What can I assist you with today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  // Handle Escape key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data: ApiResponse = await res.json();

      if (data.ok && data.message) {
        setMessages((prev) => [...prev, data.message!]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `❌ Sorry, I encountered an error: ${data.error || 'Unknown error'}. Please try again.`,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '❌ Network error — please check your connection and try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-2xl shadow-2xl hover:shadow-accent-gold/40 hover:scale-110 transition-all duration-300 animate-fade-in"
          aria-label="Open chat support"
        >
          💬
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 animate-fade-in ${
            isMinimized
              ? 'bottom-6 right-6 w-72 h-14'
              : 'bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh]'
          }`}
        >
          <div className="glass-lg h-full flex flex-col overflow-hidden shadow-2xl border border-accent-gold/20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-accent-gold/10 to-accent-neon-blue/5 cursor-pointer">
              <div
                className="flex items-center gap-3 flex-1"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-lg">
                  ✨
                </div>
                <div>
                  <h3 className="text-white font-serif text-base font-semibold leading-tight">
                    Silk Support
                  </h3>
                  <p className="text-foreground-secondary text-xs">
                    {isLoading ? 'Typing...' : 'AI Assistant'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-foreground-secondary hover:text-white transition-all"
                  aria-label={isMinimized ? 'Maximize' : 'Minimize'}
                >
                  {isMinimized ? '□' : '─'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center text-foreground-secondary hover:text-red-400 transition-all"
                  aria-label="Close chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      } animate-fade-in-up`}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium rounded-br-md'
                            : 'glass rounded-bl-md border border-white/5'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div
                            className="prose prose-invert prose-sm max-w-none [&_strong]:text-accent-gold [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_a]:text-accent-neon-blue [&_a:hover]:text-accent-gold"
                            dangerouslySetInnerHTML={{
                              __html: msg.content
                                .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/40 p-2 rounded-lg my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
                                .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-accent-neon-blue">$1</code>')
                                .replace(/### ([^\n]+)/g, '<h4 class="text-accent-gold font-serif text-sm font-semibold mt-3 mb-1">$1</h4>')
                                .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-accent-gold">$1</strong>')
                                .replace(/\n/g, '<br/>'),
                            }}
                          />
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="glass rounded-2xl px-4 py-3 rounded-bl-md">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-accent-gold animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-accent-gold animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-accent-gold animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length === 1 && (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-foreground-secondary mb-2">Quick actions:</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_ACTIONS.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(action.message)}
                          className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-accent-gold/20 border border-white/10 hover:border-accent-gold/40 text-foreground-secondary hover:text-accent-gold transition-all whitespace-nowrap"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <form
                  onSubmit={handleSubmit}
                  className="p-4 border-t border-white/10"
                >
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything..."
                        rows={1}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-foreground placeholder-foreground-secondary/50 resize-none focus:outline-none focus:border-accent-neon-blue focus:ring-1 focus:ring-accent-neon-blue/30 transition-all"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="w-11 h-11 rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-accent-gold/30 transition-all shrink-0"
                    >
                      ↑
                    </button>
                  </div>
                  <p className="text-[10px] text-foreground-secondary/60 mt-1.5 text-center">
                    Powered by AI · Responses may be inaccurate
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}