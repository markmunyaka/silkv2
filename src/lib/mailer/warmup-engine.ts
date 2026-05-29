/**
 * Silk Pro Warmup Engine
 * Local-storage based inbox warming for deliverability
 */

export interface WarmupInbox {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromName?: string;
  dailyLimit: number;
  warmupPhase: 'cold' | 'warm' | 'hot';
  dailySentCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface WarmupPair {
  id: string;
  inboxA: string;
  inboxB: string;
  status: 'active' | 'paused' | 'completed';
  messageCount: number;
  lastActivity: string;
  createdAt: string;
}

export interface WarmupMessage {
  id: string;
  pairId: string;
  fromInbox: string;
  toInbox: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  sentAt?: string;
}

const STORAGE_KEY_INBOXES = 'silk_pro_warmup_inboxes';
const STORAGE_KEY_PAIRS = 'silk_pro_warmup_pairs';
const STORAGE_KEY_MESSAGES = 'silk_pro_warmup_messages';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Storage ───
function load<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

function save<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Inboxes ───
export function getWarmupInboxes(): WarmupInbox[] {
  return load<WarmupInbox>(STORAGE_KEY_INBOXES);
}

export function addWarmupInbox(inbox: Omit<WarmupInbox, 'id' | 'createdAt' | 'dailySentCount' | 'warmupPhase'>): WarmupInbox {
  const inboxes = getWarmupInboxes();
  const newInbox: WarmupInbox = {
    ...inbox,
    id: generateId(),
    createdAt: new Date().toISOString(),
    dailySentCount: 0,
    warmupPhase: 'cold',
  };
  inboxes.push(newInbox);
  save(STORAGE_KEY_INBOXES, inboxes);
  return newInbox;
}

export function removeWarmupInbox(id: string): void {
  const inboxes = getWarmupInboxes().filter(i => i.id !== id);
  save(STORAGE_KEY_INBOXES, inboxes);
}

export function updateWarmupInbox(id: string, updates: Partial<WarmupInbox>): void {
  const inboxes = getWarmupInboxes();
  const idx = inboxes.findIndex(i => i.id === id);
  if (idx === -1) return;
  inboxes[idx] = { ...inboxes[idx], ...updates };
  save(STORAGE_KEY_INBOXES, inboxes);
}

// ─── Pairs ───
export function getWarmupPairs(): WarmupPair[] {
  return load<WarmupPair>(STORAGE_KEY_PAIRS);
}

export function createWarmupPair(inboxA: string, inboxB: string): WarmupPair {
  const pairs = getWarmupPairs();
  const existing = pairs.find(p => (p.inboxA === inboxA && p.inboxB === inboxB) || (p.inboxA === inboxB && p.inboxB === inboxA));
  if (existing) return existing;

  const pair: WarmupPair = {
    id: generateId(),
    inboxA,
    inboxB,
    status: 'active',
    messageCount: 0,
    lastActivity: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  pairs.push(pair);
  save(STORAGE_KEY_PAIRS, pairs);
  return pair;
}

export function removeWarmupPair(id: string): void {
  const pairs = getWarmupPairs().filter(p => p.id !== id);
  save(STORAGE_KEY_PAIRS, pairs);
}

// ─── Messages ───
export function getWarmupMessages(pairId?: string): WarmupMessage[] {
  const all = load<WarmupMessage>(STORAGE_KEY_MESSAGES);
  return pairId ? all.filter(m => m.pairId === pairId) : all;
}

// ─── Simulation ───
const WARMUP_SUBJECTS = [
  'Following up on our conversation',
  'Quick question about your project',
  'Great connecting with you',
  'Thought this might interest you',
  'Checking in',
  'Thanks for the discussion',
  'Looking forward to our meeting',
  'Hope you\'re doing well',
  'Just following up',
  'Great to meet you',
];

const WARMUP_BODIES = [
  'Hi {{name}},\n\nIt was great speaking with you earlier. I wanted to follow up on a few points we discussed.\n\nBest regards,\n{{sender}}',
  'Hello {{name}},\n\nI hope this message finds you well. I was thinking about our conversation and wanted to reach out.\n\nCheers,\n{{sender}}',
  'Hi {{name}},\n\nJust checking in to see how things are going. Let me know if you need anything from me.\n\nBest,\n{{sender}}',
  'Hello {{name}},\n\nThanks for taking the time to connect. I really appreciate the insights you shared.\n\nWarmly,\n{{sender}}',
  'Hi {{name}},\n\nI came across something relevant to your work and thought you might find it interesting.\n\nTalk soon,\n{{sender}}',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function simulateWarmupMessage(pair: WarmupPair, fromInbox: WarmupInbox, toInbox: WarmupInbox): WarmupMessage {
  const subject = getRandomItem(WARMUP_SUBJECTS);
  let body = getRandomItem(WARMUP_BODIES);
  body = body.replace('{{name}}', toInbox.fromName || toInbox.email);
  body = body.replace('{{sender}}', fromInbox.fromName || fromInbox.email);

  const message: WarmupMessage = {
    id: generateId(),
    pairId: pair.id,
    fromInbox: fromInbox.id,
    toInbox: toInbox.id,
    subject,
    body,
    status: 'sent',
    sentAt: new Date().toISOString(),
  };

  return message;
}

export function runWarmupCycle(): { pairsProcessed: number; messagesSent: number } {
  const inboxes = getWarmupInboxes().filter(i => i.isActive);
  const pairs = getWarmupPairs().filter(p => p.status === 'active');
  let messagesSent = 0;
  let pairsProcessed = 0;

  for (const pair of pairs) {
    const inboxA = inboxes.find(i => i.id === pair.inboxA);
    const inboxB = inboxes.find(i => i.id === pair.inboxB);
    if (!inboxA || !inboxB) continue;

    // Check daily limits
    if (inboxA.dailySentCount >= inboxA.dailyLimit && inboxB.dailySentCount >= inboxB.dailyLimit) {
      continue;
    }

    // Determine who sends (alternate based on message count)
    const fromInbox = pair.messageCount % 2 === 0 ? inboxA : inboxB;
    const toInbox = pair.messageCount % 2 === 0 ? inboxB : inboxA;

    // Skip if sender hit daily limit
    if (fromInbox.dailySentCount >= fromInbox.dailyLimit) continue;

    // Simulate the message
    const message = simulateWarmupMessage(pair, fromInbox, toInbox);
    const allMessages = getWarmupMessages();
    allMessages.push(message);
    save(STORAGE_KEY_MESSAGES, allMessages);

    // Update counters
    updateWarmupInbox(fromInbox.id, { dailySentCount: fromInbox.dailySentCount + 1 });
    updateWarmupInbox(toInbox.id, {});
    updateWarmupInbox(fromInbox.id, {
      warmupPhase: fromInbox.dailySentCount + 1 > fromInbox.dailyLimit * 0.7 ? 'hot' : fromInbox.dailySentCount + 1 > fromInbox.dailyLimit * 0.3 ? 'warm' : 'cold',
    });

    // Update pair
    const allPairs = getWarmupPairs();
    const pIdx = allPairs.findIndex(p => p.id === pair.id);
    if (pIdx !== -1) {
      allPairs[pIdx].messageCount += 1;
      allPairs[pIdx].lastActivity = new Date().toISOString();
      save(STORAGE_KEY_PAIRS, allPairs);
    }

    messagesSent++;
    pairsProcessed++;
  }

  return { pairsProcessed, messagesSent };
}

export function getWarmupStats() {
  const inboxes = getWarmupInboxes();
  const pairs = getWarmupPairs();
  const messages = getWarmupMessages();
  const today = new Date().toDateString();
  const todayMessages = messages.filter(m => m.sentAt && new Date(m.sentAt).toDateString() === today);

  return {
    totalInboxes: inboxes.length,
    activeInboxes: inboxes.filter(i => i.isActive).length,
    totalPairs: pairs.filter(p => p.status === 'active').length,
    totalMessages: messages.length,
    todayMessages: todayMessages.length,
    coldInboxes: inboxes.filter(i => i.warmupPhase === 'cold').length,
    warmInboxes: inboxes.filter(i => i.warmupPhase === 'warm').length,
    hotInboxes: inboxes.filter(i => i.warmupPhase === 'hot').length,
    dailyCapacity: inboxes.reduce((sum, i) => sum + i.dailyLimit, 0),
    todaySent: inboxes.reduce((sum, i) => sum + i.dailySentCount, 0),
  };
}