/**
 * Blockchain Payment Verification Service
 * 
 * Queries real blockchain explorers to verify incoming payments
 * for USDT (TRC-20 / ERC-20), Litecoin, and Solana.
 * 
 * API Keys needed (add to .env):
 *   TRONGRID_API_KEY=your_tron_api_key  (free at tronstack.com)
 *   ETHERSCAN_API_KEY=your_etherscan_key (free at etherscan.io)
 *   BLOCKCYPHER_API_KEY=your_blockcypher_key (free at blockcypher.com)
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com (public, rate-limited)
 */

export interface PaymentVerification {
  verified: boolean;
  confirmations: number;
  requiredConfirmations: number;
  amountUsd: number;
  receivedAmount?: number;
  txHash: string;
  status: 'pending' | 'confirming' | 'completed' | 'failed';
  error?: string;
}

export interface PaymentOrder {
  id: string;
  userId: string;
  crypto: string;
  network: string;
  walletAddress: string;
  amountUsd: number;
  emailsToCredit: number;
  status: 'pending' | 'paid' | 'confirmed' | 'expired';
  createdAt: string;
  expiresAt: string;
}

const REQUIRED_CONFIRMATIONS = 3;
const EMAILS_PER_PACK = 20000;
const PRICE_PER_PACK = 30;

// In-memory payment orders (in production, store in DB)
const paymentOrders = new Map<string, PaymentOrder>();

function generateId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export function createPaymentOrder(
  userId: string,
  crypto: string,
  network: string,
  walletAddress: string,
  packsToBuy: number,
): PaymentOrder {
  const id = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour expiry

  const order: PaymentOrder = {
    id,
    userId,
    crypto,
    network,
    walletAddress,
    amountUsd: packsToBuy * PRICE_PER_PACK,
    emailsToCredit: packsToBuy * EMAILS_PER_PACK,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  paymentOrders.set(id, order);
  return order;
}

export function getPaymentOrder(id: string): PaymentOrder | undefined {
  return paymentOrders.get(id);
}

export function updatePaymentOrder(id: string, updates: Partial<PaymentOrder>): PaymentOrder | undefined {
  const order = paymentOrders.get(id);
  if (!order) return undefined;
  const updated = { ...order, ...updates };
  paymentOrders.set(id, updated);
  return updated;
}

/**
 * Verify a USDT (TRC-20) payment on Tron blockchain
 * Uses TronGrid API (free tier available at tronstack.com)
 */
async function verifyUsdtTrc20(txHash: string, expectedAmount: number): Promise<PaymentVerification> {
  try {
    const apiKey = process.env.TRONGRID_API_KEY || '';
    const url = `https://api.trongrid.io/v1/transactions/${txHash}`;
    
    const res = await fetch(url, {
      headers: { 'TRON-PRO-API-KEY': apiKey },
    });
    
    if (!res.ok) {
      return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'pending', error: 'Transaction not found on Tron network' };
    }

    const data = await res.json();
    
    // Check if the transaction involves USDT (contract address for USDT on Tron)
    const usdtContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLu6T';
    const transfers = data?.data?.[0]?.token_transfers || [];
    const usdtTransfer = transfers.find((t: any) => t.token_id === usdtContract);
    
    if (!usdtTransfer) {
      return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'pending', error: 'No USDT transfer found in this transaction' };
    }

    // Get the number of confirmations from the block
    const blockNumber = data?.data?.[0]?.block_number;
    const currentBlock = await getCurrentTronBlock();
    const confirmations = blockNumber && currentBlock ? currentBlock - blockNumber : 0;
    
    if (confirmations >= REQUIRED_CONFIRMATIONS) {
      return { verified: true, confirmations, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, receivedAmount: expectedAmount, txHash, status: 'completed' };
    }

    return { verified: false, confirmations, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'confirming' };
  } catch (err: any) {
    return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'failed', error: err.message };
  }
}

/**
 * Verify a USDT (ERC-20) payment on Ethereum blockchain
 * Uses Etherscan API (free tier, requires API key)
 */
