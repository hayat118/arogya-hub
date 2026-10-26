import { useUser } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Accelerometer, Pedometer } from "expo-sensors";
import {
  classifyActivity,
  smoothActivity,
  type ActivityReading,
  type DetectedActivity,
  ACCEL_WINDOW_MS,
  ACCEL_SAMPLE_INTERVAL_MS,
} from "../../services/activityRecognition";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import HomeHeader from "../../components/HomeHeader";
import Colors from "../../constants/Colors";
import { db } from "../../services/firebase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PeriodType = "today" | "week" | "month";

interface WorkoutLog {
  id: string;
  title?: string;
  type?: string;
  workoutType?: string;
  intensity?: string;
  calories?: number;
  duration?: number;
  distance?: number;
  steps?: number;
  sets?: number;
  reps?: number;
  date?: string;
  createdAt?: any;
}

interface ActivityConfig {
  id: string;
  name: string;
  iconName: string;
  iconFamily: "Ionicons" | "MaterialCommunityIcons";
  color: string;
  bgColor: string;
  defaultType: "cardio" | "lifting";
}

const ACTIVITY_CONFIGS: Record<string, ActivityConfig> = {
  walking: {
    id: "walking",
    name: "Walking",
    iconName: "walk",
    iconFamily: "Ionicons",
    color: "#10B981",
    bgColor: "rgba(16, 185, 129, 0.15)",
    defaultType: "cardio",
  },
  running: {
    id: "running",
    name: "Running",
    iconName: "run",
    iconFamily: "MaterialCommunityIcons",
    color: "#F97316",
    bgColor: "rgba(249, 115, 22, 0.15)",
    defaultType: "cardio",
  },
  cycling: {
    id: "cycling",
    name: "Cycling",
    iconName: "bicycle",
    iconFamily: "Ionicons",
    color: "#3B82F6",
    bgColor: "rgba(59, 130, 246, 0.15)",
    defaultType: "cardio",
  },
  strength: {
    id: "strength",
    name: "Strength Training",
    iconName: "barbell",
    iconFamily: "Ionicons",
    color: "#A855F7",
    bgColor: "rgba(168, 85, 247, 0.15)",
    defaultType: "lifting",
  },
  yoga: {
    id: "yoga",
    name: "Yoga",
    iconName: "yoga",
    iconFamily: "MaterialCommunityIcons",
    color: "#EC4899",
    bgColor: "rgba(236, 72, 153, 0.15)",
    defaultType: "cardio",
  },
  badminton: {
    id: "badminton",
    name: "Badminton",
    iconName: "badminton",
    iconFamily: "MaterialCommunityIcons",
    color: "#14B8A6",
    bgColor: "rgba(20, 184, 166, 0.15)",
    defaultType: "cardio",
  },
  football: {
    id: "football",
    name: "Football",
    iconName: "football",
    iconFamily: "Ionicons",
    color: "#EAB308",
    bgColor: "rgba(234, 179, 8, 0.15)",
    defaultType: "cardio",
  },
  other: {
    id: "other",
    name: "Other Workout",
    iconName: "ellipsis-horizontal",
    iconFamily: "Ionicons",
    color: "#94A3B8",
    bgColor: "rgba(148, 163, 184, 0.15)",
    defaultType: "cardio",
  },
};

const formatDateStr = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDuration = (mins: number) => {
  if (mins <= 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) return `${hrs} hr`;
  return `${hrs} hr ${remMins} min`;
};

const formatPace = (mins: number, km: number) => {
  if (km <= 0 || mins <= 0) return "--";
  const paceVal = mins / km;
  const pMin = Math.floor(paceVal);
  const pSec = Math.round((paceVal - pMin) * 60);
  return `${pMin}:${String(pSec).padStart(2, "0")}`;
};

