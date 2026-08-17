import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Image } from "react-native";
import Colors from "../../constants/Colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@clerk/expo";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  UserIcon,
  WeightScaleIcon,
  RulerIcon,
  CakeIcon,
  Dumbbell01Icon,
  BalanceScaleIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

export default function Profile() {
  const { user } = useUser();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (user) {
          const stored = await AsyncStorage.getItem(`onboarding_data_${user.id}`);
          if (stored) {
            setProfileData(JSON.parse(stored));
          }
        }
      } catch (error) {
        console.error("Error loading profile tab data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image
          source={user?.imageUrl ? { uri: user.imageUrl } : require("../../assets/images/icon.png")}
          style={styles.avatar}
        />
        <Text style={styles.name}>{user?.fullName || "Fitness Enthusiast"}</Text>
        <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress || ""}</Text>
      </View>

      {/* Fitness Profile Section */}
      <Text style={styles.sectionTitle}>Fitness Profile</Text>

      {loading ? (
        <ActivityIndicator size="small" color={Colors.dark.primary} style={{ marginVertical: 20 }} />
      ) : profileData ? (
        <View style={styles.profileCard}>
          {/* Gender */}
          <View style={styles.detailRow}>
            <View style={styles.iconFrame}>
              <HugeiconsIcon icon={UserIcon} size={20} color={Colors.dark.primary} />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Gender</Text>
              <Text style={styles.detailValue}>{profileData.gender}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Goal */}
          <View style={styles.detailRow}>
            <View style={styles.iconFrame}>
              <HugeiconsIcon icon={BalanceScaleIcon} size={20} color={Colors.dark.primary} />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Fitness Goal</Text>
              <Text style={styles.detailValue}>{profileData.goal}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Workout Frequency */}
          <View style={styles.detailRow}>
            <View style={styles.iconFrame}>
              <HugeiconsIcon icon={Dumbbell01Icon} size={20} color={Colors.dark.primary} />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Weekly Workouts</Text>
              <Text style={styles.detailValue}>{profileData.workoutFrequency}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Birth Date */}
          <View style={styles.detailRow}>
            <View style={styles.iconFrame}>
              <HugeiconsIcon icon={CakeIcon} size={20} color={Colors.dark.primary} />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Date of Birth</Text>
              <Text style={styles.detailValue}>
                {profileData.birthDate
                  ? `${profileData.birthDate.day}/${profileData.birthDate.month}/${profileData.birthDate.year}`
                  : "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Height */}
          <View style={styles.detailRow}>
            <View style={styles.iconFrame}>
              <HugeiconsIcon icon={RulerIcon} size={20} color={Colors.dark.primary} />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Height</Text>
              <Text style={styles.detailValue}>{profileData.height}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Weight */}
          <View style={styles.detailRow}>
            <View style={styles.iconFrame}>
              <HugeiconsIcon icon={WeightScaleIcon} size={20} color={Colors.dark.primary} />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Weight</Text>
              <Text style={styles.detailValue}>{profileData.weight}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.noProfileCard}>
          <Text style={styles.noProfileText}>No profile information found. Please re-onboard.</Text>
        </View>
      )}

      {/* Settings Description */}
      <View style={styles.footerContainer}>
        <View style={styles.settingsIconFrame}>
          <HugeiconsIcon icon={Settings01Icon} size={24} color={Colors.dark.textMuted} />
        </View>
        <Text style={styles.subtitle}>
          Manage your personal information, physical targets, and health settings here.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120, // Add bottom padding to account for floating tab bar
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 32,
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.dark.text,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  profileCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  iconFrame: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(41, 143, 80, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginLeft: 56,
  },
  noProfileCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  noProfileText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  footerContainer: {
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  settingsIconFrame: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
