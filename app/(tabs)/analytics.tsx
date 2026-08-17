import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";

export default function Analytics() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconFrame}>
        <Ionicons name="bar-chart-outline" size={48} color={Colors.dark.primary} />
      </View>
      <Text style={styles.title}>Fitness Analytics</Text>
      <Text style={styles.subtitle}>
        Analyze your nutritional intake, calorie trends, and workout progress over time. Graph summaries will appear here.
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
    paddingBottom: 120, // Bottom padding to account for the floating tab bar
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
