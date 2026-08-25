import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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
import { menuNavigationState } from "./(tabs)/_layout";
import { useUser } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserProfile } from "../services/firebase";

type Intensity = "low" | "medium" | "high";

export default function LogExerciseDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = (params.type as string) || "cardio";
  const title = (params.title as string) || "Workout";
  const description = (params.description as string) || "";
  const { user } = useUser();
  const [profile, setProfile] = useState<any>(null);

  // Fetch profile on mount
  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const stored = await AsyncStorage.getItem(`onboarding_data_${user.id}`);
        if (stored) {
          setProfile(JSON.parse(stored));
        } else {
          const p = await getUserProfile(user.id);
          if (p) {
            setProfile(p);
          }
        }
      } catch (e) {
        console.error("Error loading user profile for calorie calculation:", e);
      }
    }
    loadProfile();
  }, [user]);

  // Intensity state (Cardio only)
  const [intensity, setIntensity] = useState<Intensity>("medium");

  // Duration states
  const [durationPreset, setDurationPreset] = useState<number | null>(30);
  const [manualDuration, setManualDuration] = useState<string>("");
  const [duration, setDuration] = useState<number>(30);

  // Sync duration with presets/manual input
  useEffect(() => {
    if (manualDuration !== "") {
      const num = parseInt(manualDuration, 10);
      if (!isNaN(num) && num > 0) {
        setDuration(num);
      }
    } else if (durationPreset !== null) {
      setDuration(durationPreset);
    }
  }, [manualDuration, durationPreset]);

  const handleSelectIntensity = (val: Intensity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setIntensity(val);
  };

  const handleSelectPreset = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setDurationPreset(val);
    setManualDuration("");
  };

  const handleManualDurationChange = (val: string) => {
    // Only numeric input
    const cleanVal = val.replace(/[^0-9]/g, "");
    setManualDuration(cleanVal);
    if (cleanVal !== "") {
      setDurationPreset(null);
    } else {
      setDurationPreset(30); // Default back to 30 if manually erased
    }
  };

  // Parsing functions for calorie calculation
  const parseHeightToCm = (heightStr: string): number => {
    if (!heightStr) return 175;
    try {
      const cmMatch = heightStr.match(/(\d+)\s*cm/i);
      if (cmMatch) return parseInt(cmMatch[1], 10);
      
      if (/^\d+$/.test(heightStr.trim())) {
        const val = parseInt(heightStr, 10);
        if (val > 100) return val;
      }

      const ftMatch = heightStr.match(/(\d+)\s*ft/i);
      const inMatch = heightStr.match(/(\d+)\s*in/i);
      const feet = ftMatch ? parseInt(ftMatch[1], 10) : 5;
      const inches = inMatch ? parseInt(inMatch[1], 10) : 9;
      return (feet * 12 + inches) * 2.54;
    } catch {
      return 175;
    }
  };

  const parseWeightToKg = (weightStr: string): number => {
    if (!weightStr) return 70;
    try {
      const lbsMatch = weightStr.match(/(\d+(\.\d+)?)\s*lbs/i);
      if (lbsMatch) {
        return parseFloat(lbsMatch[1]) * 0.45359237;
      }
      const match = weightStr.match(/(\d+(\.\d+)?)/);
      return match ? parseFloat(match[1]) : 70;
    } catch {
      return 70;
    }
  };

  const calculateAge = (birthDate: any): number => {
    const currentYear = new Date().getFullYear();
    if (typeof birthDate === "object" && birthDate?.year) {
      return currentYear - parseInt(birthDate.year, 10);
    }
    if (typeof birthDate === "string") {
      const yearMatch = birthDate.match(/^(\d{4})/);
      if (yearMatch) {
        return currentYear - parseInt(yearMatch[1], 10);
      }
    }
    return 25;
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    // Validate duration
    if (duration <= 0) {
      alert("Please enter a valid workout duration.");
      return;
    }

    // 1. Extract and parse user data
    const weight = parseWeightToKg(profile?.weight);
    const height = parseHeightToCm(profile?.height);
    const age = calculateAge(profile?.birthDate);
    const gender = profile?.gender || "Male";

    // 2. Mifflin-St Jeor BMR calculation
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (gender.toLowerCase() === "male") {
      bmr += 5;
    } else if (gender.toLowerCase() === "female") {
      bmr -= 161;
    } else {
      bmr -= 78; // General default offset
    }

    // 3. Determine MET value based on activity type and intensity
    let met = 5.0;
    if (type === "cardio") {
      if (intensity === "low") met = 4.5;
      else if (intensity === "medium") met = 7.5;
      else if (intensity === "high") met = 10.0;
    } else {
      // weight lifting / strength training
      if (intensity === "low") met = 3.5;
      else if (intensity === "medium") met = 5.0;
      else if (intensity === "high") met = 6.5;
    }

    // 4. Corrected MET calorie formula
    // Calories Burned = MET * (BMR / 1440) * duration
    const calculatedCalories = Math.round(met * (bmr / 1440) * duration);

    // Disable reopening menu on tab load since we are redirecting to tabs home
    menuNavigationState.shouldShowMenuOnReturn = false;

    // Navigate to new workout summary screen
    router.push({
      pathname: "/workout-summary",
      params: {
        type: type,
        title: title,
        calories: calculatedCalories.toString(),
        duration: duration.toString(),
        intensity: intensity,
      },
    });
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
          {/* Header Title Block */}
          <Text style={styles.largeTitle}>{title}</Text>
          <Text style={styles.subtitle}>{description}</Text>

          {/* Intensity Selector Card */}
          {(type === "cardio" || type === "lifting") && (
            <View style={styles.detailsCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="speedometer-outline" size={20} color={Colors.dark.primary} style={styles.headerIcon} />
                <Text style={styles.cardHeaderTitle}>Workout Intensity</Text>
              </View>
              <Text style={styles.cardHeaderDesc}>
                Select the intensity.
              </Text>

              {/* Intensity Box Chips */}
              <View style={styles.chipsRow}>
                {(["low", "medium", "high"] as Intensity[]).map((val) => {
                  const isSelected = intensity === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                      onPress={() => handleSelectIntensity(val)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          isSelected && styles.durationChipTextSelected,
                          { textTransform: "capitalize" }
                        ]}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Duration Selector Card */}
          <View style={styles.detailsCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="time-outline" size={20} color={Colors.dark.primary} style={styles.headerIcon} />
              <Text style={styles.cardHeaderTitle}>Workout Duration</Text>
            </View>
            <Text style={styles.cardHeaderDesc}>
              Select a preset length or enter the workout duration manually.
            </Text>

            {/* Chips */}
            <View style={styles.chipsRow}>
              {[15, 30, 60, 90].map((preset) => {
                const isSelected = durationPreset === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                    onPress={() => handleSelectPreset(preset)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        isSelected && styles.durationChipTextSelected,
                      ]}
                    >
                      {preset} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Manual Duration Input */}
            <View style={styles.manualInputContainer}>
              <Text style={styles.inputLabel}>Enter duration manually (minutes)</Text>
              <View style={styles.textInputFrame}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 45"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  keyboardType="numeric"
                  value={manualDuration}
                  onChangeText={handleManualDurationChange}
                />
                <Text style={styles.unitText}>minutes</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Continue Action */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward-sharp" size={18} color={Colors.dark.white} />
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
  detailsCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 20,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  headerIcon: {
    marginRight: 8,
  },
  cardHeaderTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardHeaderDesc: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 24,
  },
  chipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 8,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
  },
  durationChipSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  durationChipText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  durationChipTextSelected: {
    color: Colors.dark.white,
    fontWeight: "700",
  },
  manualInputContainer: {
    marginTop: 8,
  },
  inputLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInputFrame: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
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
  continueButton: {
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
  continueButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
