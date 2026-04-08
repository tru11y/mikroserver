import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { api, extractErrorMessage, type RouterStatus } from "@/src/lib/api";
import { formatBps, formatBytes, formatDateTime } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  KeyValue,
  LoadingView,
  Page,
  SectionCard,
  SectionTitle,
} from "@/src/components/ui";

type SortColumn = "username" | "bytesIn" | "bytesOut" | "uptime";
type SortDirection = "asc" | "desc";

const SORT_ITEMS: Array<{ value: SortColumn; label: string }> = [
  { value: "bytesIn", label: "↓ Download" },
  { value: "bytesOut", label: "↑ Upload" },
  { value: "username", label: "Utilisateur" },
  { value: "uptime", label: "Uptime" },
];

function getStatusTone(status: RouterStatus) {
  if (status === "ONLINE") return { text: "En ligne", color: "#7df4b4", borderColor: "#2f7050", backgroundColor: "#143625" };
  if (status === "DEGRADED") return { text: "Dégradé", color: "#ffd899", borderColor: "#8b5b22", backgroundColor: "#3e2a11" };
  if (status === "MAINTENANCE") return { text: "Maintenance", color: "#b8c7ff", borderColor: "#3e4f88", backgroundColor: "#1e2947" };
  return { text: "Hors ligne", color: "#ffb5c1", borderColor: "#8c3a4b", backgroundColor: "#401e27" };
}

function normalizeId(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Pressable onPress={copy} style={styles.copyBtn}>
      <Text style={styles.copyBtnText}>{copied ? "Copié ✓" : `Copier ${label}`}</Text>
    </Pressable>
  );
}

