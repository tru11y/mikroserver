import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { api, extractErrorMessage, type VoucherStatus } from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { saveAndSharePdf } from "@/src/lib/pdf";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingView,
  Page,
  SectionCard,
  SectionTitle,
} from "@/src/components/ui";

const PAGE_SIZE = 20;

const STATUS_META: Record<
  VoucherStatus,
  { label: string; textColor: string; borderColor: string; backgroundColor: string }
> = {
  GENERATED: {
    label: "Généré",
    textColor: "#cad7ea",
    borderColor: "#4b5f7f",
    backgroundColor: "#202c3f",
  },
  DELIVERED: {
    label: "Livré",
    textColor: "#8cf2bc",
    borderColor: "#2f704d",
    backgroundColor: "#153624",
  },
  ACTIVE: {
    label: "Actif",
    textColor: "#9ec8ff",
    borderColor: "#355f8e",
    backgroundColor: "#1a2f46",
  },
  EXPIRED: {
    label: "Expiré",
    textColor: "#ffd995",
    borderColor: "#845a24",
    backgroundColor: "#3f2d14",
  },
  REVOKED: {
    label: "Révoqué",
    textColor: "#ffb5c1",
    borderColor: "#8c3a4b",
    backgroundColor: "#3f1d26",
  },
  DELIVERY_FAILED: {
    label: "Échec livraison",
    textColor: "#ffcf97",
    borderColor: "#8a5526",
    backgroundColor: "#3f2913",
  },
};

function canRedeliver(status: VoucherStatus): boolean {
  return status === "GENERATED" || status === "DELIVERY_FAILED";
}

function canRevoke(status: VoucherStatus): boolean {
  return (
    status === "GENERATED" ||
    status === "DELIVERED" ||
    status === "ACTIVE" ||
    status === "DELIVERY_FAILED"
  );
}

