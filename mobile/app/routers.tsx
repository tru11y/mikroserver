import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  api, extractErrorMessage,
  type RouterItem,
} from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorBanner,
  InputField,
  LoadingView,
  Page,
  SectionTitle,
  StatusBadge,
} from "@/src/components/ui";

type AddForm = { ip: string; port: string; username: string; password: string; comment: string };
const EMPTY: AddForm = { ip: "", port: "8728", username: "admin", password: "", comment: "" };

export default function RoutersScreen() {
  const guard = useAuthGuard();
  const nav = useRouter();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  // After creation: track the pending router ID for polling
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pollTimeout, setPollTimeout] = useState(false);
  const pollStart = useRef<number>(0);

  const routersQuery = useQuery({
    queryKey: ["routers"],
    queryFn: () => api.routers.list(),
    refetchInterval: 30_000,
  });

  // Poll the pending router until wireguardIp is set (max 90s)
  const pendingQuery = useQuery({
    queryKey: ["router", pendingId],
    queryFn: () => api.routers.get(pendingId!),
    enabled: !!pendingId,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!pendingId) return;
    pollStart.current = Date.now();
    setPollTimeout(false);
  }, [pendingId]);

  useEffect(() => {
    if (!pendingId || !pendingQuery.data) return;
    const router = pendingQuery.data;

    if (router.wireguardIp) {
      // Tunnel is up — refresh list and close
      void qc.invalidateQueries({ queryKey: ["routers"] });
      setPendingId(null);
      setShowAdd(false);
      return;
    }

    // Timeout after 90s
    if (Date.now() - pollStart.current > 90_000) {
      setPollTimeout(true);
      setPendingId(null);
    }
  }, [pendingQuery.data, pendingId]);

  const createMut = useMutation({
    mutationFn: (f: AddForm) => {
      const name = f.comment.trim() || `Routeur ${f.ip.trim()}`;
      return api.routers.create({
        name,
        wireguardIp: f.ip.trim(),
        apiPort: Number(f.port) || 8728,
        apiUsername: f.username.trim(),
        apiPassword: f.password,
        description: f.comment.trim() || undefined,
      });
    },
    onMutate: () => { setFormError(null); },
    onSuccess: (router) => {
      setForm(EMPTY);
      setPendingId(router.id);
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.routers.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["routers"] }),
  });

  function confirmDelete(router: RouterItem) {
    Alert.alert("Supprimer", `Supprimer ${router.name} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => removeMut.mutate(router.id) },
    ]);
  }

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement..." /></Page>;
  }
  if (routersQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des routeurs..." /></Page>;
  }
  if (routersQuery.error) {
    return <Page><ErrorBanner message="Impossible de charger les routeurs." /></Page>;
  }

  const routers = routersQuery.data ?? [];
  const online = routers.filter((r) => r.status === "ONLINE").length;

  return (
    <>
      <Page>
        <SectionTitle title="Routeurs" subtitle={`${routers.length} total · ${online} en ligne`} />

        <Card>
          <ActionButton label="Ajouter un routeur" onPress={() => {
            setForm(EMPTY); setFormError(null); setPollTimeout(false); setShowAdd(true);
          }} />
        </Card>

        {routers.length === 0 ? (
          <EmptyState title="Aucun routeur" subtitle="Ajoute ton premier routeur MikroTik." />
        ) : (
          routers.map((router) => (
            <View key={router.id} style={S.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.name}>{router.name}</Text>
                  <Text style={S.meta}>
                    {router.wireguardIp ? `WG: ${router.wireguardIp}` : "Tunnel en attente"} · Port {router.apiPort}
                  </Text>
                  {router.location ? <Text style={S.meta}>{router.location}</Text> : null}
                  <Text style={S.meta}>Vu · {formatDateTime(router.lastSeenAt)}</Text>
                </View>
                <StatusBadge status={router.status} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <ActionButton flex kind="secondary" label="Détail live"
                  onPress={() => nav.push(`/router/${router.id}`)} />
                <ActionButton flex kind="danger" label="Supprimer"
                  onPress={() => confirmDelete(router)} disabled={removeMut.isPending} />
              </View>
            </View>
          ))
        )}
      </Page>

      {/* ── Modal ajout ─────────────────────────────────────── */}
      <Modal visible={showAdd} animationType="slide" onRequestClose={() => !pendingId && setShowAdd(false)}>
        <ScrollView style={S.modal} contentContainerStyle={S.modalContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Ajouter un routeur</Text>
            {!pendingId && (
              <Pressable onPress={() => setShowAdd(false)} hitSlop={12}>
                <Text style={S.closeBtn}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* ── Étape 1 : formulaire ─── */}
          {!pendingId ? (
            <>
              {formError ? <ErrorBanner message={formError} /> : null}
              {pollTimeout ? <ErrorBanner message="Tunnel non établi. Vérifiez IP/identifiants et réessayez." /> : null}

              {/* Address + Port */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 3 }}>
                  <InputField label="Address" value={form.ip}
                    onChangeText={(v) => setForm((f) => ({ ...f, ip: v }))}
                    keyboardType="numeric" placeholder="192.168.88.1" />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField label="Port" value={form.port}
                    onChangeText={(v) => setForm((f) => ({ ...f, port: v }))}
                    keyboardType="numeric" />
                </View>
              </View>

              <InputField label="Username" value={form.username}
                onChangeText={(v) => setForm((f) => ({ ...f, username: v }))} />
              <InputField label="Password" value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                secureTextEntry />
              <InputField label="Comment" value={form.comment}
                onChangeText={(v) => setForm((f) => ({ ...f, comment: v }))} />

              <ActionButton
                label={createMut.isPending ? "Connecting..." : "Connect"}
                onPress={() => {
                  if (!form.ip.trim() || !form.username.trim() || !form.password) {
                    setFormError("Address, username and password are required.");
                    return;
                  }
                  createMut.mutate(form);
                }}
                disabled={createMut.isPending} loading={createMut.isPending}
              />
            </>
          ) : (
            /* ── Étape 2 : provisioning en cours ─── */
            <View style={S.waitBox}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={S.waitTitle}>Configuration WireGuard en cours…</Text>
              <Text style={S.waitDesc}>
                Le serveur configure automatiquement le tunnel VPN sur votre routeur.
                {"\n"}Cela prend généralement 10 à 30 secondes.
              </Text>
              {pendingQuery.data && !pendingQuery.data.wireguardIp && (
                <View style={S.stepRow}>
                  <Text style={S.stepDone}>✓ Routeur créé</Text>
                  <Text style={S.stepDone}>✓ Clés WireGuard générées</Text>
                  <Text style={S.stepPending}>⟳ Attente connexion tunnel…</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  card:         { backgroundColor: "#0d1829", borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 14, padding: 14, gap: 6 },
  name:         { color: "#f0f5ff", fontWeight: "700", fontSize: 15 },
  meta:         { color: "#6b849f", fontSize: 12 },
  modal:        { flex: 1, backgroundColor: "#060e1c" },
  modalContent: { padding: 16, paddingBottom: 40, gap: 14 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle:   { color: "#f0f5ff", fontSize: 18, fontWeight: "700", flex: 1 },
  closeBtn:     { color: "#6b849f", fontSize: 20 },
  hint:         { color: "#6b849f", fontSize: 12, lineHeight: 18 },
  waitBox:      { alignItems: "center", gap: 16, paddingVertical: 40 },
  waitTitle:    { color: "#f0f5ff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  waitDesc:     { color: "#6b849f", fontSize: 13, textAlign: "center", lineHeight: 20 },
  stepRow:      { gap: 6, marginTop: 8, alignItems: "flex-start" },
  stepDone:     { color: "#4ade80", fontSize: 13 },
  stepPending:  { color: "#818cf8", fontSize: 13 },
});
