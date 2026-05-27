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
          .slice(0, 5)
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

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backWrapper} onPress={() => router.back()}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>

      {experience.heroImageUrl ? (
        <Image source={{ uri: experience.heroImageUrl }} style={styles.hero} />
      ) : (
        <View style={styles.heroPlaceholder} />
      )}

      <View style={styles.header}>
        <Text style={styles.category}>{experience.category}</Text>
        <Text style={styles.title}>{experience.title}</Text>

        <View style={styles.stats}>
          <Text style={styles.stat}>{experience.savesCount || 0} saved</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.stat}>{experience.completionsCount || 0} completed</Text>
        </View>

        <Pressable
          style={[styles.addButton, isAdded && styles.addButtonDone]}
          onPress={isAdded ? undefined : addToBucketlist}
        >
          <Text style={[styles.addButtonText, isAdded && styles.addButtonTextDone]}>
            {isAdded ? "Added to your list ✓" : "Add to my bucketlist"}
          </Text>
        </Pressable>
      </View>

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

      {similar.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Similar experiences</Text>
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
                <View style={styles.similarImagePlaceholder} />
              )}
              <View style={styles.similarText}>
                <Text style={styles.similarCategory}>{exp.category}</Text>
                <Text style={styles.similarTitle} numberOfLines={2}>
                  {exp.title}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
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
  backWrapper: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },
  hero: {
    width: "100%",
    height: 280,
    backgroundColor: "#eee",
  },
  heroPlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: "#F4F4F4",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  category: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#777",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6,
    lineHeight: 34,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 6,
  },
  stat: {
    fontSize: 14,
    color: "#777",
    fontWeight: "600",
  },
  statDot: {
    color: "#ccc",
    fontSize: 14,
  },
  addButton: {
    marginTop: 18,
    backgroundColor: "#111",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
  },
  addButtonDone: {
    backgroundColor: "#F4F4F4",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  addButtonTextDone: {
    color: "#111",
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  similarCard: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F4F4",
    borderRadius: 16,
    overflow: "hidden",
  },
  similarImage: {
    width: 70,
    height: 70,
    backgroundColor: "#ddd",
  },
  similarImagePlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: "#e0e0e0",
  },
  similarText: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  similarCategory: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#999",
  },
  similarTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 3,
    color: "#111",
  },
  bottomPad: {
    height: 40,
  },
});
