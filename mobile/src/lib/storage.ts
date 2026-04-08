import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const localStorageRef = (globalThis as { localStorage?: WebStorage }).localStorage;

export async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorageRef?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorageRef?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorageRef?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

