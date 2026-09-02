import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import HomeHeader from "../../components/HomeHeader";
import WeeklyCalendar from "../../components/WeeklyCalendar";
import Colors from "../../constants/Colors";
import { db } from "../../services/firebase";
import { calculateFallbackTargets } from "../../services/gemini";

const formatLogTime = (createdAt: any) => {
  if (!createdAt) return "Just now";
  try {
    let dateObj: Date;
    if (typeof createdAt === "object" && "seconds" in createdAt) {
      dateObj = new Date(createdAt.seconds * 1000);
    } else if (createdAt.toDate && typeof createdAt.toDate === "function") {
      dateObj = createdAt.toDate();
    } else {
      dateObj = new Date(createdAt);
    }
    if (isNaN(dateObj.getTime())) return "Just now";
    return dateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return "Just now";
  }
};

export default function Dashboard() {
  const { user } = useUser();

  // Helper to format today's date as YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
  };

  const [selectedDateId, setSelectedDateId] = useState(getTodayDateString());
  const isPastDate = selectedDateId < getTodayDateString();
  const [targetCalories, setTargetCalories] = useState(2000);
  const [targetProtein, setTargetProtein] = useState(150);
  const [targetCarbs, setTargetCarbs] = useState(200);
  const [targetFats, setTargetFats] = useState(70);
  const [targetWater, setTargetWater] = useState(3.0);
  const [aiAdvice, setAiAdvice] = useState("");
  const [profileStats, setProfileStats] = useState<any>(null);

  // Edit targets modal states
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFats, setEditFats] = useState("");
  const [editWater, setEditWater] = useState("");
  const [isSavingTargets, setIsSavingTargets] = useState(false);
  const [modalError, setModalError] = useState("");

  // Real-time logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // 1. Sync selectedDateId to AsyncStorage so plus screen knows which date we're editing
  useEffect(() => {
    async function saveActiveDate() {
      try {
        await AsyncStorage.setItem("active_calendar_date", selectedDateId);
      } catch (err) {
        console.error("Failed to save active calendar date:", err);
      }
    }
    saveActiveDate();
  }, [selectedDateId]);

  // 2. Load user targets & physical profile stats from onboarding data
  useEffect(() => {
    async function loadTargets() {
      if (!user) return;
      try {
        const stored = await AsyncStorage.getItem(`onboarding_data_${user.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setProfileStats(parsed);

          if (parsed.targetCalories) {
            setTargetCalories(Number(parsed.targetCalories));
            setTargetProtein(Number(parsed.targetProtein || 150));
            setTargetCarbs(Number(parsed.targetCarbs || 200));
            setTargetFats(Number(parsed.targetFats || 70));
            setTargetWater(Number(parsed.targetWater || 3.0));
            if (parsed.aiAdvice) setAiAdvice(parsed.aiAdvice);
          } else {
            // Auto-calculate from physical profile stats using Mifflin-St Jeor formula
            const gender = parsed.gender || "Male";
            const goal = parsed.goal || "Weight Loss";
            const freq = parsed.workoutFrequency || "3-4 days";
            const birthYear = parsed.birthDate?.year || "1998";
            const height = parsed.height || "175";
            const weight = parsed.weight || "70";
            const computed = calculateFallbackTargets(gender, goal, freq, birthYear, height, weight);
            setTargetCalories(computed.calories);
            setTargetProtein(computed.protein);
            setTargetCarbs(computed.carbs);
            setTargetFats(computed.fats);
            setTargetWater(computed.water);
            setAiAdvice(computed.advice);
          }
        }
      } catch (error) {
        console.error("Failed to load calorie targets from AsyncStorage:", error);
      }
    }
    loadTargets();
  }, [user]);

  // 3. Real-time Firestore query for daily log entries matching selectedDateId
  useEffect(() => {
    if (!user) return;

    setIsLoadingLogs(true);
    const logsQuery = query(
      collection(db, "users", user.id, "logs"),
      where("date", "==", selectedDateId)
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort logs: oldest first, recent at the bottom
        const getLogTime = (log: any) => {
          if (!log.createdAt) return Date.now(); // pending writes/local state updates default to most recent
          if (log.createdAt.seconds) return log.createdAt.seconds * 1000;
          if (log.createdAt.toDate && typeof log.createdAt.toDate === "function") {
            return log.createdAt.toDate().getTime();
          }
          const parsed = new Date(log.createdAt).getTime();
          return isNaN(parsed) ? Date.now() : parsed;
        };

        const sortedLogs = fetchedLogs.sort((a, b) => getLogTime(a) - getLogTime(b));

        setLogs(sortedLogs);
        setIsLoadingLogs(false);
      },
      (error) => {
        console.error("Firestore subscription error:", error);
        setIsLoadingLogs(false);
      }
    );

    return () => unsubscribe();
  }, [user, selectedDateId]);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  // Trigger delete confirmation popup
  const handleDeleteLog = (logId: string, logTitle: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    setDeleteTarget({ id: logId, title: logTitle });
  };

  // Perform actual deletion from Firestore
  const confirmDeleteLog = async () => {
    if (!user || !deleteTarget) return;
    try {
      setIsDeletingLog(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      const logDocRef = doc(db, "users", user.id, "logs", deleteTarget.id);
      await deleteDoc(logDocRef);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete log entry:", err);
    } finally {
      setIsDeletingLog(false);
    }
  };

  // Open targets modal prefilled
  const handleOpenEditModal = () => {
    setEditCalories(String(targetCalories));
    setEditProtein(String(targetProtein));
    setEditCarbs(String(targetCarbs));
    setEditFats(String(targetFats));
    setEditWater(String(targetWater));
    setModalError("");
    setIsEditModalVisible(true);
  };

  // Recalculate targets state & logic
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);

  const handleAutoCalculateTargets = async () => {
    if (isAutoCalculating) return;
    try {
      setIsAutoCalculating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

      // Short delay so refreshing state and indicator are clearly visible
      await new Promise((resolve) => setTimeout(resolve, 700));

      const gender = profileStats?.gender || "Male";
      const goal = profileStats?.goal || "Weight Loss";
      const freq = profileStats?.workoutFrequency || "3-4 days";
      const birthYear = profileStats?.birthDate?.year || "1998";
      const height = profileStats?.height || "175";
      const weight = profileStats?.weight || "70";

      const computed = calculateFallbackTargets(gender, goal, freq, birthYear, height, weight);

      setEditCalories(String(computed.calories));
      setEditProtein(String(computed.protein));
      setEditCarbs(String(computed.carbs));
      setEditFats(String(computed.fats));
      setEditWater(String(computed.water));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    } catch (err) {
      console.error("Auto calculation error:", err);
    } finally {
      setIsAutoCalculating(false);
    }
  };

  // Save new target metrics to Firestore & Local Storage
  const handleSaveTargets = async () => {
    if (!user) return;
    setModalError("");

    // Form Validation
    if (
      !editCalories || isNaN(Number(editCalories)) || Number(editCalories) <= 0 ||
      !editProtein || isNaN(Number(editProtein)) || Number(editProtein) <= 0 ||
      !editCarbs || isNaN(Number(editCarbs)) || Number(editCarbs) <= 0 ||
      !editFats || isNaN(Number(editFats)) || Number(editFats) <= 0 ||
      !editWater || isNaN(Number(editWater)) || Number(editWater) <= 0
    ) {
      setModalError("Please enter valid numbers greater than 0 for all targets.");
      return;
    }

    setIsSavingTargets(true);
    try {
      const newCalories = Math.round(Number(editCalories));
      const newProtein = Math.round(Number(editProtein));
      const newCarbs = Math.round(Number(editCarbs));
      const newFats = Math.round(Number(editFats));
      const newWater = Number(editWater);

      // 1. Write targets to Firestore (Main primary values)
      const userDocRef = doc(db, "users", user.id);
      await setDoc(
        userDocRef,
        {
          targetCalories: newCalories,
          targetProtein: newProtein,
          targetCarbs: newCarbs,
          targetFats: newFats,
          targetWater: newWater,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // 2. Cache in Local Storage
      const stored = await AsyncStorage.getItem(`onboarding_data_${user.id}`);
      let mergedData = {};
      if (stored) {
        mergedData = JSON.parse(stored);
      }
      mergedData = {
        ...mergedData,
        targetCalories: newCalories,
        targetProtein: newProtein,
        targetCarbs: newCarbs,
        targetFats: newFats,
        targetWater: newWater,
      };
      await AsyncStorage.setItem(`onboarding_data_${user.id}`, JSON.stringify(mergedData));

      // 3. Update dashboard state
      setTargetCalories(newCalories);
      setTargetProtein(newProtein);
      setTargetCarbs(newCarbs);
      setTargetFats(newFats);
      setTargetWater(newWater);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      setIsEditModalVisible(false);
    } catch (err) {
      console.error("Firestore save targets error:", err);
      setModalError("Failed to update targets. Please try again.");
    } finally {
      setIsSavingTargets(false);
    }
  };

  // Quick add water log entry (+0.25 Liters / 1 Glass)
  const handleQuickAddWater = async () => {
    if (!user) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
      const userLogsCollection = collection(db, "users", user.id, "logs");
      await addDoc(userLogsCollection, {
        title: "Water Intake",
        type: "water",
        amount: 0.25,
        date: selectedDateId,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Firestore quick add water error:", err);
    }
  };

  // Dynamic calculations from real-time database logs
  const consumedCalories = logs
    .filter((log) => log.type === "meal")
    .reduce((sum, log) => sum + (log.calories || 0), 0);

  const burnedCalories = logs
    .filter((log) => log.type === "workout")
    .reduce((sum, log) => sum + (log.calories || 0), 0);

  const netCalories = Math.max(0, consumedCalories - burnedCalories);

  const consumedProtein = logs
    .filter((log) => log.type === "meal")
    .reduce((sum, log) => sum + (log.protein || 0), 0);

  const consumedCarbs = logs
    .filter((log) => log.type === "meal")
    .reduce((sum, log) => sum + (log.carbs || 0), 0);

  const consumedFats = logs
    .filter((log) => log.type === "meal")
    .reduce((sum, log) => sum + (log.fats || 0), 0);

  // Allow percents to exceed 1.0 (for correct text outputs >100%)
  const proteinPercent = targetProtein > 0 ? consumedProtein / targetProtein : 0;
  const carbsPercent = targetCarbs > 0 ? consumedCarbs / targetCarbs : 0;
  const fatsPercent = targetFats > 0 ? consumedFats / targetFats : 0;

  const proteinPercentageText = Math.round(proteinPercent * 100);
  const carbsPercentageText = Math.round(carbsPercent * 100);
  const fatsPercentageText = Math.round(fatsPercent * 100);

  // Water calculations
  const consumedWater = logs
    .filter((log) => log.type === "water")
    .reduce((sum, log) => sum + (log.amount || 0), 0);

  const consumedGlasses = consumedWater / 0.25;
  const targetGlasses = Math.ceil(targetWater / 0.25);
  const glassesLeft = Math.max(0, (targetWater / 0.25) - consumedGlasses);

  // Calculate progress bar color dynamically based on percentage threshold
  const getMacroBarColor = (percent: number) => {
    const percentage = percent * 100;
    if (percentage < 50) {
      return "#F59E0B"; // Light Mustard (<50%)
    } else if (percentage < 80) {
      return "#93eeb4ff"; // Light Green (50%-80%)
    } else {
      return Colors.dark.primary; // Theme Green (80%-100%+)
    }
  };

  // Group glasses into 8-per-row chunks for vertical scrolling (16 visible at a time)
  const totalGlassesToRender = Math.max(targetGlasses, Math.ceil(consumedGlasses));
  const glassRows: number[][] = [];
  for (let i = 0; i < totalGlassesToRender; i += 8) {
    const row: number[] = [];
    for (let j = i; j < i + 8; j++) {
      row.push(j);
    }
    glassRows.push(row);
  }

  // Dual Ring Percent Calculations (both rings share targetCalories baseline)
  const eatenPercentText = targetCalories > 0 ? Math.round((consumedCalories / targetCalories) * 100) : 0;
  const targetBurned = targetCalories; // Match targeted calories eaten
  const burnedPercentText = targetBurned > 0 ? Math.round((burnedCalories / targetBurned) * 100) : 0;

  return (
    <View style={styles.rootContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={["top"]} style={styles.safeHeader}>
          <HomeHeader />
        </SafeAreaView>
        <WeeklyCalendar selectedDateId={selectedDateId} onDateSelect={setSelectedDateId} />

        <View style={styles.mainContentContainer}>
          {/* Main Calorie Ring / Visual Card */}
          <View style={styles.glassCard}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Daily Calories Required!</Text>
              <TouchableOpacity style={styles.editButton} onPress={handleOpenEditModal} activeOpacity={0.7}>
                <Ionicons name="pencil-sharp" size={12} color={Colors.dark.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Dual Side-by-Side Progress Rings */}
            <View style={styles.dualRingsRow}>
              {/* Left Ring: Calories Eaten */}
              <View style={styles.ringCardItem}>
                <Text style={styles.ringCardHeaderTitle}>Calories Eaten</Text>
                <View style={styles.ringSvgWrapper}>
                  <Svg width={115} height={115} style={styles.ringSvg}>
                    <Circle
                      cx={57.5}
                      cy={57.5}
                      r={48}
                      stroke="rgba(16, 185, 129, 0.12)"
                      strokeWidth={8}
                      fill="transparent"
                    />
                    <Circle
                      cx={57.5}
                      cy={57.5}
                      r={48}
                      stroke={consumedCalories > targetCalories ? "#EF4444" : "#10B981"}
                      strokeWidth={8}
                      fill="transparent"
                      strokeDasharray={301.6}
                      strokeDashoffset={301.6 - Math.min(1, targetCalories > 0 ? consumedCalories / targetCalories : 0) * 301.6}
                      strokeLinecap="round"
                      transform="rotate(-90 57.5 57.5)"
                    />
                  </Svg>
                  <View style={styles.ringInnerInfo}>
                    <Ionicons name="flame" size={14} color="#10B981" />
                    <Text style={styles.ringNumberVal}>{consumedCalories}</Text>
                    <Text style={styles.ringSubLabel}>cal eaten</Text>
                    <Text style={[styles.ringPercentLabel, { color: "#10B981" }]}>{eatenPercentText}%</Text>
                  </View>
                </View>
                <Text style={styles.ringTargetGoalText}>Target: {targetCalories} cal</Text>
              </View>

              {/* Right Ring: Active Burned */}
              <View style={styles.ringCardItem}>
                <Text style={styles.ringCardHeaderTitle}>Active Burned</Text>
                <View style={styles.ringSvgWrapper}>
                  <Svg width={115} height={115} style={styles.ringSvg}>
                    <Circle
                      cx={57.5}
                      cy={57.5}
                      r={48}
                      stroke="rgba(245, 158, 11, 0.12)"
                      strokeWidth={8}
                      fill="transparent"
                    />
                    <Circle
                      cx={57.5}
                      cy={57.5}
                      r={48}
                      stroke="#F59E0B"
                      strokeWidth={8}
                      fill="transparent"
                      strokeDasharray={301.6}
                      strokeDashoffset={301.6 - Math.min(1, burnedCalories / targetBurned) * 301.6}
                      strokeLinecap="round"
                      transform="rotate(-90 57.5 57.5)"
                    />
                  </Svg>
                  <View style={styles.ringInnerInfo}>
                    <Ionicons name="barbell" size={14} color="#F59E0B" />
                    <Text style={styles.ringNumberVal}>{burnedCalories}</Text>
                    <Text style={styles.ringSubLabel}>cal burned</Text>
                    <Text style={[styles.ringPercentLabel, { color: "#F59E0B" }]}>{burnedPercentText}%</Text>
                  </View>
                </View>
                <Text style={styles.ringTargetGoalText}>Goal: {targetBurned} cal</Text>
              </View>
            </View>

            {/* Net Energy Summary Row */}
            <View style={styles.netEnergyBanner}>
              <Ionicons name="flash-outline" size={14} color={Colors.dark.primary} />
              <Text style={styles.netEnergyText}>
                Net Energy: <Text style={{ color: Colors.dark.text, fontWeight: "bold" }}>{netCalories} cal</Text> ({consumedCalories} Eaten - {burnedCalories} Burned)
              </Text>
            </View>

            {/* Calorie Fulfillment & Overage Warnings */}
            {consumedCalories >= targetCalories && targetCalories > 0 && (
              <View style={styles.calorieStatusContainer}>
                {/* Fulfilled Message Line */}
                <View style={styles.calorieFulfilledBanner}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.dark.primary} />
                  <Text style={styles.calorieFulfilledText}>Daily Calorie Goal Fulfilled! 🎉</Text>
                </View>

                {/* Extra Calorie Warning Line & Calorie Count in Red Color Below */}
                {consumedCalories > targetCalories && (
                  <View style={styles.calorieWarningBanner}>
                    <View style={styles.calorieWarningHeader}>
                      <Ionicons name="warning-sharp" size={15} color="#EF4444" />
                      <Text style={styles.calorieWarningText}>Warning: Extra calories consumed after target!</Text>
                    </View>
                    <View style={styles.calorieExtraBadge}>
                      <Text style={styles.calorieExtraBadgeText}>
                        +{Math.round(consumedCalories - targetCalories)} cal extra
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.macrosVerticalContainer}>
              {/* Protein */}
              <View style={[styles.macroVerticalCard, styles.proteinVerticalCard]}>
                <View style={styles.macroVerticalHeader}>
                  <View style={styles.macroTitleRow}>
                    <Text style={[styles.macroVerticalName, styles.proteinText]}>Protein</Text>
                    <Text style={[styles.macroVerticalPercent, { color: getMacroBarColor(proteinPercent) }]}>{proteinPercentageText}%</Text>
                  </View>
                  <Text style={styles.macroVerticalRatio}>
                    {consumedProtein}g / <Text style={{ fontWeight: "bold" }}>{targetProtein}g</Text>
                  </Text>
                </View>
                <View style={styles.macroProgressTrack}>
                  <View style={[styles.macroProgressBar, { width: `${Math.min(100, Math.round(proteinPercent * 100))}%`, backgroundColor: getMacroBarColor(proteinPercent) }]} />
                </View>
                {consumedProtein >= targetProtein && targetProtein > 0 && (
                  <View style={styles.macroFooterRow}>
                    <Text style={styles.fulfilledText}>Fulfilled daily required 🎉</Text>
                    {consumedProtein > targetProtein && (
                      <View style={styles.overageBadge}>
                        <Text style={styles.overageBadgeText}>+{Math.round(consumedProtein - targetProtein)}g</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Carbs */}
              <View style={[styles.macroVerticalCard, styles.proteinVerticalCard]}>
                <View style={styles.macroVerticalHeader}>
                  <View style={styles.macroTitleRow}>
                    <Text style={[styles.macroVerticalName, styles.proteinText]}>Carbs</Text>
                    <Text style={[styles.macroVerticalPercent, { color: getMacroBarColor(carbsPercent) }]}>{carbsPercentageText}%</Text>
                  </View>
                  <Text style={styles.macroVerticalRatio}>
                    {consumedCarbs}g / <Text style={{ fontWeight: "bold" }}>{targetCarbs}g</Text>
                  </Text>
                </View>
                <View style={styles.macroProgressTrack}>
                  <View style={[styles.macroProgressBar, { width: `${Math.min(100, Math.round(carbsPercent * 100))}%`, backgroundColor: getMacroBarColor(carbsPercent) }]} />
                </View>
                {consumedCarbs >= targetCarbs && targetCarbs > 0 && (
                  <View style={styles.macroFooterRow}>
                    <Text style={styles.fulfilledText}>Fulfilled daily required 🎉</Text>
                    {consumedCarbs > targetCarbs && (
                      <View style={styles.overageBadge}>
                        <Text style={styles.overageBadgeText}>+{Math.round(consumedCarbs - targetCarbs)}g</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Fats */}
              <View style={[styles.macroVerticalCard, styles.proteinVerticalCard]}>
                <View style={styles.macroVerticalHeader}>
                  <View style={styles.macroTitleRow}>
                    <Text style={[styles.macroVerticalName, styles.proteinText]}>Fats</Text>
                    <Text style={[styles.macroVerticalPercent, { color: getMacroBarColor(fatsPercent) }]}>{fatsPercentageText}%</Text>
                  </View>
                  <Text style={styles.macroVerticalRatio}>
                    {consumedFats}g / <Text style={{ fontWeight: "bold" }}>{targetFats}g</Text>
                  </Text>
                </View>
                <View style={styles.macroProgressTrack}>
                  <View style={[styles.macroProgressBar, { width: `${Math.min(100, Math.round(fatsPercent * 100))}%`, backgroundColor: getMacroBarColor(fatsPercent) }]} />
                </View>
                {consumedFats >= targetFats && targetFats > 0 && (
                  <View style={styles.macroFooterRow}>
                    <Text style={styles.fulfilledText}>Fulfilled daily required 🎉</Text>
                    {consumedFats > targetFats && (
                      <View style={styles.overageBadge}>
                        <Text style={styles.overageBadgeText}>+{Math.round(consumedFats - targetFats)}g</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Water Intake Card */}
          <View style={styles.glassCard}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Water</Text>
              <View style={styles.waterHeaderActions}>
                <TouchableOpacity
                  style={styles.waterQuickAddBtn}
                  onPress={handleQuickAddWater}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={14} color={Colors.dark.primary} />
                  <Text style={styles.waterQuickAddText}>+250ml</Text>
                </TouchableOpacity>


              </View>
            </View>

            {/* Recommended Daily Water Target Banner */}
            <View style={styles.waterTargetBanner}>
              <View style={styles.waterTargetIconFrame}>
                <Ionicons name="water" size={18} color="#3B82F6" />
              </View>
              <View style={styles.waterTargetTextContainer}>
                <Text style={styles.waterTargetValue}>{targetWater} Liters ({targetGlasses} Glasses)</Text>
                <Text style={styles.waterTargetLabel}>Daily Adult Water Target</Text>
              </View>
            </View>

            {/* Glasses Grid in Vertical Scrollable Container (16 visible at a time) */}
            <View style={styles.waterScrollWrapper}>
              <ScrollView
                style={styles.waterGridScroll}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={totalGlassesToRender > 16}
                contentContainerStyle={styles.waterGridContent}
              >
                {glassRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.waterGridRow}>
                    {row.map((glassIndex) => {
                      if (glassIndex >= totalGlassesToRender) {
                        return <View key={`placeholder-${glassIndex}`} style={styles.glassPlaceholder} />;
                      }
                      const isFull = consumedGlasses >= glassIndex + 1;
                      const isHalf = !isFull && consumedGlasses >= glassIndex + 0.5;

                      return (
                        <TouchableOpacity
                          key={glassIndex}
                          onPress={handleQuickAddWater}
                          activeOpacity={0.8}
                          style={styles.glassTouch}
                        >
                          <Image
                            source={
                              isFull
                                ? require("../../assets/images/full_glass.png")
                                : isHalf
                                  ? require("../../assets/images/half_glass.png")
                                  : require("../../assets/images/empty_glass.png")
                            }
                            style={styles.waterGlassImage}
                            resizeMode="contain"
                          />
                          <Text style={styles.waterGlassNumber}>{glassIndex + 1}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>

            {totalGlassesToRender > 16 && (
              <Text style={styles.scrollNoticeText}>Scroll vertically for more glasses ↓</Text>
            )}

            {/* Status text */}
            <View style={styles.waterFooter}>
              {glassesLeft > 0 ? (
                <Text style={styles.waterFooterText}>
                  {glassesLeft.toFixed(1).replace(".0", "")} {glassesLeft === 1 ? "glass" : "glasses"} of water left
                </Text>
              ) : (
                <Text style={[styles.waterFooterText, { color: Colors.dark.primary, fontWeight: "700" }]}>
                  Goal reached! Logged {consumedGlasses.toFixed(1).replace(".0", "")} glasses. 🎉
                </Text>
              )}
            </View>
          </View>



          {/* AI Daily Advice & Insights */}
          {aiAdvice ? (
            <>
              <Text style={styles.sectionTitle}>AI Coach Insight</Text>
              <View style={styles.insightsContainer}>
                <View style={styles.adviceCard}>
                  <View style={styles.adviceHeader}>
                    <Ionicons name="sparkles" size={16} color={Colors.dark.primary} />
                    <Text style={styles.adviceTitle}>AI COACH INSIGHT</Text>
                  </View>
                  <Text style={styles.adviceText}>{aiAdvice}</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* Daily Logs List */}
          <Text style={styles.sectionTitle}>
            {selectedDateId === getTodayDateString() ? "Today's Logs" : "Logs for this day"}
          </Text>
          <View style={styles.mealsContainer}>
            {isLoadingLogs ? (
              <ActivityIndicator color={Colors.dark.primary} style={{ marginVertical: 20 }} />
            ) : logs.length === 0 ? (
              <View style={styles.emptyLogsCard}>
                <Ionicons name="clipboard-outline" size={32} color={Colors.dark.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyLogsText}>No logs recorded for this date.</Text>
                <Text style={styles.emptyLogsSubtext}>{"Tap the floating \"+\" button to add meals or activities."}</Text>
              </View>
            ) : (
              logs.map((log) => {
                if (log.type === "meal") {
                  return (
                    <View key={log.id} style={styles.workoutCard}>
                      {/* Big Icon on Left */}
                      <View style={[styles.workoutIconFrame, { backgroundColor: "rgba(41, 143, 80, 0.08)", borderColor: "rgba(41, 143, 80, 0.15)", borderWidth: 1 }]}>
                        <Ionicons name="restaurant-outline" size={24} color="#298F50" />
                      </View>

                      {/* Content on Right of Icon */}
                      <View style={styles.workoutDetails}>
                        {/* Title */}
                        <Text style={styles.workoutTitle} numberOfLines={1}>
                          Food: {log.title}
                        </Text>

                        {/* Calories Row in Eaten Circle Color (#10B981) */}
                        <View style={styles.workoutCalRow}>
                          <Ionicons name="flame" size={14} color="#10B981" />
                          <Text style={[styles.workoutCalText, { color: "#10B981" }]}>{log.calories} Cals</Text>
                        </View>

                        {/* Metadata row with serving size and macronutrients */}
                        <Text style={styles.workoutMetaText} numberOfLines={1}>
                          {log.servingSize ? `${log.servingSize} • ` : ""}P: {log.protein || 0}g • C: {log.carbs || 0}g • F: {log.fats || 0}g
                        </Text>
                      </View>

                      {/* Log Time at top right corner */}
                      <Text style={styles.workoutTimeText}>
                        {formatLogTime(log.createdAt)}
                      </Text>

                      {/* Delete button positioned nicely */}
                      {!isPastDate && (
                        <TouchableOpacity
                          onPress={() => handleDeleteLog(log.id, log.title)}
                          style={styles.workoutDeleteBtn}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={12} color={Colors.dark.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                } else if (log.type === "workout") {
                  // Determine icon details based on exercise type (workoutType)
                  let iconName: keyof typeof Ionicons.glyphMap = "fitness-outline";
                  let iconColor = "#EF4444"; // default manual flame
                  let iconBg = "rgba(239, 68, 68, 0.08)";
                  let iconBorder = "rgba(239, 68, 68, 0.15)";
                  let typeLabel = "Workout";

                  // Support custom manual string class checks as fallback
                  const wType = log.workoutType || (log.title.toLowerCase().includes("run") || log.title.toLowerCase().includes("cardio") ? "cardio" : log.title.toLowerCase().includes("lift") || log.title.toLowerCase().includes("weight") ? "lifting" : "manual");

                  if (wType === "cardio") {
                    iconName = "walk-outline";
                    iconColor = "#3B82F6";
                    iconBg = "rgba(59, 130, 246, 0.08)";
                    iconBorder = "rgba(59, 130, 246, 0.15)";
                    typeLabel = "Cardio";
                  } else if (wType === "lifting") {
                    iconName = "barbell-outline";
                    iconColor = "#10B981";
                    iconBg = "rgba(16, 185, 129, 0.08)";
                    iconBorder = "rgba(16, 185, 129, 0.15)";
                    typeLabel = "Weight Lifting";
                  }

                  const intensityLabel = log.intensity
                    ? `${log.intensity.charAt(0).toUpperCase() + log.intensity.slice(1)} Intensity`
                    : "Medium Intensity";

                  const durationLabel = log.duration ? `${log.duration} mins` : "";

                  return (
                    <View key={log.id} style={styles.workoutCard}>
                      {/* Big Icon on Left */}
                      <View style={[styles.workoutIconFrame, { backgroundColor: iconBg, borderColor: iconBorder, borderWidth: 1 }]}>
                        <Ionicons name={iconName} size={24} color={iconColor} />
                      </View>

                      {/* Content on Right of Icon */}
                      <View style={styles.workoutDetails}>
                        {/* Exercise Name */}
                        <Text style={styles.workoutTitle} numberOfLines={1}>
                          {log.title}
                        </Text>

                        {/* Flame Icon & Calorie Burn in Active Burned Circle Color (#F59E0B) */}
                        <View style={styles.workoutCalRow}>
                          <Ionicons name="flame" size={14} color="#F59E0B" />
                          <Text style={[styles.workoutCalText, { color: "#F59E0B" }]}>{log.calories} Cals</Text>
                        </View>

                        {/* Intensity with Type and Duration */}
                        <Text style={styles.workoutMetaText} numberOfLines={1}>
                          {intensityLabel} • {typeLabel} {durationLabel ? `• ${durationLabel}` : ""}
                        </Text>
                      </View>

                      {/* Log Time at top right corner */}
                      <Text style={styles.workoutTimeText}>
                        {formatLogTime(log.createdAt)}
                      </Text>

                      {/* Delete button positioned nicely */}
                      {!isPastDate && (
                        <TouchableOpacity
                          onPress={() => handleDeleteLog(log.id, log.title)}
                          style={styles.workoutDeleteBtn}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={12} color={Colors.dark.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                } else if (log.type === "water") {
                  return (
                    <View key={log.id} style={styles.workoutCard}>
                      {/* Big Icon on Left */}
                      <View style={[styles.workoutIconFrame, { backgroundColor: "rgba(59, 130, 246, 0.08)", borderColor: "rgba(59, 130, 246, 0.15)", borderWidth: 1 }]}>
                        <Ionicons name="water" size={24} color="#3B82F6" />
                      </View>

                      {/* Content on Right of Icon */}
                      <View style={styles.workoutDetails}>
                        {/* Title */}
                        <Text style={styles.workoutTitle} numberOfLines={1}>
                          Water Intake
                        </Text>

                        {/* Volume Row */}
                        <View style={styles.workoutCalRow}>
                          <Ionicons name="water" size={14} color="#3B82F6" />
                          <Text style={[styles.workoutCalText, { color: "#3B82F6" }]}>
                            {(log.amount * 1000).toFixed(0)} ml
                          </Text>
                        </View>

                        {/* Metadata row */}
                        <Text style={styles.workoutMetaText} numberOfLines={1}>
                          Hydration Log • {log.amount} L
                        </Text>
                      </View>

                      {/* Log Time at top right corner */}
                      <Text style={styles.workoutTimeText}>
                        {formatLogTime(log.createdAt)}
                      </Text>

                      {/* Delete button positioned nicely */}
                      {!isPastDate && (
                        <TouchableOpacity
                          onPress={() => handleDeleteLog(log.id, "Water Intake")}
                          style={styles.workoutDeleteBtn}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={12} color={Colors.dark.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }
                return null;
              })
            )}
          </View>

          {/* Visual buffer */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Target Editor Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Targets</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {modalError ? <Text style={styles.modalErrorText}>{modalError}</Text> : null}

              {/* Auto-Calculate Action Banner */}
              <TouchableOpacity
                style={[styles.autoCalcBanner, isAutoCalculating && { opacity: 0.7 }]}
                onPress={handleAutoCalculateTargets}
                disabled={isAutoCalculating}
                activeOpacity={0.8}
              >
                <View style={styles.autoCalcIconFrame}>
                  {isAutoCalculating ? (
                    <ActivityIndicator size="small" color="#298F50" />
                  ) : (
                    <Ionicons name="calculator-sharp" size={18} color="#298F50" />
                  )}
                </View>
                <View style={styles.autoCalcTextFrame}>
                  <Text style={styles.autoCalcTitle}>
                    {isAutoCalculating ? "Recalculating Targets..." : "Auto-Calculate Target"}
                  </Text>
                  <Text style={styles.autoCalcSubtitle}>
                    {isAutoCalculating
                      ? "Refreshing BMR & macronutrient values..."
                      : `Recompute BMR & TDEE from ${profileStats?.height || "Height"}, ${profileStats?.weight || "Weight"} & Goal`}
                  </Text>
                </View>
                {isAutoCalculating ? (
                  <ActivityIndicator size="small" color="#298F50" />
                ) : (
                  <Ionicons name="refresh-sharp" size={16} color="#298F50" />
                )}
              </TouchableOpacity>

              {/* Calories Target Row */}
              <View style={styles.modalFormItem}>
                <View style={styles.modalLabelRow}>
                  <Ionicons name="flame" size={16} color="#F59E0B" />
                  <Text style={styles.modalLabel}>Calories Target (cal)</Text>
                </View>
                <TextInput
                  style={styles.modalInput}
                  value={editCalories}
                  onChangeText={setEditCalories}
                  keyboardType="numeric"
                  placeholder="e.g. 2000"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                />
              </View>

              {/* Protein Target Row */}
              <View style={styles.modalFormItem}>
                <View style={styles.modalLabelRow}>
                  <Ionicons name="barbell" size={16} color="#A78BFA" />
                  <Text style={styles.modalLabel}>Protein Target (g)</Text>
                </View>
                <TextInput
                  style={styles.modalInput}
                  value={editProtein}
                  onChangeText={setEditProtein}
                  keyboardType="numeric"
                  placeholder="e.g. 150"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                />
              </View>

              {/* Carbs Target Row */}
              <View style={styles.modalFormItem}>
                <View style={styles.modalLabelRow}>
                  <Ionicons name="nutrition" size={16} color="#60A5FA" />
                  <Text style={styles.modalLabel}>Carbs Target (g)</Text>
                </View>
                <TextInput
                  style={styles.modalInput}
                  value={editCarbs}
                  onChangeText={setEditCarbs}
                  keyboardType="numeric"
                  placeholder="e.g. 200"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                />
              </View>

              {/* Fats Target Row */}
              <View style={styles.modalFormItem}>
                <View style={styles.modalLabelRow}>
                  <Ionicons name="egg-outline" size={16} color="#F87171" />
                  <Text style={styles.modalLabel}>Fats Target (g)</Text>
                </View>
                <TextInput
                  style={styles.modalInput}
                  value={editFats}
                  onChangeText={setEditFats}
                  keyboardType="numeric"
                  placeholder="e.g. 70"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                />
              </View>

              {/* Water Target Row */}
              <View style={styles.modalFormItem}>
                <View style={styles.modalLabelRow}>
                  <Ionicons name="water" size={16} color="#60A5FA" />
                  <Text style={styles.modalLabel}>Water Target (Liters)</Text>
                </View>
                <TextInput
                  style={styles.modalInput}
                  value={editWater}
                  onChangeText={setEditWater}
                  keyboardType="numeric"
                  placeholder="e.g. 3.0"
                  placeholderTextColor="rgba(255, 255, 255, 0.2)"
                />
              </View>

              {/* Modal Save Buttons */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn]}
                  onPress={() => setIsEditModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, isSavingTargets && styles.modalSaveBtnDisabled]}
                  onPress={handleSaveTargets}
                  disabled={isSavingTargets}
                  activeOpacity={0.8}
                >
                  {isSavingTargets ? (
                    <ActivityIndicator color={Colors.dark.white} size="small" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Save Targets</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Premium Delete Confirmation Modal */}
      <Modal
        visible={!!deleteTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <TouchableOpacity
          style={styles.deleteModalOverlay}
          activeOpacity={1}
          onPress={() => setDeleteTarget(null)}
        >
          <TouchableOpacity style={styles.deleteModalCard} activeOpacity={1}>
            {/* Trash Icon Badge */}
            <View style={styles.deleteIconBadge}>
              <Ionicons name="trash-bin-sharp" size={32} color="#EF4444" />
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.deleteModalTitle}>Delete Log Entry?</Text>
            <Text style={styles.deleteModalSubtitle}>
              Are you sure you want to delete this item? This action cannot be undone.
            </Text>

            {/* Target Item Name Pill */}
            {deleteTarget && (
              <View style={styles.deleteItemPill}>
                <Ionicons name="pricetag-outline" size={14} color="#EF4444" />
                <Text style={styles.deleteItemText} numberOfLines={1}>
                  {deleteTarget.title}
                </Text>
              </View>
            )}

            {/* Action Buttons Row */}
            <View style={styles.deleteModalBtnRow}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setDeleteTarget(null)}
                activeOpacity={0.7}
                disabled={isDeletingLog}
              >
                <Text style={styles.deleteCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={confirmDeleteLog}
                activeOpacity={0.8}
                disabled={isDeletingLog}
              >
                {isDeletingLog ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.deleteConfirmBtnText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeHeader: {
    backgroundColor: Colors.dark.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  mainContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  glassCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  waterTargetBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    borderRadius: 16,
    padding: 12,
    width: "100%",
    marginBottom: 20,
  },
  waterTargetIconFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  waterTargetTextContainer: {
    flex: 1,
  },
  waterTargetValue: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "700",
  },
  waterTargetLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  cardTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "700",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.15)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  editButtonText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  ringContainer: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 20,
  },
  ringSvg: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  ringInfo: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  remainingNumber: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "bold",
  },
  remainingLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  remainingPercent: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 16,
  },
  ringStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  statCol: {
    alignItems: "center",
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  statLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    marginTop: 8,
  },
  macrosVerticalContainer: {
    width: "100%",
    marginTop: 8,
    gap: 12,
  },
  macroVerticalCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: "center",
  },
  proteinVerticalCard: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  carbsVerticalCard: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    borderColor: "rgba(59, 130, 246, 0.15)",
  },
  fatsVerticalCard: {
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderColor: "rgba(239, 68, 68, 0.15)",
  },
  macroVerticalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  macroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  macroVerticalName: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  macroVerticalPercent: {
    fontSize: 12,
    fontWeight: "600",
  },
  proteinText: {
    color: "#A78BFA",
  },
  carbsText: {
    color: "#60A5FA",
  },
  fatsText: {
    color: "#F87171",
  },
  macroProgressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  macroProgressBar: {
    height: "100%",
    borderRadius: 3,
  },
  macroVerticalRatio: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: "600",
  },
  mealsContainer: {
    marginBottom: 20,
  },
  mealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
  },
  mealInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  mealIconFrame: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  mealName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600",
  },
  mealSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  workoutCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
    position: "relative",
  },
  workoutIconFrame: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  workoutDetails: {
    flex: 1,
    justifyContent: "center",
  },
  workoutTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    paddingRight: 64, // Leaves space for the top-right log time
  },
  workoutCalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  workoutCalText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  workoutMetaText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  workoutTimeText: {
    position: "absolute",
    top: 16,
    right: 16,
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  workoutDeleteBtn: {
    position: "absolute",
    bottom: 12,
    right: 16,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.12)",
  },
  insightsContainer: {
    flexDirection: "column",
    gap: 16,
    marginBottom: 24,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 16,
  },
  insightIconFrame: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  insightTextContainer: {
    flex: 1,
  },
  insightValue: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  insightLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  adviceCard: {
    backgroundColor: "rgba(41, 143, 80, 0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.1)",
    padding: 18,
  },
  adviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  adviceTitle: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  adviceText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyLogsCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  emptyLogsText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyLogsSubtext: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  logActionCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logCaloriesVal: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "700",
  },
  deleteLogBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.12)",
  },
  waterHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  waterQuickAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.15)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  waterQuickAddText: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  waterGrid: {
    width: "100%",
    gap: 12,
    marginVertical: 12,
    paddingHorizontal: 2,
  },
  waterGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    width: "100%",
  },
  glassTouch: {
    flex: 1,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  glassPlaceholder: {
    flex: 1,
    height: 52,
  },
  waterGlassImage: {
    width: "100%",
    height: 34,
  },
  waterGlassNumber: {
    fontSize: 9,
    color: Colors.dark.textSecondary,
    fontWeight: "600",
  },
  waterFooter: {
    width: "100%",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
    paddingTop: 12,
  },
  waterFooterText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    padding: 24,
    width: "90%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    paddingBottom: 12,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  modalErrorText: {
    color: Colors.dark.error,
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  modalFormItem: {
    marginBottom: 16,
    gap: 8,
  },
  modalLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  modalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: Colors.dark.text,
    fontSize: 15,
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
    marginBottom: 4,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelBtnText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  modalSaveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalSaveBtnDisabled: {
    opacity: 0.5,
  },
  modalSaveBtnText: {
    color: Colors.dark.white,
    fontSize: 14,
    fontWeight: "bold",
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  deleteModalCard: {
    width: "100%",
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  deleteIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  deleteModalTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  deleteModalSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  deleteItemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
    width: "100%",
    justifyContent: "center",
  },
  deleteItemText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  deleteModalBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  deleteCancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelBtnText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  deleteConfirmBtn: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteConfirmBtnText: {
    color: Colors.dark.white,
    fontSize: 15,
    fontWeight: "bold",
  },
  bmrNoticeTag: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  bmrNoticeText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    lineHeight: 16,
  },
  autoCalcBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.2)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  autoCalcIconFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(41, 143, 80, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  autoCalcTextFrame: {
    flex: 1,
  },
  autoCalcTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "bold",
  },
  autoCalcSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  waterScrollWrapper: {
    maxHeight: 116,
    width: "100%",
    marginVertical: 10,
  },
  waterGridScroll: {
    maxHeight: 116,
    width: "100%",
  },
  waterGridContent: {
    gap: 12,
    paddingVertical: 0,
  },
  scrollNoticeText: {
    color: "#3B82F6",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  macroFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  fulfilledText: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  overageBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overageBadgeText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "700",
  },
  calorieStatusContainer: {
    width: "100%",
    marginTop: 12,
    gap: 8,
  },
  calorieFulfilledBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.2)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: "100%",
  },
  calorieFulfilledText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  calorieWarningBanner: {
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: "100%",
  },
  calorieWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  calorieWarningText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  calorieExtraBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  calorieExtraBadgeText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "bold",
  },
  dualRingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    gap: 12,
    marginVertical: 8,
  },
  ringCardItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  ringCardHeaderTitle: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  ringSvgWrapper: {
    width: 115,
    height: 115,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  ringInnerInfo: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  ringNumberVal: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 2,
  },
  ringSubLabel: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontWeight: "500",
  },
  ringPercentLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  ringTargetGoalText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
  },
  netEnergyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: "100%",
    marginTop: 8,
  },
  netEnergyText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
});
