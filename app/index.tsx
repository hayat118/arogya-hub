import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const [localSessionChecked, setLocalSessionChecked] = useState(false);
  const [hasLocalSession, setHasLocalSession] = useState(false);
  const router = useRouter();

  // 1. Immediately check local storage on app start
  useEffect(() => {
    async function checkLocalSession() {
      try {
        const session = await AsyncStorage.getItem("user_session");
        if (session) {
          const parsed = JSON.parse(session);
          if (parsed && parsed.isAuthenticated) {
            setHasLocalSession(true);
          }
        }
      } catch (error) {
        console.error("Failed to load local session:", error);
      } finally {
        setLocalSessionChecked(true);
      }
    }
    checkLocalSession();
  }, []);

  // 2. Instant redirect if a local session is found (bypasses loading screen)
  useEffect(() => {
    if (localSessionChecked && hasLocalSession) {
      router.replace("/(tabs)");
    }
  }, [localSessionChecked, hasLocalSession, router]);

  // 3. Fallback/Verification redirect using Clerk's auth state once loaded
  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        router.replace("/(tabs)");
      } else if (localSessionChecked && !hasLocalSession) {
        router.replace("/signin");
      }
    }
  }, [isLoaded, isSignedIn, localSessionChecked, hasLocalSession, router]);

  // Show loading indicator only while checking both storage mechanisms
  if (!isLoaded && (!localSessionChecked || !hasLocalSession)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A0B0F" }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return null;
}
