import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { api, type TransactionStatus } from "@/src/lib/api";
import { formatDateTime, formatXof } from "@/src/lib/format";
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
  TransactionStatus,
  { label: string; textColor: string; borderColor: string; backgroundColor: string }
> = {
  PENDING: {
    label: "En attente",
    textColor: "#ffd995",
    borderColor: "#845a24",
    backgroundColor: "#3f2d14",
  },
  PROCESSING: {
    label: "En traitement",
    textColor: "#a0c9ff",
    borderColor: "#355f8e",
    backgroundColor: "#1a2f46",
  },
  COMPLETED: {
    label: "Complété",
    textColor: "#8cf2bc",
    borderColor: "#2f704d",
    backgroundColor: "#153624",
  },
  FAILED: {
    label: "Échoué",
    textColor: "#ffb5c1",
    borderColor: "#8c3a4b",
    backgroundColor: "#3f1d26",
  },
  REFUNDED: {
    label: "Remboursé",
    textColor: "#b8c7ff",
    borderColor: "#3c4f86",
    backgroundColor: "#1f2947",
  },
};

export default function TransactionsScreen() {
  const guard = useAuthGuard();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["transactions", page],
    queryFn: () => api.transactions.list(page, PAGE_SIZE),
  });

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des transactions..." />
      </Page>
    );
  }

  if (query.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des transactions..." />
      </Page>
    );
  }

  if (query.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les transactions." />
      </Page>
    );
  }

  const result = query.data;
  const transactions = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Page>
      <SectionTitle
        title="Transactions"
        subtitle={`${total} transaction(s) au total`}
      />

      {transactions.length === 0 ? (
        <EmptyState
          title="Aucune transaction"
          subtitle="Les paiements Wave apparaîtront ici."
        />
      ) : (
        <SectionCard>
          {transactions.map((transaction) => {
            const statusMeta = STATUS_META[transaction.status] ?? STATUS_META.PENDING;
            return (
              <View
                key={transaction.id}
                style={{
                  borderWidth: 1,
                  borderColor: "#2a3f5e",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  gap: 4,
                }}
              >
                <Text style={{ color: "#edf5ff", fontWeight: "700", fontSize: 14 }}>
                  {transaction.reference}
                </Text>
                <Text style={{ color: "#c7d9f6", fontSize: 12 }}>
                  {transaction.customerPhone || "Client inconnu"} {transaction.customerName ? `· ${transaction.customerName}` : ""}
                </Text>
                <Text style={{ color: "#9eb4d7", fontSize: 12 }}>
                  {transaction.plan?.name || "Forfait inconnu"} · {formatDateTime(transaction.createdAt)}
                </Text>
                <Text style={{ color: "#f1f7ff", fontSize: 14, fontWeight: "700" }}>
                  {formatXof(transaction.amountXof)}
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: statusMeta.borderColor,
                      backgroundColor: statusMeta.backgroundColor,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: statusMeta.textColor, fontSize: 12, fontWeight: "700" }}>
                      {statusMeta.label}
                    </Text>
                  </View>
                  {transaction.externalReference ? (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: "#30496d",
                        backgroundColor: "#12203a",
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ color: "#afc4e8", fontSize: 12, fontWeight: "600" }}>
                        Ref externe {transaction.externalReference.slice(0, 16)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </SectionCard>
      )}

      <SectionCard>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
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
