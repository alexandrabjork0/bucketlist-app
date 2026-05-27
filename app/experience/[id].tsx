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
import { useEffect, useState } from "react";
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
import PostCard from "../../components/PostCard";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_WIDTH * 1.15;

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
  const { id } = useLocalSearchParams();
  const [experience, setExperience] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [isAdded, setIsAdded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadExperience();
  }, [id]);

  const loadExperience = async () => {
    try {
      const expSnap = await getDoc(doc(db, "experiences", String(id)));
      if (!expSnap.exists()) {
        setLoading(false);
        return;
      }

      const expData = { id: expSnap.id, ...expSnap.data() };
      setExperience(expData);

      const [postsSnap, simSnap, alreadySnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "userBucketlistItems"),
            where("title", "==", (expData as any).title),
            where("completed", "==", true)
          )
        ),
        getDocs(
          query(
            collection(db, "experiences"),
            where("category", "==", (expData as any).category)
          )
        ),
        auth.currentUser
          ? getDocs(
              query(
                collection(db, "userBucketlistItems"),
                where("userId", "==", auth.currentUser.uid),
                where("experienceId", "==", String(id)),
                where("completed", "==", false)
              )
            )
          : Promise.resolve(null),
      ]);

      if (alreadySnap && !alreadySnap.empty) setIsAdded(true);

      const rawPosts = postsSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((p: any) => p.imageUrl);

      const withAuthors = await Promise.all(
        rawPosts.map(async (post: any) => {
          const authorSnap = await getDoc(doc(db, "users", post.userId));
          return {
            ...post,
            author: authorSnap.exists()
              ? { userId: post.userId, ...authorSnap.data() }
              : { userId: post.userId },
          };
        })
      );

      withAuthors.sort(
        (a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)
      );
      setPosts(withAuthors);

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

  const addToBucketlist = async () => {
    if (!auth.currentUser || !experience) return;

    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
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

    updateDoc(doc(db, "experiences", String(id)), {
      savesCount: increment(1),
    }).catch(() => {});

    setIsAdded(true);
    Alert.alert("Added", `${experience.title} was added to your bucketlist.`);
  };

  const savePost = async (post: any) => {
    if (!auth.currentUser) return;

    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
      title: post.title,
      category: post.category,
      completed: false,
      imageUrl: null,
      caption: "",
      media: [],
      createdAt: serverTimestamp(),
      completedAt: null,
      fromPost: true,
      inspiredByPostId: post.id,
      inspiredByUserId: post.userId,
      experienceId: String(id),
    });

    updateDoc(doc(db, "experiences", String(id)), {
      savesCount: increment(1),
    }).catch(() => {});

    setSavedPostIds((prev) => [...prev, post.id]);
    Alert.alert("Added", `${post.title} was added to your bucketlist.`);

    createNotification({
      recipientId: post.userId,
      type: "save",
      actorId: auth.currentUser.uid,
      postId: post.id,
    }).catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
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
            <Image
              source={{ uri: experience.heroImageUrl }}
              style={styles.heroImage}
            />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: heroBg }]} />
          )}

          {/* Bottom gradient overlay */}
          <View style={styles.heroGradient} />

          {/* Floating back button */}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>

          {/* Title overlaid on hero */}
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
            onPress={isAdded ? undefined : addToBucketlist}
          >
            <Text style={[styles.addBtnText, isAdded && styles.addBtnTextDone]}>
              {isAdded ? "Added ✓" : "+ Add to my list"}
            </Text>
          </Pressable>
        </View>

        {/* ── Posts feed ── */}
        {posts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>People who completed this</Text>
            {posts.map((post) => {
              const isOwnPost = post.userId === auth.currentUser?.uid;
              const isSaved = savedPostIds.includes(post.id);
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  author={post.author}
                  onSave={!isOwnPost && !isSaved ? () => savePost(post) : undefined}
                  saveDone={!isOwnPost && isSaved}
                />
              );
            })}
          </View>
        )}

        {posts.length === 0 && (
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyPostsText}>
              No one has completed this yet.{"\n"}Be the first.
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
                      style={[
                        styles.similarImage,
                        { backgroundColor: CATEGORY_BG[exp.category] ?? "#333" },
                      ]}
                    />
                  )}
                  <View style={styles.similarOverlay} />
                  <View style={styles.similarContent}>
                    <Text style={styles.similarTitle} numberOfLines={2}>
                      {exp.title}
                    </Text>
                  </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#777",
    fontSize: 16,
  },

  // Hero
  hero: {
    width: "100%",
    backgroundColor: "#222",
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
    height: 260,
    backgroundColor: "rgba(0,0,0,0.6)",
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
    color: "rgba(255,255,255,0.75)",
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
    borderBottomColor: "#f0f0f0",
    gap: 14,
  },
  statsBlock: {
    alignItems: "center",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
  },
  statLbl: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
    marginTop: 1,
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#eee",
  },
  addBtn: {
    flex: 1,
    marginLeft: 4,
    backgroundColor: "#111",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  addBtnDone: {
    backgroundColor: "#F0F0F0",
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  addBtnTextDone: {
    color: "#777",
  },

  // Feed
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  emptyPosts: {
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: "center",
  },
  emptyPostsText: {
    color: "#999",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  // Similar
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
    backgroundColor: "#222",
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
