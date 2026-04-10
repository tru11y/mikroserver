export interface RouterConnectionTarget {
  wireguardIp: string;
  apiPort: number;
  apiUsername: string;
  apiPasswordHash: string;
  hotspotServer?: string | null;
}
