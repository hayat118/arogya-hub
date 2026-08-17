import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "../../constants/Colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Dashboard() {
  const { user } = useUser();

  const [targetCalories, setTargetCalories] = useState(2000);
  const [targetProtein, setTargetProtein] = useState(150);
  const [targetCarbs, setTargetCarbs] = useState(200);
  const [targetFats, setTargetFats] = useState(70);
  const [targetWater, setTargetWater] = useState(3.0);
  const [aiAdvice, setAiAdvice] = useState("");

  useEffect(() => {
    async function loadTargets() {
      if (!user) return;
      try {
        const stored = await AsyncStorage.getItem(`onboarding_data_${user.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.targetCalories) setTargetCalories(Number(parsed.targetCalories));
          if (parsed.targetProtein) setTargetProtein(Number(parsed.targetProtein));
          if (parsed.targetCarbs) setTargetCarbs(Number(parsed.targetCarbs));
          if (parsed.targetFats) setTargetFats(Number(parsed.targetFats));
          if (parsed.targetWater) setTargetWater(Number(parsed.targetWater));
          if (parsed.aiAdvice) setAiAdvice(parsed.aiAdvice);
        }
      } catch (error) {
        console.error("Failed to load calorie targets from AsyncStorage:", error);
      }
    }
    loadTargets();
  }, [user]);

  const consumedCalories = 1250;
  const remainingCalories = Math.max(0, targetCalories - consumedCalories);

  const consumedProtein = 95;
  const consumedCarbs = 110;
  const consumedFats = 42;

  // Percentage calculations
  const proteinPercent = Math.min(1, consumedProtein / targetProtein);
  const carbsPercent = Math.min(1, consumedCarbs / targetCarbs);
  const fatsPercent = Math.min(1, consumedFats / targetFats);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Welcome Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.welcomeText}>Hello,</Text>
          <Text style={styles.nameText}>{user?.firstName || "Fitness Achiever"}</Text>
        </View>
        <Image
          source={user?.imageUrl ? { uri: user.imageUrl } : require("../../assets/images/icon.png")}
          style={styles.avatar}
        />
      </View>

      {/* Main Calorie Ring / Visual Card */}
      <View style={styles.glassCard}>
        <View style={styles.ringContainer}>
          <View style={styles.ringInfo}>
            <Text style={styles.remainingNumber}>{remainingCalories}</Text>
            <Text style={styles.remainingLabel}>kcal remaining</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.ringStatsRow}>
          <View style={styles.statCol}>
            <Ionicons name="flame-outline" size={18} color="#F59E0B" />
            <Text style={styles.statValue}>{consumedCalories}</Text>
            <Text style={styles.statLabel}>Eaten</Text>
          </View>
          <View style={styles.statCol}>
            <Ionicons name="barbell-outline" size={18} color="#10B981" />
            <Text style={styles.statValue}>350</Text>
            <Text style={styles.statLabel}>Active Burned</Text>
          </View>
        </View>
      </View>

      {/* Macros Section */}
      <Text style={styles.sectionTitle}>Macronutrients</Text>
      <View style={styles.macrosContainer}>
        {/* Protein */}
        <View style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroName}>Protein</Text>
            <Text style={styles.macroRatio}>
              {consumedProtein}/{targetProtein}g
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${proteinPercent * 100}%`, backgroundColor: "#8B5CF6" }]} />
          </View>
        </View>

        {/* Carbs */}
        <View style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroName}>Carbs</Text>
            <Text style={styles.macroRatio}>
              {consumedCarbs}/{targetCarbs}g
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${carbsPercent * 100}%`, backgroundColor: "#3B82F6" }]} />
          </View>
        </View>

        {/* Fats */}
        <View style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroName}>Fats</Text>
            <Text style={styles.macroRatio}>
              {consumedFats}/{targetFats}g
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${fatsPercent * 100}%`, backgroundColor: Colors.dark.error }]} />
          </View>
        </View>
      </View>

      {/* AI Daily Advice & Hydration */}
      <Text style={styles.sectionTitle}>AI Target & Insights</Text>
      <View style={styles.insightsContainer}>
        {/* Hydration Card */}
        <View style={styles.insightCard}>
          <View style={styles.insightIconFrame}>
            <Ionicons name="water" size={22} color="#3B82F6" />
          </View>
          <View style={styles.insightTextContainer}>
            <Text style={styles.insightValue}>{targetWater} Liters</Text>
            <Text style={styles.insightLabel}>Recommended Daily Water Intake</Text>
          </View>
        </View>

        {/* AI Advice Card */}
        {aiAdvice ? (
          <View style={styles.adviceCard}>
            <View style={styles.adviceHeader}>
              <Ionicons name="sparkles" size={16} color={Colors.dark.primary} />
              <Text style={styles.adviceTitle}>AI COACH INSIGHT</Text>
            </View>
            <Text style={styles.adviceText}>{aiAdvice}</Text>
          </View>
        ) : null}
      </View>

      {/* Quick Meal Log Buttons */}
      <Text style={styles.sectionTitle}>{"Today's Logs"}</Text>
      <View style={styles.mealsContainer}>
        {["Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (
          <TouchableOpacity key={meal} style={styles.mealRow} activeOpacity={0.7}>
            <View style={styles.mealInfo}>
              <View style={styles.mealIconFrame}>
                <Ionicons name="restaurant-outline" size={18} color={Colors.dark.primary} />
              </View>
              <View>
                <Text style={styles.mealName}>{meal}</Text>
                <Text style={styles.mealSubtitle}>No foods logged yet</Text>
              </View>
            </View>
            <Ionicons name="add-circle" size={24} color={Colors.dark.primary} />
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Visual buffer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerLeft: {
    justifyContent: "center",
  },
  welcomeText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  nameText: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: "bold",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
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
  ringContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    borderColor: "rgba(41, 143, 80, 0.08)",
    borderLeftColor: Colors.dark.primary,
    borderTopColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  ringInfo: {
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
  macrosContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 20,
    marginBottom: 24,
  },
  macroCard: {
    marginBottom: 16,
  },
  macroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  macroName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "500",
  },
  macroRatio: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
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
});
