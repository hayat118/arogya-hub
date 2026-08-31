import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { menuNavigationState } from "./(tabs)/_layout";
import { searchFatSecretFoods, FatSecretFood } from "../services/fatsecret";

export default function FoodSearch() {
  const { user } = useUser();
  const router = useRouter();

  // State
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FatSecretFood[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDate, setActiveDate] = useState("");

  // Resolve current active calendar date on mount
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

  // Debounced search logic: triggers when characters >= 3
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const list = await searchFatSecretFoods(trimmed);
        setResults(list);
      } catch (err) {
        console.error("FatSecret food search query error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Utility to parse FatSecret's raw "food_description" string
  const parseDescription = (desc: string) => {
    let servingSize = "1 serving";
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;

    if (!desc) return { servingSize, calories, protein, carbs, fats };

    // Format: "Per 1 slice - Calories: 75kcal | Fat: 1g | Carbs: 15g | Protein: 2g"
    const parts = desc.split("-");
    if (parts.length > 0) {
      servingSize = parts[0].replace(/per\s+/i, "").trim(); // Remove "Per " prefix if present
    }

    const calMatch = desc.match(/Calories:\s*(\d+)/i);
    if (calMatch) calories = parseInt(calMatch[1], 10);

    const proteinMatch = desc.match(/Protein:\s*(\d+(\.\d+)?)/i);
    if (proteinMatch) protein = Math.round(parseFloat(proteinMatch[1]));

    const carbsMatch = desc.match(/Carbs:\s*(\d+(\.\d+)?)/i);
    if (carbsMatch) carbs = Math.round(parseFloat(carbsMatch[1]));

    const fatsMatch = desc.match(/Fat:\s*(\d+(\.\d+)?)/i);
    if (fatsMatch) fats = Math.round(parseFloat(fatsMatch[1]));

    return { servingSize, calories, protein, carbs, fats };
  };

  const handleLogFood = (food: FatSecretFood) => {
    const { calories, servingSize, protein, carbs, fats } = parseDescription(food.food_description);

    router.push({
      pathname: "/log-food-details",
      params: {
        foodName: food.food_name,
        servingSize: servingSize,
        calories: calories.toString(),
        protein: protein.toString(),
        carbs: carbs.toString(),
        fats: fats.toString(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Food</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        {/* Search Bar Frame */}
        <View style={styles.searchBarFrame}>
          <Ionicons name="search" size={20} color={Colors.dark.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.textInput}
            placeholder="Search for apples, bread, cereal..."
            placeholderTextColor="rgba(255, 255, 255, 0.25)"
            value={query}
            onChangeText={setQuery}
            autoFocus={true}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.trim().length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dynamic content display */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
            <Text style={styles.feedbackText}>Searching database...</Text>
          </View>
        ) : query.trim().length < 3 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="nutrition-outline" size={48} color={Colors.dark.textMuted} style={styles.hintIcon} />
            <Text style={styles.feedbackText}>Type at least 3 characters to search</Text>
            <Text style={styles.hintSubtext}>Connects to the global FatSecret database</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={Colors.dark.textMuted} style={styles.hintIcon} />
            <Text style={styles.feedbackText}>{`No results found matching "${query}"`}</Text>
            <Text style={styles.hintSubtext}>Check spelling or try generic keywords</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.food_id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const { calories, servingSize } = parseDescription(item.food_description);
              return (
                <View style={styles.foodCard}>
                  {/* Left Side Details */}
                  <View style={styles.foodIconFrame}>
                    <Ionicons name="fast-food-outline" size={22} color={Colors.dark.primary} />
                  </View>

                  <View style={styles.foodDetails}>
                    <Text style={styles.foodName} numberOfLines={1}>
                      {item.food_name}
                    </Text>
                    <Text style={styles.foodSubtext} numberOfLines={1}>
                      {servingSize} • <Text style={styles.calorieHighlight}>{calories} kcal</Text>
                    </Text>
                  </View>

                  {/* Add Button Right */}
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleLogFood(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={Colors.dark.white} />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
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
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchBarFrame: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600",
  },
  clearBtn: {
    padding: 4,
  },
  centerContainer: {
    flex: 0.8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  hintIcon: {
    opacity: 0.15,
    marginBottom: 16,
  },
  feedbackText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  hintSubtext: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 24,
  },
  foodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
  },
  foodIconFrame: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(41, 143, 80, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  foodDetails: {
    flex: 1,
    justifyContent: "center",
  },
  foodName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  foodSubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  calorieHighlight: {
    color: Colors.dark.primaryLight,
    fontWeight: "600",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: 8,
  },
});
