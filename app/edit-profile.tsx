import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
import {
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { auth, db, storage } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

export default function EditProfileScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!auth.currentUser) return;

      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setUsername(data.username || "");
        setBio(data.bio || "");
        setImage(data.profileImage || null);
      }
    };

    loadProfile();
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      alert("Permission required");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async () => {
    if (!image || !auth.currentUser) return "";
  
    const response = await fetch(image);
    const blob = await response.blob();
  
    const imageRef = ref(storage, `profileImages/${auth.currentUser.uid}.jpg`);
  
    await uploadBytes(imageRef, blob);
  
    const downloadUrl = await getDownloadURL(imageRef);
  
    return downloadUrl;
  };

  const handleSave = async () => {
    Keyboard.dismiss();
  
    if (!auth.currentUser) return;
  
    let profileImageUrl = image;
  
    if (image && image.startsWith("file")) {
      profileImageUrl = await uploadImage();
    }
  
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      username: username.trim(),
      usernameLower: username.trim().toLowerCase(),
      bio: bio.trim(),
      profileImage: profileImageUrl,
    });
  
    router.back();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Edit profile</Text>
          <Text style={styles.subtitle}>Update how people see you.</Text>
  
          <View style={styles.avatarPreview}>
            {image ? (
              <Image source={{ uri: image }} style={styles.profileImage} />
            ) : (
              <Text style={styles.avatarText}>?</Text>
            )}
          </View>
  
          <Pressable onPress={pickImage} style={styles.imagePicker}>
            <Text style={styles.imagePickerText}>
              {image ? "Change photo" : "Add photo"}
            </Text>
          </Pressable>
  
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            autoCapitalize="none"
            style={styles.input}
          />
  
          <Text style={styles.label}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Write a short bio..."
            multiline
            style={[styles.input, styles.bioInput]}
          />
  
          <Pressable style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>Save changes</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
    title: {
      fontSize: 30,
      fontWeight: "800",
      color: C.text,
    },
    subtitle: {
      color: C.textSecondary,
      marginTop: 8,
      marginBottom: 24,
    },
    label: {
      fontWeight: "700",
      marginBottom: 8,
      marginTop: 8,
      color: C.text,
    },
    input: {
      backgroundColor: C.inputBackground,
      padding: 16,
      borderRadius: 16,
      fontSize: 16,
      marginBottom: 12,
      color: C.text,
    },
    bioInput: {
      minHeight: 100,
      textAlignVertical: "top",
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
    imagePicker: {
      backgroundColor: C.buttonPrimary,
      padding: 14,
      borderRadius: 16,
      alignItems: "center",
      marginBottom: 16,
    },
    imagePickerText: {
      color: C.buttonPrimaryText,
      fontWeight: "700",
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarPreview: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: C.avatarBg,
      alignSelf: "center",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 14,
    },
    avatarText: {
      color: "#fff",
      fontSize: 38,
      fontWeight: "800",
    },
  });
}