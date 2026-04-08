import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ActionButton, LoadingView, Page, SectionCard, SectionTitle } from "@/src/components/ui";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import { useAuth } from "@/src/providers/auth-provider";

const MODULES = [
  { label: "Dashboard", route: "/dashboard", subtitle: "KPIs et vue globale" },
  { label: "Analytique", route: "/analytics", subtitle: "Courbes revenus et volume" },
  { label: "Forfaits", route: "/plans", subtitle: "Créer / modifier / archiver" },
  { label: "Revendeurs", route: "/resellers", subtitle: "Gestion des comptes revendeurs" },
  { label: "Routeurs", route: "/routers", subtitle: "MikroTik + health checks" },
  { label: "Sessions", route: "/sessions", subtitle: "Sessions actives et coupure" },
  { label: "Transactions", route: "/transactions", subtitle: "Historique paiements Wave" },
  { label: "Vouchers", route: "/vouchers", subtitle: "Suivi, redelivery, révocation" },
  { label: "Générer tickets", route: "/vouchers-generate", subtitle: "Génération manuelle + PDF" },
  { label: "Paramètres", route: "/settings", subtitle: "Profil, config business et Wave" },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const guard = useAuthGuard();

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement du compte..." />
      </Page>
    );
  }

  return (
    <Page>
      <SectionTitle
        title="Console Native"
        subtitle="Toutes les fonctionnalités web sont disponibles en écrans natifs."
      />

      <SectionCard>
        <Text style={styles.userName}>
          {auth.user?.firstName} {auth.user?.lastName}
        </Text>
        <Text style={styles.userMeta}>{auth.user?.email}</Text>
        <Text style={styles.userRole}>Rôle: {auth.user?.role}</Text>
        <ActionButton
          kind="secondary"
          label={auth.isBusy ? "Déconnexion..." : "Se déconnecter"}
          onPress={() => void auth.logout()}
          disabled={auth.isBusy}
        />
      </SectionCard>

      <SectionCard>
        <View style={styles.modulesGrid}>
          {MODULES.map((module) => (
            <Pressable
              key={module.route}
              onPress={() => router.push(module.route)}
              style={styles.moduleCard}
            >
              <Text style={styles.moduleTitle}>{module.label}</Text>
              <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>
    </Page>
  );
}

const styles = StyleSheet.create({
  userName: {
    color: "#edf4ff",
    fontWeight: "700",
    fontSize: 17,
  },
  userMeta: {
    color: "#a9bad8",
    fontSize: 13,
  },
  userRole: {
    color: "#c7d6ee",
    fontSize: 12,
    marginBottom: 8,
  },
  modulesGrid: {
    gap: 10,
  },
  moduleCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#30496d",
    backgroundColor: "#0c1728",
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 3,
  },
  moduleTitle: {
    color: "#ecf4ff",
    fontSize: 14,
    fontWeight: "700",
  },
  moduleSubtitle: {
    color: "#9cb0d0",
    fontSize: 12,
  },
});

