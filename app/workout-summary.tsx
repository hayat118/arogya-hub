import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import Colors from "../constants/Colors";
import * as Haptics from "expo-haptics";
import { menuNavigationState } from "./(tabs)/_layout";

export default function WorkoutSummary() {
  const { user } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Search parameters passed from details screen
  const type = (params.type as string) || "cardio";
  const title = (params.title as string) || "Workout";
  const calories = parseInt(params.calories as string, 10) || 0;
  const duration = parseInt(params.duration as string, 10) || 0;
  const intensity = (params.intensity as string) || "medium";

  // Active date for database logging
  const [activeDate, setActiveDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadActiveDate() {
      try {
        const storedDate = await AsyncStorage.getItem("active_calendar_date");
        if (storedDate) {
          setActiveDate(storedDate);
        } else {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
            today.getDate()
          ).padStart(2, "0")}`;
          setActiveDate(todayStr);
        }
      } catch (err) {
        console.error("Failed to load active calendar date:", err);
      }
    }
    loadActiveDate();
  }, []);

  const handleLogWorkout = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Add log entry to Firestore: users/{userId}/logs
      const userLogsCollection = collection(db, "users", user.id, "logs");
      await addDoc(userLogsCollection, {
        title: title.trim(),
        type: "workout",
        workoutType: type, // "cardio" or "lifting"
        intensity: intensity, // "low", "medium", "high"
        calories: calories,
        duration: duration,
        date: activeDate,
        createdAt: serverTimestamp(),
      });

      // Trigger success haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Reset menu state and redirect home
      menuNavigationState.shouldShowMenuOnReturn = false;
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Failed to log workout to database:", err);
      alert("Failed to save your workout. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.contentContainer}>
        {/* Glowing Fire Icon Container */}
        <View style={styles.pulseOuter}>
          <View style={styles.pulseMiddle}>
            <View style={styles.pulseInner}>
              <Ionicons name="flame" size={60} color="#EF4444" />
            </View>
          </View>
        </View>

        {/* Burn Labels & Count */}
        <Text style={styles.summaryLabel}>Your Workout Burned</Text>
        <Text style={styles.calorieText}>
          {calories} <Text style={styles.unitText}>Cals</Text>
        </Text>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.statLabelCol}>
              <Ionicons name="fitness-outline" size={20} color={Colors.dark.primary} />
              <Text style={styles.statTitle}>Activity</Text>
            </View>
            <Text style={styles.statValue}>{title}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statRow}>
            <View style={styles.statLabelCol}>
              <Ionicons name="time-outline" size={20} color="#3B82F6" />
              <Text style={styles.statTitle}>Duration</Text>
            </View>
            <Text style={styles.statValue}>{duration} mins</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statRow}>
            <View style={styles.statLabelCol}>
              <Ionicons name="speedometer-outline" size={20} color="#F59E0B" />
              <Text style={styles.statTitle}>Intensity</Text>
            </View>
            <Text style={[styles.statValue, { textTransform: "capitalize" }]}>
              {intensity}
            </Text>
          </View>
        </View>

        {/* Calculation Info Banner */}
        <Text style={styles.infoText}>
          Calculated using standard metabolic equivalents (METs) adjusted for your gender, age, height, and weight profile.
        </Text>
      </View>

      {/* Log Action Button */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.logButton}
          onPress={handleLogWorkout}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.dark.white} />
          ) : (
            <>
              <Text style={styles.logButtonText}>Log Workout</Text>
              <Ionicons name="checkmark-sharp" size={18} color={Colors.dark.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700",
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  pulseOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(239, 68, 68, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  pulseMiddle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  pulseInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  summaryLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  calorieText: {
    color: Colors.dark.text,
    fontSize: 64,
    fontWeight: "900",
    marginBottom: 36,
  },
  unitText: {
    color: "#EF4444",
    fontSize: 24,
    fontWeight: "700",
  },
  statsCard: {
    width: "100%",
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 20,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  statLabelCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  infoText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
    backgroundColor: Colors.dark.background,
  },
  logButton: {
    flexDirection: "row",
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
