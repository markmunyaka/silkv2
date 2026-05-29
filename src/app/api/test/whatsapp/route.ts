/**
 * Test endpoint for WhatsApp alerts
 * 
 * Place this at: src/app/api/test/whatsapp/route.ts
 * 
 * Usage:
 * POST http://localhost:3000/api/test/whatsapp
 * Body: { "message": "Test message", "title": "Test Title" }
 * 
 * This allows you to quickly test your Twilio configuration without
 * needing to trigger actual user actions.
 */

import { NextResponse, NextRequest } from 'next/server';
import { sendFormattedWhatsAppAlert, isWhatsAppAlertConfigured, getWhatsAppAlertStatus } from '@/utils/whatsappAlert';

export async function POST(request: NextRequest) {
  try {
    // Check if WhatsApp is configured
    if (!isWhatsAppAlertConfigured()) {
      const status = getWhatsAppAlertStatus();
      return NextResponse.json(
        {
          error: 'WhatsApp alerts not configured',
          status,
          message: 'Please set up Twilio credentials in environment variables',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { message = 'This is a test message', title = 'Test Alert' } = body;

    // Validate inputs
    if (typeof message !== 'string' || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Message and title must be strings' },
        { status: 400 }
      );
    }

    if (message.length === 0 || title.length === 0) {
      return NextResponse.json(
        { error: 'Message and title cannot be empty' },
        { status: 400 }
      );
    }

    // Send test alert
    await sendFormattedWhatsAppAlert(title, message, '🧪');

    const status = getWhatsAppAlertStatus();
    return NextResponse.json({
      success: true,
      message: 'Test WhatsApp alert sent successfully',
      sentTo: status.toNumber,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('WhatsApp test endpoint error:', error);

    return NextResponse.json(
      {
        error: 'Failed to send test alert',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check WhatsApp configuration status
 */
export async function GET() {
  const configured = isWhatsAppAlertConfigured();
  const status = getWhatsAppAlertStatus();

  return NextResponse.json({
    configured,
    ...status,
    message: configured
      ? 'WhatsApp alerts are properly configured'
      : 'WhatsApp alerts are NOT configured - please set environment variables',
    setupInstructions: {
      step1: 'Get Twilio Account SID and Auth Token from https://console.twilio.com',
      step2: 'Set up WhatsApp Business Account in Twilio Console',
      step3: 'Copy credentials to .env file',
      step4: 'Restart the application',
      step5: 'POST to this endpoint to test',
    },
  });
}
