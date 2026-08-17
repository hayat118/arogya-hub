import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";

export default function History() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconFrame}>
        <Ionicons name="calendar-outline" size={48} color={Colors.dark.primary} />
      </View>
      <Text style={styles.title}>Meal History</Text>
      <Text style={styles.subtitle}>
        Your logged calorie history will appear here. You will be able to review past days and analyze trends.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  iconFrame: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: "rgba(41, 143, 80, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.dark.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
