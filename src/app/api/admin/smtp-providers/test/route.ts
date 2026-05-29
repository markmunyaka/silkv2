import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, secure, username, password, fromEmail } = body;

    if (!host || !username || !password || !fromEmail) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const diagnostics: Record<string, any> = {
      host: { status: 'checking', detail: '' },
      dns: { status: 'checking', detail: '' },
      port: { status: 'checking', detail: '' },
      auth: { status: 'checking', detail: '' },
      send: { status: 'checking', detail: '' },
    };

    // 1. Check if host resolves
    diagnostics.host = { status: 'checking', detail: `Resolving ${host}...` };
    const hostLookup = await new Promise<{ status: string; detail: string }>((resolve) => {
      dns.resolve4(host, (err, addresses) => {
        if (err) {
          resolve({ status: 'fail', detail: `DNS lookup failed: ${err.code || err.message}` });
        } else {
          resolve({ status: 'pass', detail: `Resolved to ${addresses.join(', ')}` });
        }
      });
    });
    diagnostics.host = hostLookup;

    // 2. Check MX records & SPF for the fromEmail domain
    const domain = fromEmail.split('@')[1];
    if (domain) {
      try {
        const mxRecords = await resolveMx(domain);
        const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
        diagnostics.dns = {
          status: 'pass',
          detail: `MX records found: ${sortedMx.slice(0, 2).map((m) => `${m.exchange} (priority ${m.priority})`).join(', ')}`,
          mxRecords: sortedMx.slice(0, 3),
        };

        // Check SPF record
        try {
          const txtRecords = await resolveTxt(domain);
          const spfRecord = txtRecords.find((r) => r.join('').startsWith('v=spf1'));
          if (spfRecord) {
            diagnostics.dns.spf = spfRecord.join('');
          } else {
            diagnostics.dns.spfWarning = 'No SPF record found — delivery may be flagged as spam';
          }
        } catch {
          diagnostics.dns.spfWarning = 'Could not check SPF record';
        }
      } catch {
        diagnostics.dns = {
          status: 'warn',
          detail: `No MX records found for ${domain} — email delivery may fail`,
        };
      }
    }

    // 3. Attempt SMTP connection with timing
    const startTime = Date.now();
    let connectionError: string | null = null;
    let connectionLatency = 0;

    const transporter = nodemailer.createTransport({
      host,
      port: port || 587,
      secure: secure ?? false,
      auth: { user: username, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      debug: false,
    });

    try {
      await transporter.verify();
      connectionLatency = Date.now() - startTime;
      diagnostics.port = {
        status: 'pass',
        detail: `Port ${port || 587} open — handshake completed in ${connectionLatency}ms`,
        latencyMs: connectionLatency,
      };
    } catch (err: any) {
      connectionLatency = Date.now() - startTime;
      connectionError = err.message || 'Connection refused';

      // Categorize the error
      let errorCategory = '';
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('refused') || msg.includes('econnrefused')) {
        errorCategory = 'Port is closed or blocked by firewall';
      } else if (msg.includes('timeout') || msg.includes('etimedout')) {
        errorCategory = 'Connection timed out — host unreachable or firewall blocking';
      } else if (msg.includes('auth') || msg.includes('credentials') || msg.includes('login')) {
        errorCategory = 'Authentication failed — check username/password';
      } else if (msg.includes('tls') || msg.includes('ssl') || msg.includes('certificate')) {
        errorCategory = 'SSL/TLS handshake failed — check security settings';
      } else {
        errorCategory = err.message;
      }

      diagnostics.port = {
        status: 'fail',
        detail: errorCategory,
        latencyMs: connectionLatency,
        rawError: err.message?.substring(0, 200),
      };
    }

    // 4. If connection succeeded, try sending a test email
    if (diagnostics.port.status === 'pass') {
      try {
        const sendStart = Date.now();
        const info = await transporter.sendMail({
          from: `"SMTP Test" <${fromEmail}>`,
          to: fromEmail,
          subject: '✅ Silk Road V2 - SMTP Connection Test Successful',
          text: `This is a test email from Silk Road V2 Admin.\n\nYour SMTP configuration for ${host} is working correctly.\n\nSent at: ${new Date().toISOString()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0a0a0a; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 48px;">✅</span>
              </div>
              <h1 style="color: #d4af37; font-size: 20px; margin-bottom: 12px; text-align: center;">SMTP Connection Test Successful</h1>
              <p style="color: #ccc; font-size: 14px; line-height: 1.6;">
                Your SMTP configuration for <strong style="color: #fff;">${host}</strong> is working correctly.
              </p>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="color: #999; font-size: 12px; margin: 0 0 4px;">Server</p>
                <p style="color: #fff; font-size: 14px; margin: 0;">${host}:${port || 587}</p>
                <p style="color: #999; font-size: 12px; margin: 12px 0 4px;">From</p>
                <p style="color: #fff; font-size: 14px; margin: 0;">${fromEmail}</p>
              </div>
              <p style="color: #666; font-size: 11px; text-align: center; margin-top: 20px;">
                Sent at: ${new Date().toISOString()}
              </p>
            </div>
          `,
        });

        const sendLatency = Date.now() - sendStart;
        diagnostics.send = {
          status: 'pass',
          detail: `Test email sent successfully in ${sendLatency}ms`,
          messageId: info.messageId,
          latencyMs: sendLatency,
        };
      } catch (err: any) {
        diagnostics.send = {
          status: 'warn',
          detail: `Connection OK but sending failed: ${err.message?.substring(0, 150)}`,
          rawError: err.message?.substring(0, 200),
        };
      }
    }

    // ─── Compute overall verdict ──────────────────────────────────
    const checks = [diagnostics.host.status, diagnostics.port.status, diagnostics.send.status];
    const hasFail = checks.includes('fail');
    const hasWarn = checks.includes('warn');
    const allPass = checks.every((c) => c === 'pass');

    let verdict: 'GOOD' | 'DEAD' | 'DEGRADED';
    let verdictLabel: string;
    let verdictColor: string;

    if (allPass || (!hasFail && diagnostics.port.status === 'pass')) {
      verdict = 'GOOD';
      verdictLabel = '✅ SMTP is GOOD — fully operational';
      verdictColor = 'emerald';
    } else if (hasFail) {
      verdict = 'DEAD';
      verdictLabel = '❌ SMTP is DEAD — check diagnostics below';
      verdictColor = 'red';
    } else {
      verdict = 'DEGRADED';
      verdictLabel = '⚠️ SMTP is DEGRADED — partial failure';
      verdictColor = 'amber';
    }

    // Build a human-readable summary
    const summary = [
      `Host: ${host} (${diagnostics.host.status === 'pass' ? 'resolves' : diagnostics.host.detail})`,
      `Port ${port || 587}: ${diagnostics.port.status === 'pass' ? 'open' : diagnostics.port.detail}`,
      diagnostics.send.detail ? `Send test: ${diagnostics.send.detail}` : null,
    ].filter(Boolean).join(' · ');

    return NextResponse.json({
      ok: verdict === 'GOOD',
      verdict,
      verdictLabel,
      verdictColor,
      summary,
      data: {
        verified: verdict === 'GOOD',
        verdict,
        verdictLabel,
        verdictColor,
        summary,
        diagnostics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        verdict: 'DEAD',
        verdictLabel: '❌ SMTP is DEAD — test crashed',
        verdictColor: 'red',
        summary: error.message?.substring(0, 150) || 'Test failed with an unexpected error',
        data: {
          verified: false,
          verdict: 'DEAD',
          verdictLabel: '❌ SMTP is DEAD — test crashed',
          verdictColor: 'red',
          summary: error.message?.substring(0, 150) || 'Unexpected error',
          diagnostics: {
            error: error.message?.substring(0, 300),
          },
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  }
}