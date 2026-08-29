import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import Colors from "../constants/Colors";
import { OnboardingProvider, useOnboarding } from "../context/OnboardingContext";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env");
}

// Custom token cache using expo-secure-store to store JWT tokens securely
const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      console.error("SecureStore get item error: ", error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error("SecureStore save item error: ", err);
    }
  },
};

function InitialLayout() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { hasCompletedOnboarding, isLoadingOnboarding } = useOnboarding();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    // Wait for both Clerk auth and Onboarding status to load
    if (!isAuthLoaded || (isSignedIn && isLoadingOnboarding)) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const inAuthGroup = segments[0] === "signin" || segments[0] === "signup";
    const inOnboarding = segments[0] === "onboarding";
    const inGenerating = segments[0] === "generating-plan";
    const isAllowedOutsideTabs =
      segments[0] === "log-exercise-options" ||
      segments[0] === "log-exercise-details" ||
      segments[0] === "log-exercise-manual" ||
      segments[0] === "workout-summary" ||
      segments[0] === "log-water" ||
      segments[0] === "food-search" ||
      segments[0] === "log-food-details";

    if (isSignedIn) {
      if (hasCompletedOnboarding) {
        // If onboarded and not in tabs or allowed screens, redirect to tabs
        if (!inTabsGroup && !isAllowedOutsideTabs) {
          router.replace("/(tabs)");
        }
      } else {
        // If authenticated but not onboarded, redirect to onboarding (unless already in generating page)
        if (!inOnboarding && !inGenerating) {
          router.replace("/onboarding" as any);
        }
      }
    } else if (!inAuthGroup) {
      // Redirect unauthenticated users to sign-in screen
      router.replace("/signin");
    }
  }, [isSignedIn, isAuthLoaded, hasCompletedOnboarding, isLoadingOnboarding, segments, router]);

  const showLoading = !isAuthLoaded || (isSignedIn && (isLoadingOnboarding || hasCompletedOnboarding === null));

  if (showLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.dark.background }}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="generating-plan" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="log-exercise-options" />
      <Stack.Screen name="log-exercise-details" />
      <Stack.Screen name="log-exercise-manual" />
      <Stack.Screen name="workout-summary" />
      <Stack.Screen name="log-water" />
      <Stack.Screen name="food-search" />
      <Stack.Screen name="log-food-details" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <OnboardingProvider>
          <InitialLayout />
        </OnboardingProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
