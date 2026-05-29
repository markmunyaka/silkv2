# Secure User Credential Architecture

## Overview

This schema implements defense-in-depth security for user authentication, preventing SQL injection, credential stuffing, and unauthorized access.

---

## 1. Salted Password Hashing

### How It Works
Passwords are hashed at the application layer using bcrypt or argon2 before being stored. Each password includes a unique salt.

```typescript
// Server-side password hashing (never store plain text)
import bcrypt from 'bcrypt';

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12); // 12 rounds - OWASP recommended
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### Schema Field
```prisma
model User {
  password String?  // Already hashed with salt at app layer
}
```

**Why bcrypt/argon2**: They automatically handle salting. Each hash includes the salt, so you never need to store salt separately.

---

## 2. Multi-Factor Authentication (MFA) Backup Codes

### Backup Codes Design
When a user enables MFA (TOTP), generate 8 single-use backup codes.

```typescript
import crypto from 'crypto';

function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
}

// Store codes in database (each code is hashed)
async function storeBackupCodes(userId: string, codes: string[]) {
  const hashedCodes = codes.map(code =>
    crypto.createHash('sha256').update(code).digest('hex')
  );

  await prisma.mfa.upsert({
    where: { userId_type: { userId, type: 'backup_codes' } },
    create: { userId, type: 'backup_codes', backupCodes: JSON.stringify(hashedCodes) },
    update: { backupCodes: JSON.stringify(hashedCodes) }
  });
}

// Verify a backup code (check if it matches any unused code)
async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  const mfa = await prisma.mfa.findUnique({
    where: { userId_type: { userId, type: 'backup_codes' } }
  });

  if (!mfa?.backupCodes) return false;

  const codes = JSON.parse(mfa.backupCodes);
  const index = codes.indexOf(hashedCode);

  if (index === -1) return false;

  // Mark code as used by replacing with null
  codes[index] = null;
  await prisma.mfa.update({
    where: { id: mfa.id },
    data: { backupCodes: JSON.stringify(codes) }
  });

  return true;
}
```

### Schema
```prisma
model MFA {
  id          String   @id @default(cuid())
  userId      String
  type        String   // "totp" | "backup_codes" | "sms"
  secret      String?  // TOTP secret (encrypted at rest)
  backupCodes String?  // JSON array of SHA256-hashed backup codes
}
```

---

## 3. Login Attempt Throttling & Audit Logs

### Rate Limiting
Track failed login attempts per IP address.

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

async function checkRateLimit(ipAddress: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);

  let rateLimit = await prisma.rateLimit.findUnique({
    where: { ipAddress_windowStart: { ipAddress, windowStart: now.setMinutes(0, 0, 0) } }
  });

  if (!rateLimit) {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  if (rateLimit.locked) {
    return { allowed: false, remaining: 0 };
  }

  if (now > rateLimit.windowEnd) {
    // Reset window
    await prisma.rateLimit.update({
      where: { id: rateLimit.id },
      data: { requests: 0, windowStart: now, windowEnd }
    });
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  if (rateLimit.requests >= MAX_ATTEMPTS) {
    // Lock out
    await prisma.rateLimit.update({
      where: { id: rateLimit.id },
      data: { locked: true }
    });
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - rateLimit.requests };
}
```

### Audit Logging
Log every authentication attempt for forensics.

```typescript
async function logLoginAttempt(
  userId: string | null,
  event: string,
  success: boolean,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  await prisma.auditLog.create({
    data: {
      userId,
      event,
      success,
      reason,
      ipAddress,
      userAgent,
      metadata: JSON.stringify({ timestamp: new Date().toISOString() })
    }
  });
}
```

### Schema
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  userId      String?  // null for unknown users
  event       String   // "login_attempt" | "login_success" | "mfa_required"
  ipAddress   String?
  userAgent   String?
  success     Boolean
  reason      String?  // "invalid_credentials" | "rate_limited" | "mfa_required"
  metadata    String?  // JSON for additional context
  createdAt   DateTime @default(now())
}

model RateLimit {
  id        String   @id @default(cuid())
  ipAddress String
  requests  Int      @default(0)
  windowStart DateTime @default(now())
  windowEnd DateTime
  locked    Boolean  @default(false)
}
```

---

## Complete Login Flow Example

```typescript
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function login(email: string, password: string, ipAddress: string) {
  // 1. Check rate limit
  const rateCheck = await checkRateLimit(ipAddress);
  if (!rateCheck.allowed) {
    await logLoginAttempt(null, 'login_attempt', false, 'rate_limited', ipAddress);
    throw new Error('Too many attempts. Try again later.');
  }

  // 2. Find user (Prisma parameterizes queries - prevents SQL injection)
  const user = await prisma.user.findUnique({ where: { email } });

  // 3. Verify password (hash comparison)
  if (!user || !(await bcrypt.compare(password, user.password))) {
    await logLoginAttempt(user?.id ?? null, 'login_attempt', false, 'invalid_credentials', ipAddress);
    throw new Error('Invalid credentials');
  }

  // 4. Check if MFA is required
  const mfa = await prisma.mfa.findFirst({ where: { userId: user.id, type: 'totp' } });
  if (mfa) {
    await logLoginAttempt(user.id, 'mfa_required', false, 'mfa_required', ipAddress);
    return { requiresMFA: true, userId: user.id };
  }

  // 5. Create session
  const session = await prisma.session.create({
    data: {
      sessionToken: crypto.randomBytes(32).toString('hex'),
      userId: user.id,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ip: ipAddress
    }
  });

  // 6. Log success
  await logLoginAttempt(user.id, 'login_success', true, undefined, ipAddress);

  return { sessionToken: session.sessionToken };
}
```

---

## Key Security Principles

1. **Never store plain-text passwords** - Always hash with bcrypt/argon2
2. **Parameterized queries** - Prisma prevents SQL injection by design
3. **Rate limiting** - Prevents credential stuffing attacks
4. **Audit trails** - Forensic logging for security incidents
5. **MFA backup codes** - Hashed single-use codes for account recovery
6. **Session management** - Time-bound sessions with IP tracking
