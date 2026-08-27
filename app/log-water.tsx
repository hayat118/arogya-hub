import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import Colors from "../constants/Colors";
import * as Haptics from "expo-haptics";

export default function LogWater() {
  const { user } = useUser();
  const router = useRouter();

  // State
  const [waterMl, setWaterMl] = useState<number>(0);
  const [activeDate, setActiveDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const maxMl = 1000; // 4 full glasses max

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

  const handleIncrease = () => {
    if (waterMl < maxMl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setWaterMl((prev) => prev + 125);
    }
  };

  const handleDecrease = () => {
    if (waterMl > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setWaterMl((prev) => prev - 125);
    }
  };

  const handleLogWater = async () => {
    if (!user) return;
    if (waterMl === 0) {
      alert("Please add some water intake to log.");
      return;
    }
    setIsSaving(true);

    try {
      const userLogsCollection = collection(db, "users", user.id, "logs");
      // amount is stored in Liters (e.g. 375 ml = 0.375 L)
      await addDoc(userLogsCollection, {
        title: "Water Intake",
        type: "water",
        amount: waterMl / 1000,
        date: activeDate,
        createdAt: serverTimestamp(),
      });

      // Trigger success haptics
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Redirect to dashboard home
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Failed to save water intake:", err);
      alert("Failed to log water intake. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Dynamically render glass images in centered flex rows
  const renderGlasses = () => {
    if (waterMl === 0) {
      return (
        <Image
          source={require("../assets/images/empty_glass.png")}
          style={styles.bigSingleGlass}
          resizeMode="contain"
        />
      );
    }

    if (waterMl === 125) {
      return (
        <Image
          source={require("../assets/images/half_glass.png")}
          style={styles.bigSingleGlass}
          resizeMode="contain"
        />
      );
    }

    if (waterMl === 250) {
      return (
        <Image
          source={require("../assets/images/full_glass.png")}
          style={styles.bigSingleGlass}
          resizeMode="contain"
        />
      );
    }

    const fullGlassesCount = Math.floor(waterMl / 250);
    const hasHalfGlass = waterMl % 250 === 125;

    const glasses = [];
    for (let i = 0; i < fullGlassesCount; i++) {
      glasses.push(
        <Image
          key={`full-${i}`}
          source={require("../assets/images/full_glass.png")}
          style={styles.gridGlass}
          resizeMode="contain"
        />
      );
    }

    if (hasHalfGlass) {
      glasses.push(
        <Image
          key="half"
          source={require("../assets/images/half_glass.png")}
          style={styles.gridGlass}
          resizeMode="contain"
        />
      );
    }

    return <View style={styles.glassesContainer}>{glasses}</View>;
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
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
        <Text style={styles.headerTitle}>Add Water Intake</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.contentContainer}>
        {/* Dynamic Visual representation */}
        <View style={styles.visualDisplay}>{renderGlasses()}</View>

        {/* Counter Adjuster */}
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={[styles.adjustBtn, waterMl === 0 && styles.adjustBtnDisabled]}
            onPress={handleDecrease}
            disabled={waterMl === 0 || isSaving}
            activeOpacity={0.7}
          >
            <Ionicons name="remove-sharp" size={24} color={Colors.dark.text} />
          </TouchableOpacity>

          <View style={styles.countTextContainer}>
            <Text style={styles.volumeText}>{waterMl}</Text>
            <Text style={styles.unitLabel}>ml</Text>
          </View>

          <TouchableOpacity
            style={[styles.adjustBtn, waterMl === maxMl && styles.adjustBtnDisabled]}
            onPress={handleIncrease}
            disabled={waterMl === maxMl || isSaving}
            activeOpacity={0.7}
          >
            <Ionicons name="add-sharp" size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        {/* Informative Subtext */}
        <Text style={styles.instructionsText}>
          Use the plus and minus buttons to log your water intake. Each click adds a half glass (125 ml). Maximum capacity is 1,000 ml (4 full glasses).
        </Text>
      </View>

      {/* Log Action Button */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[styles.logButton, waterMl === 0 && styles.logButtonDisabled]}
          onPress={handleLogWater}
          disabled={waterMl === 0 || isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.dark.white} />
          ) : (
            <>
              <Text style={styles.logButtonText}>Log Water</Text>
              <Ionicons name="water-sharp" size={18} color={Colors.dark.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
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
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  visualDisplay: {
    height: 220,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  bigSingleGlass: {
    width: 140,
    height: 200,
  },
  glassesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 12,
  },
  gridGlass: {
    width: 70,
    height: 100,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    marginBottom: 36,
  },
  adjustBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  adjustBtnDisabled: {
    opacity: 0.25,
  },
  countTextContainer: {
    alignItems: "center",
    minWidth: 100,
  },
  volumeText: {
    color: "#3B82F6", // Bright Water Blue
    fontSize: 48,
    fontWeight: "900",
    textShadowColor: "rgba(59, 130, 246, 0.25)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  unitLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: -4,
    letterSpacing: 1,
  },
  instructionsText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
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
  logButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    shadowColor: "transparent",
    opacity: 0.5,
  },
  logButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
