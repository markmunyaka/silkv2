import type { GeneratedMessage, LLMGeneratorConfig, ThreadMessage } from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM Sequence Generator
 *
 * If threadHistory is empty → cold B2B introduction (2-3 sentences).
 * If threadHistory exists → context-aware follow-up reply.
 * Routes to OpenAI, Anthropic, or Google GenAI via REST.
 */
export async function generateMessage(
  senderEmail: string,
  receiverEmail: string,
  threadHistory: ThreadMessage[],
  config: LLMGeneratorConfig,
): Promise<GeneratedMessage> {
  const isInitial = threadHistory.length === 0;
  const messages = buildPrompt(senderEmail, receiverEmail, threadHistory, isInitial);

  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(messages, config);
    case 'google':
      return callGoogleGenAI(messages, config);
    case 'openai':
    default:
      return callOpenAI(messages, config);
  }
}

// ─── Prompt builder ────────────────────────────────────────────────────────

function buildPrompt(
  senderEmail: string,
  receiverEmail: string,
  threadHistory: ThreadMessage[],
  isInitial: boolean,
): ChatMessage[] {
  const systemPrompt =
    'You are a professional B2B business development associate. ' +
    'Write natural, concise business emails that sound like a real human wrote them. ' +
    'Avoid marketing jargon, buzzwords, and overly enthusiastic language. ' +
    'Use realistic sentence fragments, occasional mild contractions, and varied sentence lengths. ' +
    'Never use exclamation marks excessively. ' +
    'Never mention that this is an AI-generated message. ' +
    'Keep responses to 2-4 sentences. ' +
    'Use the sender and recipient email domains to infer plausible business contexts. ' +
    'ALWAYS respond with valid JSON: { "subject": "...", "body": "..." }';

  const senderDomain = senderEmail.split('@')[1] ?? 'company.com';
  const receiverDomain = receiverEmail.split('@')[1] ?? 'company.com';

  if (isInitial) {
    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          `Generate a realistic cold B2B introduction email from someone at ${senderDomain} ` +
          `to someone at ${receiverDomain}. ` +
          `2-3 sentences, referencing a plausible business context (e.g., industry trend, ` +
          `mutual connection, or relevant product). Professional but warm tone. Invites a response. ` +
          `Respond with JSON only.`,
      },
    ];
  }

  const threadText = threadHistory
    .map((m) => `[${m.role.toUpperCase()}] ${m.content}`)
    .join('\n');
  const lastRole = threadHistory[threadHistory.length - 1]?.role;

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        `Here is the email thread so far:\n${threadText}\n\n` +
        `Generate a natural ${lastRole === 'sent' ? 'reply' : 'follow-up'} ` +
        `from ${lastRole === 'sent' ? `recipient at ${receiverDomain}` : `sender at ${senderDomain}`}. ` +
        `Keep context consistent with the conversation history. 2-3 sentences. Respond with JSON only.`,
    },
  ];
}

// ─── OpenAI ────────────────────────────────────────────────────────────────

async function callOpenAI(messages: ChatMessage[], config: LLMGeneratorConfig): Promise<GeneratedMessage> {
  const model = config.model ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.85, max_tokens: 300, response_format: { type: 'json_object' } }),
  });
  if (!response.ok) throw new Error(`OpenAI error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return parseJsonResponse(data.choices?.[0]?.message?.content ?? '');
}

// ─── Anthropic ─────────────────────────────────────────────────────────────

async function callAnthropic(messages: ChatMessage[], config: LLMGeneratorConfig): Promise<GeneratedMessage> {
  const model = config.model ?? 'claude-3-haiku-20240307';
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
  const conversationMessages = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user' as const,
    content: m.content,
  }));
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system: systemMsg, messages: conversationMessages, max_tokens: 300, temperature: 0.85 }),
  });
  if (!response.ok) throw new Error(`Anthropic error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return parseJsonResponse(data.content?.[0]?.text ?? '');
}

// ─── Google GenAI ──────────────────────────────────────────────────────────

async function callGoogleGenAI(messages: ChatMessage[], config: LLMGeneratorConfig): Promise<GeneratedMessage> {
  const model = config.model ?? 'gemini-2.0-flash';
  const googleContents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: googleContents,
        generationConfig: { temperature: 0.85, maxOutputTokens: 300, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!response.ok) throw new Error(`Google GenAI error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return parseJsonResponse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}

// ─── JSON parser ───────────────────────────────────────────────────────────

function parseJsonResponse(raw: string): GeneratedMessage {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
      throw new Error('Missing subject or body');
    }
    return { subject: parsed.subject.trim(), body: parsed.body.trim() };
  } catch {
    const lines = cleaned.split('\n').filter(Boolean);
    const subject = lines[0]?.replace(/^["']|["']$/g, '').slice(0, 100) ?? 'Re: Following up';
    const body = lines.slice(1).join('\n').trim() || cleaned;
    return { subject, body };
  }
}