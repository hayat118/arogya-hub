import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import * as Haptics from "expo-haptics";
import Colors from "../../constants/Colors";
import { db, updateUserProfile } from "../../services/firebase";

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
  const [targetWeight, setTargetWeight] = useState<string>("65");
  const [isEditWeightModalVisible, setIsEditWeightModalVisible] = useState(false);
  const [newWeightInput, setNewWeightInput] = useState("");
  const [isSavingWeight, setIsSavingWeight] = useState(false);

  // Daily Streak Modal state
  const [isStreakModalVisible, setIsStreakModalVisible] = useState(false);

  // Week streak data state
  const [weekDays, setWeekDays] = useState<DayStreakInfo[]>([]);
  const [currentStreakCount, setCurrentStreakCount] = useState<number>(0);
  const [weeklyLogs, setWeeklyLogs] = useState<LogItem[]>([]);

  // Helper to format date YYYY-MM-DD
  const formatDateStr = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // 1. Fetch user weight & target from profile
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const userDocRef = doc(db, "users", user.id);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.weight) setProfileWeight(String(data.weight));
          if (data.targetWeight) setTargetWeight(String(data.targetWeight));
        }

        // Check local storage fallback
        const cachedOnboarding = await AsyncStorage.getItem("onboarding_data");
        if (cachedOnboarding) {
          const parsed = JSON.parse(cachedOnboarding);
          if (parsed.weight && !snap.data()?.weight) {
            setProfileWeight(String(parsed.weight));
          }
        }
      } catch (err) {
        console.error("Error loading analytics profile weight:", err);
      }
    };

    fetchProfile();
  }, [user]);

  // 2. Compute current week dates (Sun - Sat) and listen to Firebase logs
  useEffect(() => {
    if (!user) return;

    const today = new Date();
    const todayStr = formatDateStr(today);
    const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // Calculate Sunday (start of week)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);

    const weekDates: DayStreakInfo[] = [];
    const labels = ["S", "M", "T", "W", "T", "F", "S"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dStr = formatDateStr(d);
      weekDates.push({
        dayLabel: labels[i],
        dateStr: dStr,
        isToday: dStr === todayStr,
        hasActivity: false,
      });
    }

    // Subscribe to Firebase logs collection for this user
    const logsRef = collection(db, "users", user.id, "logs");
    const unsub = onSnapshot(
      logsRef,
      (snapshot) => {
        const fetchedLogs: LogItem[] = [];
        const activeDatesSet = new Set<string>();

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          let dStr = data.dateStr;

          if (!dStr && data.createdAt) {
            const dateObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            dStr = formatDateStr(dateObj);
          }

          if (dStr) {
            activeDatesSet.add(dStr);
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

        // Update active status for each day of the current week
        const updatedWeek = weekDates.map((day) => ({
          ...day,
          hasActivity: activeDatesSet.has(day.dateStr),
        }));

        setWeekDays(updatedWeek);
        setWeeklyLogs(fetchedLogs);

        // Calculate consecutive streak days ending today or yesterday
        let streak = 0;
        let checkDate = new Date(today);
        while (true) {
          const checkStr = formatDateStr(checkDate);
          if (activeDatesSet.has(checkStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            // If today hasn't been logged yet, check if yesterday was logged to preserve ongoing streak
            if (streak === 0 && checkStr === todayStr) {
              checkDate.setDate(checkDate.getDate() - 1);
              continue;
            }
            break;
          }
        }

        setCurrentStreakCount(streak);
      },
      (err) => {
        console.error("Firebase analytics logs listener error:", err);
      }
    );

    return () => unsub();
  }, [user]);

  // Handle Save Weight Update
  const handleSaveWeight = async () => {
    if (!user || !newWeightInput || isNaN(Number(newWeightInput))) return;
    try {
      setIsSavingWeight(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const numericVal = Number(newWeightInput);
      setProfileWeight(String(numericVal));

      await updateUserProfile(user.id, { weight: numericVal });
      setIsEditWeightModalVisible(false);
      setNewWeightInput("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error("Error updating weight:", err);
    } finally {
      setIsSavingWeight(false);
    }
  };

  // Weekly Calorie Totals for Chart Card
  const weeklyEatenCals = weeklyLogs
    .filter((l) => l.type === "meal")
    .reduce((sum, l) => sum + (l.calories || 0), 0);

  const weeklyBurnedCals = weeklyLogs
    .filter((l) => l.type === "workout")
    .reduce((sum, l) => sum + (l.calories || 0), 0);

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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
              <Text style={styles.streakCountBadge}>{currentStreakCount} Days</Text>

              {/* Current Week Day Checkboxes (S, M, T, W, T, F, S) */}
              <View style={styles.weekChecklistRow}>
                {weekDays.map((day, idx) => (
                  <View key={`day-${idx}`} style={styles.dayColumn}>
                    <Ionicons
                      name={day.hasActivity ? "checkbox" : "square-outline"}
                      size={18}
                      color={day.hasActivity ? "#F59E0B" : "rgba(255, 255, 255, 0.25)"}
                    />
                    <Text style={[styles.dayLabelText, day.isToday && styles.todayLabelText]}>
                      {day.dayLabel}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* 2. My Weight Card */}
            <View style={[styles.dashboardCard, styles.weightCard]}>
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

              {/* Subtitle / Target info */}
              <Text style={styles.weightSubtitleText}>
                {targetWeight ? `Goal: ${targetWeight} kg` : "Updated in Profile"}
              </Text>

              {/* Quick Update Button */}
              <TouchableOpacity
                style={styles.updateWeightBtn}
                onPress={() => {
                  setNewWeightInput(profileWeight);
                  setIsEditWeightModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="pencil-sharp" size={12} color={Colors.dark.primary} />
                <Text style={styles.updateWeightBtnText}>Log Weight</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Weekly Summary Overview Card */}
          <Text style={styles.sectionHeading}>Weekly Activity Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryMetricItem}>
                <View style={[styles.metricIconBox, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
                  <Ionicons name="flame" size={20} color="#10B981" />
                </View>
                <View style={styles.metricTextContainer}>
                  <Text style={styles.metricVal}>{weeklyEatenCals} cal</Text>
                  <Text style={styles.metricLabel}>Total Food Eaten</Text>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryMetricItem}>
                <View style={[styles.metricIconBox, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
                  <Ionicons name="barbell" size={20} color="#F59E0B" />
                </View>
                <View style={styles.metricTextContainer}>
                  <Text style={styles.metricVal}>{weeklyBurnedCals} cal</Text>
                  <Text style={styles.metricLabel}>Total Burned</Text>
                </View>
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
              <Text style={styles.dialogStreakCountText}>{currentStreakCount} Days</Text>
              <View style={styles.keepGoingChip}>
                <Text style={styles.keepGoingChipText}>Keep it Going 🔥</Text>
              </View>
            </View>

            {/* Bigger Current Week Checkboxes (S, M, T, W, T, F, S) */}
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
                ? `You've logged activity for ${weekDays.filter((d) => d.hasActivity).length} of 7 days this week. Keep up the daily streak!`
                : "Log at least one activity daily (meal, workout, or water) to build your streak!"}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Weight Modal */}
      <Modal
        visible={isEditWeightModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditWeightModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Body Weight</Text>
              <TouchableOpacity
                onPress={() => setIsEditWeightModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your current body weight in kg:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newWeightInput}
              onChangeText={setNewWeightInput}
              keyboardType="numeric"
              placeholder="e.g. 70"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus={true}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditWeightModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveWeight}
                disabled={isSavingWeight}
              >
                {isSavingWeight ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Weight</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  modalCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 24,
    width: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    padding: 12,
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: {
    color: Colors.dark.white,
    fontSize: 14,
    fontWeight: "bold",
  },
});
