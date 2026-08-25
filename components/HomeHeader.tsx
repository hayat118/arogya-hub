import React from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity } from "react-native";
import { useUser } from "@clerk/expo";
import Colors from "../constants/Colors";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { BellIcon } from "@hugeicons/core-free-icons";

export default function HomeHeader() {
  const { user } = useUser();

  return (
    <View style={styles.container}>
      {/* Profile info on the left */}
      <View style={styles.leftSection}>
        <Image
          source={user?.imageUrl ? { uri: user.imageUrl } : require("../assets/images/icon.png")}
          style={styles.avatar}
        />
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>Welcome back 👋</Text>
          <Text style={styles.name} numberOfLines={1}>
            {user?.fullName || "Fitness Partner"}
          </Text>
        </View>
      </View>

      {/* Notification Icon on the right */}
      <TouchableOpacity style={styles.bellButton} activeOpacity={0.7}>
        <HugeiconsIcon icon={BellIcon} size={22} color={Colors.dark.text} />
        {/* Subtle unread notification badge */}
        <View style={styles.badge} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.dark.background,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.03)",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  greeting: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
    fontWeight: "500",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.dark.primary,
    borderWidth: 1,
    borderColor: Colors.dark.surface,
  },
});
