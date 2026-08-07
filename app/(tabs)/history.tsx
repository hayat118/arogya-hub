import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function History() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconFrame}>
        <Ionicons name="calendar-outline" size={48} color="#6366F1" />
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
    backgroundColor: "#0A0B0F",
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
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 22,
  },
});
