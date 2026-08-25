import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import Colors from "../../constants/Colors";
import * as Haptics from "expo-haptics";
import { menuNavigationState } from "./_layout";

export default function PlusScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { type, title: paramTitle, calories: paramCalories } = useLocalSearchParams<{
    type?: "meal" | "workout" | "water";
    title?: string;
    calories?: string;
  }>();

  // Selected date cache (YYYY-MM-DD)
  const [activeDate, setActiveDate] = useState("");

  // Form states
  const [logType, setLogType] = useState<"meal" | "workout" | "water">("meal");

  useEffect(() => {
    if (type && ["meal", "workout", "water"].includes(type)) {
      setLogType(type as "meal" | "workout" | "water");
    }
  }, [type]);

  const [title, setTitle] = useState("");
  const [calories, setCalories] = useState("");

  useEffect(() => {
    if (paramTitle) {
      setTitle(paramTitle);
    }
    if (paramCalories) {
      setCalories(paramCalories);
    }
  }, [paramTitle, paramCalories]);
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [waterAmount, setWaterAmount] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Resolve current active calendar date on mount
  useEffect(() => {
    async function getActiveDate() {
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
        console.error("Failed to load active date:", err);
      }
    }
    getActiveDate();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setErrorMsg("");

    // Validation
    if (logType !== "water") {
      if (!title.trim()) {
        setErrorMsg("Please enter a name/title.");
        return;
      }
      if (!calories || isNaN(Number(calories)) || Number(calories) <= 0) {
        setErrorMsg("Please enter a valid calorie count.");
        return;
      }
    } else {
      if (!waterAmount || isNaN(Number(waterAmount)) || Number(waterAmount) <= 0) {
        setErrorMsg("Please enter a valid water quantity in Liters.");
        return;
      }
    }

    setIsSaving(true);
    try {
      // Add to Firestore: users/{userId}/logs
      const userLogsCollection = collection(db, "users", user.id, "logs");
      if (logType === "water") {
        await addDoc(userLogsCollection, {
          title: "Water Intake",
          type: "water",
          amount: Number(waterAmount),
          date: activeDate,
          createdAt: serverTimestamp(),
        });
      } else {
        await addDoc(userLogsCollection, {
          title: title.trim(),
          type: logType,
          calories: Math.round(Number(calories)),
          protein: logType === "meal" ? Math.round(Number(protein || 0)) : 0,
          carbs: logType === "meal" ? Math.round(Number(carbs || 0)) : 0,
          fats: logType === "meal" ? Math.round(Number(fats || 0)) : 0,
          workoutType: logType === "workout" ? "manual" : undefined,
          intensity: logType === "workout" ? "medium" : undefined,
          date: activeDate,
          createdAt: serverTimestamp(),
        });
      }

      // Haptic feedback & navigate back
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      menuNavigationState.shouldShowMenuOnReturn = false;
      router.back();
    } catch (err) {
      console.error("Firestore log write error:", err);
      setErrorMsg("Failed to save entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDisplayDate = () => {
    if (!activeDate) return "";
    try {
      const [y, m, d] = activeDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return activeDate;
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Log</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Active Date Label Card */}
          <View style={styles.dateCard}>
            <Ionicons name="calendar-outline" size={16} color={Colors.dark.primary} />
            <Text style={styles.dateLabel}>Logging for: {formattedDisplayDate()}</Text>
          </View>

          {/* Toggle Type Segments */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, logType === "meal" && styles.segmentBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setLogType("meal");
                setErrorMsg("");
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="fast-food"
                size={16}
                color={logType === "meal" ? Colors.dark.white : Colors.dark.textMuted}
              />
              <Text
                style={[styles.segmentText, logType === "meal" && styles.segmentTextActive]}
              >
                Food
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, logType === "workout" && styles.segmentBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setLogType("workout");
                setErrorMsg("");
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="barbell"
                size={16}
                color={logType === "workout" ? Colors.dark.white : Colors.dark.textMuted}
              />
              <Text
                style={[styles.segmentText, logType === "workout" && styles.segmentTextActive]}
              >
                Workout
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, logType === "water" && styles.segmentBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setLogType("water");
                setErrorMsg("");
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="water"
                size={16}
                color={logType === "water" ? Colors.dark.white : Colors.dark.textMuted}
              />
              <Text
                style={[styles.segmentText, logType === "water" && styles.segmentTextActive]}
              >
                Water
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <View style={styles.formContainer}>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {logType === "water" ? (
              <View style={{ gap: 16 }}>
                <Text style={styles.inputLabel}>Water Amount (Liters)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. 0.25 (1 glass) or 0.5 (1 bottle)"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={waterAmount}
                  onChangeText={setWaterAmount}
                  keyboardType="numeric"
                />

                <Text style={styles.sectionDividerText}>Quick presets</Text>
                <View style={styles.macroFormRow}>
                  <TouchableOpacity
                    style={styles.quickAddWaterPreset}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setWaterAmount("0.25");
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="water-outline" size={16} color={Colors.dark.primary} />
                    <Text style={styles.presetText}>1 Glass (0.25L)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickAddWaterPreset}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setWaterAmount("0.5");
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="water" size={16} color={Colors.dark.primary} />
                    <Text style={styles.presetText}>Bottle (0.5L)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Title / Name */}
                <Text style={styles.inputLabel}>
                  {logType === "meal" ? "Food or Meal Name" : "Workout Activity Name"}
                </Text>
                <TextInput
                  style={styles.inputField}
                  placeholder={logType === "meal" ? "e.g. Oatmeal with Bananas" : "e.g. Morning Jog"}
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={60}
                />

                {/* Calories */}
                <Text style={styles.inputLabel}>
                  {logType === "meal" ? "Calories (kcal)" : "Calories Burned (kcal)"}
                </Text>
                <TextInput
                  style={styles.inputField}
                  placeholder={logType === "meal" ? "e.g. 350" : "e.g. 240"}
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                />

                {/* Macronutrients (Only for Food Type) */}
                {logType === "meal" ? (
                  <View style={styles.macrosFormSection}>
                    <Text style={styles.sectionDividerText}>Macronutrients (Optional)</Text>

                    <View style={styles.macroFormRow}>
                      {/* Protein */}
                      <View style={styles.macroFormCol}>
                        <Text style={[styles.inputLabel, { color: "#A78BFA" }]}>Protein (g)</Text>
                        <TextInput
                          style={[styles.inputField, styles.macroInputField]}
                          placeholder="0"
                          placeholderTextColor="rgba(255, 255, 255, 0.25)"
                          value={protein}
                          onChangeText={setProtein}
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Carbs */}
                      <View style={styles.macroFormCol}>
                        <Text style={[styles.inputLabel, { color: "#60A5FA" }]}>Carbs (g)</Text>
                        <TextInput
                          style={[styles.inputField, styles.macroInputField]}
                          placeholder="0"
                          placeholderTextColor="rgba(255, 255, 255, 0.25)"
                          value={carbs}
                          onChangeText={setCarbs}
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Fats */}
                      <View style={styles.macroFormCol}>
                        <Text style={[styles.inputLabel, { color: "#F87171" }]}>Fats (g)</Text>
                        <TextInput
                          style={[styles.inputField, styles.macroInputField]}
                          placeholder="0"
                          placeholderTextColor="rgba(255, 255, 255, 0.25)"
                          value={fats}
                          onChangeText={setFats}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.dark.white} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Log Entry</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 40,
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
  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(41, 143, 80, 0.04)",
    borderColor: "rgba(41, 143, 80, 0.12)",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  dateLabel: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: Colors.dark.primary,
  },
  segmentText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: Colors.dark.white,
  },
  formContainer: {
    gap: 16,
    marginBottom: 28,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlign: "center",
  },
  inputLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: -6,
  },
  inputField: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: Colors.dark.text,
    fontSize: 15,
  },
  sectionDividerText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  macrosFormSection: {
    gap: 16,
  },
  macroFormRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  macroFormCol: {
    flex: 1,
    gap: 14,
  },
  macroInputField: {
    textAlign: "center",
    paddingHorizontal: 4,
  },
  saveBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  quickAddWaterPreset: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    borderColor: "rgba(41, 143, 80, 0.15)",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  presetText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: "600",
  },
});
