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
