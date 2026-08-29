import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import Colors from "../constants/Colors";
import * as Haptics from "expo-haptics";
import { menuNavigationState } from "./(tabs)/_layout";

export default function LogFoodDetails() {
  const { user } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams<{
    foodName: string;
    servingSize: string;
    calories: string;
    protein: string;
    carbs: string;
    fats: string;
  }>();

  // Parse initial serving parts once (e.g. "1.5 cup" => number: "1.5", unit: "cup")
  const baseParts = React.useMemo(() => {
    const rawSize = params.servingSize || "1 serving";
    const match = rawSize.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      return {
        number: match[1],
        unit: match[2] || "serving"
      };
    }
    return {
      number: "1",
      unit: rawSize || "serving"
    };
  }, [params.servingSize]);

  // Suffix unit (static name)
  const servingUnit = baseParts.unit;

  // Local Editable state is restricted to number only
  const [servingNumber, setServingNumber] = useState(baseParts.number);

  // Read-only calculated states (populated from params and scaled dynamically)
  const [calories, setCalories] = useState(params.calories || "0");
  const [protein, setProtein] = useState(params.protein || "0");
  const [carbs, setCarbs] = useState(params.carbs || "0");
  const [fats, setFats] = useState(params.fats || "0");

  const [activeDate, setActiveDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Base numerical reference values for scaling calculations
  const baseMultiplier = React.useMemo(() => {
    const parsed = parseFloat(baseParts.number);
    return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  }, [baseParts.number]);

  const baseCalories = React.useMemo(() => parseFloat(params.calories || "0"), [params.calories]);
  const baseProtein = React.useMemo(() => parseFloat(params.protein || "0"), [params.protein]);
  const baseCarbs = React.useMemo(() => parseFloat(params.carbs || "0"), [params.carbs]);
  const baseFats = React.useMemo(() => parseFloat(params.fats || "0"), [params.fats]);

  // Fetch active log calendar date
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

  // Update calculated outputs on serving size number change
  const handleServingNumberChange = (numVal: string) => {
    // Restrict inputs to numbers and decimals only
    const sanitized = numVal.replace(/[^0-9.]/g, "");
    setServingNumber(sanitized);

    const currentMultiplier = parseFloat(sanitized);
    if (!isNaN(currentMultiplier) && currentMultiplier >= 0 && baseMultiplier > 0) {
      const ratio = currentMultiplier / baseMultiplier;
      setCalories(Math.round(baseCalories * ratio).toString());
      setProtein((baseProtein * ratio).toFixed(1).replace(/\.0$/, ""));
      setCarbs((baseCarbs * ratio).toFixed(1).replace(/\.0$/, ""));
      setFats((baseFats * ratio).toFixed(1).replace(/\.0$/, ""));
    } else {
      // Default to 0 values if field is cleared or invalid
      setCalories("0");
      setProtein("0");
      setCarbs("0");
      setFats("0");
    }
  };

  const handleLogFood = async () => {
    if (!user) return;

    const numCalories = parseInt(calories, 10);
    const numProtein = parseFloat(protein);
    const numCarbs = parseFloat(carbs);
    const numFats = parseFloat(fats);
    const numServing = parseFloat(servingNumber);

    if (isNaN(numServing) || numServing <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid serving quantity.");
      return;
    }
    if (isNaN(numCalories) || numCalories < 0) {
      Alert.alert("Invalid Input", "Please enter a valid calorie amount.");
      return;
    }

    setIsSaving(true);
    try {
      const userLogsCollection = collection(db, "users", user.id, "logs");
      const formattedServingSize = `${servingNumber} ${servingUnit}`.trim();

      await addDoc(userLogsCollection, {
        title: (params.foodName || "Unknown Food").trim(),
        type: "meal",
        calories: numCalories,
        protein: Math.round(numProtein),
        carbs: Math.round(numCarbs),
        fats: Math.round(numFats),
        servingSize: formattedServingSize,
        date: activeDate,
        createdAt: serverTimestamp(),
      });

      // Trigger success haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Clear menu trigger and route to dashboard index
      menuNavigationState.shouldShowMenuOnReturn = false;
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Failed to log detailed food to database:", err);
      Alert.alert("Error", "Failed to log food item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
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
              <Text style={styles.headerTitle}>Log Food</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {/* Food Name Header Card */}
              <View style={styles.nameCard}>
                <Text style={styles.foodNameLabel}>Food Item</Text>
                <Text style={styles.foodNameText}>{params.foodName || "Select Food Item"}</Text>
              </View>

              {/* Serving Size Input (Restricted to numeric editing) */}
              <View style={styles.inputCard}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="scale-outline" size={18} color={Colors.dark.textSecondary} />
                  <Text style={styles.cardHeaderTitle}>Serving Size</Text>
                </View>
                <View style={styles.servingInputRow}>
                  {/* Quantity Box (Left - Editable) */}
                  <View style={styles.equalBox}>
                    <Text style={styles.boxLabel}>Quantity</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      placeholderTextColor="rgba(255, 255, 255, 0.2)"
                      value={servingNumber}
                      onChangeText={handleServingNumberChange}
                      autoCorrect={false}
                    />
                  </View>

                  {/* Unit Box (Right - Read-only) */}
                  <View style={styles.equalBox}>
                    <Text style={styles.boxLabel}>Unit</Text>
                    <TextInput
                      style={[styles.textInput, styles.readOnlyInput]}
                      value={servingUnit}
                      editable={false}
                    />
                  </View>
                </View>
              </View>

              {/* Calories Input Card (Read-only output) */}
              <View style={[styles.inputCard, styles.caloriesBorder]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="flame" size={20} color="#EF4444" />
                  <Text style={[styles.cardHeaderTitle, { color: "#EF4444" }]}>Calories Count (Calculated)</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.caloriesInput, styles.readOnlyInput]}
                  value={calories}
                  editable={false}
                />
              </View>

              {/* Macronutrients Section (Read-only outputs) */}
              <Text style={styles.sectionHeader}>Macronutrients (Grams - Calculated)</Text>

              {/* Protein Row */}
              <View style={styles.macroCard}>
                <View style={styles.macroRow}>
                  <View style={styles.macroLabelCol}>
                    <View style={[styles.macroIconFrame, { backgroundColor: "rgba(249, 115, 22, 0.08)", borderColor: "rgba(249, 115, 22, 0.15)" }]}>
                      <Ionicons name="barbell-outline" size={18} color="#F97316" />
                    </View>
                    <Text style={styles.macroLabel}>Protein</Text>
                  </View>
                  <TextInput
                    style={[styles.macroInput, styles.readOnlyInput]}
                    value={protein}
                    editable={false}
                  />
                </View>

                {/* Carbs Row */}
                <View style={styles.macroRow}>
                  <View style={styles.macroLabelCol}>
                    <View style={[styles.macroIconFrame, { backgroundColor: "rgba(59, 130, 246, 0.08)", borderColor: "rgba(59, 130, 246, 0.15)" }]}>
                      <Ionicons name="leaf-outline" size={18} color="#3B82F6" />
                    </View>
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </View>
                  <TextInput
                    style={[styles.macroInput, styles.readOnlyInput]}
                    value={carbs}
                    editable={false}
                  />
                </View>

                {/* Fats Row */}
                <View style={[styles.macroRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <View style={styles.macroLabelCol}>
                    <View style={[styles.macroIconFrame, { backgroundColor: "rgba(234, 179, 8, 0.08)", borderColor: "rgba(234, 179, 8, 0.15)" }]}>
                      <Ionicons name="water-outline" size={18} color="#EAB308" />
                    </View>
                    <Text style={styles.macroLabel}>Fats</Text>
                  </View>
                  <TextInput
                    style={[styles.macroInput, styles.readOnlyInput]}
                    value={fats}
                    editable={false}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Footer Log Action Button */}
            <View style={styles.footerContainer}>
              <TouchableOpacity
                style={styles.logButton}
                onPress={handleLogFood}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.dark.white} />
                ) : (
                  <>
                    <Text style={styles.logButtonText}>Log Food Diary</Text>
                    <Ionicons name="checkbox-outline" size={18} color={Colors.dark.white} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  nameCard: {
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  foodNameLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  foodNameText: {
    color: Colors.dark.text,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  inputCard: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  servingInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  equalBox: {
    flex: 1,
  },
  boxLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  caloriesBorder: {
    borderColor: "rgba(239, 68, 68, 0.15)",
    backgroundColor: "rgba(239, 68, 68, 0.02)",
  },
  caloriesInput: {
    borderColor: "rgba(239, 68, 68, 0.25)",
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "700",
  },
  readOnlyInput: {
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    borderColor: "rgba(255, 255, 255, 0.03)",
    opacity: 0.65,
  },
  sectionHeader: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 12,
    paddingLeft: 4,
  },
  macroCard: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    padding: 16,
  },
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
    paddingBottom: 14,
    marginBottom: 14,
  },
  macroLabelCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  macroIconFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  macroLabel: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
  },
  macroInput: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    width: 80,
    height: 38,
    textAlign: "center",
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
