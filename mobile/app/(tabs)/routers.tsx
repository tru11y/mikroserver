import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, extractErrorMessage, type RouterItem, type WgProvision } from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton, Card, Divider, EmptyState, ErrorBanner,
  InputField, LoadingView, Page, Row, StatusBadge,
} from "@/src/components/ui";

type AddForm = { address: string; port: string; username: string; password: string; comment: string };
const EMPTY: AddForm = { address: "", port: "8728", username: "admin", password: "", comment: "" };

type PushStep = "idle" | "pushing" | "polling" | "done" | "error";

export default function RoutersScreen() {
  const guard = useAuthGuard();
  const nav   = useRouter();
  const qc    = useQueryClient();

  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState<AddForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pushStep,  setPushStep]  = useState<PushStep>("idle");
  const [pushError, setPushError] = useState<string | null>(null);
  const wgRef = useRef<WgProvision | null>(null);
  const addrRef = useRef<AddForm>(EMPTY);

  const patch = (p: Partial<AddForm>) => setForm((f) => ({ ...f, ...p }));

  const routersQuery = useQuery({
    queryKey: ["routers"],
    queryFn:  () => api.routers.list(),
    refetchInterval: 30_000,
  });

  const pendingQuery = useQuery({
    queryKey: ["router-pending", pendingId],
    queryFn:  () => api.routers.get(pendingId!),
    enabled:  !!pendingId,
    refetchInterval: 5_000,
  });

  // 3-minute timeout for tunnel polling
  useEffect(() => {
    if (!pendingId) return;
    const timer = setTimeout(() => {
      setPushStep("error");
      setPushError("Tunnel non établi (3min). Vérifiez que le routeur peut atteindre le VPS (51820/UDP).");
      setPendingId(null);
    }, 180_000);
    return () => clearTimeout(timer);
  }, [pendingId]);

  // Detect tunnel up
  useEffect(() => {
    if (!pendingId || !pendingQuery.data) return;
    if (pendingQuery.data.wireguardIp) {
      void qc.invalidateQueries({ queryKey: ["routers"] });
      setPendingId(null);
      setPushStep("done");
      setShowAdd(false);
    }
  }, [pendingQuery.data, pendingId, qc]);

  async function pushWireGuardConfig(wg: WgProvision, addr: AddForm): Promise<void> {
    const base = `http://${addr.address}:80`;
    const auth = "Basic " + btoa(`${addr.username}:${addr.password}`);
    const h = { Authorization: auth, "Content-Type": "application/json" };
    const [vpsIp, vpsPort] = wg.vpsEndpoint.split(":");

    const post = async (path: string, body: Record<string, string>) => {
      const res = await fetch(`${base}/rest${path}`, {
        method: "PUT",
        headers: h,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`RouterOS ${path}: ${res.status} ${text}`);
      }
    };

    await post("/interface/wireguard", {
      name: "wg-mks",
      "listen-port": String(wg.listenPort),
      "private-key": wg.privateKey,
    });

    await post("/interface/wireguard/peers", {
      interface: "wg-mks",
      "public-key": wg.vpsPublicKey,
      "allowed-address": "0.0.0.0/0",
      "endpoint-address": vpsIp ?? "",
      "endpoint-port": vpsPort ?? "51820",
      "persistent-keepalive": "25",
    });

    await post("/ip/address", {
      address: `${wg.wgIp}/24`,
      interface: "wg-mks",
    });
  }

  const createMut = useMutation({
    mutationFn: (f: AddForm) => api.routers.create({
      name:        f.comment.trim() || `Routeur ${f.address.trim()}`,
      wireguardIp: f.address.trim(),
      apiPort:     Number(f.port) || 8728,
      apiUsername: f.username.trim(),
      apiPassword: f.password,
      description: f.comment.trim() || undefined,
    }),
    onMutate:  () => { setFormError(null); setPushError(null); setPushStep("idle"); },
    onSuccess: async (router: RouterItem) => {
      addrRef.current = form;
      setForm(EMPTY);
      const wg = router.wgProvision;
      if (!wg) {
        setPushError("Clés WireGuard non reçues du serveur.");
        setPushStep("error");
        return;
      }
      wgRef.current = wg;
      setPushStep("pushing");
      try {
        await pushWireGuardConfig(wg, addrRef.current);
        setPushStep("polling");
        setPendingId(router.id);
      } catch (e) {
        // RouterOS REST API failed (v6 or port 80 closed) — still poll, manual setup needed
        setPushError(
          `Config auto échouée: ${String(e)}\n` +
          `Le routeur doit être RouterOS v7+ avec www service actif.\n` +
          `En attente de connexion manuelle...`
        );
        setPushStep("polling");
        setPendingId(router.id);
      }
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.routers.remove(id),
    onSuccess:  () => void qc.invalidateQueries({ queryKey: ["routers"] }),
  });

  const healthMut = useMutation({
    mutationFn: (id: string) => api.routers.healthCheck(id),
    onSuccess:  () => void qc.invalidateQueries({ queryKey: ["routers"] }),
  });

  function confirmDelete(r: RouterItem) {
    Alert.alert("Supprimer", `Supprimer « ${r.name} » ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => removeMut.mutate(r.id) },
    ]);
  }

  const isProvisioning = pushStep === "pushing" || pushStep === "polling";

  if (!guard.isReady || guard.isBlocked) return <Page scroll={false}><LoadingView /></Page>;
  if (routersQuery.isLoading)            return <Page scroll={false}><LoadingView label="Chargement des routeurs..." /></Page>;
  if (routersQuery.error)                return <Page><ErrorBanner message="Impossible de charger les routeurs." /></Page>;

  const routers = routersQuery.data ?? [];
  const online  = routers.filter((r) => r.status === "ONLINE").length;

  return (
    <>
      <Page>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={S.countTitle}>{routers.length} routeurs</Text>
              <Text style={S.countMeta}>{online} en ligne</Text>
            </View>
            <ActionButton label="+ Ajouter" onPress={() => { setForm(EMPTY); setFormError(null); setPushError(null); setPushStep("idle"); setShowAdd(true); }} />
          </View>
        </Card>

        {routers.length === 0
          ? <EmptyState title="Aucun routeur" subtitle="Ajoute ton premier routeur MikroTik." />
          : routers.map((router) => (
            <View key={router.id} style={S.routerCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={S.routerName}>{router.name}</Text>
                  {router.location ? <Text style={S.routerMeta}>{router.location}</Text> : null}
                  <Text style={S.routerMeta}>
                    {router.wireguardIp ?? "Tunnel en attente"} · Port {router.apiPort}
                  </Text>
                  {router.lastSeenAt
                    ? <Text style={S.routerMeta}>Vu · {formatDateTime(router.lastSeenAt)}</Text>
                    : null}
                </View>
                <StatusBadge status={router.status} />
              </View>
              <Divider />
              <Row>
                <ActionButton flex kind="secondary" label="Détail live" onPress={() => nav.push(`/router/${router.id}`)} />
                <ActionButton flex kind="secondary" label="Health check"
                  onPress={() => healthMut.mutate(router.id)} disabled={healthMut.isPending} loading={healthMut.isPending} />
              </Row>
              <Row>
                <ActionButton flex kind="danger" label="Supprimer"
                  onPress={() => confirmDelete(router)} disabled={removeMut.isPending} />
              </Row>
            </View>
          ))
        }
      </Page>

      <Modal visible={showAdd} animationType="slide" onRequestClose={() => !isProvisioning && setShowAdd(false)}>
        <ScrollView style={S.modal} contentContainerStyle={S.modalContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>New Router</Text>
            {!isProvisioning && (
              <Pressable onPress={() => setShowAdd(false)} hitSlop={10}>
                <Text style={S.closeBtn}>✕</Text>
              </Pressable>
            )}
          </View>

          {!isProvisioning ? (
            <>
              {formError  ? <ErrorBanner message={formError} /> : null}
              {pushError  ? <ErrorBanner message={pushError} /> : null}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 3 }}>
                  <InputField label="Address" value={form.address}
                    onChangeText={(v) => patch({ address: v })}
                    keyboardType="numeric" placeholder="192.168.88.1" />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField label="Port" value={form.port}
                    onChangeText={(v) => patch({ port: v })} keyboardType="numeric" />
                </View>
              </View>

              <InputField label="Username" value={form.username} onChangeText={(v) => patch({ username: v })} />
              <InputField label="Password" value={form.password} onChangeText={(v) => patch({ password: v })} secureTextEntry />
              <InputField label="Comment"  value={form.comment}  onChangeText={(v) => patch({ comment: v })}  placeholder="ex: Bureau principal" />

              <ActionButton
                label={createMut.isPending ? "Connecting..." : "Connect"}
                onPress={() => {
                  if (!form.address.trim() || !form.username.trim() || !form.password) {
                    setFormError("Address, username and password are required.");
                    return;
                  }
                  createMut.mutate(form);
                }}
                disabled={createMut.isPending} loading={createMut.isPending}
              />
            </>
          ) : (
            <View style={S.waitBox}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={S.waitTitle}>
                {pushStep === "pushing" ? "Configuration RouterOS en cours…" : "Attente connexion tunnel…"}
              </Text>
              {pushError ? <ErrorBanner message={pushError} /> : null}
              <View style={{ gap: 6, marginTop: 8, alignSelf: "flex-start" }}>
                <Text style={S.stepDone}>✓ Routeur enregistré</Text>
                <Text style={S.stepDone}>✓ Clés WireGuard générées</Text>
                {pushStep === "pushing"
                  ? <Text style={S.stepPending}>⟳ Push config RouterOS…</Text>
                  : <Text style={S.stepDone}>✓ Config RouterOS envoyée</Text>}
                {pushStep === "polling"
                  ? <Text style={S.stepPending}>⟳ Attente connexion tunnel…</Text>
                  : null}
              </View>
            </View>
          )}
        </ScrollView>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  countTitle:   { color: "#f0f5ff", fontSize: 17, fontWeight: "700" },
  countMeta:    { color: "#6b849f", fontSize: 12 },
  routerCard:   { backgroundColor: "#0d1829", borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 14, padding: 14, gap: 8 },
  routerName:   { color: "#f0f5ff", fontWeight: "700", fontSize: 15 },
  routerMeta:   { color: "#6b849f", fontSize: 12 },
  modal:        { flex: 1, backgroundColor: "#060e1c" },
  modalContent: { padding: 20, paddingBottom: 40, gap: 14 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  modalTitle:   { color: "#f0f5ff", fontSize: 20, fontWeight: "700" },
  closeBtn:     { color: "#6b849f", fontSize: 22 },
  waitBox:      { alignItems: "center", gap: 16, paddingVertical: 40 },
  waitTitle:    { color: "#f0f5ff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  stepDone:     { color: "#4ade80", fontSize: 13 },
  stepPending:  { color: "#818cf8", fontSize: 13 },
});
