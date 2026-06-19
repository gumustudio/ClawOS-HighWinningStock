import cron from 'node-cron';
import { logger } from '../../utils/logger';
import { getOpenCodeVersionInfo } from '../../utils/opencodeService';
import { createSystemNotification, listSystemNotifications } from '../notifications/service';

export function initOpenCodeScheduler(): void {
  cron.schedule('0 10 * * *', async () => {
    try {
      const info = await getOpenCodeVersionInfo();
      if (!info.hasUpdate) {
        return;
      }

      const existing = await listSystemNotifications({ appId: 'opencode', includeRead: false, limit: 10 });
      const alreadyNotified = existing.some((item) => item.metadata?.latest === info.latest);
      if (alreadyNotified) {
        return;
      }

      logger.info(`OpenCode update available: ${info.current} -> ${info.latest}`, { module: 'OpenCode' });
      await createSystemNotification({
        appId: 'opencode',
        title: 'OpenCode 有新版本可用',
        message: `当前 ${info.current} → 最新 ${info.latest}，可在 OpenCode 应用中一键更新。`,
        level: 'info',
        metadata: { current: info.current, latest: info.latest },
      });
    } catch (error: any) {
      logger.warn(`OpenCode daily update check failed: ${error.message}`, { module: 'OpenCode' });
    }
  });

  logger.info('OpenCode daily update checker scheduled (cron 0 10 * * *)', { module: 'OpenCode' });
}
