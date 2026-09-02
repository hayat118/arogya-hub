import { useUser, useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View, Modal, Text, ActivityIndicator, InteractionManager, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "../../constants/Colors";
import { saveUserProfile, db } from "../../services/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import * as Haptics from "expo-haptics";

// Module-level global state to persist menu visibility request across screen transitions
export const menuNavigationState = {
  shouldShowMenuOnReturn: false,
};

export default function TabsLayout() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Automatically close the modal when navigating to a logging detail page
    if (pathname === "/(tabs)/plus" || pathname === "/plus") {
      setIsLogMenuVisible(false);
    } else if (pathname === "/" || pathname === "/(tabs)") {
      if (menuNavigationState.shouldShowMenuOnReturn) {
        menuNavigationState.shouldShowMenuOnReturn = false;
        // Wait for native screen slide-back transition to finish completely before showing modal
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            setIsLogMenuVisible(true);
          }, 80);
        });
      }
    }
  }, [pathname]);

  // Log menu state
  const [isLogMenuVisible, setIsLogMenuVisible] = useState(false);
  
  // Image picker modal state
  const [isImagePickerVisible, setIsImagePickerVisible] = useState(false);

  // Sync profile to Firebase Firestore & local storage cache
  useEffect(() => {
    if (isLoaded) {
      if (user) {
        const email = user.primaryEmailAddress?.emailAddress || "";
        const name = user.fullName || "";
        const photoURL = user.imageUrl || "";

        // 1. Cache the session details locally in AsyncStorage
        AsyncStorage.setItem(
          "user_session",
          JSON.stringify({
            uid: user.id,
            email,
            displayName: name,
            photoURL,
            isAuthenticated: true,
          })
        ).catch((err) => console.error("AsyncStorage write error:", err));

        // 2. Sync to Firebase Firestore database
        saveUserProfile(user.id, email, name, photoURL)
          .then(() => {
            console.log("Firebase sync completed successfully");
          })
          .catch((err) => {
            console.error("Firebase sync error on tab layout: ", err);
          });
      } else {
        // 3. Clear local storage session on log-out
        AsyncStorage.removeItem("user_session").catch((err) =>
          console.error("AsyncStorage clear error:", err)
        );
      }
    }
  }, [user, isLoaded]);

  // Open custom premium modal to pick image source
  const handleStartScanning = () => {
    setIsLogMenuVisible(false);
    setIsImagePickerVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  // Launch camera flow
  const handleTakePhoto = async () => {
    try {
      setIsImagePickerVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "We need camera access to capture food photos for scanning.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        router.push({
          pathname: "/analyzing-food",
          params: { imageUri },
        });
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to launch device camera.");
    }
  };

  // Launch gallery picker flow
  const handleChooseFromLibrary = async () => {
    try {
      setIsImagePickerVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "We need library access to pick food photos.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        router.push({
          pathname: "/analyzing-food",
          params: { imageUri },
        });
      }
    } catch (error) {
      console.error("Library error:", error);
      Alert.alert("Error", "Failed to open photo library.");
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.dark.surface,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255, 255, 255, 0.05)",
            height: 90,
          },
          headerTitleStyle: {
            color: Colors.dark.text,
            fontSize: 18,
            fontWeight: "bold",
          },
          tabBarStyle: {
            position: "absolute",
            bottom: 24,
            left: 16,
            right: 16,
            borderRadius: 24,
            backgroundColor: Colors.dark.surface,
            borderTopWidth: 0,
            height: 72,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          },
          tabBarActiveTintColor: Colors.dark.primary,
          tabBarInactiveTintColor: Colors.dark.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
            marginBottom: 10,
          },
          tabBarIconStyle: {
            marginTop: 6,
          },
          headerRight: () => (
            <TouchableOpacity
              onPress={() => signOut()}
              style={styles.logoutButton}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color={Colors.dark.error} />
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarLabel: "Home",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: "Analytics",
            tabBarLabel: "Analytics",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarLabel: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plus"
          options={{
            title: "Log",
            tabBarLabel: () => null,
            tabBarButton: () => (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  setIsLogMenuVisible(true);
                }}
                style={styles.plusButtonContainer}
                activeOpacity={0.85}
              >
                <View style={styles.plusButton}>
                  <Ionicons name="add" size={26} color={Colors.dark.white} />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
      </Tabs>

      {/* Floating Bottom Log Options Grid Menu */}
      <Modal
        visible={isLogMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLogMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Choose Entry Type</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  setIsLogMenuVisible(false);
                }}
                style={styles.menuCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={16} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.grid}>
              {/* Row 1 */}
              <View style={styles.gridRow}>
                {/* 1. Log Exercise */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    menuNavigationState.shouldShowMenuOnReturn = true;
                    setIsLogMenuVisible(false); // Close the modal to allow smooth screen push
                    setTimeout(() => {
                      router.push("/log-exercise-options");
                    }, 250);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.cardIconFrame, { backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
                    <Ionicons name="barbell-sharp" size={22} color="#10B981" />
                  </View>
                  <Text style={styles.cardLabel}>Log Exercise</Text>
                </TouchableOpacity>

                {/* 2. Add Drink Water */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => {
                    menuNavigationState.shouldShowMenuOnReturn = false;
                    router.push("/log-water");
                  }}
                  activeOpacity={0.855}
                >
                  <View style={[styles.cardIconFrame, { backgroundColor: "rgba(59, 130, 246, 0.08)" }]}>
                    <Ionicons name="water-sharp" size={22} color="#3B82F6" />
                  </View>
                  <Text style={styles.cardLabel}>Add Drink Water</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2 */}
              <View style={styles.gridRow}>
                {/* 3. Food Database */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => {
                    menuNavigationState.shouldShowMenuOnReturn = false;
                    router.push("/food-search");
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.cardIconFrame, { backgroundColor: "rgba(167, 139, 250, 0.08)" }]}>
                    <Ionicons name="search-sharp" size={22} color="#A78BFA" />
                  </View>
                  <Text style={styles.cardLabel}>Food Database</Text>
                </TouchableOpacity>

                {/* 4. Scan Food (Premium) */}
                <TouchableOpacity
                  style={styles.card}
                  onPress={handleStartScanning}
                  activeOpacity={0.85}
                >
                  <View style={styles.premiumBadge}>
                    <Ionicons name="sparkles" size={8} color="#F59E0B" />
                    <Text style={styles.premiumText}>PRO</Text>
                  </View>
                  <View style={[styles.cardIconFrame, { backgroundColor: "rgba(245, 158, 11, 0.08)" }]}>
                    <Ionicons name="camera-sharp" size={22} color="#F59E0B" />
                  </View>
                  <Text style={styles.cardLabel}>Scan Food</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Premium Image Source Selector Modal */}
      <Modal
        visible={isImagePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsImagePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setIsImagePickerVisible(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeaderContainer}>
              <View style={styles.sheetIconBadge}>
                <Ionicons name="sparkles" size={12} color="#F59E0B" />
                <Text style={styles.sheetBadgeText}>AI VISION</Text>
              </View>
              <Text style={styles.sheetTitle}>Scan Food Image</Text>
              <Text style={styles.sheetSubtitle}>
                Select how you would like to provide your food photo for AI analysis
              </Text>
            </View>

            {/* Option Cards */}
            <View style={styles.sheetOptionsGroup}>
              {/* Camera Option */}
              <TouchableOpacity
                style={styles.sheetCard}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <View style={[styles.sheetCardIconFrame, { backgroundColor: "rgba(41, 143, 80, 0.12)", borderColor: "rgba(41, 143, 80, 0.25)" }]}>
                  <Ionicons name="camera-sharp" size={24} color="#298F50" />
                </View>
                <View style={styles.sheetCardTextContainer}>
                  <Text style={styles.sheetCardTitle}>Take a Photo</Text>
                  <Text style={styles.sheetCardSubtitle}>Use camera to snap fresh food dish</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
              </TouchableOpacity>

              {/* Gallery Option */}
              <TouchableOpacity
                style={styles.sheetCard}
                onPress={handleChooseFromLibrary}
                activeOpacity={0.8}
              >
                <View style={[styles.sheetCardIconFrame, { backgroundColor: "rgba(167, 139, 250, 0.12)", borderColor: "rgba(167, 139, 250, 0.25)" }]}>
                  <Ionicons name="images-sharp" size={24} color="#A78BFA" />
                </View>
                <View style={styles.sheetCardTextContainer}>
                  <Text style={styles.sheetCardTitle}>Choose from Gallery</Text>
                  <Text style={styles.sheetCardSubtitle}>Pick existing food photo from library</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setIsImagePickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.12)",
  },
  plusButtonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: 72,
  },
  plusButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  menuCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    position: "absolute",
    bottom: 112, // just above the floating tab bar (24px bottom spacing + 72px height + 16px gap)
    left: 16,
    right: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  menuTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    minHeight: 108,
  },
  cardIconFrame: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  cardLabel: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  premiumBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  premiumText: {
    color: "#F59E0B",
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Custom Premium Image Source Selector Sheet Styles
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeaderContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  sheetIconBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  sheetBadgeText: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sheetTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },
  sheetSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  sheetOptionsGroup: {
    gap: 14,
    marginBottom: 20,
  },
  sheetCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  sheetCardIconFrame: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetCardTextContainer: {
    flex: 1,
  },
  sheetCardTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  sheetCardSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  sheetCancelBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
});
