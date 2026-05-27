import { Link, router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
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

export default function SignupScreen() {
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
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#999"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
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
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
    color: "#777",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 21,
  },
  input: {
    backgroundColor: "#F4F4F4",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#111",
    padding: 17,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomText: {
    textAlign: "center",
    marginTop: 20,
    color: "#777",
  },
  link: {
    color: "#111",
    fontWeight: "700",
  },
});