import { Link, router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useMemo, useState } from "react";
import {
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

export default function LoginScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)");
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>Bucketlist</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to continue your dreams.</Text>

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

        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Log in</Text>
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
    button: {
      backgroundColor: C.buttonPrimary,
      padding: 17,
      borderRadius: 18,
      alignItems: "center",
      marginTop: 8,
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