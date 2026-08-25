import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "../constants/Colors";
import * as Haptics from "expo-haptics";
import { menuNavigationState } from "./(tabs)/_layout";

export default function LogExerciseOptions() {
  const router = useRouter();

  const handleSelectOption = (option: "run" | "lifting" | "manual") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    
    // Flag to reopen menu on return
    menuNavigationState.shouldShowMenuOnReturn = true;

    if (option === "run") {
      router.push({
        pathname: "/log-exercise-details",
        params: { type: "cardio", title: "Run / Cardio", description: "Running, walking, cycling, etc." },
      });
    } else if (option === "lifting") {
      router.push({
        pathname: "/log-exercise-details",
        params: { type: "lifting", title: "Weight Lifting", description: "Gym workouts, machines, weight training, etc." },
      });
    } else {
      router.push("/log-exercise-manual");
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.largeTitle}>Log Exercise</Text>
        <Text style={styles.subtitle}>Choose workout entry method</Text>

        {/* 1. Run (Running, Walking, Cycling) */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleSelectOption("run")}
          activeOpacity={0.8}
        >
          <View style={[styles.iconFrame, { backgroundColor: "rgba(59, 130, 246, 0.08)" }]}>
            <Ionicons name="walk-outline" size={24} color="#3B82F6" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.optionTitle}>Run / Cardio</Text>
            <Text style={styles.optionDesc}>Running, walking, cycling, etc.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.2)" />
        </TouchableOpacity>

        {/* 2. Weight Lifting (Gym, Machine) */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleSelectOption("lifting")}
          activeOpacity={0.8}
        >
          <View style={[styles.iconFrame, { backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
            <Ionicons name="barbell-outline" size={24} color="#10B981" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.optionTitle}>Weight Lifting</Text>
            <Text style={styles.optionDesc}>Gym workouts, machines, weight training, etc.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.2)" />
        </TouchableOpacity>

        {/* 3. Manual Entry */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleSelectOption("manual")}
          activeOpacity={0.8}
        >
          <View style={[styles.iconFrame, { backgroundColor: "rgba(167, 139, 250, 0.08)" }]}>
            <Ionicons name="create-outline" size={24} color="#A78BFA" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.optionTitle}>Manual Entry</Text>
            <Text style={styles.optionDesc}>Enter exercise name and calories burned manually.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.2)" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  largeTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginBottom: 24,
    fontWeight: "500",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 16,
    marginBottom: 16,
  },
  iconFrame: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  optionDesc: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
