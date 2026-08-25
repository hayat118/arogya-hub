import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "../constants/Colors";
import { db } from "../services/firebase";
import { menuNavigationState } from "./(tabs)/_layout";

export default function LogExerciseManual() {
  const router = useRouter();
  const { user } = useUser();

  // Form states
  const [title, setTitle] = useState("");
  const [calories, setCalories] = useState("");
  const [duration, setDuration] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Active Date state
  const [activeDate, setActiveDate] = useState("");

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
    setErrorMsg("");

    // Validations
    if (!title.trim()) {
      setErrorMsg("Please enter a workout name.");
      return;
    }
    if (!calories || isNaN(Number(calories)) || Number(calories) <= 0) {
      setErrorMsg("Please enter a valid calorie count.");
      return;
    }

    setIsSaving(true);
    try {
      // Add log entry to Firestore: users/{userId}/logs
      const userLogsCollection = collection(db, "users", user.id, "logs");
      await addDoc(userLogsCollection, {
        title: title.trim(),
        type: "workout",
        workoutType: "manual",
        intensity: "medium",
        calories: Math.round(Number(calories)),
        duration: duration ? Math.round(Number(duration)) : 0,
        date: activeDate,
        createdAt: serverTimestamp(),
      });

      // Haptics & close menu
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });

      // Navigate back to tabs and ensure the log menu modal is closed
      menuNavigationState.shouldShowMenuOnReturn = false;
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Failed to write log entry to Firestore:", err);
      setErrorMsg("Failed to save entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
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
          {/* Header Title block */}
          <Text style={styles.largeTitle}>Manual Entry</Text>
          <Text style={styles.subtitle}>
            Enter your workout details and estimated calories manually.
          </Text>

          {errorMsg !== "" && <Text style={styles.errorText}>{errorMsg}</Text>}

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Input 1: Workout Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Workout Name</Text>
              <View style={styles.inputFrame}>
                <Ionicons
                  name="fitness-outline"
                  size={20}
                  color={Colors.dark.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Swimming, Boxing, Yoga"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Input 2: Calories Burned */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Calories Burned</Text>
              <View style={styles.inputFrame}>
                <Ionicons
                  name="flame"
                  size={20}
                  color="#EF4444" // Fire Red for calories
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 350"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                />
                <Text style={styles.unitText}>cal</Text>
              </View>
            </View>

            {/* Input 3: Duration */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Duration (Optional)</Text>
              <View style={styles.inputFrame}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color="#3B82F6" // Cool Blue for time
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 45"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  keyboardType="numeric"
                  value={duration}
                  onChangeText={setDuration}
                />
                <Text style={styles.unitText}>mins</Text>
              </View>
            </View>
          </View>
        </ScrollView>

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
                <Text style={styles.logButtonText}>Log Calories</Text>
                <Ionicons name="checkmark-sharp" size={18} color={Colors.dark.white} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 28,
    fontWeight: "500",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  formCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputFrame: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600",
  },
  unitText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
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
