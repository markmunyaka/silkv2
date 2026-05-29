import { NextRequest, NextResponse } from 'next/server';
import { getPaymentOrder, updatePaymentOrder, verifyPayment } from '@/lib/wallet/blockchain-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, txHash, userId } = body as {
      orderId?: string;
      txHash?: string;
      userId?: string;
    };

    if (!orderId || !txHash) {
      return NextResponse.json({ error: 'Missing required fields: orderId and txHash' }, { status: 400 });
    }

    // Get the payment order
    const order = getPaymentOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Payment order not found or expired' }, { status: 404 });
    }

    // Verify the transaction on the blockchain
    const verification = await verifyPayment(order.crypto, txHash, order.amountUsd);

    if (verification.status === 'completed') {
      // Update the order status
      updatePaymentOrder(orderId, { status: 'confirmed' });

      // Save the transaction to the database
      const resolvedUserId = userId || order.userId || 'anonymous';
      
      try {
        await prisma.walletTransaction.create({
          data: {
            userId: resolvedUserId,
            type: 'deposit',
            amount: order.emailsToCredit,
            amountUsd: order.amountUsd,
            crypto: order.crypto,
            network: order.network,
            txHash: txHash,
            walletAddress: order.walletAddress,
            status: 'completed',
            description: `Deposit ${order.emailsToCredit.toLocaleString()} email credits via ${order.crypto.toUpperCase()}`,
            orderId: orderId,
          },
        });
      } catch (dbError) {
        console.error('[Verify Payment] DB save error (non-fatal):', dbError);
        // Non-fatal: even if DB save fails, the payment is verified
      }

      return NextResponse.json({
        verified: true,
        confirmations: verification.confirmations,
        requiredConfirmations: verification.requiredConfirmations,
        emailsToCredit: order.emailsToCredit,
        amountPaid: order.amountUsd,
        crypto: order.crypto,
        status: 'completed',
        message: `Payment confirmed! ${order.emailsToCredit.toLocaleString()} email sendouts credited.`,
      });
    }

    if (verification.status === 'confirming') {
      return NextResponse.json({
        verified: false,
        confirmations: verification.confirmations,
        requiredConfirmations: verification.requiredConfirmations,
        status: 'confirming',
        message: `Transaction found. Waiting for confirmations... (${verification.confirmations}/${verification.requiredConfirmations})`,
      });
    }

    // pending or failed
    return NextResponse.json({
      verified: false,
      confirmations: 0,
      requiredConfirmations: verification.requiredConfirmations,
      status: verification.status,
      error: verification.error,
      message: verification.error || 'Transaction not yet detected. Please ensure you sent the correct amount to the right address.',
    });
  } catch (error: unknown) {
    console.error('[Verify Payment] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}