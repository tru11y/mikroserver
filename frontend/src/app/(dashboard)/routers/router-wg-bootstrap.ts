import { api, unwrap } from '@/lib/api';
import { toast } from 'sonner';

interface BootstrapData {
  localIp: string | null;
  wgIp: string | null;
  privateKey: string | null;
  vpsPublicKey: string | null;
  endpoint: string | null;
  listenPort: number;
  tunnelReady: boolean;
  mikrotikCmd: string | null;
}

export async function triggerWgBootstrap(
  routerId: string,
  apiUsername: string,
  apiPassword: string,
): Promise<void> {
  try {
    const res = await api.routers.getBootstrap(routerId);
    const bootstrap = unwrap<BootstrapData>(res);

    if (!bootstrap || bootstrap.tunnelReady) return;

    if (bootstrap.localIp && bootstrap.mikrotikCmd) {
      try {
        await fetch(`http://${bootstrap.localIp}/rest/system/script`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(`${apiUsername}:${apiPassword}`)}`,
          },
          body: JSON.stringify({ name: 'wg-mks-bootstrap', source: bootstrap.mikrotikCmd }),
          signal: AbortSignal.timeout(5000),
        });
        await fetch(`http://${bootstrap.localIp}/rest/system/script/wg-mks-bootstrap/run`, {
          method: 'POST',
          headers: { Authorization: `Basic ${btoa(`${apiUsername}:${apiPassword}`)}` },
          signal: AbortSignal.timeout(5000),
        });
        toast.success('Configuration WireGuard envoyée au routeur.');
        return;
      } catch {
        // Expected — CORS/PNA blocks this in Chrome
      }
    }

    if (bootstrap.mikrotikCmd) {
      const cmd = bootstrap.mikrotikCmd;
      toast('Tunnel WireGuard en attente', {
        description: `Copiez la commande dans Winbox ou WebFig (${bootstrap.localIp ?? ''}).`,
        duration: 30000,
        action: {
          label: 'Copier la commande',
          onClick: () => void navigator.clipboard.writeText(cmd),
        },
      });
    }
  } catch {
    // Bootstrap fetch failed — not critical, router will remain pending
  }
}
