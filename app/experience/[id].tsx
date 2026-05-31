import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CollectionPickerSheet from "../../components/CollectionPickerSheet";
import { CollectionRef, saveToCollections } from "../../lib/collections";
import PostThumbnail from "../../components/PostThumbnail";
import { auth, db } from "../../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../../lib/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_WIDTH * 1.05;

const CATEGORY_BG: Record<string, string> = {
  Travel: "#1a5f7a",
  Adventure: "#7a4a10",
  "Food & Drink": "#7a1a4a",
  Health: "#1a7a4a",
  Creative: "#4a1a7a",
  Learning: "#6a5a10",
  Sports: "#1a2a7a",
  Nature: "#1a6a1a",
  Culture: "#7a1a1a",
  Events: "#6a4a10",
  "Personal Growth": "#4a1a6a",
  Other: "#333",
};

export default function ExperienceScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { id } = useLocalSearchParams();
  const [experience, setExperience] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  // collectionId → docId for every copy of this experience in user's bucketlist
  const [savedItems, setSavedItems] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (id) loadExperience();
  }, [id]);

  const loadExperience = async () => {
    try {
      const expSnap = await getDoc(doc(db, "experiences", String(id)));
      if (!expSnap.exists()) { setLoading(false); return; }

      const expData = { id: expSnap.id, ...expSnap.data() };
      setExperience(expData);

      const [postsSnap, simSnap, alreadySnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "userBucketlistItems"),
            where("experienceId", "==", String(id)),
            where("completed", "==", true)
          )
        ),
        getDocs(
          query(collection(db, "experiences"), where("category", "==", (expData as any).category))
        ),
        auth.currentUser
          ? getDocs(
              query(
                collection(db, "userBucketlistItems"),
                where("userId", "==", auth.currentUser.uid),
                where("experienceId", "==", String(id))
              )
            )
          : Promise.resolve(null),
      ]);

      if (alreadySnap && !alreadySnap.empty) {
        const map = new Map<string, string>();
        alreadySnap.docs.forEach((d) => {
          const colId = (d.data() as any).collectionId;
          if (colId) map.set(colId, d.id);
        });
        setSavedItems(map);
      }

      // Grid only needs image + id — no author fetching needed
      const gridPosts = postsSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((p: any) => p.imageUrl || p.media?.length > 0)
        .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));
      setPosts(gridPosts);

      setSimilar(
        simSnap.docs
          .filter((d) => d.id !== String(id))
          .slice(0, 8)
          .map((d) => ({ id: d.id, ...d.data() }))
      );
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async (toAdd: CollectionRef[], toRemove: string[]) => {
    setPickerVisible(false);
    if (!auth.currentUser || !experience) return;

    const newMap = await saveToCollections(
      {
        title: experience.title,
        category: experience.category,
        source: "explore",
        experienceId: String(id),
      },
      toAdd,
      toRemove,
      savedItems
    );

    setSavedItems(newMap);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.textSecondary} />
      </View>
    );
  }

  if (!experience) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Experience not found.</Text>
      </View>
    );
  }

  const heroBg = CATEGORY_BG[experience.category] ?? "#333";

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          {experience.heroImageUrl ? (
            <Image source={{ uri: experience.heroImageUrl }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: heroBg }]} />
          )}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
        </View>

        {/* ── Hero meta ── */}
        <View style={styles.heroMeta}>
          <Text style={styles.heroCat}>{experience.category}</Text>
          <Text style={styles.heroTitle} numberOfLines={3}>
            {experience.title}
          </Text>
        </View>

        {/* ── Action bar ── */}
        <View style={styles.actionBar}>
          <View style={styles.statsBlock}>
            <Text style={styles.statNum}>{experience.savesCount || 0}</Text>
            <Text style={styles.statLbl}>saved</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsBlock}>
            <Text style={styles.statNum}>{experience.completionsCount || 0}</Text>
            <Text style={styles.statLbl}>completed</Text>
          </View>
          <Pressable
            style={[styles.addBtn, savedItems.size > 0 && styles.addBtnDone]}
            onPress={() => setPickerVisible(true)}
          >
            <Text style={[styles.addBtnText, savedItems.size > 0 && styles.addBtnTextDone]}>
              {savedItems.size > 0 ? "Saved ▾" : "+ Save to list"}
            </Text>
          </Pressable>
        </View>

        {/* ── Completions grid ── */}
        {posts.length > 0 ? (
          <View style={styles.gridSection}>
            <View style={styles.gridHeader}>
              <Text style={styles.sectionTitle}>Completed</Text>
              <Text style={styles.gridCount}>{posts.length}</Text>
            </View>
            <View style={styles.grid}>
              {posts.map((post) => (
                <PostThumbnail
                  key={post.id}
                  post={post}
                  onPress={() =>
                    router.push({
                      pathname: "/post-feed/[id]",
                      params: { id: post.id, mode: "experience", filterId: String(id) },
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyPostsText}>
              No completions yet.{"\n"}Be the first.
            </Text>
          </View>
        )}

        {/* ── Similar experiences ── */}
        {similar.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More {experience.category}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarScroll}
            >
              {similar.map((exp) => (
                <Pressable
                  key={exp.id}
                  style={styles.similarCard}
                  onPress={() =>
                    router.push({ pathname: "/experience/[id]", params: { id: exp.id } })
                  }
                >
                  <View style={styles.similarImageWrapper}>
                    {exp.heroImageUrl ? (
                      <Image source={{ uri: exp.heroImageUrl }} style={styles.similarImage} />
                    ) : (
                      <View
                        style={[styles.similarImage, { backgroundColor: CATEGORY_BG[exp.category] ?? C.surface }]}
                      />
                    )}
                  </View>
                  <View style={styles.similarMeta}>
                    <Text style={styles.similarCat} numberOfLines={1}>{exp.category}</Text>
                    <Text style={styles.similarTitle} numberOfLines={2}>{exp.title}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      <CollectionPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onDone={handleDone}
        initiallySelected={Array.from(savedItems.keys())}
      />
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.background,
    },
    errorText: {
      color: C.textTertiary,
      fontSize: 16,
    },

    hero: {
      width: "100%",
      overflow: "hidden",
    },
    heroImage: {
      width: SCREEN_WIDTH,
      height: HERO_HEIGHT,
      resizeMode: "cover",
    },
    backBtn: {
      position: "absolute",
      top: 56,
      left: 18,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    backBtnText: {
      color: "#fff",
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 28,
      marginTop: -2,
    },
    heroMeta: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 4,
    },
    heroCat: {
      fontSize: 12,
      fontWeight: "800",
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6,
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: "900",
      color: C.text,
      lineHeight: 38,
    },

    // Action bar
    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.divider,
      gap: 14,
    },
    statsBlock: {
      alignItems: "center",
    },
    statNum: {
      fontSize: 18,
      fontWeight: "900",
      color: C.text,
    },
    statLbl: {
      fontSize: 11,
      color: C.textTertiary,
      fontWeight: "600",
      marginTop: 1,
    },
    statsDivider: {
      width: 1,
      height: 28,
      backgroundColor: C.border,
    },
    addBtn: {
      flex: 1,
      marginLeft: 4,
      backgroundColor: C.buttonPrimary,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
    },
    addBtnDone: {
      backgroundColor: C.surface,
    },
    addBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 15,
    },
    addBtnTextDone: {
      color: C.textSecondary,
    },

    // Completions grid
    gridSection: {
      marginTop: 24,
    },
    gridHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: C.text,
    },
    gridCount: {
      fontSize: 14,
      fontWeight: "600",
      color: C.textTertiary,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    emptyPosts: {
      paddingHorizontal: 20,
      paddingTop: 40,
      paddingBottom: 8,
      alignItems: "center",
    },
    emptyPostsText: {
      color: C.textTertiary,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },

    // Similar
    section: {
      marginTop: 32,
    },
    similarScroll: {
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 10,
    },
    similarCard: {
      width: 140,
    },
    similarImageWrapper: {
      width: 140,
      aspectRatio: 3 / 4,
      borderRadius: 14,
      overflow: "hidden",
    },
    similarImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    similarMeta: {
      paddingTop: 7,
      paddingHorizontal: 2,
    },
    similarCat: {
      fontSize: 10,
      fontWeight: "700",
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    similarTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: C.text,
      lineHeight: 17,
    },

    bottomPad: {
      height: 48,
    },
  });
}
