import { router } from "expo-router";
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
    Alert,
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
import CollectionPickerSheet, { CollectionRef } from "../components/CollectionPickerSheet";
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

const CATEGORIES = [
  "Travel",
  "Adventure",
  "Food & Drink",
  "Health",
  "Creative",
  "Learning",
  "Sports",
  "Nature",
  "Culture",
  "Events",
  "Personal Growth",
  "Other",
];

export default function AddIdeaScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const validateForm = (): string | null => {
    if (!auth.currentUser) return "Not logged in";
    const finalCategory = category === "Other" ? customCategory.trim() : category.trim();
    if (!title.trim()) return "Please add a title.";
    if (!finalCategory) return "Please choose a category.";
    return null;
  };

  const handleAddIdea = () => {
    const error = validateForm();
    if (error) {
      Alert.alert("Missing info", error);
      return;
    }
    Keyboard.dismiss();
    setPickerVisible(true);
  };

  const handleDone = async (toAdd: CollectionRef[], _toRemove: string[]) => {
    setPickerVisible(false);
    if (!auth.currentUser || toAdd.length === 0) return;

    const cleanTitle = title.trim();
    const cleanCategory = (category === "Other" ? customCategory : category).trim();

    let experienceId: string | null = null;

    if (!isPrivate) {
      const expRef = await addDoc(collection(db, "experiences"), {
        title: cleanTitle,
        slug: cleanTitle.toLowerCase().replace(/\s+/g, "-"),
        category: cleanCategory,
        tags: [],
        description: "",
        heroImageUrl: null,
        savesCount: 0,
        completionsCount: 0,
        trending: false,
        relatedIds: [],
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        source: "user",
      });
      experienceId = expRef.id;
    }

    for (const col of toAdd) {
      await addDoc(collection(db, "userBucketlistItems"), {
        userId: auth.currentUser.uid,
        collectionId: col.id,
        title: cleanTitle,
        category: cleanCategory,
        completed: false,
        imageUrl: null,
        caption: "",
        media: [],
        createdAt: serverTimestamp(),
        completedAt: null,
        customIdea: true,
        isPrivate,
        experienceId,
      });

      updateDoc(doc(db, "collections", col.id), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    const firstName = toAdd[0].name;
    Alert.alert(
      "Saved",
      toAdd.length === 1
        ? isPrivate
          ? `Added to "${firstName}"`
          : `Added to "${firstName}" and Explore.`
        : isPrivate
          ? `Added to ${toAdd.length} collections`
          : `Added to ${toAdd.length} collections and Explore.`
    );

    router.back();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Add your own idea</Text>
          <Text style={styles.subtitle}>
            Add something you want to do, try, visit, or experience.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Example: Sleep in a glass igloo"
            placeholderTextColor={C.inputPlaceholder}
            value={title}
            onChangeText={setTitle}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <Text style={styles.label}>Choose a category</Text>

          <View style={styles.categoryGrid}>
            {CATEGORIES.map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.categoryPill,
                  category === item && styles.categoryPillActive,
                ]}
                onPress={() => {
                  setCategory(item);
                  if (item !== "Other") {
                    setCustomCategory("");
                  }
                }}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    category === item && styles.categoryPillTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          {category === "Other" && (
            <TextInput
              style={styles.input}
              placeholder="Write your category"
              placeholderTextColor={C.inputPlaceholder}
              value={customCategory}
              onChangeText={setCustomCategory}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          )}

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <View style={[styles.checkbox, isPrivate && styles.checkboxChecked]}>
              {isPrivate && <Text style={styles.checkmark}>✓</Text>}
            </View>

            <View>
              <Text style={styles.checkboxTitle}>Keep this idea private</Text>
              <Text style={styles.checkboxSubtitle}>
                Private ideas will not show on Explore.
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.button} onPress={handleAddIdea}>
            <Text style={styles.buttonText}>Choose a collection →</Text>
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <CollectionPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onDone={handleDone}
      />
    </TouchableWithoutFeedback>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      paddingTop: 90,
      backgroundColor: C.background,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: C.text,
    },
    subtitle: {
      marginTop: 8,
      color: C.textSecondary,
      fontSize: 15,
      lineHeight: 21,
      marginBottom: 24,
    },
    input: {
      backgroundColor: C.inputBackground,
      padding: 16,
      borderRadius: 16,
      fontSize: 16,
      marginBottom: 14,
      color: C.text,
    },
    label: {
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 10,
      color: C.text,
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 18,
    },
    categoryPill: {
      backgroundColor: C.surface,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
    },
    categoryPillActive: {
      backgroundColor: C.buttonPrimary,
    },
    categoryPillText: {
      color: C.textSecondary,
      fontWeight: "800",
    },
    categoryPillTextActive: {
      color: C.buttonPrimaryText,
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 4,
      marginBottom: 18,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: C.text,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: C.buttonPrimary,
    },
    checkmark: {
      color: C.buttonPrimaryText,
      fontWeight: "900",
    },
    checkboxTitle: {
      fontWeight: "800",
      fontSize: 15,
      color: C.text,
    },
    checkboxSubtitle: {
      color: C.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    button: {
      marginTop: 8,
      backgroundColor: C.buttonPrimary,
      padding: 16,
      borderRadius: 18,
      alignItems: "center",
    },
    buttonText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 16,
    },
    cancelText: {
      marginTop: 18,
      textAlign: "center",
      color: C.textSecondary,
      fontWeight: "700",
    },
  });
}