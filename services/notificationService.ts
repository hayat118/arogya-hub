import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import {
  getAdminNotificationSettings,
  saveUserPushToken,
  AdminNotificationSettings,
} from "./firebase";

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers the device for push notifications, requests necessary permissions,
 * and saves the Expo push token to Firestore if user ID is provided.
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default & Activity Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
    });
  }

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device or simulator with notification support.");
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Permission not granted for push notifications!");
      return null;
    }

    // Get Expo push token
    const pushTokenData = await Notifications.getExpoPushTokenAsync().catch((err) => {
      console.warn("Could not retrieve Expo Push Token:", err);
      return null;
    });

    if (pushTokenData?.data) {
      token = pushTokenData.data;
      console.log("Retrieved Push Token:", token);
      if (userId) {
        await saveUserPushToken(userId, token);
      }
    }
  } catch (error) {
    console.error("Error during push notification registration:", error);
  }

  return token;
}

/**
 * Schedules daily automated notifications based on message settings fetched from Firebase 'admin' collection.
 * Includes:
 * 1. Lunch reminder (13:00)
 * 2. Afternoon activity check (16:30)
 * 3. Dinner reminder (20:00)
 * 4. Daily inactivity check reminder (21:00)
 * 5. Targeted encouragement notification for unsubscribed / free users (10:00)
 */
export async function scheduleAutomatedMealAndActivityReminders(
  userId: string,
  isSubscribed: boolean = false
): Promise<void> {
  try {
    // 1. Clear previous scheduled reminders to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 2. Fetch custom message settings set by Admin in Firebase
    const adminSettings: AdminNotificationSettings = await getAdminNotificationSettings();

    // 3. Schedule Lunch Reminder (Default: 1:00 PM / 13:00)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: adminSettings.lunchTitle,
        body: adminSettings.lunchBody,
        sound: true,
        data: { type: "lunch_reminder" },
      },
      trigger: {
        hour: adminSettings.lunchHour ?? 13,
        minute: adminSettings.lunchMinute ?? 0,
        repeats: true,
      } as any,
    });

    // 4. Schedule Afternoon Activity & Hydration Check (Default: 4:30 PM / 16:30)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: adminSettings.afternoonTitle,
        body: adminSettings.afternoonBody,
        sound: true,
        data: { type: "afternoon_reminder" },
      },
      trigger: {
        hour: adminSettings.afternoonHour ?? 16,
        minute: adminSettings.afternoonMinute ?? 30,
        repeats: true,
      } as any,
    });

    // 5. Schedule Dinner Reminder (Default: 8:00 PM / 20:00)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: adminSettings.dinnerTitle,
        body: adminSettings.dinnerBody,
        sound: true,
        data: { type: "dinner_reminder" },
      },
      trigger: {
        hour: adminSettings.dinnerHour ?? 20,
        minute: adminSettings.dinnerMinute ?? 0,
        repeats: true,
      } as any,
    });

    // 6. Schedule Daily Inactivity / Logging Encouragement (Default: 9:00 PM / 21:00)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: adminSettings.inactivityTitle,
        body: adminSettings.inactivityBody,
        sound: true,
        data: { type: "inactivity_reminder" },
      },
      trigger: {
        hour: adminSettings.inactivityHour ?? 21,
        minute: adminSettings.inactivityMinute ?? 0,
        repeats: true,
      } as any,
    });

    // 7. Targeted Notification for Unsubscribed Users / Paid Plan Encouragement (Default: 10:00 AM)
    if (!isSubscribed) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: adminSettings.unsubscribedTitle,
          body: adminSettings.unsubscribedBody,
          sound: true,
          data: { type: "subscription_encouragement" },
        },
        trigger: {
          hour: adminSettings.unsubscribedHour ?? 10,
          minute: adminSettings.unsubscribedMinute ?? 0,
          repeats: true,
        } as any,
      });
    }

    console.log("Successfully scheduled automated reminders from Firebase Admin settings.");
  } catch (error) {
    console.error("Error scheduling automated notifications:", error);
  }
}

/**
 * Instantly triggers a local test notification.
 */
export async function triggerInstantTestNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || "🔔 ArogyaHub Notification Test",
        body: body || "This is a test reminder from your Admin Push Notification panel!",
        sound: true,
      },
      trigger: null, // trigger immediately
    });
  } catch (error) {
    console.error("Failed to trigger instant test notification:", error);
    throw error;
  }
}
