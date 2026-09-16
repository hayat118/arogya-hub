import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "../../constants/Colors";
import { db, updateUserProfile } from "../../services/firebase";
import {
  BentoGridData,
  calculateFallbackBentoGrid,
  generateBentoGridInsights,
} from "../../services/gemini";

interface LogItem {
  id: string;
  type: "meal" | "workout" | "water";
  createdAt?: any;
  dateStr?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  amount?: number;
}

interface DayStreakInfo {
  dayLabel: string;
  dateStr: string;
  isToday: boolean;
  hasActivity: boolean;
}

export default function Analytics() {
  const { user } = useUser();

  // Profile stats state
  const [profileWeight, setProfileWeight] = useState<string>("70");
  const [profileGoal, setProfileGoal] = useState<string>("Maintain Weight");
  const [targetWeight, setTargetWeight] = useState<string>("65");
  const [isEditWeightModalVisible, setIsEditWeightModalVisible] = useState(false);
  const [newWeightInput, setNewWeightInput] = useState("");
  const [newTargetWeightInput, setNewTargetWeightInput] = useState("");
  const [selectedGoalInput, setSelectedGoalInput] = useState<string>("Maintain Weight");
  const [isSavingWeight, setIsSavingWeight] = useState(false);

  // Daily Streak Modal state
  const [isStreakModalVisible, setIsStreakModalVisible] = useState(false);

  // Calorie Bar Chart tab state ("burned" | "consumed") & Independent Week Offsets
  const [calorieChartMode, setCalorieChartMode] = useState<"burned" | "consumed">("consumed");
  const [calorieWeekOffset, setCalorieWeekOffset] = useState<number>(0);
  const [waterWeekOffset, setWaterWeekOffset] = useState<number>(0);
  const screenWidth = Dimensions.get("window").width;

  // Week streak data state
  const [weekDays, setWeekDays] = useState<DayStreakInfo[]>([]);
  const [currentStreakCount, setCurrentStreakCount] = useState<number>(0);
  const [weeklyLogs, setWeeklyLogs] = useState<LogItem[]>([]);

  // Bento Grid AI state
  const [bentoData, setBentoData] = useState<BentoGridData | null>(null);
  const [isBentoLoading, setIsBentoLoading] = useState<boolean>(false);

  // Helper to format date YYYY-MM-DD
  const formatDateStr = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper to normalize any date input (string, Timestamp, Date object, or epoch) to YYYY-MM-DD
  const normalizeDateStr = (raw: any): string => {
    if (!raw) return "";
    if (typeof raw === "string") {
      const cleaned = raw.split("T")[0].split(" ")[0];
      const parts = cleaned.split("-");
      if (parts.length === 3) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, "0");
        const dd = parts[2].padStart(2, "0");
        if (yyyy.length === 4 && !isNaN(Number(yyyy)) && !isNaN(Number(mm)) && !isNaN(Number(dd))) {
          return `${yyyy}-${mm}-${dd}`;
        }
      }
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return formatDateStr(d);
    } else if (raw && typeof raw.toDate === "function") {
      return formatDateStr(raw.toDate());
    } else if (raw && typeof raw === "object" && "seconds" in raw) {
      return formatDateStr(new Date(raw.seconds * 1000));
    } else if (raw instanceof Date) {
      return formatDateStr(raw);
    } else if (typeof raw === "number") {
      return formatDateStr(new Date(raw));
    }
    return "";
  };

  // Target weight editability rule
  const isTargetEditable = selectedGoalInput === "Gain Weight" || selectedGoalInput === "Lose Weight";

  // Handle current weight input change
  const handleWeightInputChange = (val: string) => {
    setNewWeightInput(val);
    if (selectedGoalInput === "Maintain Weight") {
      setNewTargetWeightInput(val);
    }
  };

  // Handle goal selection change
  const handleGoalSelect = (val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setSelectedGoalInput(val);
    if (val === "Maintain Weight") {
      setNewTargetWeightInput(newWeightInput || profileWeight);
    }
  };

  // Open Weight & Goal Modal
  const handleOpenWeightModal = () => {
    setNewWeightInput(profileWeight);
    const initialGoal = profileGoal || "Maintain Weight";
    setSelectedGoalInput(initialGoal);
    if (initialGoal === "Maintain Weight") {
      setNewTargetWeightInput(profileWeight);
    } else {
      setNewTargetWeightInput(targetWeight || profileWeight);
    }
    setIsEditWeightModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  };

  // 1. Fetch user weight, goal & target from profile
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      // Check local storage fallback first for immediate synchronization
      const cachedOnboarding =
        (await AsyncStorage.getItem(`onboarding_data_${user.id}`)) ||
        (await AsyncStorage.getItem("onboarding_data"));
      if (cachedOnboarding) {
        const parsed = JSON.parse(cachedOnboarding);
        if (parsed.weight !== undefined) setProfileWeight(String(parsed.weight));
        if (parsed.targetWeight !== undefined) setTargetWeight(String(parsed.targetWeight));
        if (parsed.goal) setProfileGoal(String(parsed.goal));
      }

      // Check Firestore document
      const userDocRef = doc(db, "users", user.id);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.weight !== undefined) setProfileWeight(String(data.weight));
        if (data.targetWeight !== undefined) setTargetWeight(String(data.targetWeight));
        if (data.goal) setProfileGoal(String(data.goal));
      }
    } catch (err) {
      console.error("Error loading analytics profile weight & goal:", err);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  // 2. Compute current week dates (Mon - Sun) and listen to Firebase logs
  useEffect(() => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateStr(today);
    const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // Calculate Monday (start of week)
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const weekDates: DayStreakInfo[] = [];
    const labels = ["M", "T", "W", "T", "F", "S", "S"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = formatDateStr(d);
      weekDates.push({
        dayLabel: labels[i],
        dateStr: dStr,
        isToday: dStr === todayStr,
        hasActivity: false,
      });
    }

    // Set initial week dates so UI renders immediately
    setWeekDays(weekDates);

    const processLogsAndSetState = (logsArray: LogItem[]) => {
      const activeDatesSet = new Set<string>();
      logsArray.forEach((l) => {
        const norm = normalizeDateStr(l.dateStr);
        if (norm) {
          activeDatesSet.add(norm);
        }
      });

      // Update active status for each day of the current week
      const updatedWeek = weekDates.map((day) => ({
        ...day,
        hasActivity: activeDatesSet.has(day.dateStr),
      }));

      setWeekDays(updatedWeek);
      setWeeklyLogs(logsArray);

      // Calculate streak days count matching current week active days
      const currentWeekActiveCount = updatedWeek.filter((day) => day.hasActivity).length;
      setCurrentStreakCount(currentWeekActiveCount);
    };

    // Subscribe to Firebase logs collection for this user
    const logsRef = collection(db, "users", user.id, "logs");
    const unsub = onSnapshot(
      logsRef,
      (snapshot) => {
        const fetchedLogs: LogItem[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const dStr = normalizeDateStr(data.dateStr || data.date || data.createdAt);

          if (dStr) {
            fetchedLogs.push({
              id: docSnap.id,
              type: data.type,
              dateStr: dStr,
              calories: data.calories || 0,
              protein: data.protein || 0,
              carbs: data.carbs || 0,
              fats: data.fats || 0,
              amount: data.amount || 0,
            });
          }
        });

        // Persist to local cache for offline resilience
        AsyncStorage.setItem(`user_logs_${user.id}`, JSON.stringify(fetchedLogs)).catch(() => { });
        processLogsAndSetState(fetchedLogs);
      },
      (err) => {
        console.error("Firebase analytics logs listener error:", err);
        // Fallback to local storage if Firestore permissions or network fail
        AsyncStorage.getItem(`user_logs_${user.id}`)
          .then((stored) => {
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                processLogsAndSetState(parsed);
              } catch (e) { }
            }
          })
          .catch(() => { });
      }
    );

    return () => unsub();
  }, [user]);

  // Handle Save Weight, Target Weight & Goal Update
  const handleSaveWeight = async () => {
    const numericVal = Number(newWeightInput);
    const numericTargetVal = isTargetEditable ? Number(newTargetWeightInput) : numericVal;

    if (!user || isNaN(numericVal)) return;

    if (isTargetEditable) {
      if (isNaN(numericTargetVal)) return;
      if (selectedGoalInput === "Lose Weight" && numericTargetVal >= numericVal) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
        return;
      }
      if (selectedGoalInput === "Gain Weight" && numericTargetVal <= numericVal) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
        return;
      }
    }

    try {
      setIsSavingWeight(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

      const numericVal = Number(newWeightInput);
      const numericTargetVal = isTargetEditable ? Number(newTargetWeightInput) : numericVal;

      setProfileWeight(String(numericVal));
      setTargetWeight(String(numericTargetVal));
      setProfileGoal(selectedGoalInput);

      // Update Firestore user profile
      await updateUserProfile(user.id, {
        weight: numericVal,
        targetWeight: numericTargetVal,
        goal: selectedGoalInput,
      });

      // Sync local AsyncStorage so Profile & Home tabs stay in sync
      try {
        const key = `onboarding_data_${user.id}`;
        const stored = await AsyncStorage.getItem(key);
        let parsed = stored ? JSON.parse(stored) : {};
        parsed.weight = numericVal;
        parsed.targetWeight = numericTargetVal;
        parsed.goal = selectedGoalInput;
        await AsyncStorage.setItem(key, JSON.stringify(parsed));
        await AsyncStorage.setItem("onboarding_data", JSON.stringify(parsed));
      } catch (e) {
        console.error("Error updating local AsyncStorage onboarding data:", e);
      }

      setIsEditWeightModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    } catch (err) {
      console.error("Error updating weight & goal:", err);
    } finally {
      setIsSavingWeight(false);
    }
  };

  // Helper to compute dates & labels for the selected week offset (0 = Current Week, -1 = Last Week...)
  const getSelectedWeekDetails = (offset: number) => {
    const today = new Date();
    const todayStr = formatDateStr(today);
    const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // Calculate Monday for target week offset (Mon - Sun)
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday + offset * 7);

    const weekDates: DayStreakInfo[] = [];
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = formatDateStr(d);
      weekDates.push({
        dayLabel: labels[i],
        dateStr: dStr,
        isToday: dStr === todayStr,
        hasActivity: false,
      });
    }

    const sundayEnd = new Date(monday);
    sundayEnd.setDate(monday.getDate() + 6);

    const startMonth = monday.toLocaleString("en-US", { month: "short" });
    const startDay = monday.getDate();
    const endMonth = sundayEnd.toLocaleString("en-US", { month: "short" });
    const endDay = sundayEnd.getDate();

    let rangeStr = `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
    if (startMonth === endMonth) {
      rangeStr = `${startMonth} ${startDay} – ${endDay}`;
    }

    let titleStr = "Current Week";
    if (offset === -1) {
      titleStr = "Last Week";
    } else if (offset < -1) {
      titleStr = `${Math.abs(offset)} Weeks Ago`;
    }

    return {
      selectedWeekDays: weekDates,
      rangeStr,
      titleStr,
    };
  };

  // Calorie Section Independent Week Navigation & Gesture
  const calorieWeekDetails = getSelectedWeekDetails(calorieWeekOffset);
  const calorieWeekDays = calorieWeekDetails.selectedWeekDays;

  const handleCaloriePrevWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setCalorieWeekOffset((prev) => prev - 1);
  };

  const handleCalorieNextWeek = () => {
    if (calorieWeekOffset >= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setCalorieWeekOffset((prev) => Math.min(0, prev + 1));
  };

  const handleCalorieResetWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    setCalorieWeekOffset(0);
  };

  const caloriePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 35 && Math.abs(gestureState.dy) < 30;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 40) {
            handleCaloriePrevWeek();
          } else if (gestureState.dx < -40) {
            handleCalorieNextWeek();
          }
        },
      }),
    [calorieWeekOffset]
  );

  // Water Section Independent Week Navigation & Gesture
  const waterWeekDetails = getSelectedWeekDetails(waterWeekOffset);
  const waterWeekDays = waterWeekDetails.selectedWeekDays;

  const handleWaterPrevWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setWaterWeekOffset((prev) => prev - 1);
  };

  const handleWaterNextWeek = () => {
    if (waterWeekOffset >= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setWaterWeekOffset((prev) => Math.min(0, prev + 1));
  };

  const handleWaterResetWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    setWaterWeekOffset(0);
  };

  const waterPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 35 && Math.abs(gestureState.dy) < 30;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 40) {
            handleWaterPrevWeek();
          } else if (gestureState.dx < -40) {
            handleWaterNextWeek();
          }
        },
      }),
    [waterWeekOffset]
  );

  // Calculate 7-day daily arrays for Calorie Section (Mon - Sun)
  const chartDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const dailyBurnedCals = calorieWeekDays.map((day) => {
    return weeklyLogs
      .filter((l) => l.type === "workout" && l.dateStr === day.dateStr)
      .reduce((sum, l) => sum + (l.calories || 0), 0);
  });

  const dailyConsumedCals = calorieWeekDays.map((day) => {
    return weeklyLogs
      .filter((l) => l.type === "meal" && l.dateStr === day.dateStr)
      .reduce((sum, l) => sum + (l.calories || 0), 0);
  });

  // Calculate 7-day daily water intake for Water Section in Liters
  const dailyWaterIntakeL = waterWeekDays.map((day) => {
    const dayWaterLogs = weeklyLogs.filter(
      (l) => l.type === "water" && l.dateStr === day.dateStr
    );
    const totalAmount = dayWaterLogs.reduce((sum, l) => sum + (l.amount || 0), 0);
    const liters = totalAmount > 20 ? totalAmount / 1000 : totalAmount;
    return Number(liters.toFixed(2));
  });

  const rawTotalWaterL = dailyWaterIntakeL.reduce((sum, val) => sum + val, 0);
  const rawAvgWaterL = rawTotalWaterL / 7;
  const rawPeakWaterL = Math.max(...dailyWaterIntakeL, 0);

  const formatWaterDisplay = (liters: number): string => {
    if (liters === 0) return "0";
    return String(Math.round(liters * 100) / 100);
  };

  const totalWeeklyWaterL = formatWaterDisplay(rawTotalWaterL);
  const avgDailyWaterL = formatWaterDisplay(rawAvgWaterL);
  const peakWaterDayL = formatWaterDisplay(rawPeakWaterL);

  // Ensure Water Y-axis steps cleanly by multiples of 0.75 L (0, 0.75, 1.50, 2.25, 3.00...)
  const waterTargetMax = Math.max(3.0, Math.ceil(rawPeakWaterL / 0.75) * 0.75);
  const waterSegments = Math.round(waterTargetMax / 0.75);

  // Current week totals for Food Consumed & Workouts Burned overview strip (Current Week Only)
  const weeklyEatenCals = dailyConsumedCals.reduce((sum, val) => sum + val, 0);
  const weeklyBurnedCals = dailyBurnedCals.reduce((sum, val) => sum + val, 0);

  const activeChartData = calorieChartMode === "burned" ? dailyBurnedCals : dailyConsumedCals;
  const activeChartTotal = activeChartData.reduce((a, b) => a + b, 0);
  const activeChartAvg = Math.round(activeChartTotal / 7);
  const activeChartPeak = Math.max(...activeChartData, 0);

  // Ensure Y-axis steps cleanly by multiples of 500 (0, 500, 1000, 1500, 2000...)
  const chartTargetMax = Math.max(2000, Math.ceil(activeChartPeak / 500) * 500);
  const chartSegments = Math.round(chartTargetMax / 500);
  const yAxisScaleTicks = Array.from({ length: chartSegments + 1 }, (_, i) =>
    Math.round(chartTargetMax - i * 500)
  );

  // 6-hour cache threshold in milliseconds (6 * 60 * 60 * 1000 = 21,600,000 ms)
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  // Compute live Gemini AI Bento Grid Insights from actual database numbers with 6h caching
  const computeAndFetchBento = async (forceRefresh: boolean = false) => {
    if (!user) return;

    const weightNum = Number(profileWeight) || 70;
    const targetWeightNum = Number(targetWeight) || weightNum;
    const goalStr = profileGoal || "Maintain Weight";

    const loggedDaysCount = weekDays.filter((d) => d.hasActivity).length;
    let totalP = 0;
    let totalC = 0;
    let totalF = 0;
    weeklyLogs.forEach((l) => {
      if (l.type === "meal") {
        totalP += l.protein || 0;
        totalC += l.carbs || 0;
        totalF += l.fats || 0;
      }
    });

    const userStats = {
      weight: weightNum,
      targetWeight: targetWeightNum,
      goal: goalStr,
      weeklyEaten: weeklyEatenCals,
      weeklyBurned: weeklyBurnedCals,
      weeklyWater: Number(totalWeeklyWaterL) || 0,
      activeStreak: currentStreakCount,
      loggedDaysCount,
      totalProtein: totalP,
      totalCarbs: totalC,
      totalFats: totalF,
    };

    // 1. Instant calculation from local database state so ALL cards render immediately
    const instant = calculateFallbackBentoGrid(userStats);
    setBentoData(instant);

    // 2. Check 6-Hour Cache from Firestore / AsyncStorage if not forceRefresh
    if (!forceRefresh) {
      try {
        const cacheDocRef = doc(db, "users", user.id, "cache", "bento_insights");
        const cacheSnap = await getDoc(cacheDocRef);
        let cachedObj: any = null;

        if (cacheSnap.exists()) {
          cachedObj = cacheSnap.data();
        } else {
          // Fallback to local AsyncStorage
          const localStored = await AsyncStorage.getItem(`bento_ai_cache_${user.id}`);
          if (localStored) cachedObj = JSON.parse(localStored);
        }

        if (cachedObj && cachedObj.generatedAt) {
          const ageMs = Date.now() - Number(cachedObj.generatedAt);
          if (ageMs < SIX_HOURS_MS) {
            // Cache is fresh (< 6 hours old)! Use cached AI text directly with live database stats
            setBentoData({
              ...instant,
              coachTitle: cachedObj.coachTitle || instant.coachTitle,
              coachInsight: cachedObj.coachInsight || instant.coachInsight,
              actionableTip: cachedObj.actionableTip || instant.actionableTip,
              generatedAtFormatted: cachedObj.generatedAtFormatted || "",
              isCached: true,
            });
            setIsBentoLoading(false);
            return; // Do NOT generate AI again!
          }
        }
      } catch (cacheErr) {
        console.warn("Bento Grid cache read error, proceeding to AI generation:", cacheErr);
      }
    }

    // 3. Cache is >6h old, missing, or forceRefresh requested: trigger Gemini AI in background
    try {
      setIsBentoLoading(true);
      const aiData = await generateBentoGridInsights(userStats);

      const nowFormatted = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      const updatedData: BentoGridData = {
        ...aiData,
        generatedAtFormatted: nowFormatted,
        isCached: false,
      };

      setBentoData(updatedData);

      // Save generated response to database & local storage with date and time
      const cacheDocRef = doc(db, "users", user.id, "cache", "bento_insights");
      const cachePayload = {
        coachTitle: aiData.coachTitle,
        coachInsight: aiData.coachInsight,
        actionableTip: aiData.actionableTip,
        generatedAt: Date.now(),
        generatedAtFormatted: nowFormatted,
        updatedAt: serverTimestamp(),
      };

      await setDoc(cacheDocRef, cachePayload, { merge: true }).catch(() => { });
      await AsyncStorage.setItem(`bento_ai_cache_${user.id}`, JSON.stringify(cachePayload)).catch(() => { });
    } catch (err) {
      console.error("Error generating & caching live Gemini Bento Grid data:", err);
    } finally {
      setIsBentoLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    computeAndFetchBento(false);
  }, [user, profileWeight, targetWeight, profileGoal, weeklyEatenCals, weeklyBurnedCals, totalWeeklyWaterL, currentStreakCount, weekDays, weeklyLogs]);

  return (
    <View style={styles.rootContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section with Big 'Progress' Title */}
        <SafeAreaView edges={["top"]} style={styles.safeHeader}>
          <View style={styles.headerContainer}>
            <Text style={styles.pageHeading}>Progress</Text>
            <Text style={styles.pageSubtitle}>
              Track your consistency, daily streak, and body metrics.
            </Text>
          </View>
        </SafeAreaView>

        <View style={styles.mainContent}>
          {/* Two Cards in a Row: 1. Daily Streak Card & 2. My Weight Card */}
          <View style={styles.cardsRow}>
            {/* 1. Daily Streak Card (Clickable to open detailed dialog) */}
            <TouchableOpacity
              style={[styles.dashboardCard, styles.streakCard]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                setIsStreakModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              {/* Top Fire Icon */}
              <View style={styles.fireIconWrapper}>
                <Image
                  source={require("../../assets/images/fire.png")}
                  style={styles.fireIconImage}
                  resizeMode="contain"
                />
              </View>

              {/* Title & Streak Counter */}
              <Text style={styles.cardTitleText}>Daily Streak</Text>
              <Text style={styles.streakCountBadge}>
                {currentStreakCount} {currentStreakCount === 1 ? "Day" : "Days"}
              </Text>

              {/* Current Week Day Checkboxes (Mon - Sun) */}
              <View style={styles.weekChecklistRow}>
                {weekDays.map((day, idx) => (
                  <View key={`day-${idx}`} style={styles.dayColumn}>
                    <Ionicons
                      name={day.hasActivity ? "checkbox" : "square-outline"}
                      size={16}
                      color={day.hasActivity ? "#F59E0B" : "rgba(255, 255, 255, 0.25)"}
                    />
                    <Text style={[styles.dayLabelText, day.isToday && styles.todayLabelText]}>
                      {day.dayLabel}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* 2. My Weight Card (Clickable to open Edit Weight & Goal modal) */}
            <TouchableOpacity
              style={[styles.dashboardCard, styles.weightCard]}
              onPress={handleOpenWeightModal}
              activeOpacity={0.85}
            >
              {/* Top Scale Icon Frame */}
              <View style={styles.scaleIconFrame}>
                <Ionicons name="scale-outline" size={24} color="#3B82F6" />
              </View>

              {/* Title & Weight Display */}
              <Text style={styles.cardTitleText}>My Weight</Text>
              <View style={styles.weightValueContainer}>
                <Text style={styles.weightValueText}>{profileWeight}</Text>
                <Text style={styles.weightUnitText}>kg</Text>
              </View>

              {/* Subtitle / Goal info */}
              <Text style={styles.weightSubtitleText}>
                {profileGoal || "Updated in Profile"}
              </Text>

              {/* Target Weight Display Badge */}
              <View style={styles.updateWeightBtn}>
                <Ionicons name="flag-outline" size={12} color={Colors.dark.primary} />
                <Text style={styles.updateWeightBtnText}>
                  Target Weight: {targetWeight || profileWeight} kg
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 7-Day Weekly Calorie Breakdown Bar Chart Card */}
          <Text style={styles.sectionHeading}>Weekly Calorie Breakdown</Text>
          <View style={styles.chartCardContainer} {...caloriePanResponder.panHandlers}>
            {/* Card Header with Week Switcher & Mode Switcher Pills */}
            <View style={styles.chartHeaderRow}>
              <View style={styles.chartTitleCol}>
                <View style={styles.weekNavRow}>
                  <TouchableOpacity
                    onPress={handleCaloriePrevWeek}
                    style={styles.weekNavBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={16} color={Colors.dark.text} />
                  </TouchableOpacity>

                  <View style={styles.weekTitleCol}>
                    <Text style={styles.chartHeadingBold}>{calorieWeekDetails.titleStr}</Text>
                    <Text style={styles.chartSubheadingBelow}>({calorieWeekDetails.rangeStr})</Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleCalorieNextWeek}
                    disabled={calorieWeekOffset >= 0}
                    style={[styles.weekNavBtn, calorieWeekOffset >= 0 && styles.weekNavBtnDisabled]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={calorieWeekOffset >= 0 ? Colors.dark.textMuted : Colors.dark.text}
                    />
                  </TouchableOpacity>
                </View>

                {calorieWeekOffset !== 0 && (
                  <TouchableOpacity onPress={handleCalorieResetWeek} style={styles.resetWeekBtn}>
                    <Ionicons name="today-outline" size={11} color={Colors.dark.primary} />
                    <Text style={styles.resetWeekBtnText}>Current Week</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.chartTabPillContainer}>
                <TouchableOpacity
                  style={[
                    styles.chartTabPill,
                    calorieChartMode === "consumed" && styles.chartTabPillConsumedActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setCalorieChartMode("consumed");
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={13}
                    color={calorieChartMode === "consumed" ? Colors.dark.primary : Colors.dark.textMuted}
                  />
                  <Text
                    style={[
                      styles.chartTabPillText,
                      calorieChartMode === "consumed" && styles.chartTabPillTextConsumedActive,
                    ]}
                  >
                    Consumed
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chartTabPill,
                    calorieChartMode === "burned" && styles.chartTabPillBurnedActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setCalorieChartMode("burned");
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="flame-outline"
                    size={13}
                    color={calorieChartMode === "burned" ? "#F59E0B" : Colors.dark.textMuted}
                  />
                  <Text
                    style={[
                      styles.chartTabPillText,
                      calorieChartMode === "burned" && styles.chartTabPillTextBurnedActive,
                    ]}
                  >
                    Burned
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Total Overview Summary Strip inside Card */}
            <View style={styles.overviewStrip}>
              <View style={styles.overviewItem}>
                <View style={[styles.overviewIcon, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                  <Ionicons name="restaurant" size={14} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.overviewLabel}> Consumed</Text>
                  <Text style={[styles.overviewValue, { color: "#10B981" }]}>{weeklyEatenCals} cal</Text>
                </View>
              </View>

              <View style={styles.overviewDivider} />

              <View style={styles.overviewItem}>
                <View style={[styles.overviewIcon, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                  <Ionicons name="barbell" size={14} color="#F59E0B" />
                </View>
                <View>
                  <Text style={styles.overviewLabel}> Burned</Text>
                  <Text style={[styles.overviewValue, { color: "#F59E0B" }]}>{weeklyBurnedCals} cal</Text>
                </View>
              </View>
            </View>

            {/* Y-Axis Unit Header Indicator */}
            <View style={styles.yAxisHeaderRow}>
              <View style={styles.yAxisBadge}>
                <Ionicons name="bar-chart-outline" size={12} color={Colors.dark.textSecondary} />
                <Text style={styles.yAxisBadgeText}>Scale: Calories (cal)</Text>
              </View>
            </View>

            {/* Bar Chart Component (Full-Width Clean Chart) */}
            <View style={styles.chartWrapper}>
              <BarChart
                data={{
                  labels: chartDayLabels,
                  datasets: [
                    {
                      data: activeChartData.length > 0 ? activeChartData : [0, 0, 0, 0, 0, 0, 0],
                    },
                  ],
                }}
                width={Math.max(280, screenWidth - 72)}
                height={230}
                segments={chartSegments}
                yAxisLabel=""
                yAxisSuffix=""
                withHorizontalLabels={false}
                chartConfig={{
                  backgroundColor: "#161821",
                  backgroundGradientFrom: "#161821",
                  backgroundGradientTo: "#161821",
                  decimalPlaces: 0,
                  fillShadowGradientFrom: calorieChartMode === "burned" ? "#F59E0B" : "#10B981",
                  fillShadowGradientTo: calorieChartMode === "burned" ? "#D97706" : "#059669",
                  fillShadowGradientFromOpacity: 0.95,
                  fillShadowGradientToOpacity: 0.7,
                  color: (opacity = 1) =>
                    calorieChartMode === "burned"
                      ? `rgba(245, 158, 11, ${opacity})`
                      : `rgba(16, 185, 129, ${opacity})`,
                  labelColor: () => "#FFFFFF",
                  style: {
                    borderRadius: 16,
                  },
                  barPercentage: 0.68,
                  propsForBackgroundLines: {
                    strokeDasharray: "4",
                    stroke: "rgba(255, 255, 255, 0.08)",
                  },
                  propsForLabels: {
                    fontSize: 10,
                    fontWeight: "700",
                    fill: "#FFFFFF",
                  },
                  propsForVerticalLabels: {
                    fontSize: 10,
                    fontWeight: "600",
                    fill: "#9CA3AF",
                  },
                }}
                style={styles.barChartStyle}
                showValuesOnTopOfBars={true}
                fromZero={true}
                fromNumber={chartTargetMax}
              />
            </View>

            {/* Bottom Stats Footer inside Card */}
            <View style={styles.chartFooterRow}>
              <View style={styles.chartFooterStat}>
                <Text style={styles.chartFooterStatLabel}>
                  Total {calorieChartMode === "burned" ? "Burned" : "Consumed"}
                </Text>
                <Text
                  style={[
                    styles.chartFooterStatVal,
                    { color: calorieChartMode === "burned" ? "#F59E0B" : Colors.dark.primary },
                  ]}
                >
                  {activeChartTotal} cal
                </Text>
              </View>
              <View style={styles.chartFooterDivider} />
              <View style={styles.chartFooterStat}>
                <Text style={styles.chartFooterStatLabel}>Daily Avg</Text>
                <Text style={styles.chartFooterStatVal}>{activeChartAvg} cal</Text>
              </View>
              <View style={styles.chartFooterDivider} />
              <View style={styles.chartFooterStat}>
                <Text style={styles.chartFooterStatLabel}>Peak Day</Text>
                <Text style={styles.chartFooterStatVal}>{activeChartPeak} cal</Text>
              </View>
            </View>
          </View>

          {/* 7-Day Water Consumption Bezier Line Chart Card */}
          <Text style={styles.sectionHeading}>Water Consumption</Text>
          <View style={styles.chartCardContainer} {...waterPanResponder.panHandlers}>
            {/* Card Header with Week Switcher & Water Unit Badge */}
            <View style={styles.chartHeaderRow}>
              <View style={styles.chartTitleCol}>
                <View style={styles.weekNavRow}>
                  <TouchableOpacity
                    onPress={handleWaterPrevWeek}
                    style={styles.weekNavBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={16} color={Colors.dark.text} />
                  </TouchableOpacity>

                  <View style={styles.weekTitleCol}>
                    <Text style={styles.chartHeadingBold}>{waterWeekDetails.titleStr}</Text>
                    <Text style={styles.chartSubheadingBelow}>({waterWeekDetails.rangeStr})</Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleWaterNextWeek}
                    disabled={waterWeekOffset >= 0}
                    style={[styles.weekNavBtn, waterWeekOffset >= 0 && styles.weekNavBtnDisabled]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={waterWeekOffset >= 0 ? Colors.dark.textMuted : Colors.dark.text}
                    />
                  </TouchableOpacity>
                </View>

                {waterWeekOffset !== 0 && (
                  <TouchableOpacity onPress={handleWaterResetWeek} style={styles.resetWeekBtn}>
                    <Ionicons name="today-outline" size={11} color={Colors.dark.primary} />
                    <Text style={styles.resetWeekBtnText}>Current Week</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Total Water Overview Summary Strip */}
            <View style={styles.overviewStrip}>
              <View style={styles.overviewItem}>
                <View style={[styles.overviewIcon, { backgroundColor: "rgba(6, 182, 212, 0.12)" }]}>
                  <Ionicons name="water" size={14} color="#06B6D4" />
                </View>
                <View>
                  <Text style={styles.overviewLabel}>Total Water</Text>
                  <Text style={[styles.overviewValue, { color: "#06B6D4" }]}>{totalWeeklyWaterL} L</Text>
                </View>
              </View>

              <View style={styles.overviewDivider} />

              <View style={styles.overviewItem}>
                <View style={[styles.overviewIcon, { backgroundColor: "rgba(59, 130, 246, 0.12)" }]}>
                  <Ionicons name="stats-chart" size={14} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.overviewLabel}>Daily Avg</Text>
                  <Text style={[styles.overviewValue, { color: "#3B82F6" }]}>{avgDailyWaterL} L/day</Text>
                </View>
              </View>
            </View>

            {/* Bezier Line Chart Component */}
            <View style={styles.chartWrapper}>
              <LineChart
                data={{
                  labels: chartDayLabels,
                  datasets: [
                    {
                      data: dailyWaterIntakeL.length > 0 ? dailyWaterIntakeL : [0, 0, 0, 0, 0, 0, 0],
                      color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={Math.max(280, screenWidth - 72)}
                height={220}
                bezier
                fromZero={true}
                fromNumber={waterTargetMax}
                segments={waterSegments}
                withHorizontalLabels={true}
                yAxisSuffix=" L"
                yLabelsOffset={4}
                chartConfig={{
                  backgroundColor: "#161821",
                  backgroundGradientFrom: "#161821",
                  backgroundGradientTo: "#161821",
                  decimalPlaces: 2,
                  formatYLabel: (label) => String(Number(label)),
                  color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
                  labelColor: () => "#FFFFFF",
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: "#06B6D4",
                    fill: "#3B82F6",
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: "4",
                    stroke: "rgba(255, 255, 255, 0.08)",
                  },
                  propsForLabels: {
                    fontSize: 10,
                    fontWeight: "700",
                    fill: "#FFFFFF",
                  },
                  propsForHorizontalLabels: {
                    fontSize: 10,
                    fontWeight: "700",
                    fill: "#9CA3AF",
                    dy: 4,
                  },
                  propsForVerticalLabels: {
                    fontSize: 10,
                    fontWeight: "600",
                    fill: "#9CA3AF",
                    dx: 2,
                  },
                }}
                style={styles.lineChartStyle}
              />
            </View>

            {/* Bottom Stats Footer */}
            <View style={styles.chartFooterRow}>
              <View style={styles.chartFooterStat}>
                <Text style={styles.chartFooterStatLabel}>Total Consumed</Text>
                <Text style={[styles.chartFooterStatVal, { color: "#06B6D4" }]}>{totalWeeklyWaterL} L</Text>
              </View>
              <View style={styles.chartFooterDivider} />
              <View style={styles.chartFooterStat}>
                <Text style={styles.chartFooterStatLabel}>Daily Avg</Text>
                <Text style={styles.chartFooterStatVal}>{avgDailyWaterL} L</Text>
              </View>
              <View style={styles.chartFooterDivider} />
              <View style={styles.chartFooterStat}>
                <Text style={styles.chartFooterStatLabel}>Peak Day</Text>
                <Text style={styles.chartFooterStatVal}>{peakWaterDayL} L</Text>
              </View>
            </View>
          </View>

          {/* AI Bento Grid Section in a Separate Card Box Container */}
          <Text style={styles.sectionHeading}>AI Performance Insights</Text>
          <View style={styles.bentoSectionContainer}>
            <View style={styles.bentoHeaderCol}>
              <TouchableOpacity
                style={styles.refreshBentoBtnBelow}
                onPress={() => computeAndFetchBento(true)}
                disabled={isBentoLoading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="sync-outline"
                  size={13}
                  color={isBentoLoading ? Colors.dark.textMuted : "#F59E0B"}
                />
                <Text style={styles.refreshBentoText}>{isBentoLoading ? "Analyzing..." : "Refresh AI Insights"}</Text>
              </TouchableOpacity>
            </View>

            {/* Bento Grid Layout - All 4 Cards Render Immediately */}
            <View style={styles.bentoGridWrapper}>
              {/* Card 1: Featured AI Coach Insight */}
              <View style={styles.bentoCardFeatured}>
                <View style={styles.bentoFeaturedHeader}>
                  <View style={styles.aiBadge}>
                    {isBentoLoading ? (
                      <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 2 }} />
                    ) : (
                      <Ionicons name="hardware-chip-outline" size={13} color="#10B981" />
                    )}
                    <Text style={styles.aiBadgeText}>
                      {isBentoLoading
                        ? "AI Analyzing Live Logs..."
                        : bentoData?.generatedAtFormatted
                          ? `Gemini AI • ${bentoData.generatedAtFormatted}`
                          : "Gemini AI Analysis"}
                    </Text>
                  </View>
                  <Text style={styles.bentoTagText}>{bentoData?.weightTrendStatus || "Live Data"}</Text>
                </View>

                {isBentoLoading ? (
                  <View style={styles.skeletonContainer}>
                    <Text style={styles.bentoCoachTitle}>Analyzing Your Performance...</Text>
                    <View style={[styles.skeletonLine, { width: "95%" }]} />
                    <View style={[styles.skeletonLine, { width: "80%" }]} />
                    <View style={[styles.skeletonLine, { width: "65%" }]} />
                    <View style={[styles.bentoTipBanner, { marginTop: 6 }]}>
                      <Ionicons name="sparkles-outline" size={14} color="#F59E0B" />
                      <Text style={styles.bentoTipText}>Processing energy & metabolic trends...</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.bentoCoachTitle}>{bentoData?.coachTitle || "AI Performance Insights"}</Text>
                    <Text style={styles.bentoCoachInsight}>{bentoData?.coachInsight || "Analyzing live database logs..."}</Text>

                    {bentoData?.actionableTip ? (
                      <View style={styles.bentoTipBanner}>
                        <Ionicons name="bulb-outline" size={14} color="#F59E0B" />
                        <Text style={styles.bentoTipText}>{bentoData.actionableTip}</Text>
                      </View>
                    ) : null}
                  </>
                )}
              </View>

              {/* Row 2: 2 Column Bento Grid Cards */}
              <View style={styles.bentoRow}>
                {/* Card 2: Habit Consistency Score */}
                <View style={[styles.bentoCardSmall, styles.bentoCardHabit]}>
                  <View style={styles.bentoCardTop}>
                    <View style={styles.bentoIconFrameAmber}>
                      <Ionicons name="flame" size={16} color="#F59E0B" />
                    </View>
                    <Text style={styles.bentoSmallTitle}>Habit Score</Text>
                  </View>
                  <View style={styles.bentoScoreContainer}>
                    <Text style={styles.bentoScoreVal}>{bentoData?.habitScore || 0}%</Text>
                    <Text style={styles.bentoScoreRating}>{bentoData?.habitRating || "Building"}</Text>
                  </View>
                  <View style={styles.bentoProgressBarBg}>
                    <View style={[styles.bentoProgressBarFill, { width: `${bentoData?.habitScore || 0}%` }]} />
                  </View>
                </View>

                {/* Card 3: Weight Goal Forecast */}
                <View style={[styles.bentoCardSmall, styles.bentoCardForecast]}>
                  <View style={styles.bentoCardTop}>
                    <View style={styles.bentoIconFrameBlue}>
                      <Ionicons name="trending-down" size={16} color="#3B82F6" />
                    </View>
                    <Text style={styles.bentoSmallTitle}>Goal Forecast</Text>
                  </View>
                  <Text style={styles.bentoForecastWeeks}>
                    {bentoData?.projectedWeeks ? `${bentoData.projectedWeeks} Wks` : "On Track"}
                  </Text>
                  <Text style={styles.bentoForecastSub}>Target: {bentoData?.estimatedGoalDate}</Text>
                </View>
              </View>

              {/* Card 4: Macro Harmony Ratio */}
              <View style={styles.bentoCardFullWidth}>
                <View style={styles.bentoCardTopRow}>
                  <View style={styles.bentoHeaderLeft}>
                    <View style={styles.bentoIconFrameGreen}>
                      <Ionicons name="nutrition" size={16} color="#10B981" />
                    </View>
                    <Text style={styles.bentoCardTitle}>Macro Harmony Ratio</Text>
                  </View>
                  <View style={styles.macroScoreChip}>
                    <Text style={styles.macroScoreChipText}>{bentoData?.macroHarmonyScore || 80}/100 Score</Text>
                  </View>
                </View>
                <Text style={styles.bentoMacroRatioText}>{bentoData?.macroRatioText || "30% P • 45% C • 25% F"}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Daily Streak Detailed Dialog Modal (Transparent Backdrop) */}
      <Modal
        visible={isStreakModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsStreakModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsStreakModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.streakDialogCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.dialogCloseBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                setIsStreakModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color={Colors.dark.textSecondary} />
            </TouchableOpacity>

            {/* Fire Icon (Bigger size in dialog) */}
            <View style={styles.dialogFireIconWrapper}>
              <Image
                source={require("../../assets/images/fire.png")}
                style={styles.dialogFireIconImage}
                resizeMode="contain"
              />
            </View>

            {/* Card Title */}
            <Text style={styles.dialogCardTitleText}>Daily Streak</Text>

            {/* Streak Count & 'Keep it Going 🔥' Chip */}
            <View style={styles.streakCountChipRow}>
              <Text style={styles.dialogStreakCountText}>
                {currentStreakCount} {currentStreakCount === 1 ? "Day" : "Days"} Streak
              </Text>
              <View style={styles.keepGoingChip}>
                <Text style={styles.keepGoingChipText}>Keep it Going 🔥</Text>
              </View>
            </View>

            {/* Bigger Current Week Checkboxes (Mon - Sun) */}
            <View style={styles.dialogWeekChecklistRow}>
              {weekDays.map((day, idx) => (
                <View key={`dialog-day-${idx}`} style={styles.dialogDayColumn}>
                  <Ionicons
                    name={day.hasActivity ? "checkbox" : "square-outline"}
                    size={22}
                    color={day.hasActivity ? "#F59E0B" : "rgba(255, 255, 255, 0.25)"}
                  />
                  <Text style={[styles.dialogDayLabelText, day.isToday && styles.dialogTodayLabelText]}>
                    {day.dayLabel}
                  </Text>
                </View>
              ))}
            </View>

            {/* Encouragement Subtext */}
            <Text style={styles.dialogStreakEncouragement}>
              {currentStreakCount > 0
                ? `🔥 ${currentStreakCount}-day active streak! You've logged activity for ${weekDays.filter((d) => d.hasActivity).length} of 7 days this week. Keep up the daily streak!`
                : "Log at least one activity daily (meal, workout, or water) to build your streak!"}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Update Weight & Goal Modal */}
      <Modal
        visible={isEditWeightModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditWeightModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsEditWeightModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.weightModalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Top Heading */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Weight</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                  setIsEditWeightModalVisible(false);
                }}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 1. Edit Weight Option */}
            <View style={styles.inputSection}>
              <Text style={styles.inputSectionLabel}>Edit Weight (kg)</Text>
              <TextInput
                style={styles.weightInput}
                value={newWeightInput}
                onChangeText={handleWeightInputChange}
                keyboardType="numeric"
                placeholder="e.g. 70"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
              />
            </View>

            {/* 2. Goal Options */}
            <View style={styles.inputSection}>
              <Text style={styles.inputSectionLabel}>Fitness Goal</Text>
              <View style={styles.goalOptionsContainer}>
                {[
                  { label: "Gain Weight", val: "Gain Weight", icon: "trending-up-outline" },
                  { label: "Maintain Weight", val: "Maintain Weight", icon: "remove-outline" },
                  { label: "Lose Weight", val: "Lose Weight", icon: "trending-down-outline" },
                ].map((item) => {
                  const isSelected = selectedGoalInput === item.val;
                  return (
                    <TouchableOpacity
                      key={item.val}
                      style={[
                        styles.goalOptionCard,
                        isSelected && styles.goalOptionCardSelected,
                      ]}
                      onPress={() => handleGoalSelect(item.val)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.goalOptionLeft}>
                        <Ionicons
                          name={item.icon as any}
                          size={18}
                          color={isSelected ? Colors.dark.primary : Colors.dark.textMuted}
                        />
                        <Text
                          style={[
                            styles.goalOptionText,
                            isSelected && styles.goalOptionTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>

                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={isSelected ? Colors.dark.primary : "rgba(255, 255, 255, 0.2)"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Target Weight Box */}
            {(() => {
              const currentW = Number(newWeightInput);
              const targetW = Number(newTargetWeightInput);
              let targetErrorMsg = "";

              if (isTargetEditable && !isNaN(currentW) && newTargetWeightInput !== "" && !isNaN(targetW)) {
                if (selectedGoalInput === "Lose Weight" && targetW >= currentW) {
                  targetErrorMsg = `Target must be less than current weight (< ${currentW} kg)`;
                } else if (selectedGoalInput === "Gain Weight" && targetW <= currentW) {
                  targetErrorMsg = `Target must be greater than current weight (> ${currentW} kg)`;
                }
              }

              const isFormInvalid =
                !newWeightInput ||
                isNaN(currentW) ||
                (isTargetEditable && (!newTargetWeightInput || isNaN(targetW) || !!targetErrorMsg));

              return (
                <>
                  <View style={styles.inputSection}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.inputSectionLabel}>Target Weight (kg)</Text>
                      {isTargetEditable ? (
                        <Text style={styles.requiredBadge}>* Compulsory</Text>
                      ) : (
                        <Text style={styles.lockedBadge}>Non-editable (Maintain)</Text>
                      )}
                    </View>
                    <TextInput
                      style={[
                        styles.weightInput,
                        !isTargetEditable && styles.weightInputDisabled,
                        !!targetErrorMsg && styles.weightInputError,
                      ]}
                      value={isTargetEditable ? newTargetWeightInput : newWeightInput}
                      onChangeText={setNewTargetWeightInput}
                      keyboardType="numeric"
                      editable={isTargetEditable}
                      placeholder={
                        selectedGoalInput === "Gain Weight"
                          ? `> ${newWeightInput || "70"} kg (Higher than current)`
                          : selectedGoalInput === "Lose Weight"
                            ? `< ${newWeightInput || "70"} kg (Lower than current)`
                            : "Matches current weight"
                      }
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    />
                    {!!targetErrorMsg && (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                        <Text style={styles.errorText}>{targetErrorMsg}</Text>
                      </View>
                    )}
                  </View>

                  {/* 4. Update Button */}
                  <TouchableOpacity
                    style={[
                      styles.updateSubmitBtn,
                      isFormInvalid && styles.updateSubmitBtnDisabled,
                    ]}
                    onPress={handleSaveWeight}
                    disabled={isSavingWeight || isFormInvalid}
                    activeOpacity={0.8}
                  >
                    {isSavingWeight ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text
                        style={[
                          styles.updateSubmitBtnText,
                          isFormInvalid && styles.updateSubmitBtnTextDisabled,
                        ]}
                      >
                        Update
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              );
            })()}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  safeHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerContainer: {
    marginBottom: 16,
  },
  pageHeading: {
    color: Colors.dark.text,
    fontSize: 30,
    fontWeight: "bold",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  mainContent: {
    paddingHorizontal: 20,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  dashboardCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  streakCard: {
    alignItems: "center",
  },
  fireIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  fireIconImage: {
    width: 26,
    height: 26,
  },
  cardTitleText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  streakCountBadge: {
    color: "#F59E0B",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  weekChecklistRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 2,
  },
  dayColumn: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  dayLabelText: {
    color: Colors.dark.textMuted,
    fontSize: 9,
    fontWeight: "600",
  },
  todayLabelText: {
    color: Colors.dark.primary,
    fontWeight: "800",
  },
  weightCard: {
    justifyContent: "space-between",
  },
  scaleIconFrame: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  weightValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginVertical: 4,
  },
  weightValueText: {
    color: Colors.dark.text,
    fontSize: 26,
    fontWeight: "800",
  },
  weightUnitText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  weightSubtitleText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginBottom: 12,
    textAlign: "center",
  },
  updateWeightBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(41, 143, 80, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  updateWeightBtnText: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  sectionHeading: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryMetricItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 12,
  },
  metricIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  metricTextContainer: {
    flex: 1,
  },
  metricVal: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "bold",
  },
  metricLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  streakDialogCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 24,
    width: "88%",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  dialogCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  dialogFireIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 6,
  },
  dialogFireIconImage: {
    width: 38,
    height: 38,
  },
  dialogCardTitleText: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },
  streakCountChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  dialogStreakCountText: {
    color: "#F59E0B",
    fontSize: 22,
    fontWeight: "800",
  },
  keepGoingChip: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  keepGoingChipText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "800",
  },
  dialogWeekChecklistRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  dialogDayColumn: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  dialogDayLabelText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  dialogTodayLabelText: {
    color: Colors.dark.primary,
    fontWeight: "800",
  },
  dialogStreakEncouragement: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  weightModalCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 24,
    width: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  inputSection: {
    marginBottom: 18,
    width: "100%",
  },
  inputSectionLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  weightInput: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  goalOptionsContainer: {
    gap: 10,
  },
  goalOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  goalOptionCardSelected: {
    backgroundColor: "rgba(41, 143, 80, 0.12)",
    borderColor: Colors.dark.primary,
  },
  goalOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalOptionText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  goalOptionTextSelected: {
    color: Colors.dark.text,
    fontWeight: "700",
  },
  goalOptionSubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: "normal",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  requiredBadge: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  lockedBadge: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  weightInputDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderColor: "rgba(255, 255, 255, 0.04)",
    color: Colors.dark.textMuted,
    opacity: 0.6,
  },
  weightInputError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "500",
  },
  updateSubmitBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  updateSubmitBtnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    shadowOpacity: 0,
    elevation: 0,
  },
  updateSubmitBtnText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  updateSubmitBtnTextDisabled: {
    color: Colors.dark.textMuted,
  },
  chartCardContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 8,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  chartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chartTitleCol: {
    justifyContent: "center",
  },
  chartHeadingBold: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: "800",
  },
  chartSubheadingBelow: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  chartTabPillContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 3,
    gap: 4,
    flexShrink: 1,
  },
  chartTabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  chartTabPillBurnedActive: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  chartTabPillConsumedActive: {
    backgroundColor: "rgba(41, 143, 80, 0.18)",
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  chartTabPillText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  chartTabPillTextBurnedActive: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  chartTabPillTextConsumedActive: {
    color: Colors.dark.primaryLight,
    fontWeight: "700",
  },
  overviewStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  overviewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  overviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  overviewLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  overviewValue: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 1,
  },
  overviewDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 10,
  },
  yAxisHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 4,
    paddingLeft: 4,
  },
  yAxisBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  yAxisBadgeText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
    width: "100%",
  },
  barChartStyle: {
    borderRadius: 16,
    paddingRight: 0,
    marginLeft: 0,
    alignSelf: "center",
  },
  lineChartStyle: {
    borderRadius: 16,
    paddingRight: 75,
    alignSelf: "center",
  },
  chartFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  chartFooterStat: {
    flex: 1,
    alignItems: "center",
  },
  chartFooterStatLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  chartFooterStatVal: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "bold",
  },
  chartFooterDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  waterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(6, 182, 212, 0.1)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
  },
  waterBadgeText: {
    color: "#06B6D4",
    fontSize: 11,
    fontWeight: "600",
  },
  weekNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weekNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  weekNavBtnDisabled: {
    opacity: 0.3,
  },
  weekTitleCol: {
    justifyContent: "center",
  },
  resetWeekBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(41, 143, 80, 0.12)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.2)",
    marginTop: 6,
    alignSelf: "flex-start",
  },
  resetWeekBtnText: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  bentoSectionContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  bentoHeaderCol: {
    marginBottom: 14,
    gap: 8,
    alignItems: "flex-start",
  },
  bentoTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeadingNoMargin: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.dark.text,
  },
  refreshBentoBtnBelow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  refreshBentoText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
  },
  bentoGridWrapper: {
    gap: 12,
  },
  bentoCardFeatured: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  bentoFeaturedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiBadgeText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  bentoTagText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  bentoCoachTitle: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 6,
  },
  bentoCoachInsight: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  bentoTipBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: 12,
    padding: 10,
  },
  bentoTipText: {
    color: Colors.dark.text,
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  bentoRow: {
    flexDirection: "row",
    gap: 12,
  },
  bentoCardSmall: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 14,
    justifyContent: "space-between",
  },
  bentoCardHabit: {
    borderColor: "rgba(245, 158, 11, 0.15)",
  },
  bentoCardForecast: {
    borderColor: "rgba(59, 130, 246, 0.15)",
  },
  bentoCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  bentoIconFrameAmber: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  bentoIconFrameBlue: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  bentoIconFrameGreen: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  bentoSmallTitle: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  bentoScoreContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 8,
  },
  bentoScoreVal: {
    color: "#F59E0B",
    fontSize: 22,
    fontWeight: "800",
  },
  bentoScoreRating: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  bentoProgressBarBg: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  bentoProgressBarFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 3,
  },
  bentoForecastWeeks: {
    color: "#3B82F6",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  bentoForecastSub: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  bentoCardFullWidth: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
    padding: 14,
  },
  bentoCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bentoHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bentoCardTitle: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "700",
  },
  macroScoreChip: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  macroScoreChipText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
  },
  bentoMacroRatioText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  skeletonContainer: {
    marginVertical: 4,
    gap: 8,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 6,
  },
});
