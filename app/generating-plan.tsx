import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import Colors from "../constants/Colors";
import { useOnboarding } from "../context/OnboardingContext";
import { generateAIFitnessTargets } from "../services/gemini";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Tick02Icon, SparklesIcon, DatabaseIcon } from "@hugeicons/core-free-icons";

export default function GeneratingPlan() {
  const { completeOnboarding } = useOnboarding();
  const params = useLocalSearchParams();

  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Status steps list
  const steps = [
    { label: "Analyzing physical metrics & profile", id: 0 },
    { label: "Consulting Gemini AI fitness coach", id: 1 },
    { label: "Structuring macronutrient distribution", id: 2 },
    { label: "Optimizing hydration goals & guidelines", id: 3 },
    { label: "Saving profile and syncing to Arogya Hub", id: 4 },
  ];

  useEffect(() => {
    let active = true;

    // Extract inputs from query parameters
    const gender = String(params.gender || "Male");
    const goal = String(params.goal || "Maintain Weight");
    const workoutFrequency = String(params.workoutFrequency || "3-4 days");
    const birthDay = String(params.birthDay || "01");
    const birthMonth = String(params.birthMonth || "01");
    const birthYear = String(params.birthYear || "1995");
    const height = String(params.height || "5 ft 9 in");
    const weight = String(params.weight || "70 kg");

    // Start the AI target generation in the background immediately
    const aiPromise = generateAIFitnessTargets(
      gender,
      goal,
      workoutFrequency,
      { day: birthDay, month: birthMonth, year: birthYear },
      height,
      weight
    );

    async function runLoaderSequence() {
      try {
        // Step 0: Analyzing physical metrics & profile
        if (!active) return;
        setActiveStep(0);
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Step 1: Consulting Gemini AI fitness coach
        if (!active) return;
        setActiveStep(1);
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Step 2: Structuring macronutrient distribution
        if (!active) return;
        setActiveStep(2);
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Step 3: Optimizing hydration goals & guidelines
        if (!active) return;
        setActiveStep(3);
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Step 4: Saving profile and syncing to Arogya Hub
        if (!active) return;
        setActiveStep(4);

        // Wait for the background AI request to complete
        const generated = await aiPromise;

        const onboardingPayload = {
          gender,
          goal,
          workoutFrequency,
          birthDate: {
            day: birthDay,
            month: birthMonth,
            year: birthYear,
          },
          height,
          weight,
        };

        const targetsPayload = {
          calories: generated.calories,
          protein: generated.protein,
          carbs: generated.carbs,
          fats: generated.fats,
          water: generated.water,
          advice: generated.advice,
        };

        // Complete onboarding & save targets to Firestore and AsyncStorage
        await completeOnboarding(onboardingPayload, targetsPayload);

        // Complete final checkmark step (moves index past the last checklist item)
        if (active) {
          setActiveStep(5);
        }
      } catch (err: any) {
        console.error("AI Plan Generation failed:", err);
        if (active) {
          setError(err.message || "An unexpected error occurred. Please try again.");
        }
      }
    }

    runLoaderSequence();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Animated AI Icon Container */}
        <View style={styles.iconContainer}>
          <View style={styles.glowOuter}>
            <View style={styles.glowInner}>
              <HugeiconsIcon icon={SparklesIcon} size={42} color={Colors.dark.primary} />
            </View>
          </View>
        </View>

        <Text style={styles.title}>Creating Your Plan</Text>
        <Text style={styles.subtitle}>
          Our AI is calculating target calorie baselines and macronutrient profiles just for you.
        </Text>

        {/* Steps Status Check-list */}
        <View style={styles.stepsCard}>
          {steps.map((stepItem, idx) => {
            const isCompleted = activeStep > idx;
            const isActive = activeStep === idx;
            
            return (
              <View key={stepItem.id} style={styles.stepRow}>
                <View style={styles.bulletContainer}>
                  {isCompleted ? (
                    <View style={styles.checkmarkCircle}>
                      <HugeiconsIcon icon={Tick02Icon} size={13} color={Colors.dark.white} />
                    </View>
                  ) : isActive ? (
                    <ActivityIndicator size="small" color={Colors.dark.primary} />
                  ) : (
                    <View style={styles.emptyCircle} />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                    isCompleted && styles.stepLabelCompleted,
                  ]}
                >
                  {stepItem.label}
                </Text>
              </View>
            );
          })}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Plan Generation Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: "center",
  },
  glowOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(41, 143, 80, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  glowInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.dark.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  stepsCard: {
    width: "100%",
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 24,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bulletContainer: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  stepLabel: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    fontWeight: "500",
  },
  stepLabelActive: {
    color: Colors.dark.text,
    fontWeight: "600",
  },
  stepLabelCompleted: {
    color: Colors.dark.textSecondary,
  },
  errorBox: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 18,
    width: "100%",
  },
  errorTitle: {
    color: Colors.dark.error,
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  errorText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
