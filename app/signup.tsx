import { useOAuth } from "@clerk/expo";
import { useSignUp } from "@clerk/expo/legacy";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import Colors from "../constants/Colors";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saveUserProfile } from "../services/firebase";

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  // Verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Email/Password Sign Up
  const handleSignUp = async () => {
    if (!isSignUpLoaded) return;
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Split full name into first and last name
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Start the signup process
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      // If Clerk has marked the signup as complete (verification is disabled in Dashboard)
      if (result.status === "complete") {
        if (result.createdUserId) {
          try {
            await saveUserProfile(result.createdUserId, email, fullName);
          } catch (dbError) {
            console.error("Error saving user details to Firestore during signup: ", dbError);
          }
        }

        Alert.alert(
          "Success",
          "Account created successfully! Please sign in with your email and password.",
          [
            {
              text: "OK",
              onPress: () => {
                router.replace("/signin");
              },
            },
          ]
        );
      } else {
        // Otherwise, send the email verification code and show OTP input view
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        setPendingVerification(true);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Sign Up Failed", err.errors?.[0]?.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // Verify Email Verification Code (OTP)
  const handleVerify = async () => {
    if (!isSignUpLoaded) return;
    if (!verificationCode) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }

    setIsLoading(true);
    try {
      // Attempt to verify the email code
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        // Save user profile details to Firestore database immediately
        if (result.createdUserId) {
          try {
            await saveUserProfile(result.createdUserId, email, fullName);
          } catch (dbError) {
            console.error("Error saving user details to Firestore during signup: ", dbError);
          }
        }

        Alert.alert(
          "Success",
          "Account created successfully! Please sign in with your email and password.",
          [
            {
              text: "OK",
              onPress: () => {
                router.replace("/signin");
              },
            },
          ]
        );
      } else {
        console.warn("Verification incomplete:", result.status);
        Alert.alert("Verification Failed", "Unable to complete registration. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Verification Failed", err.errors?.[0]?.message || "Invalid verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Sign In/Up
  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    try {
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow();
      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
      }
    } catch (err: any) {
      console.error("Google Sign-Up Error:", err);
      Alert.alert("Google Sign-Up Failed", err.message || "Failed to authenticate with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!pendingVerification ? (
            <>
              {/* Header */}
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Arogya Hub and start your fitness journey</Text>
              </View>

              {/* Form */}
              <View style={styles.formCard}>
                {/* Full Name */}
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>

                {/* Email Address */}
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                {/* Password */}
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Password</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password"
                    placeholderTextColor={Colors.dark.textMuted}
                    secureTextEntry={!isPasswordVisible}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={Colors.dark.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm Password */}
                <View style={styles.inputLabelContainer}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor={Colors.dark.textMuted}
                    secureTextEntry={!isConfirmPasswordVisible}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={isConfirmPasswordVisible ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={Colors.dark.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSignUp}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.dark.white} />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.primaryButtonText}>Sign Up</Text>
                      <Ionicons name="arrow-forward" size={18} color={Colors.dark.white} style={{ marginLeft: 8 }} />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or sign up with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google OAuth Button */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignUp}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-google" size={20} color={Colors.dark.googleText} style={{ marginRight: 10 }} />
                  <Text style={styles.googleButtonText}>Sign up with Google</Text>
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/signin" asChild>
                  <TouchableOpacity>
                    <Text style={styles.footerLink}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </>
          ) : (
            <>
              {/* Verification OTP view */}
              <View style={styles.headerContainer}>
                <View style={styles.logoFrame}>
                  <Ionicons name="mail-open-outline" size={40} color={Colors.dark.primary} />
                </View>
                <Text style={styles.title}>Verify Email</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit verification code to{"\n"}
                  <Text style={{ fontWeight: "600", color: Colors.dark.text }}>{email}</Text>
                </Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.cardHeader}>Enter Code</Text>

                <View style={styles.inputWrapper}>
                  <Ionicons name="key-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={Colors.dark.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerify}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.dark.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Create Account</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={async () => {
                    if (!signUp) return;
                    try {
                      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
                      Alert.alert("Code Sent", "Verification code has been resent to your email.");
                    } catch (e: any) {
                      Alert.alert("Error", e.message || "Failed to resend code.");
                    }
                  }}
                  disabled={isLoading}
                >
                  <Text style={styles.resendButtonText}>Resend Code</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoFrame: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.dark.text,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: 20,
  },
  inputLabelContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceDarker,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
  },
  eyeIcon: {
    padding: 4,
  },
  primaryButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 18,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  dividerText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    paddingHorizontal: 12,
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: Colors.dark.white,
    borderRadius: 18,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.googleBorder,
  },
  googleButtonText: {
    color: Colors.dark.googleText,
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  resendButton: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  resendButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