export default function RouterDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routerId = normalizeId(params.id);
  const guard = useAuthGuard();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sortColumn, setSortColumn] = useState<SortColumn>("bytesIn");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showWinBox, setShowWinBox] = useState(false);
  const [showWgConfig, setShowWgConfig] = useState(false);

  const routerQuery = useQuery({
    queryKey: ["router", routerId],
    queryFn: () => api.routers.get(routerId as string),
    refetchInterval: 15_000,
    enabled: Boolean(routerId),
  });

  const liveQuery = useQuery({
    queryKey: ["router-live", routerId],
    queryFn: () => api.routers.liveStats(routerId as string),
    refetchInterval: 5_000,
    retry: false,
    enabled: Boolean(routerId),
  });

  const wgConfigQuery = useQuery({
    queryKey: ["router-wg-config", routerId],
    queryFn: () => api.routers.wireguardConfig(routerId as string),
    enabled: Boolean(routerId) && showWgConfig,
    staleTime: 60_000,
  });

  const healthMutation = useMutation({
    mutationFn: () => api.routers.healthCheck(routerId as string),
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["router", routerId] });
      await queryClient.invalidateQueries({ queryKey: ["router-live", routerId] });
      await queryClient.invalidateQueries({ queryKey: ["routers"] });
    },
    onError: (error) => setActionError(extractErrorMessage(error)),
  });

  const terminateMutation = useMutation({
    mutationFn: (payload: { routerId: string; mikrotikId: string }) =>
      api.sessions.terminate(payload.routerId, payload.mikrotikId),
    onMutate: (payload) => { setDisconnectingId(payload.mikrotikId); setActionError(null); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["router-live", routerId] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => setActionError(extractErrorMessage(error)),
    onSettled: () => setDisconnectingId(null),
  });

  const sortedClients = useMemo(() => {
    const clients = [...(liveQuery.data?.clients ?? [])];
    clients.sort((left, right) => {
      const direction = sortDirection === "desc" ? -1 : 1;
      if (sortColumn === "username") return direction * left.username.localeCompare(right.username);
      if (sortColumn === "uptime") return direction * left.uptime.localeCompare(right.uptime);
      return direction * (left[sortColumn] - right[sortColumn]);
    });
    return clients;
  }, [liveQuery.data?.clients, sortColumn, sortDirection]);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) { setSortDirection((c) => (c === "asc" ? "desc" : "asc")); return; }
    setSortColumn(column);
    setSortDirection("desc");
  }

  function openWebFig() {
    const ip = routerQuery.data?.wireguardIp;
    const url = `http://${ip}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "WebFig inaccessible",
        `L'IP ${ip} n'est accessible que depuis le réseau WireGuard VPS.\n\nConnectez votre appareil au VPN WireGuard avant d'accéder à WebFig.`,
        [
          { text: `Copier l'IP`, onPress: () => void Clipboard.setStringAsync(ip ?? "") },
          { text: "Fermer", style: "cancel" },
        ],
      );
    });
  }

  function openTerminal() {
    const ip = routerQuery.data?.wireguardIp;
    const user = routerQuery.data?.apiUsername ?? "admin";
    Linking.openURL(`ssh://${user}@${ip}`).catch(() => {
      Alert.alert(
        "Terminal SSH",
        `Installez JuiceSSH ou Termux sur votre appareil.\n\nHôte: ${ip}\nUtilisateur: ${user}\n\nNécessite le VPN WireGuard actif.`,
        [
          { text: "Copier l'hôte", onPress: () => void Clipboard.setStringAsync(ip ?? "") },
          { text: "Fermer", style: "cancel" },
        ],
      );
    });
  }

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement du routeur..." /></Page>;
  }
  if (!routerId) {
    return <Page><ErrorBanner message="ID routeur invalide." /></Page>;
  }
  if (routerQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement du routeur..." /></Page>;
  }
  if (routerQuery.error || !routerQuery.data) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger ce routeur." />
        <SectionCard>
          <ActionButton kind="secondary" label="Retour routeurs" onPress={() => router.replace("/routers")} />
        </SectionCard>
      </Page>
    );
  }

  const routerInfo = routerQuery.data;
  const stats = liveQuery.data;
  const statusTone = getStatusTone(routerInfo.status);

  return (
    <Page>
      <SectionTitle title={routerInfo.name} subtitle={routerInfo.location || "Sans localisation"} />
      {actionError ? <ErrorBanner message={actionError} /> : null}

      <SectionCard>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={[styles.badge, { borderColor: statusTone.borderColor, backgroundColor: statusTone.backgroundColor }]}>
              <Text style={[styles.badgeText, { color: statusTone.color }]}>{statusTone.text}</Text>
            </View>
            <View style={[styles.badge, { borderColor: "#314a6d", backgroundColor: "#122038" }]}>
              <Text style={[styles.badgeText, { color: "#cbe0ff" }]}>
                Live {liveQuery.dataUpdatedAt ? new Date(liveQuery.dataUpdatedAt).toLocaleTimeString("fr-FR") : "—"}
              </Text>
            </View>
          </View>
          <KeyValue label="WireGuard / API" value={`${routerInfo.wireguardIp}:${routerInfo.apiPort}`} />
          <KeyValue label="Utilisateur API" value={routerInfo.apiUsername} />
          <KeyValue label="Serveur hotspot" value={routerInfo.hotspotServer} />
          <KeyValue label="Profil hotspot" value={routerInfo.hotspotProfile} />
          <KeyValue label="Dernière activité" value={formatDateTime(routerInfo.lastSeenAt)} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <ActionButton kind="secondary" label="Retour" onPress={() => router.replace("/routers")} />
          <ActionButton
            kind="secondary"
            label={healthMutation.isPending ? "Test..." : "Health check"}
            onPress={() => healthMutation.mutate()}
            disabled={healthMutation.isPending}
          />
          <ActionButton
            kind="secondary"
            label={liveQuery.isFetching ? "..." : "Actualiser"}
            onPress={() => void liveQuery.refetch()}
            disabled={liveQuery.isFetching}
          />
        </View>
      </SectionCard>

      {/* ---- Outils de connexion ---- */}
      <SectionCard>
        <SectionTitle title="Outils de connexion" subtitle="Accès administration MikroTik" />
        <View style={{ gap: 8 }}>
          <Pressable style={styles.toolRow} onPress={() => setShowWinBox(true)}>
            <Text style={styles.toolIcon}>🖥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolTitle}>WinBox</Text>
              <Text style={styles.toolSubtitle}>Gestionnaire MikroTik (PC uniquement)</Text>
            </View>
            <Text style={styles.toolChevron}>›</Text>
          </Pressable>

          <Pressable style={styles.toolRow} onPress={openWebFig}>
            <Text style={styles.toolIcon}>🌐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolTitle}>WebFig</Text>
              <Text style={styles.toolSubtitle}>Interface web MikroTik (nécessite VPN WireGuard)</Text>
            </View>
            <Text style={styles.toolChevron}>›</Text>
          </Pressable>

          <Pressable style={styles.toolRow} onPress={openTerminal}>
            <Text style={styles.toolIcon}>💻</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolTitle}>Terminal SSH</Text>
              <Text style={styles.toolSubtitle}>Ouvre JuiceSSH / Termux (nécessite VPN WireGuard)</Text>
            </View>
            <Text style={styles.toolChevron}>›</Text>
          </Pressable>

          <Pressable style={styles.toolRow} onPress={() => setShowWgConfig(true)}>
            <Text style={styles.toolIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolTitle}>Config WireGuard</Text>
              <Text style={styles.toolSubtitle}>Générer et copier la configuration WireGuard</Text>
            </View>
            <Text style={styles.toolChevron}>›</Text>
          </Pressable>
        </View>
      </SectionCard>

      {/* ---- Live stats ---- */}
      <SectionCard>
        <SectionTitle title="Statistiques live" subtitle="Mise à jour toutes les 5 secondes" />
        {liveQuery.isLoading && !stats ? (
          <LoadingView label="Chargement des statistiques..." />
        ) : (
          <View style={{ gap: 8 }}>
            <KeyValue label="Clients actifs" value={stats?.activeClients ?? 0} />
            <KeyValue label="Débit download" value={formatBps(stats?.rxBytesPerSec ?? 0)} />
            <KeyValue label="Débit upload" value={formatBps(stats?.txBytesPerSec ?? 0)} />
            <KeyValue label="Total download" value={formatBytes(stats?.totalBytesIn ?? 0)} />
            <KeyValue label="Total upload" value={formatBytes(stats?.totalBytesOut ?? 0)} />
          </View>
        )}
      </SectionCard>

      {/* ---- Connected clients ---- */}
      <SectionCard>
        <SectionTitle title="Clients connectés" subtitle={`${sortedClients.length} session(s)`} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SORT_ITEMS.map((item) => {
            const active = sortColumn === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => toggleSort(item.value)}
                style={[styles.sortBtn, active && styles.sortBtnActive]}
              >
                <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>
                  {item.label} {active ? (sortDirection === "desc" ? "↓" : "↑") : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {sortedClients.length === 0 ? (
          <EmptyState
            title="Aucun client connecté"
            subtitle={routerInfo.status === "ONLINE" ? "Aucune session active." : "Routeur hors ligne ou inaccessible."}
          />
        ) : (
          <View style={{ gap: 8 }}>
            {sortedClients.map((client) => (
              <View key={client.id} style={styles.clientCard}>
                <Text style={styles.clientName}>{client.username}</Text>
                <Text style={styles.clientMeta}>{client.ipAddress} · {client.macAddress}</Text>
                <Text style={styles.clientStats}>
                  Uptime {client.uptime} · ↓ {formatBytes(client.bytesIn)} · ↑ {formatBytes(client.bytesOut)}
                </Text>
                <ActionButton
                  kind="danger"
                  label={disconnectingId === client.id ? "Coupure..." : "Couper session"}
                  onPress={() => terminateMutation.mutate({ routerId: routerId!, mikrotikId: client.id })}
                  disabled={terminateMutation.isPending}
                />
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* ==== WinBox Modal ==== */}
      <Modal visible={showWinBox} animationType="slide" transparent onRequestClose={() => setShowWinBox(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <SectionTitle title="WinBox" subtitle={routerInfo.name} />
            <Text style={styles.modalNote}>
              WinBox est disponible uniquement sur PC (Windows/macOS). Utilisez les informations ci-dessous depuis votre PC connecté au VPN WireGuard.
            </Text>
            <View style={{ gap: 10 }}>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>IP WireGuard</Text>
                <Text style={styles.credValue}>{routerInfo.wireguardIp}</Text>
                <CopyButton value={routerInfo.wireguardIp} label="IP" />
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Port</Text>
                <Text style={styles.credValue}>{routerInfo.apiPort}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Utilisateur</Text>
                <Text style={styles.credValue}>{routerInfo.apiUsername}</Text>
                <CopyButton value={routerInfo.apiUsername} label="user" />
              </View>
            </View>
            <Text style={styles.modalHint}>
              Téléchargez WinBox: mikrotik.com/download
            </Text>
            <Text style={styles.modalHint}>
              Le mot de passe API est masqué. Utilisez celui configuré lors de l'ajout du routeur.
            </Text>
            <ActionButton kind="secondary" label="Fermer" onPress={() => setShowWinBox(false)} />
          </View>
        </View>
      </Modal>

      {/* ==== WireGuard Config Modal ==== */}
      <Modal visible={showWgConfig} animationType="slide" onRequestClose={() => setShowWgConfig(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: "#0b1018" }} contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}>
          <SectionTitle title="Config WireGuard" subtitle={routerInfo.name} />

          {wgConfigQuery.isLoading ? (
            <SectionCard><LoadingView label="Génération..." /></SectionCard>
          ) : wgConfigQuery.error ? (
            <SectionCard><ErrorBanner message="Impossible de générer la config WireGuard." /></SectionCard>
          ) : wgConfigQuery.data ? (
            <SectionCard>
              <View style={{ gap: 12 }}>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>IP assignée</Text>
                  <Text style={styles.credValue}>{wgConfigQuery.data.wireguardIp}</Text>
                  <CopyButton value={wgConfigQuery.data.wireguardIp} label="IP" />
                </View>
                <View style={styles.configBox}>
                  <Text style={styles.configText}>{wgConfigQuery.data.config}</Text>
                </View>
                <ActionButton
                  label="Copier toute la config"
                  onPress={() => void Clipboard.setStringAsync(wgConfigQuery.data!.config)}
                />
                <Text style={styles.modalHint}>
                  Remplacez &lt;CLE_PRIVEE_ROUTEUR&gt; par la clé privée WireGuard générée sur le routeur MikroTik (WireGuard → Generate Keys → Private Key).
                </Text>
                <Text style={styles.modalHint}>
                  Si &lt;CLE_PUBLIQUE_VPS&gt; apparaît, configurez-la dans Paramètres → Infrastructure WireGuard (clé: wireguard.vps_public_key).
                </Text>
              </View>
            </SectionCard>
          ) : null}

          <SectionCard>
            <ActionButton kind="secondary" label="Fermer" onPress={() => setShowWgConfig(false)} />
          </SectionCard>
        </ScrollView>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  sortBtn: {
    borderRadius: 999, borderWidth: 1, borderColor: "#2d4466", backgroundColor: "#101a2c",
    paddingHorizontal: 10, paddingVertical: 6,
  },
  sortBtnActive: { borderColor: "#4f79b7", backgroundColor: "#1b2d49" },
  sortBtnText: { color: "#a2b6d4", fontSize: 12, fontWeight: "600" },
  sortBtnTextActive: { color: "#d8e8ff" },
  clientCard: { borderWidth: 1, borderColor: "#2c4161", borderRadius: 10, padding: 10, gap: 4 },
  clientName: { color: "#eef5ff", fontWeight: "700", fontSize: 14 },
  clientMeta: { color: "#cadbf7", fontSize: 12 },
  clientStats: { color: "#98add0", fontSize: 12 },
  toolRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: "#2a3f5e", borderRadius: 10, padding: 12,
    backgroundColor: "#0e1a2e",
  },
  toolIcon: { fontSize: 22, width: 32, textAlign: "center" },
  toolTitle: { color: "#e2efff", fontSize: 14, fontWeight: "700" },
  toolSubtitle: { color: "#7a96c0", fontSize: 12, marginTop: 2 },
  toolChevron: { color: "#4a6a99", fontSize: 22 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#0d1520", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, gap: 14,
  },
  modalNote: { color: "#b0c8ee", fontSize: 13, lineHeight: 20 },
  modalHint: { color: "#7a96c0", fontSize: 12, lineHeight: 18 },
  credRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  credLabel: { color: "#7a96c0", fontSize: 12, minWidth: 90 },
  credValue: { color: "#e2efff", fontSize: 14, fontWeight: "700", flex: 1, fontFamily: "monospace" },
  copyBtn: {
    borderWidth: 1, borderColor: "#2d4a72", borderRadius: 8, backgroundColor: "#132139",
    paddingHorizontal: 10, paddingVertical: 5,
  },
  copyBtnText: { color: "#7ac4f5", fontSize: 12, fontWeight: "700" },
  configBox: {
    backgroundColor: "#060e18", borderRadius: 8, borderWidth: 1, borderColor: "#1e3050", padding: 12,
  },
  configText: { color: "#a8d4ff", fontSize: 11, fontFamily: "monospace", lineHeight: 18 },
});
