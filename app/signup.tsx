import { Link, router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

export default function SignupScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleSignup = async () => {
    if (!username.trim()) {
      alert("Please choose a username");
      return;
    }
  
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
  
      // 👉 vista user í Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: email.trim(),
        username: username.trim(),
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
          previewText: "Welcome to Bucketlist! Start exploring experiences and save what inspires you.",
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

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
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Start saving dreams, places, and moments you want to experience.
        </Text>

        <TextInput
          placeholder="Username"
          placeholderTextColor={C.inputPlaceholder}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
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

        <Pressable style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>Create account</Text>
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