import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page not found</Text>
      <Link href="/" style={styles.link}>
        Return to home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#0a0a0f",
  },
  title: {
    color: "#f4f5ff",
    fontSize: 20,
    fontWeight: "700",
  },
  link: {
    color: "#8cc8ff",
    fontSize: 16,
  },
});
