import { Router } from 'express';
import crypto from 'crypto';
import { controlOpenCodeService, getOpenCodeServiceStatus, hasOpenCodeAppLockPassword, OPENCODE_APP_LOCK_PASSWORD, type OpenCodeServiceAction } from '../utils/opencodeService';
import { logger } from '../utils/logger';

const router = Router();
const OPENCODE_APP_LOCK_COOKIE = 'clawos_opencode_app_lock';
const OPENCODE_APP_LOCK_MAX_AGE_SECONDS = 8 * 60 * 60;

function getLockSecret(): string {
  return crypto.createHash('sha256').update(`opencode-app-lock:${OPENCODE_APP_LOCK_PASSWORD}`).digest('hex');
}

function hasValidOpenCodeAppLockCookie(cookieHeader?: string): boolean {
  if (!cookieHeader) {
    return false;
  }

  const expected = getLockSecret();
  return cookieHeader.split(';').some((rawCookie) => {
    const trimmed = rawCookie.trim();
    if (!trimmed.startsWith(`${OPENCODE_APP_LOCK_COOKIE}=`)) {
      return false;
    }
    return decodeURIComponent(trimmed.slice(OPENCODE_APP_LOCK_COOKIE.length + 1)) === expected;
  });
}

function buildOpenCodeAppLockCookie(req: any): string {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${OPENCODE_APP_LOCK_COOKIE}=${encodeURIComponent(getLockSecret())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${OPENCODE_APP_LOCK_MAX_AGE_SECONDS}`,
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function hasOpenCodeAppAccess(cookieHeader?: string): boolean {
  return hasValidOpenCodeAppLockCookie(cookieHeader);
}

router.get('/status', async (_req, res) => {
  try {
    const status = await getOpenCodeServiceStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error(`OpenCode status failed: ${error.message}`, { module: 'OpenCode' });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/unlock', (req, res) => {
  if (!hasOpenCodeAppLockPassword()) {
    logger.error('OpenCode app lock password is not configured', { module: 'OpenCode' });
    return res.status(500).json({ success: false, error: 'OpenCode 应用锁未配置' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password !== OPENCODE_APP_LOCK_PASSWORD) {
    logger.warn('OpenCode app unlock failed', { module: 'OpenCode' });
    return res.status(401).json({ success: false, error: 'OpenCode 应用锁密码错误' });
  }

  res.setHeader('Set-Cookie', buildOpenCodeAppLockCookie(req));
  res.json({ success: true });
});

router.post('/lock', (_req, res) => {
  res.setHeader('Set-Cookie', `${OPENCODE_APP_LOCK_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ success: true });
});

router.post('/service/:action', async (req, res) => {
  const action = req.params.action as OpenCodeServiceAction;
  if (!['start', 'stop', 'restart'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Unsupported OpenCode service action' });
  }

  try {
    const status = await controlOpenCodeService(action);
    res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error(`OpenCode service ${action} failed: ${error.message}`, { module: 'OpenCode' });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
