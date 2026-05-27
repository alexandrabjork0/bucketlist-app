import { router, useLocalSearchParams } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import PostCard from "../../components/PostCard";

type CompletedItem = {
  id: string;
  userId: string;
  title: string;
  category: string;
  imageUrl: string | null;
  caption?: string;
  completedAt?: any;
  media?: Array<{ url: string; type: "image" | "video" }>;
  author: {
    userId: string;
    username?: string;
    profileImage?: string | null;
  };
};

export default function ExploreItemScreen() {
  const { id } = useLocalSearchParams();
  const [ideaTitle, setIdeaTitle] = useState("");
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCompletedPosts();
    }
  }, [id]);

  const fetchCompletedPosts = async () => {
    try {
      const ideaRef = doc(db, "exploreIdeas", String(id));
      const ideaSnap = await getDoc(ideaRef);

      if (!ideaSnap.exists()) {
        setLoading(false);
        return;
      }

      const title = ideaSnap.data().title;
      setIdeaTitle(title);

      const q = query(
        collection(db, "userBucketlistItems"),
        where("title", "==", title),
        where("completed", "==", true)
      );

      const snapshot = await getDocs(q);

      const posts = snapshot.docs
        .map((docItem) => ({
          id: docItem.id,
          userId: docItem.data().userId,
          title: docItem.data().title,
          category: docItem.data().category,
          imageUrl: docItem.data().imageUrl ?? null,
          caption: docItem.data().caption ?? "",
          completedAt: docItem.data().completedAt ?? null,
          media: docItem.data().media ?? [],
        }))
        .filter((item) => item.imageUrl);

      const withAuthors = await Promise.all(
        posts.map(async (item) => {
          const authorSnap = await getDoc(doc(db, "users", item.userId));
          return {
            ...item,
            author: authorSnap.exists()
              ? { userId: item.userId, ...authorSnap.data() }
              : { userId: item.userId },
          };
        })
      );

      setCompletedItems(withAuthors);
    } catch (error) {
      console.log("Error fetching completed posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveToBucketlist = async (item: CompletedItem) => {
    if (!auth.currentUser) return;

    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
      title: item.title,
      category: item.category,
      completed: false,
      imageUrl: null,
      caption: "",
      media: [],
      createdAt: serverTimestamp(),
      completedAt: null,
      fromPost: true,
      inspiredByPostId: item.id,
      inspiredByUserId: item.userId,
    });

    setSavedIds((prev) => [...prev, item.id]);
    Alert.alert("Added", `${item.title} was added to your bucketlist.`);

    createNotification({
      recipientId: item.userId,
      type: "save",
      actorId: auth.currentUser.uid,
      postId: item.id,
    }).catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>

      <Text style={styles.title}>{ideaTitle}</Text>
      <Text style={styles.subtitle}>
        See everyone who has completed this bucketlist idea.
      </Text>

      {completedItems.length === 0 ? (
        <Text style={styles.emptyText}>
          No one has completed this yet. Be the first.
        </Text>
      ) : (
        completedItems.map((item) => {
          const isOwnPost = item.userId === auth.currentUser?.uid;
          const isSaved = savedIds.includes(item.id);

          return (
            <PostCard
              key={item.id}
              post={item}
              author={item.author}
              onSave={!isOwnPost && !isSaved ? () => saveToBucketlist(item) : undefined}
              saveDone={!isOwnPost && isSaved}
            />
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 80,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 18,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    paddingHorizontal: 24,
  },
  subtitle: {
    marginTop: 8,
    color: "#777",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 30,
    color: "#777",
    textAlign: "center",
    fontWeight: "600",
    paddingHorizontal: 24,
  },
});
