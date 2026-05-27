import { router, useLocalSearchParams } from "expo-router";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth, db } from "../(tabs)/firebaseConfig";
import PostCard from "../../components/PostCard";

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadPosts = async () => {
      if (!auth.currentUser) return;

      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setProfile(userSnap.data());
      }

      const postsQuery = query(
        collection(db, "userBucketlistItems"),
        where("userId", "==", auth.currentUser.uid),
        where("completed", "==", true)
      );

      const postsSnap = await getDocs(postsQuery);

      const fetchedPosts = postsSnap.docs
        .map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
        .sort((a: any, b: any) => {
          const aTime = a.completedAt?.seconds || 0;
          const bTime = b.completedAt?.seconds || 0;
          return bTime - aTime;
        });

      setPosts(fetchedPosts);

      setTimeout(() => {
        const selectedIndex = fetchedPosts.findIndex((post) => post.id === id);

        if (selectedIndex !== -1) {
          scrollViewRef.current?.scrollTo({
            y: selectedIndex * 680,
            animated: false,
          });
        }
      }, 300);
    };

    loadPosts();
  }, [id]);

  const deletePost = async (postId: string) => {
    Alert.alert("Delete post?", "This will permanently delete this post.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "userBucketlistItems", postId));

          setPosts((prevPosts) =>
            prevPosts.filter((post) => post.id !== postId)
          );

          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.topTitle}>Posts</Text>

        <View style={{ width: 45 }} />
      </View>

      <ScrollView ref={scrollViewRef} style={styles.feed}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            author={{
              userId: auth.currentUser?.uid || "",
              username: profile?.username,
              profileImage: profile?.profileImage,
            }}
            onDelete={() => deletePost(post.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  topBar: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backText: {
    fontSize: 16,
    fontWeight: "700",
  },
  topTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  feed: {
    flex: 1,
  },
});