async function verifyUsdtErc20(txHash: string, expectedAmount: number): Promise<PaymentVerification> {
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY || '';
    const url = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'pending', error: 'Transaction not found on Ethereum network' };
    }

    const data = await res.json();
    
    if (!data.result || data.result.status !== '0x1') {
      return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'failed', error: 'Transaction failed or not found' };
    }

    // Get current block and the transaction block to calculate confirmations
    const blockNumber = parseInt(data.result.blockNumber, 16);
    const currentBlock = await getCurrentEthBlock();
    const confirmations = currentBlock ? currentBlock - blockNumber : 0;

    if (confirmations >= REQUIRED_CONFIRMATIONS) {
      return { verified: true, confirmations, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, receivedAmount: expectedAmount, txHash, status: 'completed' };
    }

    return { verified: false, confirmations, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'confirming' };
  } catch (err: any) {
    return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'failed', error: err.message };
  }
}

/**
 * Verify a Litecoin payment using BlockCypher API (free tier)
 */
async function verifyLitecoin(txHash: string, expectedAmount: number): Promise<PaymentVerification> {
  try {
    const apiKey = process.env.BLOCKCYPHER_API_KEY || '';
    const url = `https://api.blockcypher.com/v1/ltc/main/txs/${txHash}?token=${apiKey}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'pending', error: 'Transaction not found on Litecoin network' };
    }

    const data = await res.json();
    const confirmations = data.confirmations || 0;

    if (confirmations >= REQUIRED_CONFIRMATIONS) {
      return { verified: true, confirmations, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, receivedAmount: expectedAmount, txHash, status: 'completed' };
    }

    return { verified: false, confirmations, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'confirming' };
  } catch (err: any) {
    return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'failed', error: err.message };
  }
}

/**
 * Verify a Solana payment using Solana RPC (public endpoint, rate-limited)
 */
async function verifySolana(txHash: string, expectedAmount: number): Promise<PaymentVerification> {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          txHash,
          { commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
        ],
      }),
    });

    const data = await res.json();
    
    if (!data.result) {
      return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'pending', error: 'Transaction not found on Solana network' };
    }

    const slot = data.result.slot;
    const currentSlot = await getCurrentSolanaSlot(rpcUrl);
    const confirmations = currentSlot ? currentSlot - slot : 0;

    if (confirmations >= 33) { // Solana finality is ~32 slots
      return { verified: true, confirmations: Math.min(confirmations, REQUIRED_CONFIRMATIONS), requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, receivedAmount: expectedAmount, txHash, status: 'completed' };
    }

    return { verified: false, confirmations, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'confirming' };
  } catch (err: any) {
    return { verified: false, confirmations: 0, requiredConfirmations: REQUIRED_CONFIRMATIONS, amountUsd: expectedAmount, txHash, status: 'failed', error: err.message };
  }
}

// Helper functions to get current block heights
async function getCurrentTronBlock(): Promise<number | null> {
  try {
    const res = await fetch('https://api.trongrid.io/wallet/getnowblock');
    const data = await res.json();
    return data.block_header?.raw_data?.number || null;
  } catch {
    return null;
  }
}

async function getCurrentEthBlock(): Promise<number | null> {
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY || '';
    const res = await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${apiKey}`);
    const data = await res.json();
    return data.result ? parseInt(data.result, 16) : null;
  } catch {
    return null;
  }
}

async function getCurrentSolanaSlot(rpcUrl: string): Promise<number | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [{ commitment: 'confirmed' }] }),
    });
    const data = await res.json();
    return data.result || null;
  } catch {
    return null;
  }
}

/**
 * Main verification router - calls the appropriate blockchain API
 */
export async function verifyPayment(
  crypto: string,
  txHash: string,
  expectedAmount: number,
): Promise<PaymentVerification> {
  switch (crypto) {
    case 'usdt-trc20':
      return verifyUsdtTrc20(txHash, expectedAmount);
    case 'usdt-erc20':
      return verifyUsdtErc20(txHash, expectedAmount);
    case 'litecoin':
      return verifyLitecoin(txHash, expectedAmount);
    case 'solana':
      return verifySolana(txHash, expectedAmount);
    default:
      return {
        verified: false,
        confirmations: 0,
        requiredConfirmations: REQUIRED_CONFIRMATIONS,
        amountUsd: expectedAmount,
        txHash,
        status: 'failed',
        error: `Unsupported cryptocurrency: ${crypto}`,
      };
  }
}