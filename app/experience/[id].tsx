import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CollectionPickerSheet from "../../components/CollectionPickerSheet";
import { auth, db } from "../../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../../lib/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_WIDTH * 1.05;
const GRID_GAP = 2;
const TILE_SIZE = Math.floor((SCREEN_WIDTH - GRID_GAP * 2) / 3);

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
  const [isAdded, setIsAdded] = useState(false);
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

      if (alreadySnap && !alreadySnap.empty) setIsAdded(true);

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
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePickerSelect = async (collectionId: string, collectionName: string) => {
    setPickerVisible(false);
    if (!auth.currentUser || !experience) return;
    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
      collectionId,
      title: experience.title,
      category: experience.category,
      completed: false,
      imageUrl: null,
      caption: "",
      media: [],
      createdAt: serverTimestamp(),
      completedAt: null,
      fromExplore: true,
      experienceId: String(id),
    });
    await Promise.all([
      updateDoc(doc(db, "experiences", String(id)), { savesCount: increment(1) }).catch(() => {}),
      updateDoc(doc(db, "collections", collectionId), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch(() => {}),
    ]);
    setIsAdded(true);
    Alert.alert("Saved", `Added to "${collectionName}"`);
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
        <View style={[styles.hero, { height: HERO_HEIGHT }]}>
          {experience.heroImageUrl ? (
            <Image source={{ uri: experience.heroImageUrl }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: heroBg }]} />
          )}
          <View style={styles.heroGradient} />

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>

          <View style={styles.heroContent}>
            <Text style={styles.heroCat}>{experience.category}</Text>
            <Text style={styles.heroTitle} numberOfLines={3}>
              {experience.title}
            </Text>
          </View>
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
            style={[styles.addBtn, isAdded && styles.addBtnDone]}
            onPress={isAdded ? undefined : () => setPickerVisible(true)}
          >
            <Text style={[styles.addBtnText, isAdded && styles.addBtnTextDone]}>
              {isAdded ? "Saved ✓" : "+ Save to list"}
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
              {posts.map((post) => {
                const imageUrl = post.imageUrl || post.media?.[0]?.url;
                return (
                  <Pressable
                    key={post.id}
                    style={styles.gridTile}
                    onPress={() =>
                      router.push({ pathname: "/post/[id]", params: { id: post.id } })
                    }
                  >
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.gridTileImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.gridTileImage, { backgroundColor: C.surfaceElevated }]} />
                    )}
                  </Pressable>
                );
              })}
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
                  {exp.heroImageUrl ? (
                    <Image source={{ uri: exp.heroImageUrl }} style={styles.similarImage} />
                  ) : (
                    <View
                      style={[styles.similarImage, { backgroundColor: CATEGORY_BG[exp.category] ?? "#333" }]}
                    />
                  )}
                  <View style={styles.similarOverlay} />
                  <View style={styles.similarContent}>
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
        onSelect={handlePickerSelect}
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

    // Hero — always dark regardless of theme
    hero: {
      width: "100%",
      backgroundColor: "#1A1A1A",
      overflow: "hidden",
    },
    heroImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    heroGradient: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 280,
      backgroundColor: "rgba(0,0,0,0.65)",
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
    heroContent: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      paddingBottom: 24,
    },
    heroCat: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6,
    },
    heroTitle: {
      color: "#fff",
      fontSize: 32,
      fontWeight: "900",
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
      gap: GRID_GAP,
    },
    gridTile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
    },
    gridTileImage: {
      width: TILE_SIZE,
      height: TILE_SIZE,
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
      height: 190,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: "#1A1A1A",
    },
    similarImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    similarOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 90,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    similarContent: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 10,
    },
    similarTitle: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 17,
    },

    bottomPad: {
      height: 48,
    },
  });
}
