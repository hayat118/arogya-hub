import { useOAuth } from "@clerk/expo";
import { useSignIn } from "@clerk/expo/legacy";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import Colors from "../constants/Colors";
import {
  ActivityIndicator,
  Alert,
  Image,
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

// Warm up the browser for Google OAuth on Android/iOS
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Email/Password Sign In
  const handleSignIn = async () => {
    if (!isSignInLoaded) return;
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        if (setActive) {
          await setActive({ session: result.createdSessionId });
        }
      } else {
        console.warn("Sign in status incomplete:", result.status);
        Alert.alert("Verification Required", "Please verify your account details.");
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Sign In Failed", err.errors?.[0]?.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow();
      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      Alert.alert("Google Sign-In Failed", err.message || "Failed to authenticate with Google.");
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
          {/* Logo & Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoFrame}>
              <Image
                source={require("../assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Arogya Hub</Text>
            <Text style={styles.subtitle}>Track your calories and hit your goals with AI</Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeader}>Welcome Back</Text>

            {/* Email Field */}
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

            {/* Password Field */}
            <View style={styles.inputLabelContainer}>
              <Text style={styles.inputLabel}>Password</Text>
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
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

            {/* Sign In Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.dark.white} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color={Colors.dark.white} style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google OAuth Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={20} color={Colors.dark.googleText} style={{ marginRight: 10 }} />
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{"Don't have an account? "}</Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Create Account</Text>
              </TouchableOpacity>
            </Link>
          </View>
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
  logo: {
    width: 50,
    height: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.dark.text,
    letterSpacing: 0.5,
    marginBottom: 8,
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
});
