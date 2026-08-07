import { useUser, useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { saveUserProfile } from "../../services/firebase";

export default function TabsLayout() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();

  // Sync profile to Firebase Firestore & local storage cache
  useEffect(() => {
    if (isLoaded) {
      if (user) {
        const email = user.primaryEmailAddress?.emailAddress || "";
        const name = user.fullName || "";
        const photoURL = user.imageUrl || "";

        // 1. Cache the session details locally in AsyncStorage
        AsyncStorage.setItem(
          "user_session",
          JSON.stringify({
            uid: user.id,
            email,
            displayName: name,
            photoURL,
            isAuthenticated: true,
          })
        ).catch((err) => console.error("AsyncStorage write error:", err));

        // 2. Sync to Firebase Firestore database
        saveUserProfile(user.id, email, name, photoURL)
          .then(() => {
            console.log("Firebase sync completed successfully");
          })
          .catch((err) => {
            console.error("Firebase sync error on tab layout: ", err);
          });
      } else {
        // 3. Clear local storage session on log-out
        AsyncStorage.removeItem("user_session").catch((err) =>
          console.error("AsyncStorage clear error:", err)
        );
      }
    }
  }, [user, isLoaded]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#161821",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.05)",
          height: 90,
        },
        headerTitleStyle: {
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: "bold",
        },
        tabBarStyle: {
          backgroundColor: "#161821",
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.05)",
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#6366F1",
        tabBarInactiveTintColor: "#6B7280",
        headerRight: () => (
          <TouchableOpacity
            onPress={() => signOut()}
            style={styles.logoutButton}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarLabel: "History",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-coach"
        options={{
          title: "AI Coach",
          tabBarLabel: "Coach",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.12)",
  },
});
