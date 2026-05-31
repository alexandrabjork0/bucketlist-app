import { Link, router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
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
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

function getAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use": return "That email is already registered.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/weak-password": return "Password must be at least 6 characters.";
    case "auth/network-request-failed": return "Network error. Check your connection.";
    default: return "Something went wrong. Please try again.";
  }
}

function validateUsername(username: string): string | null {
  const t = username.trim();
  if (t.length < 3) return "Username must be at least 3 characters.";
  if (t.length > 20) return "Username must be 20 characters or less.";
  if (!/^[a-zA-Z0-9_]+$/.test(t)) return "Only letters, numbers, and underscores allowed.";
  return null;
}

export default function SignupScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    const usernameError = validateUsername(trimmedUsername);
    if (usernameError) {
      Alert.alert("Invalid username", usernameError);
      return;
    }

    if (!trimmedEmail) {
      Alert.alert("Missing email", "Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const taken = await getDocs(
        query(collection(db, "users"), where("usernameLower", "==", trimmedUsername.toLowerCase()))
      );
      if (!taken.empty) {
        Alert.alert("Username taken", "That username is already in use. Please choose another.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: trimmedEmail,
        username: trimmedUsername,
        usernameLower: trimmedUsername.toLowerCase(),
        bio: "",
        profileImage: "",
        createdAt: serverTimestamp(),
        notificationsLastSeen: serverTimestamp(),
      });

      await setDoc(
        doc(db, "notifications", `system_${userCredential.user.uid}_welcome`),
        {
          recipientId: userCredential.user.uid,
          type: "system",
          tab: "system",
          actors: [],
          actorCount: 0,
          postId: null,
          postTitle: null,
          postImageUrl: null,
          previewText: "Welcome to LivedIt! Start exploring experiences and save what inspires you.",
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Sign up failed", getAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>LivedIt</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Save experiences, go do them, share the memory.
        </Text>

        <TextInput
          placeholder="Username"
          placeholderTextColor={C.inputPlaceholder}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

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

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Creating account…" : "Create account"}
          </Text>
        </Pressable>

        <Text style={styles.bottomText}>
          Already have an account?{" "}
          <Link href="/login" style={styles.link}>
            Log in
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
      lineHeight: 21,
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
