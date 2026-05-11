import { router, useLocalSearchParams } from "expo-router";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { db } from "../(tabs)/firebaseConfig";

type CompletedItem = {
  id: string;
  userId: string;
  title: string;
  category: string;
  imageUrl: string | null;
  caption?: string;
  completedAt?: any;
};

export default function ExploreItemScreen() {
  const { id } = useLocalSearchParams();
  const [ideaTitle, setIdeaTitle] = useState("");
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
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

      const ideaData = ideaSnap.data();
      const title = ideaData.title;

      setIdeaTitle(title);

      const q = query(
        collection(db, "userBucketlistItems"),
        where("title", "==", title),
        where("completed", "==", true)
      );

      const snapshot = await getDocs(q);

      const posts = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          userId: doc.data().userId,
          title: doc.data().title,
          category: doc.data().category,
          imageUrl: doc.data().imageUrl ?? null,
          caption: doc.data().caption ?? "",
          completedAt: doc.data().completedAt ?? null,
        }))
        .filter((item) => item.imageUrl);

      setCompletedItems(posts);
    } catch (error) {
      console.log("Error fetching completed posts:", error);
    } finally {
      setLoading(false);
    }
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
        completedItems.map((item) => (
          <Pressable
            key={item.id}
            style={styles.postCard}
            onPress={() => router.push(`/post/${item.id}`)}
          >
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
            )}

            <View style={styles.postInfo}>
              <Text style={styles.postTitle}>{item.title}</Text>

              {item.caption ? (
                <Text style={styles.caption}>{item.caption}</Text>
              ) : null}

              <Pressable onPress={() => router.push(`/user/${item.userId}`)}>
                <Text style={styles.userLink}>View profile</Text>
              </Pressable>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
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
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    color: "#777",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 30,
    color: "#777",
    textAlign: "center",
    fontWeight: "600",
  },
  postCard: {
    marginTop: 18,
    backgroundColor: "#F4F4F4",
    borderRadius: 22,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 280,
    backgroundColor: "#ddd",
  },
  postInfo: {
    padding: 16,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  caption: {
    marginTop: 8,
    fontSize: 15,
    color: "#555",
    lineHeight: 21,
  },
  userLink: {
    marginTop: 12,
    fontWeight: "800",
    color: "#111",
  },
});