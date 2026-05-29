import { router } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { auth, db } from "../../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../../lib/theme";
import { migrateIdeasToExperiences } from "../../lib/migration";

type Experience = {
  id: string;
  title: string;
  category: string;
  heroImageUrl: string | null;
  savesCount: number;
  completionsCount: number;
};

const { width: SCREEN_W } = Dimensions.get("window");
const FEATURED_W = Math.round(SCREEN_W * 0.52);
const REC_W = Math.round(SCREEN_W * 0.42);

const CATEGORIES = [
  "All",
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

const CREATE_CATEGORIES = CATEGORIES.filter((c) => c !== "All");

// ── Cinematic card with overlay text ────────────────────────────────────────

function FeaturedCard({ exp, width }: { exp: Experience; width: number }) {
  const C = useTheme();
  const height = Math.round(width * 1.42);
  return (
    <Pressable
      style={{ width, marginRight: 10 }}
      onPress={() => router.push({ pathname: "/experience/[id]", params: { id: exp.id } })}
    >
      <View style={[fc.image, { width, height, backgroundColor: C.surfaceElevated }]}>
        {exp.heroImageUrl && (
          <Image source={{ uri: exp.heroImageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </View>
      <View style={fc.body}>
        <Text style={[fc.cat, { color: C.textTertiary }]}>{exp.category}</Text>
        <Text style={[fc.title, { color: C.text }]} numberOfLines={2}>{exp.title}</Text>
        {exp.savesCount > 0 && (
          <Text style={[fc.saves, { color: C.textTertiary }]}>{exp.savesCount} saved</Text>
        )}
      </View>
    </Pressable>
  );
}

const fc = StyleSheet.create({
  image: {
    borderRadius: 18,
    overflow: "hidden",
  },
  body: {
    paddingTop: 10,
    paddingHorizontal: 2,
  },
  cat: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  saves: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
  },
});

// ── Small masonry tile ───────────────────────────────────────────────────────

function ExperienceTile({ exp }: { exp: Experience }) {
  const C = useTheme();
  const ts = useMemo(() => makeTileStyles(C), [C]);
  return (
    <Pressable
      style={ts.tile}
      onPress={() => router.push({ pathname: "/experience/[id]", params: { id: exp.id } })}
    >
      <View style={[ts.imageWrapper, { backgroundColor: C.surfaceElevated }]}>
        {exp.heroImageUrl && (
          <Image source={{ uri: exp.heroImageUrl }} style={ts.image} resizeMode="cover" />
        )}
      </View>
      <View style={ts.body}>
        <Text style={ts.cat}>{exp.category}</Text>
        <Text style={ts.title} numberOfLines={3}>{exp.title}</Text>
        {exp.savesCount > 0 && (
          <Text style={ts.saves}>{exp.savesCount} saved</Text>
        )}
      </View>
    </Pressable>
  );
}

function makeTileStyles(C: ThemeColors) {
  return StyleSheet.create({
    tile: { marginBottom: 4 },
    imageWrapper: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 14,
      overflow: "hidden",
    },
    image: { width: "100%", height: "100%" },
    body: { paddingTop: 8, paddingHorizontal: 2, paddingBottom: 4 },
    cat: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: C.textTertiary,
    },
    title: {
      fontSize: 13,
      fontWeight: "800",
      color: C.text,
      marginTop: 3,
      lineHeight: 17,
    },
    saves: {
      marginTop: 3,
      fontSize: 11,
      color: C.textTertiary,
      fontWeight: "500",
    },
  });
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [search, setSearch] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [recommended, setRecommended] = useState<Experience[]>([]);
  const [topCategory, setTopCategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExperiences();
    fetchPersonalized();
  }, []);

  const fetchExperiences = async () => {
    const expSnap = await getDocs(query(collection(db, "experiences"), limit(1)));
    if (expSnap.empty) await migrateIdeasToExperiences();

    const snapshot = await getDocs(query(collection(db, "experiences")));
    const fetched: Experience[] = snapshot.docs.map((d) => ({
      id: d.id,
      title: d.data().title || "",
      category: d.data().category || "Other",
      heroImageUrl: d.data().heroImageUrl || null,
      savesCount: d.data().savesCount || 0,
      completionsCount: d.data().completionsCount || 0,
    }));
    fetched.sort((a, b) => b.savesCount - a.savesCount);
    setExperiences(fetched);
  };

  const fetchPersonalized = async () => {
    if (!auth.currentUser) return;
    const snap = await getDocs(
      query(collection(db, "userBucketlistItems"), where("userId", "==", auth.currentUser.uid))
    );
    const catCount: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const cat = d.data().category;
      if (cat) catCount[cat] = (catCount[cat] || 0) + 1;
    });
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    if (!topCat) return;
    setTopCategory(topCat);

    const recSnap = await getDocs(
      query(collection(db, "experiences"), where("category", "==", topCat), limit(10))
    );
    const recs: Experience[] = recSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title || "",
      category: d.data().category || "Other",
      heroImageUrl: d.data().heroImageUrl || null,
      savesCount: d.data().savesCount || 0,
      completionsCount: d.data().completionsCount || 0,
    }));
    setRecommended(recs.sort((a, b) => b.savesCount - a.savesCount).slice(0, 8));
  };

  const openSheet = () => {
    setNewTitle("");
    setNewCategory("");
    setNewCustomCategory("");
    setNewIsPrivate(false);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    Keyboard.dismiss();
    setSheetOpen(false);
  };

  const handleCreate = async () => {
    if (!auth.currentUser) return;
    const finalCategory =
      newCategory === "Other" ? newCustomCategory.trim() : newCategory.trim();
    if (!newTitle.trim() || !finalCategory) {
      Alert.alert("Missing info", "Please add a title and category.");
      return;
    }
    const cleanTitle = newTitle.trim();
    try {
      setSubmitting(true);
      let experienceId: string | null = null;
      if (!newIsPrivate) {
        const expRef = await addDoc(collection(db, "experiences"), {
          title: cleanTitle,
          slug: cleanTitle.toLowerCase().replace(/\s+/g, "-"),
          category: finalCategory,
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
        title: cleanTitle,
        category: finalCategory,
        completed: false,
        imageUrl: null,
        caption: "",
        media: [],
        createdAt: serverTimestamp(),
        completedAt: null,
        source: "custom",
        isPrivate: newIsPrivate,
        experienceId,
      });
      closeSheet();
      Alert.alert(
        "Added",
        newIsPrivate
          ? "Your private idea was added to your list."
          : "Your idea was added to your list and Explore."
      );
      if (!newIsPrivate) fetchExperiences();
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const trending = experiences.slice(0, 8);

  const matchesSearch = (exp: Experience) => {
    const q = search.toLowerCase();
    return !q || exp.title.toLowerCase().includes(q) || exp.category.toLowerCase().includes(q);
  };

  // Soft filter: selected category rises to top, rest continues below for endless discovery
  const prioritized =
    selectedCategory === "All"
      ? experiences.filter(matchesSearch)
      : [
          ...experiences.filter((e) => e.category === selectedCategory && matchesSearch(e)),
          ...experiences.filter((e) => e.category !== selectedCategory && matchesSearch(e)),
        ];

  const leftCol = prioritized.filter((_, i) => i % 2 === 0);
  const rightCol = prioritized.filter((_, i) => i % 2 !== 0);

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Explore</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search experiences…"
          placeholderTextColor={C.inputPlaceholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── 1. Featured / Trending ── */}
        {!search && trending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending this week</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {trending.map((exp) => (
                <FeaturedCard key={exp.id} exp={exp} width={FEATURED_W} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── 2. Personalized ── */}
        {!search && recommended.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Because you love{" "}
              <Text style={styles.sectionTitleAccent}>{topCategory}</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {recommended.map((exp) => (
                <FeaturedCard key={exp.id} exp={exp} width={REC_W} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── 3. Category chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── 4. Discovery grid ── */}
        <View style={styles.gridHeader}>
          <Text style={styles.gridLabel}>
            {selectedCategory === "All" ? "Discover" : selectedCategory}
          </Text>
        </View>

        {prioritized.length > 0 ? (
          <View style={styles.masonry}>
            <View style={styles.masonryCol}>
              {leftCol.map((exp) => <ExperienceTile key={exp.id} exp={exp} />)}
            </View>
            <View style={styles.masonryCol}>
              {rightCol.map((exp) => <ExperienceTile key={exp.id} exp={exp} />)}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No experiences found.</Text>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* ── FAB ── */}
      <Pressable style={styles.fab} onPress={openSheet}>
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

      {/* ── Creation sheet ── */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add your own idea</Text>
            <Text style={styles.sheetSubtitle}>
              Something you want to do, visit, or experience.
            </Text>

            <TextInput
              style={styles.sheetInput}
              placeholder="e.g. Sleep in a glass igloo"
              placeholderTextColor={C.inputPlaceholder}
              value={newTitle}
              onChangeText={setNewTitle}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Text style={styles.sheetLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sheetChipsScroll}
            >
              {CREATE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.sheetChip, newCategory === cat && styles.sheetChipActive]}
                  onPress={() => {
                    setNewCategory(cat);
                    if (cat !== "Other") setNewCustomCategory("");
                  }}
                >
                  <Text style={[styles.sheetChipText, newCategory === cat && styles.sheetChipTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {newCategory === "Other" && (
              <TextInput
                style={[styles.sheetInput, { marginTop: 10 }]}
                placeholder="Write your category"
                placeholderTextColor={C.inputPlaceholder}
                value={newCustomCategory}
                onChangeText={setNewCustomCategory}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            )}

            <Pressable
              style={styles.sheetToggleRow}
              onPress={() => setNewIsPrivate((v) => !v)}
            >
              <View style={[styles.sheetCheckbox, newIsPrivate && styles.sheetCheckboxChecked]}>
                {newIsPrivate && <Text style={styles.sheetCheckmark}>✓</Text>}
              </View>
              <View>
                <Text style={styles.sheetToggleTitle}>Keep private</Text>
                <Text style={styles.sheetToggleSub}>Won't show on Explore</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.sheetButton, submitting && styles.sheetButtonDisabled]}
              onPress={handleCreate}
              disabled={submitting}
            >
              <Text style={styles.sheetButtonText}>
                {submitting ? "Adding..." : "Add to my list"}
              </Text>
            </Pressable>

            <Pressable onPress={closeSheet} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },

    // Header
    header: {
      paddingTop: 66,
      paddingHorizontal: 18,
      paddingBottom: 10,
      backgroundColor: C.background,
    },
    pageTitle: {
      fontSize: 30,
      fontWeight: "900",
      color: C.text,
      marginBottom: 14,
    },
    searchInput: {
      backgroundColor: C.inputBackground,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      fontSize: 15,
      color: C.text,
    },

    // Sections
    section: {
      marginTop: 28,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: C.text,
      paddingHorizontal: 18,
      marginBottom: 14,
    },
    sectionTitleAccent: {
      color: C.textSecondary,
    },
    hScroll: {
      paddingHorizontal: 18,
      paddingBottom: 2,
    },

    // Category chips
    chipsScroll: {
      paddingHorizontal: 18,
      paddingTop: 24,
      paddingBottom: 8,
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: C.surface,
      borderRadius: 999,
    },
    chipActive: {
      backgroundColor: C.buttonPrimary,
    },
    chipText: {
      color: C.textSecondary,
      fontWeight: "700",
      fontSize: 12,
    },
    chipTextActive: {
      color: C.buttonPrimaryText,
    },

    // Discovery grid
    gridHeader: {
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 12,
    },
    gridLabel: {
      fontSize: 18,
      fontWeight: "900",
      color: C.text,
    },
    masonry: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 8,
    },
    masonryCol: {
      flex: 1,
      gap: 8,
    },
    emptyText: {
      paddingHorizontal: 20,
      paddingTop: 40,
      color: C.textSecondary,
      textAlign: "center",
      fontWeight: "600",
      fontSize: 15,
    },
    bottomPad: {
      height: 100,
    },

    // FAB
    fab: {
      position: "absolute",
      bottom: 28,
      right: 22,
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: C.buttonPrimary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabIcon: {
      color: C.buttonPrimaryText,
      fontSize: 26,
      fontWeight: "300",
      lineHeight: 30,
    },

    // Creation sheet
    overlay: {
      flex: 1,
      backgroundColor: C.overlay,
    },
    sheetWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingBottom: 40,
      paddingTop: 14,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.handle,
      alignSelf: "center",
      marginBottom: 20,
    },
    sheetTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: C.text,
    },
    sheetSubtitle: {
      marginTop: 6,
      color: C.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 18,
    },
    sheetInput: {
      backgroundColor: C.inputBackground,
      padding: 15,
      borderRadius: 14,
      fontSize: 16,
      color: C.text,
    },
    sheetLabel: {
      fontSize: 14,
      fontWeight: "800",
      marginTop: 16,
      marginBottom: 10,
      color: C.text,
    },
    sheetChipsScroll: {
      gap: 8,
    },
    sheetChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: C.surface,
      borderRadius: 999,
    },
    sheetChipActive: {
      backgroundColor: C.buttonPrimary,
    },
    sheetChipText: {
      color: C.textSecondary,
      fontWeight: "700",
      fontSize: 13,
    },
    sheetChipTextActive: {
      color: C.buttonPrimaryText,
    },
    sheetToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 18,
      marginBottom: 20,
    },
    sheetCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: C.text,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetCheckboxChecked: {
      backgroundColor: C.buttonPrimary,
      borderColor: C.buttonPrimary,
    },
    sheetCheckmark: {
      color: C.buttonPrimaryText,
      fontWeight: "900",
      fontSize: 13,
    },
    sheetToggleTitle: {
      fontWeight: "800",
      fontSize: 15,
      color: C.text,
    },
    sheetToggleSub: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 1,
    },
    sheetButton: {
      backgroundColor: C.buttonPrimary,
      padding: 16,
      borderRadius: 18,
      alignItems: "center",
    },
    sheetButtonDisabled: {
      backgroundColor: C.disabled,
    },
    sheetButtonText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 16,
    },
    sheetCancel: {
      alignItems: "center",
      marginTop: 14,
    },
    sheetCancelText: {
      color: C.textSecondary,
      fontWeight: "700",
      fontSize: 15,
    },
  });
}
