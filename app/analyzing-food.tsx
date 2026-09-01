import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "../constants/Colors";
import * as Haptics from "expo-haptics";
import { analyzeFoodImage } from "../services/gemini";

export default function AnalyzingFood() {
  const router = useRouter();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  // Progress states for 3 steps
  const [step1, setStep1] = useState<"pending" | "loading" | "completed">("loading");
  const [step2, setStep2] = useState<"pending" | "loading" | "completed">("pending");
  const [step3, setStep3] = useState<"pending" | "loading" | "completed">("pending");

  // Extracted AI nutrition details
  const [nutritionData, setNutritionData] = useState<{
    foodName: string;
    servingSize: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    isFood: boolean;
    isFallback?: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function runAnalysis() {
      if (!imageUri) {
        setStep1("completed");
        setStep2("completed");
        setStep3("completed");
        return;
      }

      // Step 1: Base64 image preparation
      setStep1("loading");
      try {
        const response = await fetch(imageUri);
        await response.blob(); // Check that file is readable
        if (!active) return;
        setStep1("completed");
        setStep2("loading");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        // Step 2: Fetch nutrition data from Gemini AI Model
        const data = await analyzeFoodImage(imageUri);
        if (!active) return;
        setNutritionData(data);
        setStep2("completed");
        setStep3("loading");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        // Step 3: Reconcile results with a short visual delay
        setTimeout(() => {
          if (!active) return;
          setStep3("completed");
          if (!data.isFood) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }, 1000);

      } catch (error) {
        console.error("AI Analysis flow error:", error);
        if (!active) return;
        setStep1("completed");
        setStep2("completed");
        setStep3("completed");
      }
    }

    runAnalysis();

    return () => {
      active = false;
    };
  }, [imageUri]);

  const isComplete = step1 === "completed" && step2 === "completed" && step3 === "completed";

  const handleContinue = () => {
    if (!isComplete || !nutritionData || !nutritionData.isFood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    // Navigate to food logging details screen prefilled with Gemini results
    router.replace({
      pathname: "/log-food-details",
      params: {
        foodName: nutritionData.foodName,
        servingSize: nutritionData.servingSize,
        calories: String(nutritionData.calories),
        protein: String(nutritionData.protein),
        carbs: String(nutritionData.carbs),
        fats: String(nutritionData.fats),
      },
    });
  };

  // Render checkmark, spinner, or empty circle depending on state
  const renderStepIndicator = (state: "pending" | "loading" | "completed") => {
    if (state === "completed") {
      return (
        <View style={styles.stepIconFrame}>
          <Ionicons name="checkbox" size={26} color="#298F50" />
        </View>
      );
    }
    if (state === "loading") {
      return (
        <View style={styles.stepIconFrame}>
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        </View>
      );
    }
    return (
      <View style={styles.stepIconFrame}>
        <Ionicons name="square-outline" size={26} color="rgba(255, 255, 255, 0.15)" />
      </View>
    );
  };

  const getStepTextStyle = (state: "pending" | "loading" | "completed") => {
    if (state === "completed") {
      return [styles.stepText, styles.stepTextCompleted];
    }
    if (state === "loading") {
      return [styles.stepText, styles.stepTextActive];
    }
    return [styles.stepText, styles.stepTextPending];
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.back();
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analyzing Food</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Image Preview in square card */}
      <View style={styles.content}>
        <View style={styles.imageCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={48} color={Colors.dark.textMuted} />
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
        </View>

        {/* Non-Food / Non-Edible Warning Card */}
        {isComplete && nutritionData && !nutritionData.isFood ? (
          <View style={styles.nonFoodCard}>
            <View style={styles.nonFoodBadge}>
              <Ionicons name="warning" size={14} color="#EF4444" />
              <Text style={styles.nonFoodBadgeText}>NON-EDIBLE ITEM</Text>
            </View>

            <Text style={styles.nonFoodItemTitle}>
              Detected: {nutritionData.foodName}
            </Text>

            <Text style={styles.nonFoodDescription}>
              This item does not belong to the food category or is a non-edible item.
            </Text>

            {/* Red Cross Icon */}
            <View style={styles.redCrossFrame}>
              <Ionicons name="close-circle-sharp" size={56} color="#EF4444" />
              <Text style={styles.redCrossSubtext}>No nutrition values available</Text>
            </View>
          </View>
        ) : (
          /* Steps Card */
          <View style={styles.stepsCard}>
            <Text style={styles.cardHeaderTitle}>AI Analysis Progress</Text>
            
            <View style={styles.stepRow}>
              {renderStepIndicator(step1)}
              <View style={styles.stepTextContainer}>
                <Text style={getStepTextStyle(step1)}>Analyzing food</Text>
                <Text style={styles.stepSubtext}>Identifying ingredients and portions</Text>
              </View>
            </View>

            <View style={styles.dividerLine} />

            <View style={styles.stepRow}>
              {renderStepIndicator(step2)}
              <View style={styles.stepTextContainer}>
                <Text style={getStepTextStyle(step2)}>Getting nutrition data</Text>
                <Text style={styles.stepSubtext}>Calculating macro/micronutrients</Text>
              </View>
            </View>

            <View style={styles.dividerLine} />

            <View style={styles.stepRow}>
              {renderStepIndicator(step3)}
              <View style={styles.stepTextContainer}>
                <Text style={getStepTextStyle(step3)}>Get final result</Text>
                <Text style={styles.stepSubtext}>Preparing log entries for confirmation</Text>
              </View>
            </View>
          </View>
        )}

        {/* API Key Fallback Notice */}
        {isComplete && nutritionData?.isFallback && nutritionData.isFood && (
          <View style={styles.fallbackNotice}>
            <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
            <Text style={styles.fallbackNoticeText}>
              Gemini API key is unconfigured in .env. Showing demo targets.
            </Text>
          </View>
        )}
      </View>

      {/* Footer Button */}
      <View style={styles.footer}>
        {isComplete && nutritionData && !nutritionData.isFood ? (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.back();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Scan a Food Item</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueButton, !isComplete && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isComplete}
            activeOpacity={0.8}
          >
            {isComplete ? (
              <Text style={styles.continueButtonText}>Continue</Text>
            ) : (
              <View style={styles.buttonLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.dark.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.continueButtonTextDisabled}>Processing Image...</Text>
              </View>
            )}
          </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
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
    fontWeight: "bold",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  imageCard: {
    width: 240,
    height: 240,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.01)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    alignItems: "center",
    gap: 8,
  },
  placeholderText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  stepsCard: {
    width: "100%",
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 20,
    gap: 16,
  },
  cardHeaderTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  stepIconFrame: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stepIconCompleted: {
    backgroundColor: "#298F50",
  },
  stepIconLoading: {
    backgroundColor: "rgba(41, 143, 80, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.2)",
  },
  stepIconPending: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  stepDotPending: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.textMuted,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepText: {
    fontSize: 15,
    fontWeight: "600",
  },
  stepTextActive: {
    color: Colors.dark.text,
  },
  stepTextCompleted: {
    color: Colors.dark.textSecondary,
  },
  stepTextPending: {
    color: Colors.dark.textMuted,
  },
  stepSubtext: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  dividerLine: {
    marginLeft: 16,
    width: 1,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  continueButton: {
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
  continueButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonTextDisabled: {
    color: Colors.dark.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  fallbackNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    width: "100%",
  },
  fallbackNoticeText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  nonFoodCard: {
    width: "100%",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  nonFoodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nonFoodBadgeText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  nonFoodItemTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  nonFoodDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  redCrossFrame: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 6,
  },
  redCrossSubtext: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "#EF4444",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  retryButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "bold",
  },
});
