import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(focused: boolean, name: IoniconsName, nameFocused: IoniconsName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={focused ? nameFocused : name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle:       { backgroundColor: "#0a1020" },
        headerTintColor:   "#f0f5ff",
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: "#0a1020",
          borderTopColor:  "#1e2f4a",
          borderTopWidth:  1,
          height:          60,
          paddingBottom:   8,
          paddingTop:      4,
        },
        tabBarActiveTintColor:   "#a5b4fc",
        tabBarInactiveTintColor: "#3d5070",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "home-outline", "home")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="routers"
        options={{
          title: "Routeurs",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "wifi-outline", "wifi")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="vouchers"
        options={{
          title: "Tickets",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "pricetag-outline", "pricetag")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "card-outline", "card")({ color, size }),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Plus",
          tabBarIcon: ({ focused, color, size }) =>
            tabIcon(focused, "menu-outline", "menu")({ color, size }),
        }}
      />
    </Tabs>
  );
}
