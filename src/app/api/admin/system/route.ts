import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type {
  SystemMetrics,
  SystemLogEntry,
  AdminApiResponse,
} from '@/types/admin';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// GET /api/admin/system
// Returns simulated system metrics + recent log entries
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
): Promise<NextResponse<AdminApiResponse<{ metrics: SystemMetrics; logs: SystemLogEntry[] }>>> {
  try {
    // ---- Simulated / computed metrics ----
    const metrics: SystemMetrics = {
      apiLatencyMs: Math.round(Math.random() * 80 + 20),           // 20–100ms
      llmTokensConsumed: Math.round(Math.random() * 15000 + 5000), // 5k–20k
      activeWorkers: Math.floor(Math.random() * 4 + 1),            // 1–4
      uptimeHours: Math.round(Math.random() * 720 + 48),           // 48–768h
      memoryUsageMb: Math.round(Math.random() * 400 + 200),        // 200–600MB
      dbSizeMb: Math.round(Math.random() * 10 + 5),                // 5–15MB
    };

    // ---- Recent system log entries (sourced from real DB events) ----
    let recentFiles: Array<{ id: string; fileName: string; createdAt: Date; user: { name: string } }> = [];
    let recentVideos: Array<{ id: string; prompt: string; status: string; errorMessage: string | null; createdAt: Date; user: { name: string } }> = [];

    try {
      recentFiles = await prisma.file.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      });
    } catch {
      // File table may not exist yet
    }

    try {
      recentVideos = await prisma.videoGeneration.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      });
    } catch {
      // VideoGeneration table may not exist yet
    }

    const logs: SystemLogEntry[] = [
      ...recentFiles.map(
        (f): SystemLogEntry => ({
          id: `file-${f.id}`,
          timestamp: f.createdAt.toISOString(),
          level: 'info' as const,
          source: 'File Processor',
          message: `PDF processed: "${f.fileName}"`,
          details: `Owner: ${f.user.name}`,
        }),
      ),
      ...recentVideos.map(
        (v): SystemLogEntry => ({
          id: `video-${v.id}`,
          timestamp: v.createdAt.toISOString(),
          level: v.status === 'failed' ? 'error' as const : 'info' as const,
          source: 'Video Generator',
          message: `Video generation ${v.status}: "${v.prompt.slice(0, 60)}${v.prompt.length > 60 ? '…' : ''}"`,
          details: `Status: ${v.status}${v.errorMessage ? ` | Error: ${v.errorMessage}` : ''}`,
        }),
      ),
      {
        id: 'system-startup',
        timestamp: new Date().toISOString(),
        level: 'info' as const,
        source: 'System',
        message: 'Admin dashboard initialized',
      },
    ];

    // Sort by timestamp descending, take 15 max
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    logs.splice(15);

    return NextResponse.json({ ok: true, data: { metrics, logs } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/system]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}