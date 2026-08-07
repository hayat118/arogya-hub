import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Dashboard() {
  const { user } = useUser();

  // Mock targets for nutrition (can be loaded from Firestore later)
  const targetCalories = 2000;
  const consumedCalories = 1250;
  const remainingCalories = targetCalories - consumedCalories;

  const targetProtein = 150; // grams
  const consumedProtein = 95;

  const targetCarbs = 200; // grams
  const consumedCarbs = 110;

  const targetFats = 70; // grams
  const consumedFats = 42;

  // Percentage calculations
  const proteinPercent = consumedProtein / targetProtein;
  const carbsPercent = consumedCarbs / targetCarbs;
  const fatsPercent = consumedFats / targetFats;

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
            <View style={[styles.progressBar, { width: `${fatsPercent * 100}%`, backgroundColor: "#EF4444" }]} />
          </View>
        </View>
      </View>

      {/* Quick Meal Log Buttons */}
      <Text style={styles.sectionTitle}>{"Today's Logs"}</Text>
      <View style={styles.mealsContainer}>
        {["Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (
          <TouchableOpacity key={meal} style={styles.mealRow} activeOpacity={0.7}>
            <View style={styles.mealInfo}>
              <View style={styles.mealIconFrame}>
                <Ionicons name="restaurant-outline" size={18} color="#6366F1" />
              </View>
              <View>
                <Text style={styles.mealName}>{meal}</Text>
                <Text style={styles.mealSubtitle}>No foods logged yet</Text>
              </View>
            </View>
            <Ionicons name="add-circle" size={24} color="#6366F1" />
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
    backgroundColor: "#0A0B0F",
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
    color: "#6B7280",
    fontSize: 14,
  },
  nameText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#6366F1",
  },
  glassCard: {
    backgroundColor: "#161821",
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
    borderColor: "rgba(99, 102, 241, 0.1)",
    borderLeftColor: "#6366F1",
    borderTopColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  ringInfo: {
    alignItems: "center",
  },
  remainingNumber: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "bold",
  },
  remainingLabel: {
    color: "#6B7280",
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
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  statLabel: {
    color: "#6B7280",
    fontSize: 12,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    marginTop: 8,
  },
  macrosContainer: {
    backgroundColor: "#161821",
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
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  macroRatio: {
    color: "#9CA3AF",
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
    backgroundColor: "#161821",
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
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  mealName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  mealSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
});