export default function VouchersScreen() {
  const guard = useAuthGuard();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  const vouchersQuery = useQuery({
    queryKey: ["vouchers", page],
    queryFn: () => api.vouchers.list(page, PAGE_SIZE),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.revoke(id),
    onMutate: () => {
      setActionError(null);
      setActionInfo(null);
    },
    onSuccess: async () => {
      setActionInfo("Voucher révoqué.");
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    },
    onError: (error) => {
      setActionError(extractErrorMessage(error));
    },
  });

  const redeliverMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.redeliver(id),
    onMutate: () => {
      setActionError(null);
      setActionInfo(null);
    },
    onSuccess: async () => {
      setActionInfo("Relivraison demandée.");
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    },
    onError: (error) => {
      setActionError(extractErrorMessage(error));
    },
  });

  const exportMutation = useMutation({
    mutationFn: (voucherIds: string[]) => api.vouchers.downloadPdf(voucherIds),
    onMutate: () => {
      setActionError(null);
      setActionInfo(null);
    },
    onSuccess: async (buffer) => {
      const result = await saveAndSharePdf(buffer, "tickets");
      setActionInfo(
        result.shared
          ? "PDF prêt et partage lancé."
          : `PDF généré localement: ${result.uri}`,
      );
    },
    onError: (error) => {
      setActionError(extractErrorMessage(error));
    },
  });

  const result = vouchersQuery.data;
  const vouchers = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => vouchers.some((voucher) => voucher.id === id)));
  }, [vouchers]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected = useMemo(
    () => vouchers.length > 0 && vouchers.every((voucher) => selectedIds.includes(voucher.id)),
    [selectedIds, vouchers],
  );

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleSelectVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !vouchers.some((voucher) => voucher.id === id)),
      );
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      vouchers.forEach((voucher) => next.add(voucher.id));
      return Array.from(next);
    });
  }

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des vouchers..." />
      </Page>
    );
  }

  if (vouchersQuery.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des vouchers..." />
      </Page>
    );
  }

  if (vouchersQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les vouchers." />
      </Page>
    );
  }

  return (
    <Page>
      <SectionTitle
        title="Vouchers"
        subtitle={`${total} voucher(s) au total`}
      />

      {actionError ? <ErrorBanner message={actionError} /> : null}
      {actionInfo ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: "#2f704d",
            backgroundColor: "#143625",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#9ff0c8", fontSize: 13 }}>{actionInfo}</Text>
        </View>
      ) : null}

      <SectionCard>
        <Text style={{ color: "#d8e6fd", fontSize: 13 }}>
          {selectedCount} ticket(s) sélectionné(s)
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionButton
            kind="secondary"
            label={allVisibleSelected ? "Désélectionner la page" : "Sélectionner la page"}
            onPress={toggleSelectVisible}
            disabled={vouchers.length === 0}
          />
          <ActionButton
            kind="primary"
            label={exportMutation.isPending ? "Export..." : "Exporter PDF"}
            onPress={() => exportMutation.mutate(selectedIds)}
            disabled={selectedIds.length === 0 || exportMutation.isPending}
          />
        </View>
      </SectionCard>

      {vouchers.length === 0 ? (
        <EmptyState
          title="Aucun voucher"
          subtitle="Les vouchers générés apparaîtront ici."
        />
      ) : (
        <SectionCard>
          {vouchers.map((voucher) => {
            const selected = selectedIds.includes(voucher.id);
            const statusMeta = STATUS_META[voucher.status] ?? STATUS_META.EXPIRED;
            return (
              <View
                key={voucher.id}
                style={{
                  borderWidth: 1,
                  borderColor: selected ? "#4e79b5" : "#2a3f5e",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  gap: 4,
                  backgroundColor: selected ? "#14243d" : "#111827",
                }}
              >
                <View
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Text style={{ color: "#eef5ff", fontSize: 15, fontWeight: "700" }}>
                    {voucher.code}
                  </Text>
                  <Pressable
                    onPress={() => toggleSelected(voucher.id)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: selected ? "#4e79b5" : "#3b4f6c",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? "#2a4a79" : "#0f1829",
                    }}
                  >
                    <Text style={{ color: selected ? "#e7f1ff" : "#768ba8", fontWeight: "800" }}>
                      {selected ? "✓" : ""}
                    </Text>
                  </Pressable>
                </View>

                <Text style={{ color: "#bed0ec", fontSize: 12 }}>
                  {voucher.planName || "Forfait inconnu"} · {voucher.routerName || "Routeur —"}
                </Text>
                <Text style={{ color: "#93a8ca", fontSize: 12 }}>
                  {voucher.generationType === "MANUAL" ? "Manuel" : "Auto"} · Créé {formatDateTime(voucher.createdAt)}
                </Text>
                <Text style={{ color: "#8ca1c2", fontSize: 12 }}>
                  Expire {formatDateTime(voucher.expiresAt)} · Livré {formatDateTime(voucher.deliveredAt)}
                </Text>

                <View
                  style={{
                    borderWidth: 1,
                    borderColor: statusMeta.borderColor,
                    backgroundColor: statusMeta.backgroundColor,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text style={{ color: statusMeta.textColor, fontSize: 12, fontWeight: "700" }}>
                    {statusMeta.label}
                  </Text>
                </View>

                {voucher.lastDeliveryError ? (
                  <Text style={{ color: "#ffc585", fontSize: 12 }}>
                    Erreur livraison: {voucher.lastDeliveryError}
                  </Text>
                ) : null}

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {canRedeliver(voucher.status) ? (
                    <ActionButton
                      kind="secondary"
                      label="Relivrer"
                      onPress={() => redeliverMutation.mutate(voucher.id)}
                      disabled={redeliverMutation.isPending}
                    />
                  ) : null}
                  {canRevoke(voucher.status) ? (
                    <ActionButton
                      kind="danger"
                      label="Révoquer"
                      onPress={() => revokeMutation.mutate(voucher.id)}
                      disabled={revokeMutation.isPending}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </SectionCard>
      )}

      <SectionCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#d8e7ff", fontSize: 13 }}>
            Page {page} / {totalPages}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ActionButton
              kind="secondary"
              label="Précédent"
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            />
            <ActionButton
              kind="secondary"
              label="Suivant"
              onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            />
          </View>
        </View>
      </SectionCard>
    </Page>
  );
}
