import { NextRequest, NextResponse } from 'next/server';
import { createPaymentOrder } from '@/lib/wallet/blockchain-service';

const WALLET_ADDRESSES: Record<string, { address: string; network: string }> = {
  'usdt-trc20': { address: process.env.WALLET_USDT_TRC20 || 'YOUR_USDT_TRC20_WALLET_ADDRESS', network: 'TRC-20' },
  'usdt-erc20': { address: process.env.WALLET_USDT_ERC20 || 'YOUR_USDT_ERC20_WALLET_ADDRESS', network: 'ERC-20' },
  'litecoin': { address: process.env.WALLET_LITECOIN || 'YOUR_LITECOIN_WALLET_ADDRESS', network: 'LTC' },
  'solana': { address: process.env.WALLET_SOLANA || 'YOUR_SOLANA_WALLET_ADDRESS', network: 'SOL' },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crypto, packsToBuy } = body as {
      crypto?: string;
      packsToBuy?: number;
    };

    if (!crypto || !packsToBuy || packsToBuy < 1) {
      return NextResponse.json({ error: 'Invalid request: crypto and packsToBuy required' }, { status: 400 });
    }

    const walletInfo = WALLET_ADDRESSES[crypto];
    if (!walletInfo) {
      return NextResponse.json({ error: `Unsupported cryptocurrency: ${crypto}` }, { status: 400 });
    }

    const order = createPaymentOrder('anonymous', crypto, walletInfo.network, walletInfo.address, packsToBuy);

    return NextResponse.json({
      orderId: order.id,
      walletAddress: walletInfo.address,
      network: walletInfo.network,
      amountUsd: order.amountUsd,
      emailsToCredit: order.emailsToCredit,
      crypto,
      expiresAt: order.expiresAt,
    });
  } catch (error: unknown) {
    console.error('[Create Payment] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}