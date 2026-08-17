import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import Colors from "../constants/Colors";
import { useOnboarding } from "../context/OnboardingContext";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  ManIcon,
  WomanIcon,
  UserIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  BalanceScaleIcon,
  Calendar01Icon,
  Dumbbell01Icon,
  Dumbbell02Icon,
  CakeIcon,
  RulerIcon,
  WeightScaleIcon,
  ArrowLeftIcon,
} from "@hugeicons/core-free-icons";

export default function Onboarding() {
  const { completeOnboarding } = useOnboarding();
  const { signOut } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form states
  const [gender, setGender] = useState("");
  const [goal, setGoal] = useState("");
  const [workoutFrequency, setWorkoutFrequency] = useState("");
  
  // Birthdate states
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // Height (feet & inches) and Weight (kg) states
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("70");

  // TextInput refs for auto-focusing birthdate fields
  const monthInputRef = useRef<TextInput>(null);
  const yearInputRef = useRef<TextInput>(null);

  // Focus weight input for increment/decrement ease
  const weightInputRef = useRef<TextInput>(null);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    Haptics.impactAsync(style).catch((err) => console.log("Haptics not supported", err));
  };

  const triggerSuccessHaptic = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((err) =>
      console.log("Success haptic error", err)
    );
  };

  const handleGenderSelect = (val: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setGender(val);
  };

  const handleGoalSelect = (val: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setGoal(val);
  };

  const handleWorkoutSelect = (val: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setWorkoutFrequency(val);
  };

  // Validation helpers for each step
  const isStepValid = () => {
    switch (step) {
      case 1:
        return gender !== "";
      case 2:
        return goal !== "";
      case 3:
        return workoutFrequency !== "";
      case 4: {
        const d = parseInt(birthDay, 10);
        const m = parseInt(birthMonth, 10);
        const y = parseInt(birthYear, 10);
        return (
          birthDay.length > 0 &&
          birthMonth.length > 0 &&
          birthYear.length === 4 &&
          d >= 1 &&
          d <= 31 &&
          m >= 1 &&
          m <= 12 &&
          y >= 1920 &&
          y <= new Date().getFullYear()
        );
      }
      case 5: {
        const ft = parseInt(heightFeet, 10);
        const inch = parseInt(heightInches, 10);
        const wt = parseFloat(weight);
        return (
          heightFeet.length > 0 &&
          heightInches.length > 0 &&
          weight.length > 0 &&
          ft >= 3 &&
          ft <= 8 &&
          inch >= 0 &&
          inch <= 11 &&
          wt >= 20 &&
          wt <= 300
        );
      }
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!isStepValid()) return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (step < 5) {
      setStep(step + 1);
    } else {
      submitOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      setStep(step - 1);
    }
  };

  const submitOnboarding = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const formattedHeight = `${heightFeet} ft ${heightInches} in`;
    const formattedWeight = `${weight} kg`;

    router.replace({
      pathname: "/generating-plan" as any,
      params: {
        gender,
        goal,
        workoutFrequency,
        birthDay,
        birthMonth,
        birthYear,
        height: formattedHeight,
        weight: formattedWeight,
      },
    });
  };

  // Stepper controls for Weight (Step 5)
  const adjustWeight = (amount: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const current = parseFloat(weight) || 70;
    const newVal = Math.max(20, Math.min(300, current + amount));
    // Check if whole number or float to keep string clean
    setWeight(newVal % 1 === 0 ? newVal.toFixed(0) : newVal.toFixed(1));
  };

  // Auto-focus transitions for birthdate
  const handleDayChange = (text: string) => {
    // Only numeric
    const clean = text.replace(/[^0-9]/g, "");
    setBirthDay(clean);
    if (clean.length === 2) {
      monthInputRef.current?.focus();
    }
  };

  const handleMonthChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    setBirthMonth(clean);
    if (clean.length === 2) {
      yearInputRef.current?.focus();
    }
  };

  const handleYearChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    setBirthYear(clean);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Top Header Row */}
        <View style={styles.header}>
          {step > 1 ? (
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <HugeiconsIcon icon={ArrowLeftIcon} size={22} color={Colors.dark.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={styles.headerTitle}>Arogya Hub</Text>
          <TouchableOpacity onPress={() => signOut()} style={styles.exitButton} activeOpacity={0.7}>
            <Text style={styles.exitText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar Container */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${(step / 5) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>Step {step} of 5</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Step 1: Gender */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Tell us about yourself</Text>
              <Text style={styles.subtitle}>Select your gender to customize your calorie targets.</Text>

              <View style={styles.optionsContainer}>
                {/* Male Option */}
                <TouchableOpacity
                  style={[styles.cardOption, gender === "Male" && styles.cardOptionSelected]}
                  onPress={() => handleGenderSelect("Male")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconWrapper, gender === "Male" && styles.iconWrapperSelected]}>
                    <HugeiconsIcon
                      icon={ManIcon}
                      size={32}
                      color={gender === "Male" ? Colors.dark.primary : Colors.dark.textSecondary}
                    />
                  </View>
                  <Text style={[styles.optionLabel, gender === "Male" && styles.optionLabelSelected]}>
                    Male
                  </Text>
                </TouchableOpacity>

                {/* Female Option */}
                <TouchableOpacity
                  style={[styles.cardOption, gender === "Female" && styles.cardOptionSelected]}
                  onPress={() => handleGenderSelect("Female")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconWrapper, gender === "Female" && styles.iconWrapperSelected]}>
                    <HugeiconsIcon
                      icon={WomanIcon}
                      size={32}
                      color={gender === "Female" ? Colors.dark.primary : Colors.dark.textSecondary}
                    />
                  </View>
                  <Text style={[styles.optionLabel, gender === "Female" && styles.optionLabelSelected]}>
                    Female
                  </Text>
                </TouchableOpacity>

                {/* Other Option */}
                <TouchableOpacity
                  style={[styles.cardOption, gender === "Other" && styles.cardOptionSelected]}
                  onPress={() => handleGenderSelect("Other")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconWrapper, gender === "Other" && styles.iconWrapperSelected]}>
                    <HugeiconsIcon
                      icon={UserIcon}
                      size={32}
                      color={gender === "Other" ? Colors.dark.primary : Colors.dark.textSecondary}
                    />
                  </View>
                  <Text style={[styles.optionLabel, gender === "Other" && styles.optionLabelSelected]}>
                    Other
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: Goal */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>What's your goal?</Text>
              <Text style={styles.subtitle}>Select the primary outcome you want to achieve.</Text>

              <View style={styles.listContainer}>
                {/* Lose Weight */}
                <TouchableOpacity
                  style={[styles.listOption, goal === "Lose Weight" && styles.listOptionSelected]}
                  onPress={() => handleGoalSelect("Lose Weight")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.listIconWrapper, goal === "Lose Weight" && styles.listIconSelected]}>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={24}
                      color={goal === "Lose Weight" ? Colors.dark.primary : Colors.dark.textSecondary}
                    />
                  </View>
                  <View style={styles.listTextWrapper}>
                    <Text style={[styles.listLabel, goal === "Lose Weight" && styles.listLabelSelected]}>
                      Lose Weight
                    </Text>
                    <Text style={styles.listSubtext}>Burn fat, increase energy, and feel lighter</Text>
                  </View>
                </TouchableOpacity>

                {/* Maintain Weight */}
                <TouchableOpacity
                  style={[styles.listOption, goal === "Maintain Weight" && styles.listOptionSelected]}
                  onPress={() => handleGoalSelect("Maintain Weight")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.listIconWrapper, goal === "Maintain Weight" && styles.listIconSelected]}>
                    <HugeiconsIcon
                      icon={BalanceScaleIcon}
                      size={24}
                      color={goal === "Maintain Weight" ? Colors.dark.primary : Colors.dark.textSecondary}
                    />
                  </View>
                  <View style={styles.listTextWrapper}>
                    <Text style={[styles.listLabel, goal === "Maintain Weight" && styles.listLabelSelected]}>
                      Maintain Weight
                    </Text>
                    <Text style={styles.listSubtext}>Optimize body composition and stay fit</Text>
                  </View>
                </TouchableOpacity>

                {/* Gain Weight */}
                <TouchableOpacity
                  style={[styles.listOption, goal === "Gain Weight" && styles.listOptionSelected]}
                  onPress={() => handleGoalSelect("Gain Weight")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.listIconWrapper, goal === "Gain Weight" && styles.listIconSelected]}>
                    <HugeiconsIcon
                      icon={ArrowUp01Icon}
                      size={24}
                      color={goal === "Gain Weight" ? Colors.dark.primary : Colors.dark.textSecondary}
                    />
                  </View>
                  <View style={styles.listTextWrapper}>
                    <Text style={[styles.listLabel, goal === "Gain Weight" && styles.listLabelSelected]}>
                      Gain Weight
                    </Text>
                    <Text style={styles.listSubtext}>Build lean muscle mass and add strength</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Workout Details */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Your Workout Details</Text>
              <Text style={styles.subtitle}>How many days per week do you plan to train?</Text>

              <View style={styles.listContainer}>
                {/* 2-3 days */}
                <TouchableOpacity
                  style={[
                    styles.listOption,
                    workoutFrequency === "2-3 days" && styles.listOptionSelected,
                  ]}
                  onPress={() => handleWorkoutSelect("2-3 days")}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.listIconWrapper,
                      workoutFrequency === "2-3 days" && styles.listIconSelected,
                    ]}
                  >
                    <HugeiconsIcon
                      icon={Calendar01Icon}
                      size={24}
                      color={
                        workoutFrequency === "2-3 days" ? Colors.dark.primary : Colors.dark.textSecondary
                      }
                    />
                  </View>
                  <View style={styles.listTextWrapper}>
                    <Text
                      style={[
                        styles.listLabel,
                        workoutFrequency === "2-3 days" && styles.listLabelSelected,
                      ]}
                    >
                      2 - 3 Days / week
                    </Text>
                    <Text style={styles.listSubtext}>Perfect for staying active or getting started</Text>
                  </View>
                </TouchableOpacity>

                {/* 3-4 days */}
                <TouchableOpacity
                  style={[
                    styles.listOption,
                    workoutFrequency === "3-4 days" && styles.listOptionSelected,
                  ]}
                  onPress={() => handleWorkoutSelect("3-4 days")}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.listIconWrapper,
                      workoutFrequency === "3-4 days" && styles.listIconSelected,
                    ]}
                  >
                    <HugeiconsIcon
                      icon={Dumbbell01Icon}
                      size={24}
                      color={
                        workoutFrequency === "3-4 days" ? Colors.dark.primary : Colors.dark.textSecondary
                      }
                    />
                  </View>
                  <View style={styles.listTextWrapper}>
                    <Text
                      style={[
                        styles.listLabel,
                        workoutFrequency === "3-4 days" && styles.listLabelSelected,
                      ]}
                    >
                      3 - 4 Days / week
                    </Text>
                    <Text style={styles.listSubtext}>Great for body transformation and progress</Text>
                  </View>
                </TouchableOpacity>

                {/* 5-6 days */}
                <TouchableOpacity
                  style={[
                    styles.listOption,
                    workoutFrequency === "5-6 days" && styles.listOptionSelected,
                  ]}
                  onPress={() => handleWorkoutSelect("5-6 days")}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.listIconWrapper,
                      workoutFrequency === "5-6 days" && styles.listIconSelected,
                    ]}
                  >
                    <HugeiconsIcon
                      icon={Dumbbell02Icon}
                      size={24}
                      color={
                        workoutFrequency === "5-6 days" ? Colors.dark.primary : Colors.dark.textSecondary
                      }
                    />
                  </View>
                  <View style={styles.listTextWrapper}>
                    <Text
                      style={[
                        styles.listLabel,
                        workoutFrequency === "5-6 days" && styles.listLabelSelected,
                      ]}
                    >
                      5 - 6 Days / week
                    </Text>
                    <Text style={styles.listSubtext}>High commitment for athletes & core trainers</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Birth Date */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>When's your birthday?</Text>
              <Text style={styles.subtitle}>We calculate metabolic baselines based on your age.</Text>

              <View style={styles.centerIconContainer}>
                <View style={styles.circleGraphic}>
                  <HugeiconsIcon icon={CakeIcon} size={40} color={Colors.dark.primary} />
                </View>
              </View>

              <View style={styles.dateInputsContainer}>
                {/* Day Input */}
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.inputMicroLabel}>Day</Text>
                  <TextInput
                    style={styles.numericInput}
                    placeholder="DD"
                    placeholderTextColor={Colors.dark.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={birthDay}
                    onChangeText={handleDayChange}
                  />
                </View>

                {/* Month Input */}
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.inputMicroLabel}>Month</Text>
                  <TextInput
                    ref={monthInputRef}
                    style={styles.numericInput}
                    placeholder="MM"
                    placeholderTextColor={Colors.dark.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={birthMonth}
                    onChangeText={handleMonthChange}
                  />
                </View>

                {/* Year Input */}
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.inputMicroLabel}>Year</Text>
                  <TextInput
                    ref={yearInputRef}
                    style={styles.numericInput}
                    placeholder="YYYY"
                    placeholderTextColor={Colors.dark.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={birthYear}
                    onChangeText={handleYearChange}
                  />
                </View>
              </View>

              {!isStepValid() && (birthDay || birthMonth || birthYear) && (
                <Text style={styles.errorText}>Please enter a valid date (e.g. 15-08-1995)</Text>
              )}
            </View>
          )}

          {/* Step 5: Height and Weight */}
          {step === 5 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Height & Weight</Text>
              <Text style={styles.subtitle}>Specify your physical dimensions to complete your profile.</Text>

              {/* Height Inputs (Feet and Inches) */}
              <View style={styles.sectionHeaderContainer}>
                <HugeiconsIcon icon={RulerIcon} size={20} color={Colors.dark.primary} />
                <Text style={styles.sectionHeading}>Height</Text>
              </View>

              <View style={styles.heightRow}>
                {/* Feet */}
                <View style={styles.heightInputWrapper}>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="5"
                    placeholderTextColor={Colors.dark.textMuted}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={heightFeet}
                    onChangeText={(val) => setHeightFeet(val.replace(/[^0-9]/g, ""))}
                  />
                  <Text style={styles.unitLabel}>feet</Text>
                </View>

                {/* Inches */}
                <View style={styles.heightInputWrapper}>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="9"
                    placeholderTextColor={Colors.dark.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={heightInches}
                    onChangeText={(val) => setHeightInches(val.replace(/[^0-9]/g, ""))}
                  />
                  <Text style={styles.unitLabel}>inches</Text>
                </View>
              </View>

              {/* Weight Section (Kg) with Stepper */}
              <View style={[styles.sectionHeaderContainer, { marginTop: 32 }]}>
                <HugeiconsIcon icon={WeightScaleIcon} size={20} color={Colors.dark.primary} />
                <Text style={styles.sectionHeading}>Weight (kg)</Text>
              </View>

              <View style={styles.weightStepperContainer}>
                {/* Decrement Button */}
                <TouchableOpacity
                  onPress={() => adjustWeight(-1)}
                  style={styles.stepperButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperButtonText}>-</Text>
                </TouchableOpacity>

                {/* Weight TextInput */}
                <TextInput
                  ref={weightInputRef}
                  style={styles.weightInput}
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={(val) => setWeight(val.replace(/[^0-9.]/g, ""))}
                />

                {/* Increment Button */}
                <TouchableOpacity
                  onPress={() => adjustWeight(1)}
                  style={styles.stepperButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.stepperPresets}>
                <TouchableOpacity onPress={() => adjustWeight(-5)} style={styles.presetChip}>
                  <Text style={styles.presetChipText}>-5 kg</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => adjustWeight(5)} style={styles.presetChip}>
                  <Text style={styles.presetChipText}>+5 kg</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, !isStepValid() && styles.primaryButtonDisabled]}
            onPress={handleNext}
            disabled={!isStepValid() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.dark.white} />
            ) : (
              <Text style={styles.primaryButtonText}>{step === 5 ? "Finish" : "Next"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.dark.text,
  },
  exitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.1)",
  },
  exitText: {
    color: Colors.dark.error,
    fontSize: 13,
    fontWeight: "600",
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 18,
    alignItems: "center",
  },
  progressBarTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.dark.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  stepContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
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
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  optionsContainer: {
    flexDirection: "column",
    gap: 16,
  },
  cardOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  cardOptionSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: "rgba(41, 143, 80, 0.05)",
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconWrapperSelected: {
    backgroundColor: "rgba(41, 143, 80, 0.1)",
    borderColor: "rgba(41, 143, 80, 0.2)",
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  optionLabelSelected: {
    color: Colors.dark.text,
  },
  listContainer: {
    flexDirection: "column",
    gap: 16,
  },
  listOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },
  listOptionSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: "rgba(41, 143, 80, 0.05)",
  },
  listIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  listIconSelected: {
    backgroundColor: "rgba(41, 143, 80, 0.1)",
    borderColor: "rgba(41, 143, 80, 0.2)",
  },
  listTextWrapper: {
    flex: 1,
  },
  listLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  listLabelSelected: {
    color: Colors.dark.text,
  },
  listSubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    lineHeight: 16,
  },
  centerIconContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  circleGraphic: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(41, 143, 80, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  dateInputsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  dateInputWrapper: {
    flex: 1,
    maxWidth: 95,
  },
  inputMicroLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  numericInput: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    height: 60,
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 13,
    textAlign: "center",
    marginTop: 16,
  },
  sectionHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heightRow: {
    flexDirection: "row",
    gap: 16,
  },
  heightInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    height: 60,
    paddingHorizontal: 16,
  },
  measurementInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  unitLabel: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    marginLeft: 8,
  },
  weightStepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 20,
    height: 72,
    paddingHorizontal: 8,
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  stepperButtonText: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: "600",
  },
  weightInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  stepperPresets: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 14,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  presetChipText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  primaryButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 18,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
