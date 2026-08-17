import { useUser, useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Colors from "../../constants/Colors";
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
          backgroundColor: Colors.dark.surface,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.05)",
          height: 90,
        },
        headerTitleStyle: {
          color: Colors.dark.text,
          fontSize: 18,
          fontWeight: "bold",
        },
        tabBarStyle: {
          position: "absolute",
          bottom: 24,
          left: 16,
          right: 16,
          borderRadius: 24,
          backgroundColor: Colors.dark.surface,
          borderTopWidth: 0,
          height: 72,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 10,
        },
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginBottom: 10,
        },
        tabBarIconStyle: {
          marginTop: 6,
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => signOut()}
            style={styles.logoutButton}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color={Colors.dark.error} />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarLabel: "Analytics",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          title: "Log",
          tabBarLabel: () => null,
          tabBarButton: () => (
            <TouchableOpacity
              onPress={() => {
                alert("Log Food & Activity coming soon!");
              }}
              style={styles.plusButtonContainer}
              activeOpacity={0.85}
            >
              <View style={styles.plusButton}>
                <Ionicons name="add" size={26} color={Colors.dark.white} />
              </View>
            </TouchableOpacity>
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
  plusButtonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: 72,
  },
  plusButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
