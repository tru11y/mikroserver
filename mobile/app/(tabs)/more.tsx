import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ActionButton, Card, Divider, LoadingView, Page } from "@/src/components/ui";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import { useAuth } from "@/src/providers/auth-provider";

type MenuItem = {
  label:    string;
  subtitle: string;
  route:    string;
  icon:     React.ComponentProps<typeof Ionicons>["name"];
};

const MENU: MenuItem[] = [
  { label: "Analytique",        subtitle: "Courbes revenus et volume",          route: "/analytics",        icon: "bar-chart-outline" },
  { label: "Sessions actives",  subtitle: "Clients connectés, coupure de session", route: "/sessions",      icon: "people-outline" },
  { label: "Générer tickets",   subtitle: "Génération manuelle + PDF",           route: "/vouchers-generate", icon: "add-circle-outline" },
  { label: "Forfaits",          subtitle: "Créer, modifier, archiver",           route: "/plans",            icon: "pricetags-outline" },
  { label: "Revendeurs",        subtitle: "Gestion des comptes revendeurs",      route: "/resellers",        icon: "storefront-outline" },
  { label: "Paramètres",        subtitle: "Profil, API Wave, configuration",     route: "/settings",         icon: "settings-outline" },
];

export default function MoreScreen() {
  const router = useRouter();
  const auth   = useAuth();
  const guard  = useAuthGuard();

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView /></Page>;
  }

  return (
    <Page>
      {/* User card */}
      <Card>
        <View style={S.userRow}>
          <View style={S.avatar}>
            <Text style={S.avatarText}>
              {auth.user?.firstName?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.userName}>
              {auth.user?.firstName} {auth.user?.lastName}
            </Text>
            <Text style={S.userEmail}>{auth.user?.email}</Text>
            <Text style={S.userRole}>{auth.user?.role}</Text>
          </View>
        </View>
        <Divider />
        <ActionButton
          kind="danger"
          label={auth.isBusy ? "Déconnexion..." : "Se déconnecter"}
          onPress={() => void auth.logout()}
          disabled={auth.isBusy}
          loading={auth.isBusy}
        />
      </Card>

      {/* Navigation menu */}
      {MENU.map((item) => (
        <Pressable
          key={item.route}
          onPress={() => router.push(item.route as never)}
          style={({ pressed }) => [S.menuItem, pressed && S.menuItemPressed]}
        >
          <View style={S.menuIcon}>
            <Ionicons name={item.icon} size={20} color="#6366f1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.menuLabel}>{item.label}</Text>
            <Text style={S.menuSub}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#3d5070" />
        </Pressable>
      ))}
    </Page>
  );
}

const S = StyleSheet.create({
  userRow:        { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar:         {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: "#1a2547",
    borderWidth: 1, borderColor: "#2e3f6e",
    alignItems: "center", justifyContent: "center",
  },
  avatarText:     { color: "#a5b4fc", fontSize: 18, fontWeight: "700" },
  userName:       { color: "#f0f5ff", fontSize: 15, fontWeight: "700" },
  userEmail:      { color: "#6b849f", fontSize: 12 },
  userRole:       { color: "#4a617e", fontSize: 11, marginTop: 1 },
  menuItem:       {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0d1829",
    borderWidth: 1, borderColor: "#1e2f4a",
    borderRadius: 14,
    padding: 14,
  },
  menuItemPressed:{ opacity: 0.7 },
  menuIcon:       {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: "#0f1c38",
    borderWidth: 1, borderColor: "#1e2f4a",
    alignItems: "center", justifyContent: "center",
  },
  menuLabel:      { color: "#f0f5ff", fontSize: 14, fontWeight: "600" },
  menuSub:        { color: "#6b849f", fontSize: 12, marginTop: 1 },
});
