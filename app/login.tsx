import { Link, router } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

function getAuthError(code: string): string {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/too-many-requests": return "Too many attempts. Please try again later.";
    case "auth/network-request-failed": return "Network error. Check your connection.";
    default: return "Something went wrong. Please try again.";
  }
}

export default function LoginScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert("Missing email", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Log in failed", getAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Reset password", "Enter your email address above, then tap Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Email sent", "Check your inbox for a password reset link.");
    } catch (error: any) {
      Alert.alert("Error", getAuthError(error.code));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>LivedIt</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to continue living it.</Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor={C.inputPlaceholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={C.inputPlaceholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <Pressable onPress={handleForgotPassword} style={styles.forgotRow}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Logging in…" : "Log in"}</Text>
        </Pressable>

        <Text style={styles.bottomText}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={styles.link}>
            Sign up
          </Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
      justifyContent: "center",
      padding: 24,
    },
    card: {
      backgroundColor: C.surface,
      padding: 26,
      borderRadius: 28,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
    },
    logo: {
      fontSize: 34,
      fontWeight: "800",
      marginBottom: 24,
      color: C.text,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: C.text,
    },
    subtitle: {
      fontSize: 15,
      color: C.textSecondary,
      marginTop: 8,
      marginBottom: 24,
    },
    input: {
      backgroundColor: C.inputBackground,
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      fontSize: 16,
      color: C.text,
    },
    forgotRow: {
      alignItems: "flex-end",
      marginBottom: 16,
      marginTop: -4,
    },
    forgotText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.textSecondary,
    },
    button: {
      backgroundColor: C.buttonPrimary,
      padding: 17,
      borderRadius: 18,
      alignItems: "center",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: C.buttonPrimaryText,
      fontSize: 16,
      fontWeight: "700",
    },
    bottomText: {
      textAlign: "center",
      marginTop: 20,
      color: C.textSecondary,
    },
    link: {
      color: C.text,
      fontWeight: "700",
    },
  });
}
