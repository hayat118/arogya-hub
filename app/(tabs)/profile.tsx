import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser, useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import Colors from "../../constants/Colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { updateUserProfile } from "../../services/firebase";
import { calculateFallbackTargets } from "../../services/gemini";

// Helper to parse stored height into feet and inches
const parseHeightToFtIn = (heightRaw?: any) => {
  if (!heightRaw) return { feet: "5", inches: "9" };
  const str = String(heightRaw).trim();

  // Match e.g. "5 ft 9 in", "5ft 9in", "5'9", "5 ft", "5 feet 9 inches"
  const ftInMatch = str.match(/(\d+)\s*(?:ft|feet|')?\s*(\d+)?\s*(?:in|inches|")?/i);
  if (ftInMatch && (str.includes("ft") || str.includes("feet") || str.includes("'") || str.includes("in") || str.includes("inches"))) {
    return {
      feet: ftInMatch[1] || "5",
      inches: ftInMatch[2] || "0",
    };
  }

  // If stored as numeric cm e.g. 175 or "175"
  const cmVal = parseFloat(str.replace(/[^0-9.]/g, ""));
  if (!isNaN(cmVal) && cmVal > 50) {
    const totalInches = cmVal / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return {
      feet: String(feet),
      inches: String(inches >= 12 ? 11 : inches),
    };
  }

  return { feet: "5", inches: "9" };
};

const formatHeightDisplay = (heightRaw?: any) => {
  if (!heightRaw) return "5 ft 9 in";
  const { feet, inches } = parseHeightToFtIn(heightRaw);
  return `${feet} ft ${inches} in`;
};

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<any>(null);
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);

  // Edit Personal Details Modal States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editGender, setEditGender] = useState("Male");
  const [editWorkoutFreq, setEditWorkoutFreq] = useState("3-4 days");
  const [editHeightFeet, setEditHeightFeet] = useState("5");
  const [editHeightInches, setEditHeightInches] = useState("9");
  const [editWeight, setEditWeight] = useState("70");
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      if (user) {
        const stored = await AsyncStorage.getItem(`onboarding_data_${user.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setProfileData(parsed);
          // Pre-populate edit modal form states
          if (parsed.gender) setEditGender(parsed.gender);
          if (parsed.workoutFrequency) setEditWorkoutFreq(parsed.workoutFrequency);
          if (parsed.height) {
            const { feet, inches } = parseHeightToFtIn(parsed.height);
            setEditHeightFeet(feet);
            setEditHeightInches(inches);
          }
          if (parsed.weight) setEditWeight(String(parsed.weight));
        }
      }
    } catch (error) {
      console.error("Error loading profile tab data:", error);
    }
  };

  // Re-fetch data whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const handleOpenEditModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (profileData) {
      if (profileData.gender) setEditGender(profileData.gender);
      if (profileData.workoutFrequency) setEditWorkoutFreq(profileData.workoutFrequency);
      if (profileData.height) {
        const { feet, inches } = parseHeightToFtIn(profileData.height);
        setEditHeightFeet(feet);
        setEditHeightInches(inches);
      }
      if (profileData.weight) setEditWeight(String(profileData.weight));
    }
    setIsEditModalVisible(true);
  };

  const handleSavePersonalDetails = async () => {
    if (!user) return;

    const ftNum = parseInt(editHeightFeet, 10);
    const inNum = parseInt(editHeightInches, 10) || 0;
    const weightNum = parseFloat(editWeight);

    if (isNaN(ftNum) || ftNum <= 0 || ftNum > 8) {
      Alert.alert("Invalid Input", "Please enter a valid height in feet (e.g. 5).");
      return;
    }
    if (isNaN(inNum) || inNum < 0 || inNum >= 12) {
      Alert.alert("Invalid Input", "Please enter valid inches (0 to 11).");
      return;
    }
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid weight in kg.");
      return;
    }

    const formattedHeight = `${ftNum} ft ${inNum} in`;

    setIsSaving(true);
    try {
      const key = `onboarding_data_${user.id}`;
      const stored = await AsyncStorage.getItem(key);
      let parsed = stored ? JSON.parse(stored) : {};

      parsed.gender = editGender;
      parsed.workoutFrequency = editWorkoutFreq;
      parsed.height = formattedHeight;
      parsed.weight = weightNum;

      // Recalculate target calories and macros based on new stats
      const goal = parsed.goal || "Lose Weight";
      const birthYear = parsed.birthDate?.year || "1998";
      const computedTargets = calculateFallbackTargets(
        editGender,
        goal,
        editWorkoutFreq,
        birthYear,
        formattedHeight,
        weightNum.toString()
      );

      parsed.targetCalories = computedTargets.calories;
      parsed.targetProtein = computedTargets.protein;
      parsed.targetCarbs = computedTargets.carbs;
      parsed.targetFats = computedTargets.fats;
      parsed.targetWater = computedTargets.water;

      // Save to local AsyncStorage
      await AsyncStorage.setItem(key, JSON.stringify(parsed));
      await AsyncStorage.setItem("onboarding_data", JSON.stringify(parsed));

      // Sync to Firestore user profile
      try {
        await updateUserProfile(user.id, {
          gender: editGender,
          workoutFrequency: editWorkoutFreq,
          height: formattedHeight,
          weight: weightNum,
          targetCalories: computedTargets.calories,
          targetProtein: computedTargets.protein,
          targetCarbs: computedTargets.carbs,
          targetFats: computedTargets.fats,
          targetWater: computedTargets.water,
        });
      } catch (firestoreErr) {
        console.warn("Firestore sync warning during profile edit:", firestoreErr);
      }

      setProfileData(parsed);
      setIsEditModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error("Failed to update personal details:", err);
      Alert.alert("Error", "Failed to update details. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert("Log Out", "Are you sure you want to log out of ArogyaHub?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            console.error("Failed to sign out:", err);
          }
        },
      },
    ]);
  };

  const handleContactEmail = async (subjectText: string, bodyText: string) => {
    const email = "tariqueht6@gmail.com";
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`;
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          "Contact Support",
          `Please send an email to our support team at: ${email}`,
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      Alert.alert("Contact Support", `Please email us at ${email}`);
    }
  };

  const handleItemPress = (title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (title === "Personal Details") {
      setShowPersonalDetails((prev) => !prev);
    } else if (title === "Free Trial" || title === "Upgrade to Premium Features") {
      Alert.alert(
        "Premium Features",
        "Start your 7-day free trial to unlock AI Coach insights, advanced macro breakdown, and unlimited meal scans!",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start Free Trial",
            onPress: () =>
              Alert.alert("Trial Activated", "Your 7-day free trial has been activated! Enjoy premium features."),
          },
        ]
      );
    } else if (title === "Contact Us") {
      handleContactEmail(
        "ArogyaHub Support Request",
        `Hi ArogyaHub Team,\n\nI need assistance with:\n\nUser ID: ${user?.id || ""}\nEmail: ${user?.primaryEmailAddress?.emailAddress || ""}`
      );
    } else if (title === "Request new features") {
      handleContactEmail(
        "ArogyaHub Feature Request",
        `Hi ArogyaHub Team,\n\nI would like to suggest the following feature:\n\nDetails:\n`
      );
    } else if (title === "Terms and Conditions") {
      router.push("/terms-and-conditions");
    } else if (title === "Privacy Policy") {
      router.push("/privacy-policy");
    } else {
      Alert.alert(title, `${title} settings will be available in the next release.`);
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Card */}
        <View style={styles.userInfoCard}>
          <Image
            source={
              user?.imageUrl
                ? { uri: user.imageUrl }
                : require("../../assets/images/icon.png")
            }
            style={styles.avatar}
          />
          <View style={styles.userTextContainer}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.fullName || "Fitness Enthusiast"}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.primaryEmailAddress?.emailAddress || "user@arogyahub.com"}
            </Text>
          </View>
        </View>

        {/* Free Trial Option Card */}
        <TouchableOpacity
          style={styles.freeTrialCard}
          activeOpacity={0.85}
          onPress={() => handleItemPress("Free Trial")}
        >
          <View style={styles.trialLeftIconFrame}>
            <Ionicons name="sparkles" size={22} color="#F59E0B" />
          </View>
          <View style={styles.trialTextContainer}>
            <Text style={styles.trialTitle}>Start Free Trial</Text>
            <Text style={styles.trialSubtext}>Start 7 days Free trial</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
        </TouchableOpacity>

        {/* Account Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Account</Text>
          <View style={styles.sectionCard}>
            {/* Personal Details */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress("Personal Details")}
            >
              <View style={[styles.optionIconFrame, { backgroundColor: "rgba(59, 130, 246, 0.12)" }]}>
                <Ionicons name="person-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.optionText}>Personal Details</Text>
              <Ionicons
                name={showPersonalDetails ? "chevron-down" : "chevron-forward"}
                size={18}
                color={Colors.dark.textMuted}
              />
            </TouchableOpacity>

            {/* Expanded Personal Details Info */}
            {showPersonalDetails && profileData && (
              <View style={styles.expandedDetailsBox}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Gender</Text>
                  <Text style={styles.detailVal}>{profileData.gender || "N/A"}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Weekly Workouts</Text>
                  <Text style={styles.detailVal}>{profileData.workoutFrequency || "N/A"}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Height</Text>
                  <Text style={styles.detailVal}>{formatHeightDisplay(profileData.height)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Weight</Text>
                  <Text style={styles.detailVal}>{profileData.weight ? `${profileData.weight} kg` : "N/A"}</Text>
                </View>

                <TouchableOpacity
                  style={styles.editDetailsBtn}
                  activeOpacity={0.8}
                  onPress={handleOpenEditModal}
                >
                  <Ionicons name="create-outline" size={16} color={Colors.dark.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.editDetailsBtnText}>Edit Personal Details</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.separator} />

            {/* Preferences */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress("Preferences")}
            >
              <View style={[styles.optionIconFrame, { backgroundColor: "rgba(168, 85, 247, 0.12)" }]}>
                <Ionicons name="options-outline" size={20} color="#A855F7" />
              </View>
              <Text style={styles.optionText}>Preferences</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* Upgrade to Premium Features */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress("Upgrade to Premium Features")}
            >
              <View style={[styles.optionIconFrame, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                <Ionicons name="star-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.optionText}>Upgrade to Premium Features</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Support</Text>
          <View style={styles.sectionCard}>
            {/* Request new features */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress("Request new features")}
            >
              <View style={[styles.optionIconFrame, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                <Ionicons name="bulb-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.optionText}>Request new features</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* Contact Us */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress("Contact Us")}
            >
              <View style={[styles.optionIconFrame, { backgroundColor: "rgba(14, 165, 233, 0.12)" }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0EA5E9" />
              </View>
              <Text style={styles.optionText}>Contact Us</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* Terms and condition */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress("Terms and Conditions")}
            >
              <View style={[styles.optionIconFrame, { backgroundColor: "rgba(244, 63, 94, 0.12)" }]}>
                <Ionicons name="document-text-outline" size={20} color="#F43F5E" />
              </View>
              <Text style={styles.optionText}>Terms and Condition</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* Privacy Policy */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress("Privacy Policy")}
            >
              <View style={[styles.optionIconFrame, { backgroundColor: "rgba(99, 102, 241, 0.12)" }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#6366F1" />
              </View>
              <Text style={styles.optionText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button (Outside Support Section) */}
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Personal Details Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Personal Details</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Gender */}
              <Text style={styles.inputGroupLabel}>Gender</Text>
              <View style={styles.pillRow}>
                {["Male", "Female", "Other"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pillBtn, editGender === g && styles.pillBtnActive]}
                    onPress={() => setEditGender(g)}
                  >
                    <Text style={[styles.pillText, editGender === g && styles.pillTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Workout Frequency */}
              <Text style={styles.inputGroupLabel}>Weekly Workouts</Text>
              <View style={styles.pillRow}>
                {["1-2 days", "3-4 days", "5+ days"].map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.pillBtn, editWorkoutFreq === freq && styles.pillBtnActive]}
                    onPress={() => setEditWorkoutFreq(freq)}
                  >
                    <Text style={[styles.pillText, editWorkoutFreq === freq && styles.pillTextActive]}>{freq}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Height Input (Feet and Inches) */}
              <Text style={styles.inputGroupLabel}>Height</Text>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputSubLabel}>Feet (ft)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={editHeightFeet}
                    onChangeText={(val) => setEditHeightFeet(val.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 5"
                    placeholderTextColor="#6B7280"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputSubLabel}>Inches (in)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={editHeightInches}
                    onChangeText={(val) => setEditHeightInches(val.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 9"
                    placeholderTextColor="#6B7280"
                  />
                </View>
              </View>

              {/* Weight Input (kg) */}
              <Text style={styles.inputGroupLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={editWeight}
                onChangeText={setEditWeight}
                placeholder="e.g. 70"
                placeholderTextColor="#6B7280"
              />
            </ScrollView>

            {/* Modal Action Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSaving && styles.modalSaveBtnDisabled]}
                onPress={handleSavePersonalDetails}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120, // Padding for floating tab bar
  },
  userInfoCard: {
    backgroundColor: "#1E202C",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    marginRight: 16,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  freeTrialCard: {
    backgroundColor: "#1E202C",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  trialLeftIconFrame: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  trialTextContainer: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  trialSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: "#1E202C",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  optionIconFrame: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginLeft: 52,
  },
  expandedDetailsBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    padding: 12,
    marginVertical: 6,
    marginLeft: 52,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  editDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41, 143, 80, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.3)",
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  editDetailsBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.primary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 40,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#1E202C",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2C2E3E",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  inputGroupLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 12,
    marginBottom: 8,
  },
  inputSubLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pillBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillBtnActive: {
    backgroundColor: "rgba(41, 143, 80, 0.2)",
    borderColor: Colors.dark.primary,
  },
  pillText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  pillTextActive: {
    color: Colors.dark.primary,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#2A2D3D",
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  modalSaveBtn: {
    flex: 1.4,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveBtnDisabled: {
    opacity: 0.5,
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
