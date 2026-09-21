import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Saves or updates user profile information in Firestore if it doesn't already exist.
 */
export async function saveUserProfile(
  userId: string,
  email: string,
  displayName?: string,
  photoURL?: string
) {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // 1. User doesn't exist, create a fresh profile document
      await setDoc(userDocRef, {
        uid: userId,
        email,
        displayName: displayName || "",
        photoURL: photoURL || "",
        targetCalories: 2000, // default target calories
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("New user profile created in Firestore:", userId);
    } else {
      // 2. User already exists, only update dynamic fields if necessary (keeps targets and createdAt intact)
      const existingData = userDocSnap.data();
      await setDoc(
        userDocRef,
        {
          displayName: displayName || existingData.displayName || "",
          photoURL: photoURL || existingData.photoURL || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("User profile checked and synced with Firestore:", userId);
    }
  } catch (error) {
    console.error("Error saving user profile to Firestore:", error);
    throw error;
  }
}

/**
 * Retrieves user profile from Firestore.
 */
export async function getUserProfile(userId: string) {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      return userDocSnap.data();
    }
    return null;
  } catch (error: any) {
    console.error("Error fetching user profile from Firestore:", error);
    if (error?.code === "permission-denied" || error?.message?.includes("permissions")) {
      console.warn("Firestore permission-denied: Check Firestore Security Rules in Firebase Console for project 'tarique-9ff49'.");
    }
    throw error;
  }
}

/**
 * Updates an existing user profile with onboarding data or other custom fields.
 */
export async function updateUserProfile(userId: string, data: any) {
  try {
    const userDocRef = doc(db, "users", userId);
    await setDoc(
      userDocRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log("User profile successfully updated in Firestore:", userId);
  } catch (error: any) {
    console.error("Error updating user profile in Firestore:", error);
    if (error?.code === "permission-denied" || error?.message?.includes("permissions")) {
      console.warn("Firestore permission-denied: Check Firestore Security Rules in Firebase Console for project 'tarique-9ff49'.");
    }
    throw error;
  }
}

export interface AdminNotificationSettings {
  lunchTitle: string;
  lunchBody: string;
  lunchHour: number;
  lunchMinute: number;
  afternoonTitle: string;
  afternoonBody: string;
  afternoonHour: number;
  afternoonMinute: number;
  dinnerTitle: string;
  dinnerBody: string;
  dinnerHour: number;
  dinnerMinute: number;
  inactivityTitle: string;
  inactivityBody: string;
  inactivityHour: number;
  inactivityMinute: number;
  unsubscribedTitle: string;
  unsubscribedBody: string;
  unsubscribedHour: number;
  unsubscribedMinute: number;
  updatedAt?: any;
}

export const DEFAULT_NOTIFICATION_SETTINGS: AdminNotificationSettings = {
  lunchTitle: "🍱 Lunch Time Reminder",
  lunchBody: "Don't forget to log your lunch meal and track your daily calories!",
  lunchHour: 13,
  lunchMinute: 0,
  afternoonTitle: "⚡ Afternoon Hydration & Activity Check",
  afternoonBody: "Time to log a workout, steps, or stay hydrated with fresh water!",
  afternoonHour: 16,
  afternoonMinute: 30,
  dinnerTitle: "🍽️ Dinner Log Reminder",
  dinnerBody: "End your day strong! Log your dinner to complete your daily nutrition goal.",
  dinnerHour: 20,
  dinnerMinute: 0,
  inactivityTitle: "🔔 You Haven't Logged Any Activity Today!",
  inactivityBody: "Consistency is key to health! Take 10 seconds to log your meal or workout.",
  inactivityHour: 21,
  inactivityMinute: 0,
  unsubscribedTitle: "⭐ Unlock Your Full Health Potential",
  unsubscribedBody: "Subscribe to ArogyaHub Premium for AI meal analysis, unlimited workout tracking, & personal insights!",
  unsubscribedHour: 10,
  unsubscribedMinute: 0,
};

import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_ADMIN_NOTIF_KEY = "admin_notification_settings_cache";

/**
 * Fetches admin push notification message settings from Firebase Firestore collection `admin`,
 * falling back to local AsyncStorage cache or defaults if permissions/network fail.
 */
export async function getAdminNotificationSettings(): Promise<AdminNotificationSettings> {
  let cached: Partial<AdminNotificationSettings> = {};
  try {
    const localData = await AsyncStorage.getItem(LOCAL_ADMIN_NOTIF_KEY);
    if (localData) {
      cached = JSON.parse(localData);
    }
  } catch (err) {
    console.warn("AsyncStorage read error for admin notification settings:", err);
  }

  try {
    const adminDocRef = doc(db, "admin", "notification_settings");
    const docSnap = await getDoc(adminDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const merged = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...cached,
        ...data,
      } as AdminNotificationSettings;
      // Keep local cache in sync with cloud
      AsyncStorage.setItem(LOCAL_ADMIN_NOTIF_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    }
  } catch (error: any) {
    if (error?.code === "permission-denied" || error?.message?.includes("permissions")) {
      console.warn(
        "Firestore permission-denied reading admin collection. Relying on local cache. Update Firestore rules for project 'tarique-9ff49'."
      );
    } else {
      console.warn("Could not fetch admin notification settings from Firestore:", error);
    }
  }

  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...cached,
  };
}

/**
 * Updates admin push notification message settings in Firebase Firestore collection `admin`
 * and persists to local AsyncStorage cache.
 */
export async function updateAdminNotificationSettings(
  settings: Partial<AdminNotificationSettings>
): Promise<{ cloudSynced: boolean }> {
  let cloudSynced = false;

  // 1. Always save to local AsyncStorage cache first for instant local responsiveness
  try {
    const current = await getAdminNotificationSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(LOCAL_ADMIN_NOTIF_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Error saving admin settings to local AsyncStorage:", err);
  }

  // 2. Try to sync to Firebase Firestore 'admin' collection
  try {
    const adminDocRef = doc(db, "admin", "notification_settings");
    await setDoc(
      adminDocRef,
      {
        ...settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log("Admin notification settings successfully updated in Firebase 'admin' collection.");
    cloudSynced = true;
  } catch (error: any) {
    if (error?.code === "permission-denied" || error?.message?.includes("permissions")) {
      console.warn(
        "Firestore permission-denied for 'admin' collection. Saved locally. To enable Firebase cloud sync, allow write access to collection 'admin' in Firebase Console Rules."
      );
    } else {
      console.error("Error saving admin notification settings to Firestore:", error);
    }
  }

  return { cloudSynced };
}

/**
 * Saves user's Push Notification Token to their Firestore profile document.
 */
export async function saveUserPushToken(userId: string, token: string): Promise<void> {
  try {
    const userDocRef = doc(db, "users", userId);
    await setDoc(
      userDocRef,
      {
        pushToken: token,
        pushTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log("User push token successfully saved to Firestore:", userId);
  } catch (error) {
    console.warn("Failed to save push token to Firestore:", error);
  }
}

