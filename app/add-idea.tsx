import { router } from "expo-router";
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
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
import CollectionPickerSheet from "../components/CollectionPickerSheet";
import { auth, db } from "../lib/firebaseConfig";

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

  const handleCollectionSelected = async (collectionId: string, collectionName: string) => {
    setPickerVisible(false);
    if (!auth.currentUser) return;

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

    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
      collectionId,
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

    updateDoc(doc(db, "collections", collectionId), {
      itemCount: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    Alert.alert(
      "Saved",
      isPrivate
        ? `Added to "${collectionName}"`
        : `Added to "${collectionName}" and Explore.`
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
            placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
        onSelect={handleCollectionSelected}
      />
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 90,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    color: "#777",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#F4F4F4",
    padding: 16,
    borderRadius: 16,
    fontSize: 16,
    marginBottom: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  categoryPill: {
    backgroundColor: "#F4F4F4",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  categoryPillActive: {
    backgroundColor: "#111",
  },
  categoryPillText: {
    color: "#555",
    fontWeight: "800",
  },
  categoryPillTextActive: {
    color: "#fff",
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
    borderColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#111",
  },
  checkmark: {
    color: "#fff",
    fontWeight: "900",
  },
  checkboxTitle: {
    fontWeight: "800",
    fontSize: 15,
  },
  checkboxSubtitle: {
    color: "#777",
    fontSize: 13,
    marginTop: 2,
  },
  button: {
    marginTop: 8,
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  cancelText: {
    marginTop: 18,
    textAlign: "center",
    color: "#777",
    fontWeight: "700",
  },
});