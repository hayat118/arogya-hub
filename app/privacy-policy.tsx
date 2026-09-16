import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/Colors";

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdatedText}>Last Updated: September 10, 2026</Text>

        {/* Section 1 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#6366F1" />
            </View>
            <Text style={styles.sectionTitle}>1. Data We Collect</Text>
          </View>
          <Text style={styles.paragraph}>
            We collect profile information (such as name and email via Clerk Auth), physical metrics (gender, height, weight, workout frequency), and activity logs (water intake, food diary items, workout logs).
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="analytics-outline" size={20} color={Colors.dark.primary} />
            </View>
            <Text style={styles.sectionTitle}>2. How We Use Your Data</Text>
          </View>
          <Text style={styles.paragraph}>
            Your data is used to calculate daily BMR/TDEE calorie targets using the Mifflin-St Jeor formula, track weekly macro balances, compute habit scores, and generate AI insights for meal analysis and target suggestions.
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="cloud-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.sectionTitle}>3. Third-Party Integrations</Text>
          </View>
          <Text style={styles.paragraph}>
            We integrate with trusted third-party providers:
          </Text>
          <Text style={[styles.bulletItem, { marginTop: 8 }]}>
            • <Text style={styles.boldText}>Clerk Authentication</Text> for secure login and session token caching.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Firebase Firestore</Text> for encrypted cloud sync of user profile and daily logs.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Gemini AI API</Text> for food image recognition and target recommendation generation.
          </Text>
        </View>

        {/* Section 4 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="lock-closed-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.sectionTitle}>4. Data Security & Storage</Text>
          </View>
          <Text style={styles.paragraph}>
            All network communication is transmitted securely over TLS/HTTPS. Local data is cached securely using device storage (AsyncStorage and SecureStore).
          </Text>
        </View>

        {/* Section 5 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="key-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.sectionTitle}>5. Your Rights & Data Control</Text>
          </View>
          <Text style={styles.paragraph}>
            You have full control over your data. You may update or delete your profile information, food entries, and activity logs at any time, or request complete account deletion.
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="mail-outline" size={20} color="#0EA5E9" />
            </View>
            <Text style={styles.sectionTitle}>6. Privacy Support</Text>
          </View>
          <Text style={styles.paragraph}>
            For any questions or data privacy inquiries, please reach out to our privacy officer at{" "}
            <Text style={styles.linkText}>tariqueht6@gmail.com</Text>.
          </Text>
        </View>
      </ScrollView>
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
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
  },
  sectionCard: {
    backgroundColor: "#1E202C",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    padding: 18,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  paragraph: {
    fontSize: 14,
    color: "#9CA3AF",
    lineHeight: 22,
  },
  bulletItem: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 20,
    marginBottom: 4,
  },
  boldText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  linkText: {
    color: Colors.dark.primary,
    fontWeight: "600",
  },
});
