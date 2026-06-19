import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

const NPM_BIN = '/usr/bin/npm';
function npmEnv(): { [key: string]: string } {
  const cleanPath = [
    '/usr/bin',
    '/usr/local/bin',
    '/bin',
    process.env.PATH || '',
  ].join(':');
  return { ...process.env, PATH: cleanPath };
}

export const OPENCODE_WEB_UNIT = 'opencode-web.service';
export const OPENCODE_WEB_PORT = 4096;
export const OPENCODE_WEB_TARGET = `http://127.0.0.1:${OPENCODE_WEB_PORT}`;
export const OPENCODE_APP_LOCK_PASSWORD = process.env.CLAWOS_OPENCODE_APP_PASSWORD?.trim() || process.env.OPENCODE_SERVER_PASSWORD?.trim() || '';
export const OPENCODE_SERVER_USERNAME = process.env.OPENCODE_SERVER_USERNAME?.trim() || 'opencode';
export const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD?.trim() || '';

export type OpenCodeServiceAction = 'start' | 'stop' | 'restart';

export interface OpenCodeServiceStatus {
  unit: string;
  status: string;
  isRunning: boolean;
  health: 'ok' | 'starting' | 'down';
  healthDetail: string;
}

export function getOpenCodeBasicAuthHeader(): string {
  return `Basic ${Buffer.from(`${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`).toString('base64')}`;
}

export function hasOpenCodeServerPassword(): boolean {
  return OPENCODE_SERVER_PASSWORD.length > 0;
}

export function hasOpenCodeAppLockPassword(): boolean {
  return OPENCODE_APP_LOCK_PASSWORD.length > 0;
}

async function systemctlUser(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('systemctl', ['--user', ...args], { timeout: 12000 });
  return stdout.trim();
}

export async function controlOpenCodeService(action: OpenCodeServiceAction): Promise<OpenCodeServiceStatus> {
  await systemctlUser([action, OPENCODE_WEB_UNIT]);
  return getOpenCodeServiceStatus();
}

async function getSystemdActiveState(): Promise<string> {
  try {
    const state = await systemctlUser(['is-active', OPENCODE_WEB_UNIT]);
    return state || 'unknown';
  } catch {
    return 'inactive';
  }
}

async function probeOpenCodeHealth(): Promise<{ health: OpenCodeServiceStatus['health']; detail: string }> {
  if (!hasOpenCodeServerPassword()) {
    return { health: 'down', detail: 'OPENCODE_SERVER_PASSWORD is not configured' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${OPENCODE_WEB_TARGET}/global/health`, {
      headers: { Authorization: getOpenCodeBasicAuthHeader() },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { health: 'starting', detail: `HTTP ${response.status}` };
    }

    const payload = await response.json().catch(() => null) as { healthy?: boolean; version?: string } | null;
    if (payload?.healthy) {
      return { health: 'ok', detail: payload.version ? `OpenCode ${payload.version}` : 'OpenCode health ok' };
    }

    return { health: 'starting', detail: 'health payload not ready' };
  } catch (error: any) {
    return { health: 'starting', detail: error.name === 'AbortError' ? 'health probe timeout' : error.message };
  }
}

export async function getOpenCodeServiceStatus(): Promise<OpenCodeServiceStatus> {
  const status = await getSystemdActiveState();
  const isRunning = status === 'active';
  if (!isRunning) {
    return {
      unit: OPENCODE_WEB_UNIT,
      status,
      isRunning,
      health: 'down',
      healthDetail: 'OpenCode Web service is not running',
    };
  }

  const probe = await probeOpenCodeHealth();
  return {
    unit: OPENCODE_WEB_UNIT,
    status,
    isRunning,
    health: probe.health,
    healthDetail: probe.detail,
  };
}

let cachedNpmPrefix: string | null = null;

async function getNpmGlobalPrefix(): Promise<string> {
  if (cachedNpmPrefix) {
    return cachedNpmPrefix;
  }
  const { stdout } = await execFileAsync(NPM_BIN, ['config', 'get', 'prefix'], {
    timeout: 10000,
    env: npmEnv(),
  });
  cachedNpmPrefix = stdout.trim();
  return cachedNpmPrefix;
}

async function getInstalledOpenCodeVersion(): Promise<string | null> {
  try {
    const prefix = await getNpmGlobalPrefix();
    const pkgPath = path.join(prefix, 'lib', 'node_modules', 'opencode-ai', 'package.json');
    const content = await fs.promises.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ?? null;
  } catch (error: any) {
    logger.warn(`Failed to read installed OpenCode version: ${error.message}`, { module: 'OpenCode' });
    return null;
  }
}

async function getLatestOpenCodeVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(NPM_BIN, ['view', 'opencode-ai', 'version'], {
      timeout: 20000,
      env: npmEnv(),
    });
    return stdout.trim() || null;
  } catch (error: any) {
    logger.warn(`Failed to fetch latest OpenCode version: ${error.message}`, { module: 'OpenCode' });
    return null;
  }
}

export interface OpenCodeVersionInfo {
  current: string | null;
  latest: string | null;
  hasUpdate: boolean;
}

export async function getOpenCodeVersionInfo(): Promise<OpenCodeVersionInfo> {
  const [current, latest] = await Promise.all([
    getInstalledOpenCodeVersion(),
    getLatestOpenCodeVersion(),
  ]);
  return {
    current,
    latest,
    hasUpdate: !!(current && latest && current !== latest),
  };
}

export interface OpenCodeUpdateResult {
  versionInfo: OpenCodeVersionInfo;
  restarted: boolean;
}

export async function performOpenCodeUpdate(): Promise<OpenCodeUpdateResult> {
  logger.info('Starting OpenCode package update via npm...', { module: 'OpenCode' });
  await execFileAsync(NPM_BIN, ['install', '-g', 'opencode-ai@latest'], {
    timeout: 120000,
    env: npmEnv(),
  });
  logger.info('OpenCode package updated, restarting web service...', { module: 'OpenCode' });
  cachedNpmPrefix = null;
  await controlOpenCodeService('restart');
  const versionInfo = await getOpenCodeVersionInfo();
  logger.info(`OpenCode update complete: now ${versionInfo.current}`, { module: 'OpenCode' });
  return { versionInfo, restarted: true };
}
