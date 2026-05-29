/**
 * Kling AI Video Service — Silk Road V2
 *
 * Asynchronous text-to-video generation via the Kling 3.0 API.
 *
 * Because video rendering can take up to 90 seconds, this service exposes
 * two operations:
 *   1. `createVideoTask` — submits a text prompt and returns a `task_id`.
 *   2. `checkVideoStatus`  — polls the task endpoint for completion.
 *
 * Authentication uses Kling's HMAC-SHA256 JWT scheme:
 *   - `process.env.KLING_ACCESS_KEY`
 *   - `process.env.KLING_SECRET_KEY`
 *
 * @see https://docs.klingai.com/api-reference/video/generate
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response envelope from every Kling API call. */
interface KlingApiResponse<T> {
  code: number;            // 0 = success
  message: string;
  request_id: string;
  data: T;
}

/** Payload returned by POST /v1/videos/generations. */
interface CreateVideoTaskData {
  task_id: string;
}

/** Status of a video generation task. */
export type KlingTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

/** Payload returned by GET /v1/tasks/:taskId. */
interface TaskStatusData {
  task_id: string;
  status: KlingTaskStatus;
  /** Present only when status === 'SUCCEEDED'. */
  videos?: Array<{
    id: string;
    url: string;              // Temporary download link (expires ~24 h)
    duration: string;         // e.g. "5.0"
    width: number;
    height: number;
    cover: string;            // Thumbnail URL
  }>;
  /** Present only when status === 'FAILED'. */
  error?: {
    code: number;
    message: string;
  };
  created_at: number;
  updated_at: number;
}

/** Public result returned by `createVideoTask`. */
export interface CreateVideoTaskResult {
  taskId: string;
}

/** Public result returned by `checkVideoStatus`. */
export interface CheckVideoStatusResult {
  taskId: string;
  status: KlingTaskStatus;
  /** Available only after SUCCEEDED. */
  videoUrl?: string;
  /** Available only after SUCCEEDED. */
  thumbnailUrl?: string;
  /** Error details when FAILED. */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Kling AI API v3 endpoints.
 *
 * Note: The Kling API uses an older-style REST convention.
 *   - Generate task: POST /v1/videos/text2video
 *   - Query task:    GET  /v1/videos/text2video/{taskId}
 */
const KLING_BASE_URL = 'https://api.klingai.com';
const KLING_GENERATION_ENDPOINT = '/v1/videos/text2video';
const KLING_TASK_ENDPOINT = '/v1/videos/text2video';
const KLING_MODEL = 'kling-v3';

/** Maximum time (ms) to wait for a single API call. */
const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// JWT Authentication Helpers
// ---------------------------------------------------------------------------

/**
 * Generate an HMAC-SHA256 signed JWT for Kling API authentication.
 *
 * Kling requires a custom JWT with the following claims:
 *   - `iss` (issuer) = access_key
 *   - `exp` (expiration) = current epoch + 1800 s (30 min)
 *   - `nbf` (not before) = current epoch - 5 s (clock skew tolerance)
 *
 * The JWT is signed with the HMAC-SHA256 algorithm using the secret_key.
 */
function generateKlingJwt(): string {
  const accessKey = process.env.KLING_ACCESS_KEY ?? '';
  const secretKey = process.env.KLING_SECRET_KEY ?? '';

  if (!accessKey || !secretKey) {
    throw new Error(
      'Kling API credentials not configured. Set KLING_ACCESS_KEY and KLING_SECRET_KEY in environment variables.',
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // --- Build header ---
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // --- Build payload ---
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30-minute expiry
    nbf: now - 5,    // 5-second clock-skew tolerance
  };

  // --- Encode header & payload ---
  const base64Encode = (obj: Record<string, unknown>): string => {
    const json = JSON.stringify(obj);
    // Use safe Base64url encoding
    return Buffer.from(json)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const headerEncoded = base64Encode(header);
  const payloadEncoded = base64Encode(payload);

  // --- Sign with HMAC-SHA256 ---
  const { createHmac } = require('crypto');
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = createHmac('sha256', secretKey)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// ---------------------------------------------------------------------------
// HTTP Helper
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around `fetch` that injects the Kling JWT token and
 * standard headers, plus an AbortSignal timeout.
 */
async function klingFetch<T>(
  endpoint: string,
  options: {
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
  } = { method: 'GET' },
): Promise<KlingApiResponse<T>> {
  const token = generateKlingJwt();
  const url = `${KLING_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const fetchOptions: RequestInit = {
    method: options.method,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Kling API responded with ${response.status} ${response.statusText}: ${errorBody}`,
    );
  }

  const json: KlingApiResponse<T> = await response.json();

  if (json.code !== 0) {
    throw new Error(
      `Kling API error [code=${json.code}]: ${json.message || 'Unknown error'}`,
    );
  }

  return json;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a text-to-video generation task to Kling 3.0.
 *
 * @param prompt - The text description of the video to generate.
 * @param options - Optional overrides (duration, aspect ratio, etc.).
 * @returns The `task_id` assigned by Kling.
 *
 * @throws If credentials are missing, the API call fails, or the request times out.
 */
export async function createVideoTask(
  prompt: string,
  options?: {
    duration?: number;   // seconds, default 5
    aspect_ratio?: string; // e.g. "16:9", "9:16", "1:1"
  },
): Promise<CreateVideoTaskResult> {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('A non-empty `prompt` string is required to create a video task.');
  }

  try {
    const response = await klingFetch<CreateVideoTaskData>(KLING_GENERATION_ENDPOINT, {
      method: 'POST',
      body: {
        model: KLING_MODEL,
        prompt: prompt.trim(),
        duration: options?.duration ?? 5,
        aspect_ratio: options?.aspect_ratio ?? '16:9',
      },
    });

    return { taskId: response.data.task_id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KlingService] createVideoTask failed:', message);
    throw error; // Re-throw so the caller can handle it appropriately
  }
}

/**
 * Poll the status of a previously submitted video generation task.
 *
 * @param taskId - The `task_id` returned by `createVideoTask`.
 * @returns The current status, and if SUCCEEDED, the video download URL.
 *
 * @throws If credentials are missing, the API call fails, or the request times out.
 */
export async function checkVideoStatus(taskId: string): Promise<CheckVideoStatusResult> {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('A valid `taskId` string is required to check video status.');
  }

  try {
    const response = await klingFetch<TaskStatusData>(
      `${KLING_TASK_ENDPOINT}/${encodeURIComponent(taskId)}`,
      { method: 'GET' },
    );

    const data = response.data;

    const result: CheckVideoStatusResult = {
      taskId: data.task_id,
      status: data.status,
    };

    if (data.status === 'SUCCEEDED' && data.videos && data.videos.length > 0) {
      result.videoUrl = data.videos[0].url;
      result.thumbnailUrl = data.videos[0].cover;
    }

    if (data.status === 'FAILED' && data.error) {
      result.errorMessage = data.error.message;
    }

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[KlingService] checkVideoStatus failed for task ${taskId}:`, message);
    throw error; // Re-throw so the caller can handle it appropriately
  }
}