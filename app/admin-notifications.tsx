import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/Colors";
import * as Haptics from "expo-haptics";
import {
  getAdminNotificationSettings,
  updateAdminNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  AdminNotificationSettings,
} from "../services/firebase";
import {
  triggerInstantTestNotification,
  scheduleAutomatedMealAndActivityReminders,
} from "../services/notificationService";
import { useUser } from "@clerk/expo";

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Notification Message Form States
  const [lunchTitle, setLunchTitle] = useState("");
  const [lunchBody, setLunchBody] = useState("");
  const [lunchHour, setLunchHour] = useState("13");
  const [lunchMinute, setLunchMinute] = useState("0");

  const [afternoonTitle, setAfternoonTitle] = useState("");
  const [afternoonBody, setAfternoonBody] = useState("");
  const [afternoonHour, setAfternoonHour] = useState("16");
  const [afternoonMinute, setAfternoonMinute] = useState("30");

  const [dinnerTitle, setDinnerTitle] = useState("");
  const [dinnerBody, setDinnerBody] = useState("");
  const [dinnerHour, setDinnerHour] = useState("20");
  const [dinnerMinute, setDinnerMinute] = useState("0");

  const [inactivityTitle, setInactivityTitle] = useState("");
  const [inactivityBody, setInactivityBody] = useState("");
  const [inactivityHour, setInactivityHour] = useState("21");
  const [inactivityMinute, setInactivityMinute] = useState("0");

  const [unsubscribedTitle, setUnsubscribedTitle] = useState("");
  const [unsubscribedBody, setUnsubscribedBody] = useState("");
  const [unsubscribedHour, setUnsubscribedHour] = useState("10");
  const [unsubscribedMinute, setUnsubscribedMinute] = useState("0");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getAdminNotificationSettings();
      populateForm(data);
    } catch (error) {
      console.error("Failed to load admin settings:", error);
      populateForm(DEFAULT_NOTIFICATION_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: AdminNotificationSettings) => {
    setLunchTitle(data.lunchTitle || DEFAULT_NOTIFICATION_SETTINGS.lunchTitle);
    setLunchBody(data.lunchBody || DEFAULT_NOTIFICATION_SETTINGS.lunchBody);
    setLunchHour(String(data.lunchHour ?? 13));
    setLunchMinute(String(data.lunchMinute ?? 0));

    setAfternoonTitle(data.afternoonTitle || DEFAULT_NOTIFICATION_SETTINGS.afternoonTitle);
    setAfternoonBody(data.afternoonBody || DEFAULT_NOTIFICATION_SETTINGS.afternoonBody);
    setAfternoonHour(String(data.afternoonHour ?? 16));
    setAfternoonMinute(String(data.afternoonMinute ?? 30));

    setDinnerTitle(data.dinnerTitle || DEFAULT_NOTIFICATION_SETTINGS.dinnerTitle);
    setDinnerBody(data.dinnerBody || DEFAULT_NOTIFICATION_SETTINGS.dinnerBody);
    setDinnerHour(String(data.dinnerHour ?? 20));
    setDinnerMinute(String(data.dinnerMinute ?? 0));

    setInactivityTitle(data.inactivityTitle || DEFAULT_NOTIFICATION_SETTINGS.inactivityTitle);
    setInactivityBody(data.inactivityBody || DEFAULT_NOTIFICATION_SETTINGS.inactivityBody);
    setInactivityHour(String(data.inactivityHour ?? 21));
    setInactivityMinute(String(data.inactivityMinute ?? 0));

    setUnsubscribedTitle(data.unsubscribedTitle || DEFAULT_NOTIFICATION_SETTINGS.unsubscribedTitle);
    setUnsubscribedBody(data.unsubscribedBody || DEFAULT_NOTIFICATION_SETTINGS.unsubscribedBody);
    setUnsubscribedHour(String(data.unsubscribedHour ?? 10));
    setUnsubscribedMinute(String(data.unsubscribedMinute ?? 0));
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSaving(true);
    try {
      const updatedData: AdminNotificationSettings = {
        lunchTitle,
        lunchBody,
        lunchHour: parseInt(lunchHour, 10) || 13,
        lunchMinute: parseInt(lunchMinute, 10) || 0,

        afternoonTitle,
        afternoonBody,
        afternoonHour: parseInt(afternoonHour, 10) || 16,
        afternoonMinute: parseInt(afternoonMinute, 10) || 30,

        dinnerTitle,
        dinnerBody,
        dinnerHour: parseInt(dinnerHour, 10) || 20,
        dinnerMinute: parseInt(dinnerMinute, 10) || 0,

        inactivityTitle,
        inactivityBody,
        inactivityHour: parseInt(inactivityHour, 10) || 21,
        inactivityMinute: parseInt(inactivityMinute, 10) || 0,

        unsubscribedTitle,
        unsubscribedBody,
        unsubscribedHour: parseInt(unsubscribedHour, 10) || 10,
        unsubscribedMinute: parseInt(unsubscribedMinute, 10) || 0,
      };

      // 1. Save to Firebase 'admin' collection doc ('admin/notification_settings') with local cache fallback
      const { cloudSynced } = await updateAdminNotificationSettings(updatedData);

      // 2. Reschedule automated reminders locally
      if (user?.id) {
        await scheduleAutomatedMealAndActivityReminders(user.id, false);
      }

      if (cloudSynced) {
        Alert.alert(
          "Settings Saved",
          "Push notification settings successfully updated in Firebase Admin collection and rescheduled!"
        );
      } else {
        Alert.alert(
          "Saved Locally",
          "Notification settings updated locally & rescheduled! To enable Firebase Cloud sync, update your Firestore Security Rules in Firebase Console for collection 'admin'."
        );
      }
    } catch (error: any) {
      console.error("Save admin settings error:", error);
      Alert.alert("Save Error", error?.message || "Failed to update notification settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTesting(true);
    try {
      await triggerInstantTestNotification(
        lunchTitle || "🍱 Lunch Time Reminder",
        lunchBody || "Don't forget to log your meal in ArogyaHub!"
      );
      Alert.alert("Test Notification Sent", "Check your device status bar / notification banner!");
    } catch (error: any) {
      Alert.alert("Test Notification Failed", error?.message || "Could not trigger test notification.");
    } finally {
      setTesting(false);
    }
  };

  const handleResetDefaults = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert(
      "Reset Defaults",
      "Are you sure you want to reset all notification messages to default values?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => populateForm(DEFAULT_NOTIFICATION_SETTINGS),
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Fetching Firebase Admin Push Settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Firebase Push Settings</Text>
          <Text style={styles.headerSubtitle}>Admin Collection Management</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Admin Banner */}
          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.dark.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Configured notification templates are synced to the Firebase Firestore{" "}
              <Text style={styles.highlightText}>admin/notification_settings</Text> collection for all user automated reminders.
            </Text>
          </View>

          {/* Section 1: Lunch Reminder */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <Ionicons name="restaurant" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.cardTitle}>Lunch Reminder</Text>
            </View>
            <Text style={styles.label}>Notification Title</Text>
            <TextInput
              style={styles.input}
              value={lunchTitle}
              onChangeText={setLunchTitle}
              placeholder="e.g. 🍱 Lunch Time Reminder"
              placeholderTextColor="#6B7280"
            />
            <Text style={styles.label}>Notification Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={lunchBody}
              onChangeText={setLunchBody}
              multiline
              numberOfLines={2}
              placeholder="Enter message body"
              placeholderTextColor="#6B7280"
            />
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={lunchHour}
                  onChangeText={setLunchHour}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={lunchMinute}
                  onChangeText={setLunchMinute}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>
          </View>

          {/* Section 2: Afternoon Activity Reminder */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                <Ionicons name="flash" size={20} color="#10B981" />
              </View>
              <Text style={styles.cardTitle}>Afternoon Activity Check</Text>
            </View>
            <Text style={styles.label}>Notification Title</Text>
            <TextInput
              style={styles.input}
              value={afternoonTitle}
              onChangeText={setAfternoonTitle}
              placeholder="e.g. ⚡ Afternoon Hydration & Activity Check"
              placeholderTextColor="#6B7280"
            />
            <Text style={styles.label}>Notification Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={afternoonBody}
              onChangeText={setAfternoonBody}
              multiline
              numberOfLines={2}
              placeholder="Enter message body"
              placeholderTextColor="#6B7280"
            />
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={afternoonHour}
                  onChangeText={setAfternoonHour}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={afternoonMinute}
                  onChangeText={setAfternoonMinute}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>
          </View>

          {/* Section 3: Dinner Reminder */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
                <Ionicons name="moon" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.cardTitle}>Dinner Reminder</Text>
            </View>
            <Text style={styles.label}>Notification Title</Text>
            <TextInput
              style={styles.input}
              value={dinnerTitle}
              onChangeText={setDinnerTitle}
              placeholder="e.g. 🍽️ Dinner Log Reminder"
              placeholderTextColor="#6B7280"
            />
            <Text style={styles.label}>Notification Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={dinnerBody}
              onChangeText={setDinnerBody}
              multiline
              numberOfLines={2}
              placeholder="Enter message body"
              placeholderTextColor="#6B7280"
            />
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={dinnerHour}
                  onChangeText={setDinnerHour}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={dinnerMinute}
                  onChangeText={setDinnerMinute}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>
          </View>

          {/* Section 4: Daily Inactivity Reminder */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                <Ionicons name="notifications" size={20} color="#EF4444" />
              </View>
              <Text style={styles.cardTitle}>Daily Inactivity Encouragement</Text>
            </View>
            <Text style={styles.label}>Notification Title</Text>
            <TextInput
              style={styles.input}
              value={inactivityTitle}
              onChangeText={setInactivityTitle}
              placeholder="e.g. 🔔 You Haven't Logged Any Activity Today!"
              placeholderTextColor="#6B7280"
            />
            <Text style={styles.label}>Notification Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={inactivityBody}
              onChangeText={setInactivityBody}
              multiline
              numberOfLines={2}
              placeholder="Enter message body"
              placeholderTextColor="#6B7280"
            />
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={inactivityHour}
                  onChangeText={setInactivityHour}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={inactivityMinute}
                  onChangeText={setInactivityMinute}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>
          </View>

          {/* Section 5: Unsubscribed User Paid Plan Notification */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "rgba(234, 179, 8, 0.15)" }]}>
                <Ionicons name="star" size={20} color="#EAB308" />
              </View>
              <Text style={styles.cardTitle}>Unsubscribed User Paid Encouragement</Text>
            </View>
            <Text style={styles.label}>Notification Title</Text>
            <TextInput
              style={styles.input}
              value={unsubscribedTitle}
              onChangeText={setUnsubscribedTitle}
              placeholder="e.g. ⭐ Unlock Your Full Health Potential"
              placeholderTextColor="#6B7280"
            />
            <Text style={styles.label}>Notification Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={unsubscribedBody}
              onChangeText={setUnsubscribedBody}
              multiline
              numberOfLines={2}
              placeholder="Enter message body"
              placeholderTextColor="#6B7280"
            />
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Hour (0-23)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={unsubscribedHour}
                  onChangeText={setUnsubscribedHour}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>Minute (0-59)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={unsubscribedMinute}
                  onChangeText={setUnsubscribedMinute}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>
          </View>

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.primaryButton, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Save Settings to Firebase Admin</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleTestNotification}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryButtonText}>Send Test Push</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.outlineButton} onPress={handleResetDefaults}>
              <Ionicons name="refresh" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
              <Text style={styles.outlineButtonText}>Reset Defaults</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.text,
    lineHeight: 18,
  },
  highlightText: {
    fontWeight: "700",
    color: Colors.dark.primary,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.dark.text,
    fontSize: 14,
  },
  textArea: {
    height: 60,
    textAlignVertical: "top",
  },
  timeRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 12,
  },
  timeCol: {
    flex: 1,
  },
  subLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  smallInput: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.dark.text,
    fontSize: 14,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 13,
  },
  outlineButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  outlineButtonText: {
    color: Colors.dark.textSecondary,
    fontWeight: "600",
    fontSize: 13,
  },
});
