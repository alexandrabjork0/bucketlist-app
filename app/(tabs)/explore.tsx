import { router } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
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

type Experience = {
  id: string;
  title: string;
  category: string;
  heroImageUrl: string | null;
  savesCount: number;
  completionsCount: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  Travel: "#E8F4FD",
  Adventure: "#FEF3C7",
  "Food & Drink": "#FCE7F3",
  Health: "#D1FAE5",
  Creative: "#EDE9FE",
  Learning: "#FEF9C3",
  Sports: "#DBEAFE",
  Nature: "#DCFCE7",
  Culture: "#FEE2E2",
  Events: "#FFF7ED",
  "Personal Growth": "#F3E8FF",
  Other: "#F4F4F4",
};

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

export default function ExploreScreen() {
  const [search, setSearch] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchExperiences(), fetchPeople()]);
  };

  const fetchExperiences = async () => {
    const expSnap = await getDocs(query(collection(db, "experiences"), limit(1)));
    if (expSnap.empty) {
      await migrateIdeasToExperiences();
    }

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

  const fetchPeople = async () => {
    const snapshot = await getDocs(query(collection(db, "users"), limit(50)));
    setPeople(
      snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p: any) => p.isPrivate !== true)
        .filter((p: any) => p.id !== auth.currentUser?.uid)
    );
  };

  const addToBucketlist = async (exp: Experience) => {
    if (!auth.currentUser) {
      Alert.alert("Not logged in", "You need to log in first.");
      return;
    }

    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
      title: exp.title,
      category: exp.category,
      completed: false,
      imageUrl: null,
      caption: "",
      media: [],
      createdAt: serverTimestamp(),
      completedAt: null,
      fromExplore: true,
      experienceId: exp.id,
    });

    updateDoc(doc(db, "experiences", exp.id), {
      savesCount: increment(1),
    }).catch(() => {});

    Alert.alert("Added", `${exp.title} was added to your bucketlist.`);
  };

  const trending = experiences.slice(0, 6);

  const filtered = experiences.filter((exp) => {
    const matchCat = selectedCategory === "All" || exp.category === selectedCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      exp.title.toLowerCase().includes(q) ||
      exp.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const filteredPeople = people.filter((p: any) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.username?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q)
    );
  });

  const leftCol = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 !== 0);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Explore</Text>
          <Pressable onPress={() => router.push("/add-idea")}>
            <Text style={styles.plus}>＋</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search experiences, people..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {!search && trending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trending</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingScroll}
            >
              {trending.map((exp) => (
                <Pressable
                  key={exp.id}
                  style={styles.trendingCard}
                  onPress={() =>
                    router.push({ pathname: "/experience/[id]", params: { id: exp.id } })
                  }
                >
                  {exp.heroImageUrl ? (
                    <Image source={{ uri: exp.heroImageUrl }} style={styles.trendingImage} />
                  ) : (
                    <View
                      style={[
                        styles.trendingImage,
                        { backgroundColor: CATEGORY_COLORS[exp.category] ?? "#F4F4F4" },
                      ]}
                    />
                  )}
                  <View style={styles.trendingOverlay}>
                    <Text style={styles.trendingCat}>{exp.category}</Text>
                    <Text numberOfLines={2} style={styles.trendingTitle}>
                      {exp.title}
                    </Text>
                    {exp.savesCount > 0 && (
                      <Text style={styles.trendingCount}>{exp.savesCount} saved</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

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
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === cat && styles.chipTextActive,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {filtered.length > 0 ? (
          <View style={styles.masonry}>
            <View style={styles.masonryCol}>
              {leftCol.map((exp) => (
                <ExperienceTile key={exp.id} exp={exp} onAdd={addToBucketlist} />
              ))}
            </View>
            <View style={styles.masonryCol}>
              {rightCol.map((exp) => (
                <ExperienceTile key={exp.id} exp={exp} onAdd={addToBucketlist} />
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No experiences found.</Text>
        )}

        {filteredPeople.length > 0 && (
          <View style={[styles.section, styles.peopleSection]}>
            <Text style={styles.sectionLabel}>People to follow</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleScroll}
            >
              {filteredPeople.map((person: any) => (
                <Pressable
                  key={person.id}
                  style={styles.personCard}
                  onPress={() =>
                    person.id === auth.currentUser?.uid
                      ? router.push("/profile")
                      : router.push({ pathname: "/user/[id]", params: { id: person.id } })
                  }
                >
                  {person.profileImage ? (
                    <Image source={{ uri: person.profileImage }} style={styles.personAvatar} />
                  ) : (
                    <View style={styles.personAvatarFallback}>
                      <Text style={styles.personAvatarText}>
                        {person.username?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.personUsername} numberOfLines={1}>
                    @{person.username || "user"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

function ExperienceTile({
  exp,
  onAdd,
}: {
  exp: Experience;
  onAdd: (exp: Experience) => void;
}) {
  return (
    <Pressable
      style={styles.tile}
      onPress={() =>
        router.push({ pathname: "/experience/[id]", params: { id: exp.id } })
      }
    >
      {exp.heroImageUrl ? (
        <Image source={{ uri: exp.heroImageUrl }} style={styles.tileImage} />
      ) : (
        <View
          style={[
            styles.tileImage,
            { backgroundColor: CATEGORY_COLORS[exp.category] ?? "#F4F4F4" },
          ]}
        />
      )}

      <View style={styles.tileBody}>
        <Text style={styles.tileCat}>{exp.category}</Text>
        <Text style={styles.tileTitle} numberOfLines={3}>
          {exp.title}
        </Text>
        {exp.savesCount > 0 && (
          <Text style={styles.tileSaves}>{exp.savesCount} saved</Text>
        )}
        <Pressable
          style={styles.tileAddBtn}
          onPress={(e) => {
            e.stopPropagation();
            onAdd(exp);
          }}
        >
          <Text style={styles.tileAddText}>+ Add</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  top: {
    paddingTop: 70,
    paddingHorizontal: 18,
    paddingBottom: 4,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
  },
  plus: {
    fontSize: 32,
    fontWeight: "800",
  },
  searchInput: {
    marginTop: 14,
    backgroundColor: "#F4F4F4",
    padding: 14,
    borderRadius: 16,
    fontSize: 16,
  },

  section: {
    marginTop: 22,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  trendingScroll: {
    paddingHorizontal: 18,
    gap: 12,
  },
  trendingCard: {
    width: 150,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F4F4F4",
  },
  trendingImage: {
    width: 150,
    height: 120,
  },
  trendingOverlay: {
    padding: 10,
  },
  trendingCat: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#999",
  },
  trendingTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    marginTop: 3,
    lineHeight: 18,
  },
  trendingCount: {
    marginTop: 4,
    fontSize: 11,
    color: "#777",
    fontWeight: "600",
  },

  chipsScroll: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F4F4F4",
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: "#111",
  },
  chipText: {
    color: "#555",
    fontWeight: "700",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#fff",
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
  tile: {
    borderRadius: 16,
    backgroundColor: "#F4F4F4",
    overflow: "hidden",
  },
  tileImage: {
    width: "100%",
    aspectRatio: 1,
  },
  tileBody: {
    padding: 10,
  },
  tileCat: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#999",
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    marginTop: 3,
    lineHeight: 18,
  },
  tileSaves: {
    marginTop: 4,
    fontSize: 11,
    color: "#777",
    fontWeight: "600",
  },
  tileAddBtn: {
    marginTop: 8,
    backgroundColor: "#111",
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
  },
  tileAddText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  emptyText: {
    paddingHorizontal: 20,
    paddingTop: 30,
    color: "#777",
    textAlign: "center",
    fontWeight: "600",
  },

  peopleSection: {
    marginTop: 28,
  },
  peopleScroll: {
    paddingHorizontal: 18,
    gap: 12,
  },
  personCard: {
    alignItems: "center",
    width: 80,
  },
  personAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#eee",
  },
  personAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  personAvatarText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 20,
  },
  personUsername: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
  },

  bottomPad: {
    height: 40,
  },
});
