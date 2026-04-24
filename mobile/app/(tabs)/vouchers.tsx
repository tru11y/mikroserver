import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, extractErrorMessage } from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  Divider,
  EmptyState,
  ErrorBanner,
  LoadingView,
  Page,
  Row,
  StatusBadge,
} from "@/src/components/ui";

const PAGE_SIZE = 20;

export default function VouchersScreen() {
  const guard      = useAuthGuard();
  const expoRouter = useRouter();
  const qc         = useQueryClient();
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["vouchers", page],
    queryFn:  () => api.vouchers.list(page, PAGE_SIZE),
    refetchInterval: 30_000,
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => api.vouchers.revoke(id),
    onSuccess:  async () => qc.invalidateQueries({ queryKey: ["vouchers"] }),
    onError:    (e) => setActionError(extractErrorMessage(e)),
  });

  const redeliverMut = useMutation({
    mutationFn: (id: string) => api.vouchers.redeliver(id),
    onSuccess:  async () => qc.invalidateQueries({ queryKey: ["vouchers"] }),
    onError:    (e) => setActionError(extractErrorMessage(e)),
  });

  function confirmRevoke(id: string, code: string) {
    Alert.alert("Révoquer ticket", `Révoquer le ticket ${code} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Révoquer", style: "destructive", onPress: () => revokeMut.mutate(id) },
    ]);
  }

  if (!guard.isReady || guard.isBlocked) return <Page scroll={false}><LoadingView /></Page>;
  if (query.isLoading) return <Page scroll={false}><LoadingView label="Chargement des tickets..." /></Page>;
  if (query.error) return <Page><ErrorBanner message="Impossible de charger les tickets." /></Page>;

  const { items = [], total = 0 } = query.data ?? {};
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Page>
      {/* Header actions */}
      <Card>
        <View style={S.headerRow}>
          <Text style={S.headerCount}>{total} tickets</Text>
          <ActionButton
            label="Générer"
            onPress={() => expoRouter.push("/vouchers-generate")}
          />
        </View>
      </Card>

      {actionError ? <ErrorBanner message={actionError} /> : null}

      {items.length === 0 ? (
        <EmptyState title="Aucun ticket" subtitle="Génère des tickets depuis le bouton ci-dessus." />
      ) : (
        items.map((v) => (
          <View key={v.id} style={S.voucherCard}>
            <View style={S.voucherHeader}>
              <Text style={S.voucherCode}>{v.code}</Text>
              <StatusBadge status={v.status} />
            </View>

            {v.planName ? <Text style={S.voucherMeta}>{v.planName}</Text> : null}
            {v.routerName ? (
              <Text style={S.voucherMeta}>Routeur · {v.routerName}</Text>
            ) : null}
            <Text style={S.voucherDate}>
              Créé · {formatDateTime(v.createdAt)}
              {v.expiresAt ? `  ·  Expire · ${formatDateTime(v.expiresAt)}` : ""}
            </Text>

            {v.lastDeliveryError ? (
              <ErrorBanner message={v.lastDeliveryError} />
            ) : null}

            <Divider />

            <Row>
              {(v.status === "DELIVERY_FAILED" || v.status === "GENERATED") && (
                <ActionButton
                  flex
                  kind="secondary"
                  label="Relancer"
                  onPress={() => redeliverMut.mutate(v.id)}
                  disabled={redeliverMut.isPending}
                  loading={redeliverMut.isPending && redeliverMut.variables === v.id}
                />
              )}
              {v.status !== "REVOKED" && v.status !== "EXPIRED" && (
                <ActionButton
                  flex
                  kind="danger"
                  label="Révoquer"
                  onPress={() => confirmRevoke(v.id, v.code)}
                  disabled={revokeMut.isPending}
                />
              )}
            </Row>
          </View>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <Row>
            <ActionButton
              flex
              kind="secondary"
              label="← Précédent"
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            />
            <ActionButton
              flex
              kind="ghost"
              label={`${page} / ${totalPages}`}
              onPress={() => {}}
            />
            <ActionButton
              flex
              kind="secondary"
              label="Suivant →"
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            />
          </Row>
        </Card>
      )}
    </Page>
  );
}

const S = StyleSheet.create({
  headerRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerCount:  { color: "#f0f5ff", fontSize: 17, fontWeight: "700" },
  voucherCard:  {
    backgroundColor: "#0d1829",
    borderWidth: 1, borderColor: "#1e2f4a",
    borderRadius: 14, padding: 14, gap: 8,
  },
  voucherHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  voucherCode:  { color: "#a5b4fc", fontWeight: "700", fontSize: 15, fontFamily: "monospace" },
  voucherMeta:  { color: "#6b849f", fontSize: 12 },
  voucherDate:  { color: "#4a617e", fontSize: 11 },
});
