import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@clerk/expo";
import { getUserProfile, updateUserProfile } from "../services/firebase";

export interface OnboardingData {
  gender: string;
  goal: string;
  workoutFrequency: string;
  birthDate: {
    day: string;
    month: string;
    year: string;
  };
  height: string; // e.g. "5 ft 10 in"
  weight: string; // e.g. "72 kg"
}

export interface GeneratedTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  water: number;
  advice: string;
}

interface OnboardingContextType {
  hasCompletedOnboarding: boolean | null;
  isLoadingOnboarding: boolean;
  completeOnboarding: (data: OnboardingData, targets: GeneratedTargets) => Promise<void>;
  checkOnboardingStatus: () => Promise<boolean>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);

  const checkOnboardingStatus = async (): Promise<boolean> => {
    if (!user) {
      setHasCompletedOnboarding(false);
      setIsLoadingOnboarding(false);
      return false;
    }

    try {
      // Always verify against the Firestore database (server truth)
      const profile = await getUserProfile(user.id);

      if (
        profile &&
        profile.gender &&
        profile.goal &&
        profile.workoutFrequency &&
        profile.birthDate &&
        profile.height &&
        profile.weight
      ) {
        // Exists in database, update/sync local AsyncStorage cache
        const dataToSave = {
          gender: profile.gender,
          goal: profile.goal,
          workoutFrequency: profile.workoutFrequency,
          birthDate: profile.birthDate,
          height: profile.height,
          weight: profile.weight,
          targetCalories: profile.targetCalories || 2000,
          targetProtein: profile.targetProtein || 150,
          targetCarbs: profile.targetCarbs || 200,
          targetFats: profile.targetFats || 70,
          targetWater: profile.targetWater || 2.5,
          aiAdvice: profile.aiAdvice || "",
        };
        await AsyncStorage.setItem(`onboarding_data_${user.id}`, JSON.stringify(dataToSave));
        setHasCompletedOnboarding(true);
        setIsLoadingOnboarding(false);
        return true;
      } else {
        // Document or data is missing/deleted from Firestore, clear local cache
        await AsyncStorage.removeItem(`onboarding_data_${user.id}`);
        setHasCompletedOnboarding(false);
        setIsLoadingOnboarding(false);
        return false;
      }
    } catch (error) {
      console.error("Error in checkOnboardingStatus:", error);
      // Fail-safe: try to use local AsyncStorage data if firestore query fails (offline support)
      try {
        const localData = await AsyncStorage.getItem(`onboarding_data_${user.id}`);
        if (localData) {
          setHasCompletedOnboarding(true);
          setIsLoadingOnboarding(false);
          return true;
        }
      } catch (localErr) {
        console.error("AsyncStorage backup retrieval error:", localErr);
      }
      setHasCompletedOnboarding(false);
      setIsLoadingOnboarding(false);
      return false;
    }
  };

  useEffect(() => {
    if (isUserLoaded) {
      if (user) {
        setIsLoadingOnboarding(true);
        checkOnboardingStatus();
      } else {
        // User logged out, reset state
        setHasCompletedOnboarding(null);
        setIsLoadingOnboarding(false);
      }
    }
  }, [user, isUserLoaded]);

  const completeOnboarding = async (data: OnboardingData, targets: GeneratedTargets) => {
    if (!user) throw new Error("No authenticated user found during onboarding completion");

    try {
      setIsLoadingOnboarding(true);

      const mergedData = {
        gender: data.gender,
        goal: data.goal,
        workoutFrequency: data.workoutFrequency,
        birthDate: data.birthDate,
        height: data.height,
        weight: data.weight,
        targetCalories: targets.calories,
        targetProtein: targets.protein,
        targetCarbs: targets.carbs,
        targetFats: targets.fats,
        targetWater: targets.water,
        aiAdvice: targets.advice,
        isOnboarded: true,
      };

      // 1. Save to AsyncStorage
      await AsyncStorage.setItem(`onboarding_data_${user.id}`, JSON.stringify(mergedData));

      // 2. Save to Firestore
      await updateUserProfile(user.id, mergedData);

      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      throw error;
    } finally {
      setIsLoadingOnboarding(false);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        isLoadingOnboarding,
        completeOnboarding,
        checkOnboardingStatus,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
