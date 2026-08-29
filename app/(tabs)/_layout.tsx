import { useUser, useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View, Modal, Text, ActivityIndicator, InteractionManager } from "react-native";
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
  
  // Scanner mockup state
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

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

  // Start mock scanning
  const handleStartScanning = () => {
    setIsLogMenuVisible(false);
    setIsScannerVisible(true);
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    setTimeout(() => {
      setIsScanning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 1800);
  };

  // Log mock scanned food
  const handleLogScannedFood = async () => {
    if (!user) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      const storedDate = await AsyncStorage.getItem("active_calendar_date");
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
        today.getDate()
      ).padStart(2, "0")}`;
      const activeDate = storedDate || todayStr;
      
      const userLogsCollection = collection(db, "users", user.id, "logs");
      await addDoc(userLogsCollection, {
        title: "Grilled Avocado Salmon Salad (Scan)",
        type: "meal",
        calories: 380,
        protein: 28,
        carbs: 10,
        fats: 22,
        date: activeDate,
        createdAt: serverTimestamp(),
      });
      
      setIsScannerVisible(false);
    } catch (err) {
      console.error("Firestore log scanned food error:", err);
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

      {/* AI Scanner Mock/Placeholder Modal */}
      <Modal
        visible={isScannerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsScannerVisible(false)}
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>AI Food Scanner</Text>
            <TouchableOpacity onPress={() => setIsScannerVisible(false)} style={styles.scannerCloseBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          {isScanning ? (
            <View style={styles.scanningBody}>
              <View style={styles.scannerBox}>
                <Ionicons name="scan-outline" size={120} color={Colors.dark.primary} />
                <View style={styles.scanningLine} />
              </View>
              <ActivityIndicator size="large" color={Colors.dark.primary} style={{ marginTop: 24 }} />
              <Text style={styles.scanningText}>Scanning food plate via AI camera...</Text>
            </View>
          ) : (
            <View style={styles.scannerResultContainer}>
              <Text style={styles.resultHeader}>Scan Success 🎉</Text>
              <View style={styles.resultCard}>
                <Ionicons name="restaurant" size={32} color={Colors.dark.primary} style={{ marginBottom: 12 }} />
                <Text style={styles.scannedFoodTitle}>Grilled Avocado Salmon Salad</Text>
                <Text style={styles.scannedFoodCal}>380 kcal</Text>
                
                <View style={styles.resultDivider} />
                
                <View style={styles.scannedMacrosRow}>
                  <View style={styles.scannedMacroCol}>
                    <Text style={styles.scannedMacroVal}>28g</Text>
                    <Text style={styles.scannedMacroLabel}>Protein</Text>
                  </View>
                  <View style={styles.scannedMacroCol}>
                    <Text style={styles.scannedMacroVal}>10g</Text>
                    <Text style={styles.scannedMacroLabel}>Carbs</Text>
                  </View>
                  <View style={styles.scannedMacroCol}>
                    <Text style={styles.scannedMacroVal}>22g</Text>
                    <Text style={styles.scannedMacroLabel}>Fats</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.logScannedBtn}
                onPress={handleLogScannedFood}
                activeOpacity={0.8}
              >
                <Text style={styles.logScannedBtnText}>Log to Food Diary</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.retryScanBtn}
                onPress={handleStartScanning}
                activeOpacity={0.7}
              >
                <Text style={styles.retryScanBtnText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  // Scanner Mock styles
  scannerOverlay: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: "space-between",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  scannerTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  scannerCloseBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  scanningBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerBox: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.01)",
    position: "relative",
    overflow: "hidden",
  },
  scanningLine: {
    position: "absolute",
    width: "100%",
    height: 3,
    backgroundColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    top: "50%", 
  },
  scanningText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
  },
  scannerResultContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 10,
  },
  resultHeader: {
    color: Colors.dark.primary,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  resultCard: {
    width: "100%",
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  scannedFoodTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  scannedFoodCal: {
    color: Colors.dark.primary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
  },
  resultDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 16,
  },
  scannedMacrosRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  scannedMacroCol: {
    alignItems: "center",
  },
  scannedMacroVal: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
  },
  scannedMacroLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  logScannedBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 12,
  },
  logScannedBtnText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  retryScanBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  retryScanBtnText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});