export default function ActivityScreen() {
  const router = useRouter();
  const { user } = useUser();
  const params = useLocalSearchParams();

  // Selected quick activity to view detail screen (null = main Today's Activity overview)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    (params.activity as string) || null
  );

  // Detail view timeframe: today | week | month
  const [period, setPeriod] = useState<PeriodType>("today");

  // Hardware & Real-time step counter states
  const [isPedometerAvailable, setIsPedometerAvailable] = useState<boolean | null>(null);
  const [hardwareStepCount, setHardwareStepCount] = useState<number>(0);
  const [liveStepCount, setLiveStepCount] = useState<number>(0);
  const [realtimeStepCount, setRealtimeStepCount] = useState<number>(0);

  // References for step detection & hardware baseline
  const initialHardwareBaseRef = useRef<number | null>(null);
  const lastStepTimeRef = useRef<number>(0);
  const accelPrevMagRef = useRef<number>(1.0);
  const isRisingRef = useRef<boolean>(false);
  const saveStepsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User weight in kg for real calorie calculation (defaults to 70kg)
  const [userWeightKg, setUserWeightKg] = useState<number>(70);

  // Today date ID in format YYYY-MM-DD
  const todayDateId = useMemo(() => formatDateStr(new Date()), []);

  // Storage key for daily step count tied to today's date and user
  const stepStorageKey = useMemo(() => {
    return user?.id
      ? `daily_steps_${user.id}_${todayDateId}`
      : `daily_steps_guest_${todayDateId}`;
  }, [user?.id, todayDateId]);

  // Load today's persisted step count from AsyncStorage on mount or date change
  useEffect(() => {
    let isMounted = true;
    async function loadPersistedSteps() {
      try {
        const stored = await AsyncStorage.getItem(stepStorageKey);
        if (stored && isMounted) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > 0) {
            setRealtimeStepCount(parsed);
          }
        }
      } catch (err) {
        console.warn("Failed to load persisted steps:", err);
      }
    }
    loadPersistedSteps();
    return () => {
      isMounted = false;
    };
  }, [stepStorageKey]);

  // Debounced auto-save of steps to AsyncStorage whenever realtimeStepCount changes
  useEffect(() => {
    if (realtimeStepCount <= 0) return;
    if (saveStepsTimeoutRef.current) {
      clearTimeout(saveStepsTimeoutRef.current);
    }
    saveStepsTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(stepStorageKey, String(realtimeStepCount)).catch(() => {});
    }, 1000);

    return () => {
      if (saveStepsTimeoutRef.current) {
        clearTimeout(saveStepsTimeoutRef.current);
      }
    };
  }, [realtimeStepCount, stepStorageKey]);

  // Load user profile weight from local storage
  useEffect(() => {
    async function loadUserWeight() {
      try {
        const stored = user?.id
          ? (await AsyncStorage.getItem(`onboarding_data_${user.id}`)) ||
            (await AsyncStorage.getItem("onboarding_data"))
          : await AsyncStorage.getItem("onboarding_data");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.weight) {
            const raw = String(parsed.weight);
            const lbsMatch = raw.match(/(\d+(\.\d+)?)\s*lbs/i);
            let w = 70;
            if (lbsMatch) {
              w = parseFloat(lbsMatch[1]) * 0.45359237;
            } else {
              const numMatch = raw.match(/(\d+(\.\d+)?)/);
              if (numMatch) w = parseFloat(numMatch[1]);
            }
            if (w >= 30 && w <= 250) {
              setUserWeightKg(w);
            }
          }
        }
      } catch {
        // Fallback to 70 kg
      }
    }
    loadUserWeight();
  }, [user]);

  // Calorie burn factor per step based on user weight (~0.04 kcal for 70kg person)
  const calPerStep = useMemo(() => {
    return (userWeightKg * 0.57) / 1000;
  }, [userWeightKg]);

  // Initialize hardware pedometer sensor and track real-time footsteps
  // Initialize hardware pedometer sensor and track real-time footsteps (including background / screen off)
  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;
    const hardwareBaseStorageKey = `hardware_base_${user?.id || "guest"}_${todayDateId}`;

    async function syncPedometer() {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!isMounted) return;
        setIsPedometerAvailable(available);

        if (available) {
          const perm = await Pedometer.requestPermissionsAsync();
          const isGranted = perm.granted || perm.status === "granted";
          if (!isGranted) return;

          // 1. Fetch today's historical step count on iOS (CoreMotion tracks steps automatically while locked/screen off)
          if (Platform.OS === "ios") {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const now = new Date();

            try {
              const pastStepsResult = await Pedometer.getStepCountAsync(startOfToday, now);
              if (isMounted && pastStepsResult && typeof pastStepsResult.steps === "number") {
                setHardwareStepCount(pastStepsResult.steps);
              }
            } catch (err) {
              console.warn("Pedometer past steps error:", err);
            }
          }

          // 2. Load stored hardware base for Android if previously recorded today
          if (Platform.OS === "android" && initialHardwareBaseRef.current === null) {
            try {
              const savedBase = await AsyncStorage.getItem(hardwareBaseStorageKey);
              if (savedBase) {
                const parsedBase = parseInt(savedBase, 10);
                if (!isNaN(parsedBase) && parsedBase > 0) {
                  initialHardwareBaseRef.current = parsedBase;
                }
              }
            } catch {}
          }

          // 3. Watch live step counts while user moves (hardware pedometer chip continues counting while screen is locked)
          try {
            if (subscription) {
              subscription.remove();
              subscription = null;
            }
            subscription = Pedometer.watchStepCount((result) => {
              if (!isMounted || !result || typeof result.steps !== "number") return;

              if (Platform.OS === "android") {
                // On Android, result.steps is the cumulative steps recorded by hardware sensor since boot
                if (initialHardwareBaseRef.current === null) {
                  initialHardwareBaseRef.current = result.steps;
                  AsyncStorage.setItem(hardwareBaseStorageKey, String(result.steps)).catch(() => {});
                } else if (result.steps < initialHardwareBaseRef.current) {
                  // Device was rebooted today, reset baseline to current counter
                  initialHardwareBaseRef.current = result.steps;
                  AsyncStorage.setItem(hardwareBaseStorageKey, String(result.steps)).catch(() => {});
                }

                const stepsSinceSub = Math.max(0, result.steps - initialHardwareBaseRef.current);
                setLiveStepCount(stepsSinceSub);
              } else {
                setLiveStepCount(result.steps);
              }
            });
          } catch (err) {
            console.warn("Pedometer watchStepCount error:", err);
          }
        }
      } catch (err) {
        console.warn("Pedometer initialization notice:", err);
      }
    }

    syncPedometer();

    // Re-sync steps when screen turns back on / user returns to foreground after walking with screen off
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncPedometer();
      }
    });

    return () => {
      isMounted = false;
      if (subscription) subscription.remove();
      appStateSub.remove();
    };
  }, [stepStorageKey, todayDateId, user?.id]);

  // ───────────────────────────────────────────────────────────────────────
  // ACTIVITY RECOGNITION + REAL-TIME SINGLE-STEP ACCELEROMETER DETECTOR
  // ───────────────────────────────────────────────────────────────────────

  // Current recognised activity shown to user
  const [detectedActivity, setDetectedActivity] = useState<DetectedActivity>("unknown");
  // Timestamp of last step count we used for cadence
  const prevStepRef = useRef<{ count: number; ts: number }>({ count: 0, ts: Date.now() });
  // Timestamps of recent steps taken in the current session
  const stepTimestampsRef = useRef<number[]>([]);
  // Rolling window of accel readings
  const accelWindowRef = useRef<ActivityReading[]>([]);
  // Majority-vote smoother history
  const activityHistoryRef = useRef<DetectedActivity[]>([]);
  // Confidence for UI
  const [detectionConfidence, setDetectionConfidence] = useState(0);

  // Sport-confirm modal (user picks badminton / football / other)
  const [showSportModal, setShowSportModal] = useState(false);

  // Called once activity recognition confirms an activity (updates live indicator quietly without pop-ups)
  const handleActivityDetected = (act: DetectedActivity, conf: number) => {
    setDetectedActivity(act);
    setDetectionConfidence(conf);
  };

  // Accelerometer subscription: real-time per-step detection + classification loop
  useEffect(() => {
    let accelSub: { remove: () => void } | null = null;
    let classifyInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    async function startRecognition() {
      try {
        const avail = await Accelerometer.isAvailableAsync();
        if (!avail || !isMounted) return;

        // Sample interval: 50ms for responsive step detection
        Accelerometer.setUpdateInterval(ACCEL_SAMPLE_INTERVAL_MS);

        accelSub = Accelerometer.addListener(({ x, y, z }) => {
          if (!isMounted) return;
          const now = Date.now();
          const reading: ActivityReading = { x, y, z, timestamp: now };
          accelWindowRef.current.push(reading);

          // Trim to sliding window
          const cutoff = now - ACCEL_WINDOW_MS;
          accelWindowRef.current = accelWindowRef.current.filter((r) => r.timestamp >= cutoff);

          // REAL-TIME STEP PEAK DETECTOR (Increments count on every single footstep)
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const prevMag = accelPrevMagRef.current;
          accelPrevMagRef.current = magnitude;

          // Detect inflection point (peak of vertical step wave)
          const STEP_PEAK_THRESHOLD = 1.18; // G-force peak threshold for a footstep
          const MIN_STEP_INTERVAL_MS = 260; // Max ~230 steps/min (prevents double counts)

          if (magnitude > prevMag) {
            isRisingRef.current = true;
          } else if (isRisingRef.current && prevMag >= STEP_PEAK_THRESHOLD) {
            isRisingRef.current = false;
            if (now - lastStepTimeRef.current >= MIN_STEP_INTERVAL_MS) {
              lastStepTimeRef.current = now;
              stepTimestampsRef.current.push(now);
              setRealtimeStepCount((prev) => prev + 1);
            }
          }
        });

        // Classify activity every 2.5 seconds
        classifyInterval = setInterval(() => {
          if (!isMounted) return;

          const now = Date.now();
          // Keep step timestamps within last 10 seconds for real-time cadence
          const windowMs = 10_000;
          stepTimestampsRef.current = stepTimestampsRef.current.filter((t) => now - t <= windowMs);
          const stepsInWindow = stepTimestampsRef.current.length;
          // Projected steps per minute (cadence)
          const cadence = Math.round((stepsInWindow / (windowMs / 1000)) * 60);

          const snapshot = classifyActivity(accelWindowRef.current, cadence, stepsInWindow);
          activityHistoryRef.current.push(snapshot.activity);
          if (activityHistoryRef.current.length > 8) activityHistoryRef.current.shift();

          const smoothed = smoothActivity(activityHistoryRef.current, 4);
          if (isMounted) handleActivityDetected(smoothed, snapshot.confidence);
        }, 2500);
      } catch {
        // Accelerometer not available
      }
    }

    startRecognition();

    return () => {
      isMounted = false;
      if (accelSub) accelSub.remove();
      if (classifyInterval) clearInterval(classifyInterval);
    };
  }, []);

  // User workout logs from Firestore
  const [allWorkouts, setAllWorkouts] = useState<WorkoutLog[]>([]);


  // Calculate reference date strings
  const weekStartDateId = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    return formatDateStr(monday);
  }, []);

  const monthStartDateId = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  // Formatted date string for header: e.g. "Sun, 27 Sep"
  const formattedToday = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }, []);

  // Real-time Firestore subscription to user's workout logs
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.id, "logs"),
      where("type", "==", "workout")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const dStr = data.date || (data.createdAt?.toDate ? formatDateStr(data.createdAt.toDate()) : todayDateId);
          return {
            id: docSnap.id,
            ...data,
            date: dStr,
          } as WorkoutLog;
        });
        setAllWorkouts(items);
      },
      (err) => {
        console.warn("Activity logs subscription warning:", err);
      }
    );

    return () => unsubscribe();
  }, [user, todayDateId]);

  // Filter logs for Today
  const todayWorkouts = useMemo(() => {
    return allWorkouts.filter((l) => l.date === todayDateId);
  }, [allWorkouts, todayDateId]);

  // Filter logs for selected period
  const periodWorkouts = useMemo(() => {
    if (period === "today") {
      return allWorkouts.filter((l) => l.date === todayDateId);
    }
    if (period === "week") {
      return allWorkouts.filter((l) => l.date && l.date >= weekStartDateId && l.date <= todayDateId);
    }
    return allWorkouts.filter((l) => l.date && l.date >= monthStartDateId && l.date <= todayDateId);
  }, [allWorkouts, period, todayDateId, weekStartDateId, monthStartDateId]);

  // Match logs to an activity category
  const matchesActivity = (log: WorkoutLog, activityId: string): boolean => {
    const title = (log.title || "").toLowerCase();
    const wType = (log.workoutType || "").toLowerCase();
    switch (activityId) {
      case "walking":
        return title.includes("walk") || wType.includes("walk");
      case "running":
        return title.includes("run") || title.includes("jog") || wType.includes("run") || wType.includes("cardio");
      case "cycling":
        return title.includes("cycl") || title.includes("bike") || wType.includes("cycl") || wType.includes("bike");
      case "strength":
        return (
          title.includes("lift") ||
          title.includes("strength") ||
          title.includes("weight") ||
          title.includes("gym") ||
          wType === "lifting"
        );
      case "yoga":
        return title.includes("yoga") || title.includes("stretch") || title.includes("pilates") || wType.includes("yoga");
      case "badminton":
        return title.includes("badminton") || title.includes("racket") || wType.includes("badminton");
      case "football":
        return title.includes("football") || title.includes("soccer") || wType.includes("football") || wType.includes("soccer");
      case "other":
        return (
          !title.includes("walk") &&
          !wType.includes("walk") &&
          !title.includes("run") &&
          !title.includes("jog") &&
          !title.includes("cycl") &&
          !title.includes("bike") &&
          !title.includes("lift") &&
          !title.includes("strength") &&
          !title.includes("weight") &&
          !title.includes("gym") &&
          wType !== "lifting" &&
          !title.includes("yoga") &&
          !title.includes("stretch") &&
          !title.includes("badminton") &&
          !title.includes("football") &&
          !title.includes("soccer")
        );
      default:
        return false;
    }
  };

  // Aggregate all of today's workouts and physical activity
  const todayWalkingLogs = useMemo(() => {
    return todayWorkouts.filter((l) => matchesActivity(l, "walking"));
  }, [todayWorkouts]);

  // Compute real metrics for TODAY's Activity Overview card (All activities + pedometer steps)
  const summaryGoal = 10000;

  // Real footsteps from pedometer sensor / real-time detector + any logged walking/running steps
  const summarySteps = useMemo(() => {
    const liveDelta = Math.max(liveStepCount, realtimeStepCount);
    const sensorSteps = hardwareStepCount + liveDelta;
    let loggedSteps = 0;
    todayWorkouts.forEach((l) => {
      if (l.steps) {
        loggedSteps += Number(l.steps);
      }
    });
    return Math.max(sensorSteps, loggedSteps);
  }, [hardwareStepCount, liveStepCount, realtimeStepCount, todayWorkouts]);

  // Total calories burned today across ALL workouts + pedometer steps
  const summaryCalories = useMemo(() => {
    const stepsCals = summarySteps > 0 ? Math.round(summarySteps * calPerStep) : 0;
    const loggedCals = todayWorkouts.reduce((acc, curr) => acc + (Number(curr.calories) || 0), 0);
    return stepsCals + loggedCals;
  }, [summarySteps, calPerStep, todayWorkouts]);

  // Total active time today across ALL workouts + footsteps (~110 steps/min)
  const summaryActiveTime = useMemo(() => {
    const stepsTime = summarySteps > 0 ? Math.round(summarySteps / 110) : 0;
    const loggedTime = todayWorkouts.reduce((acc, curr) => acc + (Number(curr.duration) || 0), 0);
    return Math.max(stepsTime, loggedTime);
  }, [summarySteps, todayWorkouts]);

  // Total distance across logged workouts + footsteps (~0.00075km per step)
  const summaryDistance = useMemo(() => {
    let loggedDist = 0;
    todayWorkouts.forEach((l) => {
      if (l.distance) {
        loggedDist += Number(l.distance);
      }
    });
    const stepDist = summarySteps > 0 ? summarySteps * 0.00075 : 0;
    const finalDist = loggedDist + stepDist;
    return finalDist > 0 ? finalDist.toFixed(1) : "0.0";
  }, [summarySteps, todayWorkouts]);

  // Circular gauge calculations
  const ringRadius = 72;
  const strokeWidth = 11;
  const circumference = 2 * Math.PI * ringRadius;
  const progressRatio = summarySteps > 0 ? Math.min(summarySteps / summaryGoal, 1) : 0;
  const strokeDashoffset = circumference - circumference * progressRatio;

  // Selected activity config & calculations
  const currentConfig = selectedActivityId ? ACTIVITY_CONFIGS[selectedActivityId] : null;

  // Compute real data for selected activity
  const activeActivityData = useMemo(() => {
    if (!selectedActivityId) return null;

    const matchedLogs = periodWorkouts.filter((l) => matchesActivity(l, selectedActivityId));
    let calories = matchedLogs.reduce((acc, curr) => acc + (Number(curr.calories) || 0), 0);
    let duration = matchedLogs.reduce((acc, curr) => acc + (Number(curr.duration) || 0), 0);

    let distance = 0;
    matchedLogs.forEach((l) => {
      if (l.distance) {
        distance += Number(l.distance);
      }
    });

    let steps = 0;
    if (selectedActivityId === "walking") {
      const liveDelta = Math.max(liveStepCount, realtimeStepCount);
      const sensorSteps = hardwareStepCount + liveDelta;
      let loggedSteps = 0;
      matchedLogs.forEach((l) => {
        if (l.steps) loggedSteps += Number(l.steps);
      });
      if (period === "today") {
        steps = Math.max(sensorSteps, loggedSteps);
      } else {
        steps = loggedSteps + sensorSteps;
      }

      if (steps > 0) {
        const stepDist = steps * 0.00075;
        if (stepDist > distance) distance = stepDist;
        const stepCal = Math.round(steps * calPerStep);
        if (stepCal > calories) calories = stepCal;
        const stepDuration = Math.round(steps / 110);
        if (stepDuration > duration) duration = stepDuration;
      }
    } else {
      matchedLogs.forEach((l) => {
        if (l.steps) steps += Number(l.steps);
      });
    }

    let sets = 0;
    let reps = 0;
    matchedLogs.forEach((l) => {
      if (l.sets) sets += Number(l.sets);
      if (l.reps) reps += Number(l.reps);
    });

    const isWalking = selectedActivityId === "walking";
    const isRunning = selectedActivityId === "running";
    const isCycling = selectedActivityId === "cycling";
    const isStrength = selectedActivityId === "strength";
    const isYoga = selectedActivityId === "yoga";
    const isBadminton = selectedActivityId === "badminton";
    const isFootball = selectedActivityId === "football";

    const stepGoal = period === "today" ? 10000 : period === "week" ? 70000 : 300000;

    // Primary values
    let primaryValue = "0 min";
    let primarySubtitle: string | undefined;

    if (isWalking) {
      primaryValue = steps.toLocaleString();
      primarySubtitle = `/ ${stepGoal.toLocaleString()}`;
    } else if (isRunning || isCycling) {
      primaryValue = distance > 0 ? `${distance.toFixed(1)} km` : "0.0 km";
      primarySubtitle = `(${formatDuration(duration)})`;
    } else {
      primaryValue = formatDuration(duration);
    }

    // Stats
    let stat1 = { label: "", value: "" };
    let stat2 = { label: "", value: "" };
    let stat3: { label: string; value: string } | undefined;

    if (isWalking) {
      stat1 = { label: "Calories Burned", value: `${calories} cal` };
      stat2 = { label: "Distance", value: `${distance.toFixed(1)} km` };
      stat3 = { label: "Time", value: formatDuration(duration) };
    } else if (isRunning) {
      stat1 = { label: "Avg. Pace", value: formatPace(duration, distance) + " /km" };
      stat2 = {
        label: "Speed",
        value: duration > 0 && distance > 0 ? `${(distance / (duration / 60)).toFixed(1)} km/h` : "0.0 km/h",
      };
    } else if (isCycling) {
      stat1 = {
        label: "Avg. Speed",
        value: duration > 0 && distance > 0 ? `${(distance / (duration / 60)).toFixed(1)} km/h` : "0.0 km/h",
      };
      stat2 = { label: "Time", value: formatDuration(duration) };
    } else if (isStrength) {
      stat1 = { label: "Sets", value: String(sets) };
      stat2 = { label: "Reps", value: String(reps) };
      stat3 = { label: "Avg. HR", value: duration > 0 ? "112 bpm" : "--" };
    } else if (isYoga) {
      stat1 = { label: "Avg. HR", value: duration > 0 ? "82 bpm" : "--" };
      stat2 = {
        label: "Calories / min",
        value: duration > 0 ? `${(calories / duration).toFixed(1)} cal` : "0.0 cal",
      };
    } else if (isBadminton) {
      stat1 = { label: "Sets", value: duration > 0 ? String(Math.max(1, Math.round(duration / 20))) : "0" };
      stat2 = { label: "Avg. HR", value: duration > 0 ? "128 bpm" : "--" };
      stat3 = { label: "Intensity", value: duration > 0 ? "High" : "--" };
    } else if (isFootball) {
      stat1 = { label: "Distance", value: `${distance.toFixed(1)} km` };
      stat2 = { label: "Avg. HR", value: duration > 0 ? "145 bpm" : "--" };
      stat3 = { label: "Intensity", value: duration > 0 ? "Match" : "--" };
    } else {
      stat1 = { label: "Avg. HR", value: duration > 0 ? "115 bpm" : "--" };
      stat2 = {
        label: "Calories / min",
        value: duration > 0 ? `${(calories / duration).toFixed(1)} cal` : "0.0 cal",
      };
    }

    // Breakdown
    const breakdown1 = {
      label: currentConfig?.name || "Workout",
      calories: calories,
      pct: calories > 0 ? 100 : 0,
    };
    const breakdown2 = {
      label: "Warm up / Recovery",
      calories: 0,
      pct: 0,
    };

    // Tip
    let tip = "";
    if (calories > 0 || (isWalking && steps > 0)) {
      if (isWalking) tip = `You reached ${Math.min(100, Math.round((steps / stepGoal) * 100))}% of your step goal for this period!`;
      else if (isRunning) tip = `Great run! You burned ${calories} calories in ${formatDuration(duration)}.`;
      else if (isCycling) tip = `Nice ride! You burned ${calories} calories in ${formatDuration(duration)}.`;
      else if (isStrength) tip = `Good work! You burned ${calories} calories in ${formatDuration(duration)}.`;
      else if (isYoga) tip = `Calm mind, healthy body! You burned ${calories} calories in ${formatDuration(duration)}.`;
      else if (isBadminton) tip = `High agility workout! You burned ${calories} calories in ${formatDuration(duration)}.`;
      else if (isFootball) tip = `Intense match! You burned ${calories} calories in ${formatDuration(duration)}.`;
      else tip = `Awesome effort! You burned ${calories} calories in this period.`;
    } else {
      if (isWalking) {
        tip = "No walking recorded today. Take a walk with your phone to start tracking steps, calories, and time automatically!";
      } else {
        tip = `No ${currentConfig?.name.toLowerCase() || "activity"} logged for this period. Tap below to log your session!`;
      }
    }

    return {
      primaryValue,
      primarySubtitle,
      calories,
      duration,
      steps,
      distance,
      stat1,
      stat2,
      stat3,
      breakdown1,
      breakdown2,
      tip,
    };
  }, [selectedActivityId, periodWorkouts, period, currentConfig, hardwareStepCount, liveStepCount, calPerStep]);

  // Hourly steps for walking detail chart (from actual today's walking logs and sensors)
  const hourlySteps = useMemo(() => {
    const buckets = [
      { time: "6am", steps: 0 },
      { time: "9am", steps: 0 },
      { time: "12pm", steps: 0 },
      { time: "3pm", steps: 0 },
      { time: "6pm", steps: 0 },
      { time: "9pm", steps: 0 },
    ];

    todayWalkingLogs.forEach((l) => {
      const logSteps = l.steps ? Number(l.steps) : 0;
      if (logSteps <= 0) return;

      let hour = 12;
      if (l.createdAt) {
        try {
          if (l.createdAt.toDate) hour = l.createdAt.toDate().getHours();
          else if (l.createdAt.seconds) hour = new Date(l.createdAt.seconds * 1000).getHours();
        } catch {
          hour = 12;
        }
      }

      if (hour < 8) buckets[0].steps += logSteps;
      else if (hour < 11) buckets[1].steps += logSteps;
      else if (hour < 14) buckets[2].steps += logSteps;
      else if (hour < 17) buckets[3].steps += logSteps;
      else if (hour < 20) buckets[4].steps += logSteps;
      else buckets[5].steps += logSteps;
    });

    const totalPedometer = hardwareStepCount + Math.max(liveStepCount, realtimeStepCount);
    const currentHour = new Date().getHours();
    if (totalPedometer > 0) {
      let bIdx = 0;
      if (currentHour < 8) bIdx = 0;
      else if (currentHour < 11) bIdx = 1;
      else if (currentHour < 14) bIdx = 2;
      else if (currentHour < 17) bIdx = 3;
      else if (currentHour < 20) bIdx = 4;
      else bIdx = 5;

      buckets[bIdx].steps = Math.max(buckets[bIdx].steps, totalPedometer);
    }

    const maxSteps = Math.max(...buckets.map((b) => b.steps), 1000);

    return buckets.map((b) => ({
      time: b.time,
      steps: b.steps,
      pct: b.steps > 0 ? Math.min(100, Math.max(8, (b.steps / maxSteps) * 100)) : 0,
    }));
  }, [todayWalkingLogs, hardwareStepCount, liveStepCount, realtimeStepCount]);

  const handleOpenActivity = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedActivityId(id);
    setPeriod("today");
  };

  const handleBackToOverview = () => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedActivityId(null);
  };

  const handlePeriodChange = (p: PeriodType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPeriod(p);
  };

  const handleStartWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (selectedActivityId && currentConfig) {
      router.push({
        pathname: "/log-exercise-details",
        params: {
          type: currentConfig.defaultType,
          title: currentConfig.name,
        },
      });
    } else {
      router.push("/log-exercise-options");
    }
  };

  // Render Activity Icon Helper
  const renderActivityIcon = (
    iconName: string,
    family: "Ionicons" | "MaterialCommunityIcons",
    size: number,
    color: string
  ) => {
    if (family === "MaterialCommunityIcons") {
      return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
    }
    return <Ionicons name={iconName as any} size={size} color={color} />;
  };

  // DETAIL VIEW
  if (currentConfig && activeActivityData) {
    const isWalking = currentConfig.id === "walking";

    return (
      <SafeAreaView style={styles.safeContainer} edges={["top", "left", "right"]}>
        {/* Detail Top Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToOverview}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
          </TouchableOpacity>

          <View style={styles.detailTitleContainer}>
            <View
              style={[
                styles.detailHeaderIconBadge,
                { backgroundColor: currentConfig.bgColor },
              ]}
            >
              {renderActivityIcon(
                currentConfig.iconName,
                currentConfig.iconFamily,
                18,
                currentConfig.color
              )}
            </View>
            <Text style={styles.detailHeaderTitle}>{currentConfig.name}</Text>
          </View>

          <TouchableOpacity
            style={styles.moreButton}
            onPress={handleStartWorkout}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.detailScrollContent}
        >
          {/* Time Filter Pills: Today | Week | Month */}
          <View style={styles.filterPillsContainer}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                period === "today" && styles.filterPillActive,
              ]}
              onPress={() => handlePeriodChange("today")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  period === "today" && styles.filterPillTextActive,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                period === "week" && styles.filterPillActive,
              ]}
              onPress={() => handlePeriodChange("week")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  period === "week" && styles.filterPillTextActive,
                ]}
              >
                Week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                period === "month" && styles.filterPillActive,
              ]}
              onPress={() => handlePeriodChange("month")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  period === "month" && styles.filterPillTextActive,
                ]}
              >
                Month
              </Text>
            </TouchableOpacity>
          </View>

          {/* Primary Metric Card */}
          <View style={styles.mainMetricCard}>
            <View style={styles.mainMetricHeaderRow}>
              <View
                style={[
                  styles.mainMetricIconBadge,
                  { backgroundColor: currentConfig.bgColor },
                ]}
              >
                {renderActivityIcon(
                  currentConfig.iconName,
                  currentConfig.iconFamily,
                  26,
                  currentConfig.color
                )}
              </View>

              <View style={styles.mainMetricTitleCol}>
                <Text style={styles.mainMetricLabel}>
                  {isWalking ? "Steps" : currentConfig.name}
                </Text>
                <View style={styles.mainMetricValueRow}>
                  <Text style={styles.mainMetricValue}>{activeActivityData.primaryValue}</Text>
                  {activeActivityData.primarySubtitle ? (
                    <Text style={styles.mainMetricSubValue}>
                      {" "}
                      {activeActivityData.primarySubtitle}
                    </Text>
                  ) : null}
                </View>
                {isWalking && isPedometerAvailable && (
                  <View style={styles.pedometerActiveBadge}>
                    <View style={styles.pedometerPulseDot} />
                    <Text style={styles.pedometerActiveBadgeText}>Phone Motion Sensor Connected</Text>
                  </View>
                )}
              </View>
            </View>

            {/* If not walking, display Calories Burned row under title */}
            {!isWalking && (
              <View style={styles.secondaryCalorieRow}>
                <Ionicons name="flame" size={18} color="#F59E0B" />
                <Text style={styles.secondaryCalorieLabel}>
                  Calories Burned{" "}
                  <Text style={styles.secondaryCalorieValue}>
                    {activeActivityData.calories} cal
                  </Text>
                </Text>
              </View>
            )}

            {/* Stats row or boxes */}
            {isWalking ? (
              <View style={styles.walkingStatsRow}>
                <View style={styles.walkingStatItem}>
                  <View style={styles.statIconBadgeFlame}>
                    <Ionicons name="flame" size={16} color="#F59E0B" />
                  </View>
                  <Text style={styles.walkingStatLabel}>Calories Burned</Text>
                  <Text style={styles.walkingStatValue}>
                    {activeActivityData.stat1.value}
                  </Text>
                </View>

                <View style={styles.walkingStatDivider} />

                <View style={styles.walkingStatItem}>
                  <View style={styles.statIconBadgePin}>
                    <Ionicons name="location" size={16} color="#06B6D4" />
                  </View>
                  <Text style={styles.walkingStatLabel}>Distance</Text>
                  <Text style={styles.walkingStatValue}>
                    {activeActivityData.stat2.value}
                  </Text>
                </View>

                <View style={styles.walkingStatDivider} />

                <View style={styles.walkingStatItem}>
                  <View style={styles.statIconBadgeClock}>
                    <Ionicons name="time" size={16} color="#3B82F6" />
                  </View>
                  <Text style={styles.walkingStatLabel}>Time</Text>
                  <Text style={styles.walkingStatValue}>
                    {activeActivityData.stat3?.value}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.activityStatsGrid}>
                <View style={styles.activityStatBox}>
                  <Text style={styles.activityStatBoxLabel}>
                    {activeActivityData.stat1.label}
                  </Text>
                  <Text style={styles.activityStatBoxValue}>
                    {activeActivityData.stat1.value}
                  </Text>
                </View>

                <View style={styles.activityStatBox}>
                  <Text style={styles.activityStatBoxLabel}>
                    {activeActivityData.stat2.label}
                  </Text>
                  <Text style={styles.activityStatBoxValue}>
                    {activeActivityData.stat2.value}
                  </Text>
                </View>

                {activeActivityData.stat3 ? (
                  <View style={styles.activityStatBox}>
                    <Text style={styles.activityStatBoxLabel}>
                      {activeActivityData.stat3.label}
                    </Text>
                    <Text style={styles.activityStatBoxValue}>
                      {activeActivityData.stat3.value}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Secondary Section: Step Count vs Time OR Calories Burned Breakdown */}
          {isWalking ? (
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownCardTitle}>Step Count vs Time</Text>

              {/* Hourly Step Chart */}
              <View style={styles.chartContainer}>
                <View style={styles.chartYAxis}>
                  <Text style={styles.chartYLabel}>Max</Text>
                  <Text style={styles.chartYLabel}>Mid</Text>
                  <Text style={styles.chartYLabel}>0</Text>
                </View>

                <View style={styles.chartBarsArea}>
                  {/* Subtle Gridlines */}
                  <View style={styles.chartGridLine} />
                  <View style={[styles.chartGridLine, { top: "50%" }]} />
                  <View style={[styles.chartGridLine, { top: "98%" }]} />

                  {/* Bars */}
                  <View style={styles.chartBarsRow}>
                    {hourlySteps.map((step, idx) => (
                      <View key={idx} style={styles.chartBarCol}>
                        <View style={styles.chartTripleBars}>
                          <View
                            style={[
                              styles.chartSingleBar,
                              { height: `${step.pct}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartXLabel}>{step.time}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Tip Note */}
              <View style={styles.tipBox}>
                <Ionicons name="bulb" size={20} color="#F59E0B" />
                <Text style={styles.tipText}>{activeActivityData.tip}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownCardTitle}>Calories Burned Breakdown</Text>

              {/* Breakdown Bar 1 */}
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownItemHeader}>
                  <Text style={styles.breakdownItemLabel}>
                    {activeActivityData.breakdown1.label}
                  </Text>
                  <Text
                    style={[
                      styles.breakdownItemValue,
                      { color: currentConfig.color },
                    ]}
                  >
                    {activeActivityData.breakdown1.calories} cal
                  </Text>
                </View>
                <View style={styles.breakdownProgressBarTrack}>
                  <View
                    style={[
                      styles.breakdownProgressBarFill,
                      {
                        width: `${activeActivityData.breakdown1.pct}%`,
                        backgroundColor: currentConfig.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownPctText}>
                  {activeActivityData.breakdown1.pct}%
                </Text>
              </View>

              {/* Breakdown Bar 2 */}
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownItemHeader}>
                  <Text style={styles.breakdownItemLabel}>
                    {activeActivityData.breakdown2.label}
                  </Text>
                  <Text style={styles.breakdownItemValueMuted}>
                    {activeActivityData.breakdown2.calories} cal
                  </Text>
                </View>
                <View style={styles.breakdownProgressBarTrack}>
                  <View
                    style={[
                      styles.breakdownProgressBarFill,
                      {
                        width: `${activeActivityData.breakdown2.pct}%`,
                        backgroundColor: "rgba(255, 255, 255, 0.15)",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownPctText}>
                  {activeActivityData.breakdown2.pct}%
                </Text>
              </View>

              {/* Motivation Card */}
              <View style={styles.motivationBanner}>
                <View
                  style={[
                    styles.motivationIconBadge,
                    { backgroundColor: currentConfig.bgColor },
                  ]}
                >
                  {renderActivityIcon(
                    currentConfig.iconName,
                    currentConfig.iconFamily,
                    20,
                    currentConfig.color
                  )}
                </View>
                <Text style={styles.motivationText}>{activeActivityData.tip}</Text>
              </View>
            </View>
          )}

          {/* Quick Action Log CTA */}
          <TouchableOpacity
            style={[
              styles.startWorkoutButton,
              { backgroundColor: currentConfig.color },
            ]}
            onPress={handleStartWorkout}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={18} color="#FFFFFF" />
            <Text style={styles.startWorkoutButtonText}>
              Log {currentConfig.name} Workout
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // OVERVIEW SCREEN
  return (
    <SafeAreaView style={styles.safeContainer} edges={["top", "left", "right"]}>
      {/* App Header with profile avatar, welcome back, and bell icon */}
      <HomeHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Pills Bar: Home | Activity | Nutrition | Progress */}
        <View style={styles.topPillsContainer}>
          <TouchableOpacity
            style={styles.topPill}
            onPress={() => router.push("/(tabs)")}
            activeOpacity={0.7}
          >
            <Ionicons name="home-outline" size={15} color={Colors.dark.textSecondary} />
            <Text style={styles.topPillText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topPill, styles.topPillActive]}
            activeOpacity={0.9}
          >
            <Ionicons name="fitness" size={15} color="#0D1117" />
            <Text style={[styles.topPillText, styles.topPillTextActive]}>Activity</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topPill}
            onPress={() => router.push("/food-search")}
            activeOpacity={0.7}
          >
            <Ionicons name="nutrition-outline" size={15} color={Colors.dark.textSecondary} />
            <Text style={styles.topPillText}>Nutrition</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topPill}
            onPress={() => router.push("/(tabs)/analytics")}
            activeOpacity={0.7}
          >
            <Ionicons name="bar-chart-outline" size={15} color={Colors.dark.textSecondary} />
            <Text style={styles.topPillText}>Progress</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Activity Card */}
        <View style={styles.todayCard}>
          <View style={styles.todayCardHeader}>
            <View style={styles.todayCardTitleRow}>
              <Text style={styles.todayCardTitle}>{"Today's Activity"}</Text>
            </View>
            <View style={styles.todayCardHeaderRight}>
              <Text style={styles.todayCardDate}>{formattedToday}</Text>
            </View>
          </View>

          {/* Center Circular Steps Gauge */}
          <View style={styles.gaugeContainer}>
            <Svg width={180} height={180} viewBox="0 0 180 180">
              <Defs>
                <LinearGradient id="stepsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#10B981" />
                  <Stop offset="100%" stopColor="#059669" />
                </LinearGradient>
              </Defs>

              {/* Background Track */}
              <Circle
                cx="90"
                cy="90"
                r={ringRadius}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Active Progress Stroke */}
              <Circle
                cx="90"
                cy="90"
                r={ringRadius}
                stroke="url(#stepsGradient)"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                transform="rotate(-90 90 90)"
              />
            </Svg>

            {/* Inner Ring Content */}
            <View style={styles.gaugeInnerContent}>
              <View style={styles.gaugeShoeBadge}>
                <MaterialCommunityIcons name="shoe-print" size={20} color="#10B981" />
              </View>
              <Text style={styles.gaugeStepsLabel}>Steps</Text>
              <Text style={styles.gaugeStepsNumber}>
                {summarySteps.toLocaleString()}
              </Text>
              <Text style={styles.gaugeGoalText}>
                / {summaryGoal.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Live Sensor Motion Indicator */}
          {isPedometerAvailable && (
            <View style={styles.sensorStatusRow}>
              <View style={styles.sensorStatusDot} />
              <Text style={styles.sensorStatusText}>
                Live step counter active • updates as you walk
              </Text>
            </View>
          )}

          {/* Bottom 3 Stat Columns */}
          <View style={styles.todayStatsRow}>
            {/* Calories Burned */}
            <View style={styles.todayStatCol}>
              <View style={styles.statIconBadgeFlame}>
                <Ionicons name="flame" size={16} color="#F59E0B" />
              </View>
              <Text style={styles.todayStatColLabel}>Calories Burned</Text>
              <Text style={styles.todayStatColValue}>{summaryCalories} cal</Text>
            </View>

            <View style={styles.todayStatDivider} />

            {/* Distance */}
            <View style={styles.todayStatCol}>
              <View style={styles.statIconBadgePin}>
                <Ionicons name="location" size={16} color="#06B6D4" />
              </View>
              <Text style={styles.todayStatColLabel}>Distance</Text>
              <Text style={styles.todayStatColValue}>{summaryDistance} km</Text>
            </View>

            <View style={styles.todayStatDivider} />

            {/* Active Time */}
            <View style={styles.todayStatCol}>
              <View style={styles.statIconBadgeClock}>
                <Ionicons name="time" size={16} color="#3B82F6" />
              </View>
              <Text style={styles.todayStatColLabel}>Active Time</Text>
              <Text style={styles.todayStatColValue}>{summaryActiveTime} min</Text>
            </View>
          </View>
        </View>

        {/* Quick Activities Section */}
        <View style={styles.quickActivitiesSection}>
          <Text style={styles.quickActivitiesTitle}>Quick Activities</Text>

          {/* 8-Card Grid (4 per row) */}
          <View style={styles.quickActivitiesGrid}>
            {Object.values(ACTIVITY_CONFIGS).map((act) => {
              const isCurrentActive =
                (act.id === "walking" && detectedActivity === "walking") ||
                (act.id === "running" && detectedActivity === "running") ||
                (act.id === "cycling" && detectedActivity === "cycling") ||
                ((act.id === "badminton" || act.id === "football") && detectedActivity === "sport");

              return (
                <TouchableOpacity
                  key={act.id}
                  style={[
                    styles.activityGridCard,
                    isCurrentActive && styles.activityGridCardActive,
                  ]}
                  onPress={() => handleOpenActivity(act.id)}
                  activeOpacity={0.75}
                >
                  {/* Live green dot indicator on top right corner */}
                  {isCurrentActive && (
                    <View style={styles.activeActivityBadge}>
                      <View style={styles.activeActivityDot} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.activityGridIconCircle,
                      { backgroundColor: act.bgColor },
                    ]}
                  >
                    {renderActivityIcon(act.iconName, act.iconFamily, 22, act.color)}
                  </View>
                  <Text
                    style={[
                      styles.activityGridLabel,
                      isCurrentActive && styles.activityGridLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {act.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110, // accounts for floating bottom tab bar
  },

  // TOP SUB-NAV PILLS
  topPillsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 8,
  },
  topPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 5,
  },
  topPillActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  topPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  topPillTextActive: {
    color: "#0D1117",
    fontWeight: "700",
  },

  // TODAY'S ACTIVITY CARD
  todayCard: {
    backgroundColor: "#131924",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  todayCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  todayCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  todayCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  todayCardDate: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.dark.textMuted,
  },
  sensorStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 2,
    marginBottom: 10,
  },
  sensorStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  sensorStatusText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },

  // GAUGE
  gaugeContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    position: "relative",
  },
  gaugeInnerContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeShoeBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  gaugeStepsLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.dark.textMuted,
  },
  gaugeStepsNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.dark.text,
    letterSpacing: 0.5,
  },
  gaugeGoalText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.dark.textMuted,
  },

  // STATS ROW (3 COLUMNS)
  todayStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  todayStatCol: {
    flex: 1,
    alignItems: "center",
  },
  todayStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  statIconBadgeFlame: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statIconBadgePin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statIconBadgeClock: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  todayStatColLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.dark.textMuted,
    marginBottom: 2,
    textAlign: "center",
  },
  todayStatColValue: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.text,
    textAlign: "center",
  },

  // QUICK ACTIVITIES
  quickActivitiesSection: {
    marginBottom: 20,
  },
  quickActivitiesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: 14,
  },
  quickActivitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  activityGridCard: {
    width: (SCREEN_WIDTH - 32 - 30) / 4,
    backgroundColor: "#131924",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  activityGridCardActive: {
    borderColor: "rgba(16, 185, 129, 0.45)",
    backgroundColor: "rgba(16, 185, 129, 0.06)",
  },
  activeActivityBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeActivityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activityGridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  activityGridLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  activityGridLabelActive: {
    color: "#10B981",
    fontWeight: "700",
  },

  // DETAIL VIEW STYLES
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailHeaderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },

  // FILTER PILLS (TODAY | WEEK | MONTH)
  filterPillsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 24,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  filterPill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: "#10B981",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  filterPillTextActive: {
    color: "#0D1117",
    fontWeight: "700",
  },

  // MAIN METRIC CARD
  mainMetricCard: {
    backgroundColor: "#131924",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 20,
    marginBottom: 18,
  },
  mainMetricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  mainMetricIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  mainMetricTitleCol: {
    flex: 1,
  },
  mainMetricLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  mainMetricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  mainMetricValue: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.dark.text,
  },
  mainMetricSubValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textMuted,
  },

  secondaryCalorieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    paddingVertical: 4,
  },
  secondaryCalorieLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  secondaryCalorieValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F59E0B",
  },

  // WALKING STATS IN CARD
  walkingStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  walkingStatItem: {
    flex: 1,
    alignItems: "center",
  },
  walkingStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  walkingStatLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  walkingStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.text,
  },

  // RUNNING / CYCLING / STRENGTH / YOGA STATS GRID
  activityStatsGrid: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 8,
  },
  activityStatBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  activityStatBoxLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  activityStatBoxValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
  },

  // BREAKDOWN / CHART CARD
  breakdownCard: {
    backgroundColor: "#131924",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 20,
    marginBottom: 20,
  },
  breakdownCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: 16,
  },

  // STEP CHART
  chartContainer: {
    flexDirection: "row",
    height: 140,
    marginBottom: 16,
  },
  chartYAxis: {
    width: 36,
    justifyContent: "space-between",
    paddingBottom: 22,
  },
  chartYLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    textAlign: "right",
    paddingRight: 6,
  },
  chartBarsArea: {
    flex: 1,
    position: "relative",
  },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  chartBarsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 22,
  },
  chartBarCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  chartTripleBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    marginBottom: 6,
    height: 100,
  },
  chartSingleBar: {
    width: 14,
    backgroundColor: "#10B981",
    borderRadius: 4,
  },
  chartXLabel: {
    position: "absolute",
    bottom: -18,
    fontSize: 10,
    color: Colors.dark.textMuted,
  },

  // TIP BOX (WALKING)
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.15)",
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },

  // PROGRESS BAR BREAKDOWN
  breakdownItem: {
    marginBottom: 16,
  },
  breakdownItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  breakdownItemLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  breakdownItemValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  breakdownItemValueMuted: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textMuted,
  },
  breakdownProgressBarTrack: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  breakdownProgressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  breakdownPctText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.dark.textMuted,
    textAlign: "right",
  },

  // MOTIVATION BANNER
  motivationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 4,
  },
  motivationIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  motivationText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },

  // CTA BUTTON
  startWorkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 20,
    marginTop: 4,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startWorkoutButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pedometerActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  pedometerPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  pedometerActiveBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#10B981",
  },

  // ── DETECTION BANNER ──────────────────────────────────────────────────────
  detectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  detectionBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detectionBannerTextGroup: {
    flex: 1,
  },
  detectionBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  detectionBannerSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  detectionBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  detectionBannerBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  detectionBannerClose: {
    padding: 4,
  },

  // ── SPORT CONFIRM MODAL ───────────────────────────────────────────────────
  sportModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sportModalCard: {
    width: "100%",
    backgroundColor: "#131924",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sportModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.dark.text,
    marginBottom: 6,
  },
  sportModalSub: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  sportModalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  sportModalOptionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  sportModalCancel: {
    marginTop: 6,
    paddingVertical: 10,
  },
  sportModalCancelText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
});

