import { router } from "expo-router";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth, db } from "../../lib/firebaseConfig";
import { migrateIdeasToExperiences } from "../../lib/migration";
import { ThemeColors, useTheme } from "../../lib/theme";

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
  const [people, setPeople] = useState<any[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchExperiences();
    fetchPersonalized();
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) { setPeople([]); return; }
    searchTimer.current = setTimeout(() => searchUsers(search.trim()), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const searchUsers = async (q: string) => {
    const lower = q.toLowerCase();
    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("usernameLower", ">=", lower),
        where("usernameLower", "<=", lower + ""),
        orderBy("usernameLower"),
        limit(8)
      )
    );
    setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

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

        {/* ── 0. People results ── */}
        {search.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>People</Text>
            {people.length === 0 ? (
              <Text style={styles.noResults}>No users found.</Text>
            ) : (
              people.map((user) => (
                <Pressable
                  key={user.id}
                  style={styles.personRow}
                  onPress={() => router.push({ pathname: "/user/[id]", params: { id: user.id } })}
                >
                  {user.profileImage ? (
                    <Image source={{ uri: user.profileImage }} style={styles.personAvatar} />
                  ) : (
                    <View style={styles.personAvatarFallback}>
                      <Text style={styles.personAvatarInitial}>
                        {user.username?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.personInfo}>
                    <Text style={styles.personUsername}>@{user.username}</Text>
                    {user.bio ? (
                      <Text style={styles.personBio} numberOfLines={1}>{user.bio}</Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

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

    // People search results
    personRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 10,
      gap: 12,
    },
    personAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    personAvatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.surfaceElevated,
      justifyContent: "center",
      alignItems: "center",
    },
    personAvatarInitial: {
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },
    personInfo: {
      flex: 1,
    },
    personUsername: {
      fontSize: 15,
      fontWeight: "800",
      color: C.text,
    },
    personBio: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },
    noResults: {
      paddingHorizontal: 18,
      color: C.textSecondary,
      fontSize: 14,
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

  });
}
