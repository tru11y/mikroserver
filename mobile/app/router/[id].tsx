import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert, Linking, Modal, Pressable,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { api, extractErrorMessage } from "@/src/lib/api";
import { formatBps, formatBytes, formatDateTime } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  Divider,
  EmptyState,
  ErrorBanner,
  KeyValue,
  LoadingView,
  Page,
  Row,
  StatusBadge,
} from "@/src/components/ui";

// ─── Types / helpers ─────────────────────────────────────────────────────────

type SortColumn = "username" | "bytesIn" | "bytesOut" | "uptime";
type SortDirection = "asc" | "desc";

const SORT_ITEMS: Array<{ value: SortColumn; label: string }> = [
  { value: "bytesIn",   label: "↓ Download" },
  { value: "bytesOut",  label: "↑ Upload" },
  { value: "username",  label: "Utilisateur" },
  { value: "uptime",    label: "Uptime" },
];

function normalizeId(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Pressable onPress={copy} style={S.copyBtn}>
      <Text style={S.copyBtnText}>{copied ? "Copié ✓" : `Copier ${label}`}</Text>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RouterDetailScreen() {
  const params   = useLocalSearchParams<{ id?: string | string[] }>();
  const routerId = normalizeId(params.id);
  const guard    = useAuthGuard();
  const nav      = useRouter();
  const qc       = useQueryClient();

  const [sortColumn,     setSortColumn]     = useState<SortColumn>("bytesIn");
  const [sortDir,        setSortDir]        = useState<SortDirection>("desc");
  const [disconnectingId,setDisconnectingId]= useState<string | null>(null);
  const [actionError,    setActionError]    = useState<string | null>(null);
  const [showWinBox,     setShowWinBox]     = useState(false);
  const [showWgConfig,   setShowWgConfig]   = useState(false);

  const routerQuery = useQuery({
    queryKey:        ["router", routerId],
    queryFn:         () => api.routers.get(routerId as string),
    refetchInterval: 15_000,
    enabled:         Boolean(routerId),
  });

  const liveQuery = useQuery({
    queryKey:        ["router-live", routerId],
    queryFn:         () => api.routers.liveStats(routerId as string),
    refetchInterval: 5_000,
    retry:           false,
    enabled:         Boolean(routerId),
  });

  const wgQuery = useQuery({
    queryKey:  ["router-wg-config", routerId],
    queryFn:   () => api.routers.wireguardConfig(routerId as string),
    enabled:   Boolean(routerId) && showWgConfig,
    staleTime: 60_000,
  });

  const healthMut = useMutation({
    mutationFn: () => api.routers.healthCheck(routerId as string),
    onMutate:   () => setActionError(null),
    onSuccess:  async () => {
      await qc.invalidateQueries({ queryKey: ["router", routerId] });
      await qc.invalidateQueries({ queryKey: ["router-live", routerId] });
      await qc.invalidateQueries({ queryKey: ["routers"] });
    },
    onError: (e) => setActionError(extractErrorMessage(e)),
  });

  const terminateMut = useMutation({
    mutationFn: (p: { routerId: string; mikrotikId: string }) =>
      api.sessions.terminate(p.routerId, p.mikrotikId),
    onMutate:   (p) => { setDisconnectingId(p.mikrotikId); setActionError(null); },
    onSuccess:  async () => {
      await qc.invalidateQueries({ queryKey: ["router-live", routerId] });
      await qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError:    (e) => setActionError(extractErrorMessage(e)),
    onSettled:  () => setDisconnectingId(null),
  });

  const sortedClients = useMemo(() => {
    const clients = [...(liveQuery.data?.clients ?? [])];
    const dir = sortDir === "desc" ? -1 : 1;
    clients.sort((a, b) => {
      if (sortColumn === "username") return dir * a.username.localeCompare(b.username);
      if (sortColumn === "uptime")   return dir * a.uptime.localeCompare(b.uptime);
      return dir * (a[sortColumn] - b[sortColumn]);
    });
    return clients;
  }, [liveQuery.data?.clients, sortColumn, sortDir]);

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) { setSortDir((c) => c === "asc" ? "desc" : "asc"); return; }
    setSortColumn(col); setSortDir("desc");
  }

  function openWebFig() {
    const ip = routerQuery.data?.wireguardIp;
    Linking.openURL(`http://${ip}`).catch(() => {
      Alert.alert("WebFig inaccessible",
        `L'IP ${ip} n'est accessible que depuis le réseau WireGuard.\nConnectez votre appareil au VPN WireGuard.`,
        [{ text: `Copier l'IP`, onPress: () => void Clipboard.setStringAsync(ip ?? "") }, { text: "Fermer", style: "cancel" }]);
    });
  }

  function openTerminal() {
    const ip   = routerQuery.data?.wireguardIp;
    const user = routerQuery.data?.apiUsername ?? "admin";
    Linking.openURL(`ssh://${user}@${ip}`).catch(() => {
      Alert.alert("Terminal SSH",
        `Installez JuiceSSH ou Termux.\n\nHôte: ${ip}\nUtilisateur: ${user}\n\nNécessite le VPN WireGuard.`,
        [{ text: "Copier l'hôte", onPress: () => void Clipboard.setStringAsync(ip ?? "") }, { text: "Fermer", style: "cancel" }]);
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
        <Card><ActionButton kind="secondary" label="Retour" onPress={() => nav.back()} /></Card>
      </Page>
    );
  }

  const r    = routerQuery.data;
  const live = liveQuery.data;

  return (
    <Page>
      {actionError ? <ErrorBanner message={actionError} /> : null}

      {/* ── Info routeur ────────────────────────── */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={S.routerName}>{r.name}</Text>
            {r.location ? <Text style={S.routerMeta}>{r.location}</Text> : null}
            <Text style={S.routerMeta}>{r.wireguardIp ?? "—"}:{r.apiPort}</Text>
          </View>
          <StatusBadge status={r.status} />
        </View>
        {r.lastSeenAt ? (
          <Text style={S.routerSeen}>Dernier contact · {formatDateTime(r.lastSeenAt)}</Text>
        ) : null}
        <Divider />
        <KeyValue label="Utilisateur API"  value={r.apiUsername} />
        <KeyValue label="Serveur hotspot"  value={r.hotspotServer} />
        <KeyValue label="Profil hotspot"   value={r.hotspotProfile} />
        <Divider />
        <Row>
          <ActionButton flex kind="secondary"
            label={healthMut.isPending ? "Test..." : "Health check"}
            onPress={() => healthMut.mutate()} disabled={healthMut.isPending} loading={healthMut.isPending} />
          <ActionButton flex kind="secondary"
            label={liveQuery.isFetching ? "..." : "Actualiser"}
            onPress={() => void liveQuery.refetch()} disabled={liveQuery.isFetching} />
        </Row>
      </Card>

      {/* ── Outils ─────────────────────────────── */}
      <Card>
        <Text style={S.sectionLabel}>Outils de connexion</Text>
        {[
          { icon: "desktop-outline"   as const, title: "WinBox",         sub: "Gestionnaire MikroTik (PC uniquement)",       onPress: () => setShowWinBox(true) },
          { icon: "globe-outline"     as const, title: "WebFig",          sub: "Interface web (nécessite VPN WireGuard)",     onPress: openWebFig },
          { icon: "terminal-outline"  as const, title: "Terminal SSH",    sub: "JuiceSSH / Termux (nécessite VPN WireGuard)", onPress: openTerminal },
          { icon: "lock-closed-outline" as const, title: "Config WireGuard", sub: "Générer et copier la configuration WG",   onPress: () => setShowWgConfig(true) },
        ].map((item) => (
          <Pressable key={item.title} style={S.toolRow} onPress={item.onPress}>
            <View style={S.toolIcon}>
              <Ionicons name={item.icon} size={20} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.toolTitle}>{item.title}</Text>
              <Text style={S.toolSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#3d5070" />
          </Pressable>
        ))}
      </Card>

      {/* ── Stats live ─────────────────────────── */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={S.sectionLabel}>Statistiques live</Text>
          <Text style={S.liveStamp}>
            {liveQuery.dataUpdatedAt
              ? new Date(liveQuery.dataUpdatedAt).toLocaleTimeString("fr-FR")
              : "—"}
          </Text>
        </View>
        {liveQuery.isLoading && !live ? (
          <LoadingView label="Chargement..." />
        ) : (
          <>
            <KeyValue label="Clients actifs" value={live?.activeClients ?? 0} />
            <KeyValue label="Débit ↓"        value={formatBps(live?.rxBytesPerSec ?? 0)} />
            <KeyValue label="Débit ↑"        value={formatBps(live?.txBytesPerSec ?? 0)} />
            <KeyValue label="Total ↓"        value={formatBytes(live?.totalBytesIn  ?? 0)} />
            <KeyValue label="Total ↑"        value={formatBytes(live?.totalBytesOut ?? 0)} />
          </>
        )}
      </Card>

      {/* ── Clients connectés ──────────────────── */}
      <Card>
        <Text style={S.sectionLabel}>Clients connectés · {sortedClients.length}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }}>
          {SORT_ITEMS.map((item) => {
            const active = sortColumn === item.value;
            return (
              <Pressable key={item.value} onPress={() => toggleSort(item.value)}
                style={[S.sortBtn, active && S.sortBtnActive]}>
                <Text style={[S.sortText, active && S.sortTextActive]}>
                  {item.label}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {sortedClients.length === 0 ? (
          <EmptyState
            title="Aucun client connecté"
            subtitle={r.status === "ONLINE" ? "Aucune session active." : "Routeur hors ligne ou inaccessible."}
          />
        ) : (
          <View style={{ gap: 8 }}>
            {sortedClients.map((client) => (
              <View key={client.id} style={S.clientCard}>
                <Text style={S.clientName}>{client.username}</Text>
                <Text style={S.clientMeta}>{client.ipAddress} · {client.macAddress}</Text>
                <Text style={S.clientStats}>
                  Uptime {client.uptime} · ↓ {formatBytes(client.bytesIn)} · ↑ {formatBytes(client.bytesOut)}
                </Text>
                <ActionButton kind="danger"
                  label={disconnectingId === client.id ? "Coupure..." : "Couper session"}
                  onPress={() => terminateMut.mutate({ routerId: routerId!, mikrotikId: client.id })}
                  disabled={terminateMut.isPending}
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* ── Modal WinBox ────────────────────────── */}
      <Modal visible={showWinBox} animationType="slide" transparent onRequestClose={() => setShowWinBox(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <View style={S.sheetHeader}>
              <Text style={S.sheetTitle}>WinBox · {r.name}</Text>
              <Pressable onPress={() => setShowWinBox(false)} hitSlop={10}><Text style={S.closeX}>✕</Text></Pressable>
            </View>
            <Text style={S.sheetNote}>
              WinBox est disponible uniquement sur PC (Windows/macOS). Utilisez les informations ci-dessous depuis votre PC connecté au VPN WireGuard.
            </Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              <CredRow label="IP WireGuard" value={r.wireguardIp ?? "—"} onCopy={r.wireguardIp ?? undefined} />
              <CredRow label="Port"         value={String(r.apiPort)} />
              <CredRow label="Utilisateur"  value={r.apiUsername} onCopy={r.apiUsername} />
            </View>
            <Text style={S.sheetHint}>Le mot de passe API est masqué. Utilisez celui configuré lors de l'ajout du routeur.</Text>
            <Text style={S.sheetHint}>Téléchargez WinBox: mikrotik.com/download</Text>
            <ActionButton kind="secondary" label="Fermer" onPress={() => setShowWinBox(false)} />
          </View>
        </View>
      </Modal>

      {/* ── Modal WireGuard config ──────────────── */}
      <Modal visible={showWgConfig} animationType="slide" onRequestClose={() => setShowWgConfig(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: "#060e1c" }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <View style={S.sheetHeader}>
            <Text style={S.sheetTitle}>Config WireGuard · {r.name}</Text>
            <Pressable onPress={() => setShowWgConfig(false)} hitSlop={10}><Text style={S.closeX}>✕</Text></Pressable>
          </View>

          {wgQuery.isLoading ? (
            <Card><LoadingView label="Génération..." /></Card>
          ) : wgQuery.error ? (
            <ErrorBanner message="Impossible de générer la config WireGuard." />
          ) : wgQuery.data ? (
            <Card>
              <CredRow label="IP assignée" value={wgQuery.data.wireguardIp} onCopy={wgQuery.data.wireguardIp} />
              <View style={S.configBox}>
                <Text style={S.configText}>{wgQuery.data.config}</Text>
              </View>
              <ActionButton label="Copier toute la config"
                onPress={() => void Clipboard.setStringAsync(wgQuery.data!.config)} />
              <Text style={S.sheetHint}>
                Remplacez &lt;CLE_PRIVEE_ROUTEUR&gt; par la clé privée WireGuard générée sur le routeur MikroTik.
              </Text>
              <Text style={S.sheetHint}>
                Si &lt;CLE_PUBLIQUE_VPS&gt; apparaît, configurez-la dans Paramètres → Infrastructure WireGuard.
              </Text>
            </Card>
          ) : null}

          <ActionButton kind="ghost" label="Fermer" onPress={() => setShowWgConfig(false)} />
        </ScrollView>
      </Modal>
    </Page>
  );
}

function CredRow({ label, value, onCopy }: { label: string; value: string; onCopy?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Text style={S.credLabel}>{label}</Text>
      <Text style={S.credValue}>{value}</Text>
      {onCopy ? <CopyButton value={onCopy} label={label} /> : null}
    </View>
  );
}

const S = StyleSheet.create({
  routerName: { color: "#f0f5ff", fontWeight: "700", fontSize: 16 },
  routerMeta: { color: "#6b849f", fontSize: 12 },
  routerSeen: { color: "#4a617e", fontSize: 11 },
  sectionLabel:{ color: "#6b849f", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  liveStamp:  { color: "#4a617e", fontSize: 11 },

  toolRow:    { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 12, padding: 12, marginTop: 8, backgroundColor: "#060e1c" },
  toolIcon:   { width: 36, height: 36, borderRadius: 10, backgroundColor: "#0f1c38", borderWidth: 1, borderColor: "#1e2f4a", alignItems: "center", justifyContent: "center" },
  toolTitle:  { color: "#f0f5ff", fontSize: 14, fontWeight: "700" },
  toolSub:    { color: "#6b849f", fontSize: 12, marginTop: 1 },

  sortBtn:      { borderRadius: 99, borderWidth: 1, borderColor: "#1e2f4a", backgroundColor: "#0d1829", paddingHorizontal: 10, paddingVertical: 6 },
  sortBtnActive:{ borderColor: "#6366f1", backgroundColor: "#111f35" },
  sortText:     { color: "#6b849f", fontSize: 12, fontWeight: "600" },
  sortTextActive:{ color: "#a5b4fc" },

  clientCard:  { borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 12, padding: 12, gap: 4 },
  clientName:  { color: "#f0f5ff", fontWeight: "700", fontSize: 14 },
  clientMeta:  { color: "#c4d3ef", fontSize: 12 },
  clientStats: { color: "#6b849f", fontSize: 12 },

  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: "#0d1829", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  sheetHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { color: "#f0f5ff", fontSize: 17, fontWeight: "700", flex: 1 },
  sheetNote:  { color: "#c4d3ef", fontSize: 13, lineHeight: 20 },
  sheetHint:  { color: "#6b849f", fontSize: 12, lineHeight: 18 },
  closeX:     { color: "#6b849f", fontSize: 20 },

  credLabel:  { color: "#6b849f", fontSize: 12, minWidth: 90 },
  credValue:  { color: "#f0f5ff", fontSize: 14, fontWeight: "700", flex: 1, fontFamily: "monospace" },
  copyBtn:    { borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 8, backgroundColor: "#0d1829", paddingHorizontal: 10, paddingVertical: 5 },
  copyBtnText:{ color: "#6366f1", fontSize: 12, fontWeight: "700" },

  configBox:  { backgroundColor: "#060e1c", borderRadius: 10, borderWidth: 1, borderColor: "#1e2f4a", padding: 12, marginVertical: 8 },
  configText: { color: "#a5b4fc", fontSize: 11, fontFamily: "monospace", lineHeight: 18 },
});
