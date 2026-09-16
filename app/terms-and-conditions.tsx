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

export default function TermsAndConditions() {
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
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
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
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.dark.primary} />
            </View>
            <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          </View>
          <Text style={styles.paragraph}>
            By downloading, installing, accessing, or using ArogyaHub, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use our application.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="medical-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.sectionTitle}>2. Medical & Fitness Disclaimer</Text>
          </View>
          <Text style={styles.paragraph}>
            ArogyaHub is designed solely for fitness tracking, calorie estimation, and habit monitoring. The content, AI suggestions, and calorie calculations provided in the app do NOT constitute medical advice, diagnosis, or treatment.
          </Text>
          <Text style={[styles.paragraph, { marginTop: 8 }]}>
            Always consult a qualified physician or healthcare provider before beginning any new diet, workout routine, or nutritional program.
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="person-circle-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.sectionTitle}>3. User Accounts & Security</Text>
          </View>
          <Text style={styles.paragraph}>
            Account registration and authentication are securely processed via Clerk Auth. You are responsible for keeping your login credentials secure and for all activities conducted under your account.
          </Text>
        </View>

        {/* Section 4 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="nutrition-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.sectionTitle}>4. Activity & Food Logging</Text>
          </View>
          <Text style={styles.paragraph}>
            Activity logs, food diary entries, and daily water consumption logged within ArogyaHub are stored locally and synced with Firebase Firestore to generate habit scores, calorie breakdown charts, and streak milestones.
          </Text>
        </View>

        {/* Section 5 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="sparkles-outline" size={20} color="#A855F7" />
            </View>
            <Text style={styles.sectionTitle}>5. Subscriptions & Free Trial</Text>
          </View>
          <Text style={styles.paragraph}>
            ArogyaHub offers free features as well as premium subscription tiers. Free trial periods give users temporary access to premium AI features. Subscriptions auto-renew unless cancelled prior to the end of the billing period.
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconFrame}>
              <Ionicons name="mail-outline" size={20} color="#0EA5E9" />
            </View>
            <Text style={styles.sectionTitle}>6. Contact Us</Text>
          </View>
          <Text style={styles.paragraph}>
            If you have any questions or concerns regarding these Terms & Conditions, please contact our support team at{" "}
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
  linkText: {
    color: Colors.dark.primary,
    fontWeight: "600",
  },
});
