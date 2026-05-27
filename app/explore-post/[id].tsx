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
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import PostCard from "../../components/PostCard";

export default function ExplorePostScreen() {
  const { id } = useLocalSearchParams();

  const [post, setPost] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPost = async () => {
      if (!id) return;

      const postSnap = await getDoc(doc(db, "userBucketlistItems", String(id)));

      if (!postSnap.exists()) {
        setLoading(false);
        return;
      }

      const postData = { id: postSnap.id, ...postSnap.data() };
      setPost(postData);

      const [authorSnap, alreadySnap] = await Promise.all([
        getDoc(doc(db, "users", (postData as any).userId)),
        auth.currentUser && (postData as any).title
          ? getDocs(
              query(
                collection(db, "userBucketlistItems"),
                where("userId", "==", auth.currentUser.uid),
                where("title", "==", (postData as any).title),
                where("completed", "==", false)
              )
            )
          : Promise.resolve(null),
      ]);

      setAuthor(
        authorSnap.exists()
          ? { userId: (postData as any).userId, ...authorSnap.data() }
          : { userId: (postData as any).userId }
      );

      if (alreadySnap && !alreadySnap.empty) setIsSaved(true);
      setLoading(false);
    };

    loadPost();
  }, [id]);

  const saveToBucketlist = async () => {
    if (!auth.currentUser || !post) return;

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
      experienceId: post.experienceId || null,
    });

    if (post.experienceId) {
      updateDoc(doc(db, "experiences", post.experienceId), {
        savesCount: increment(1),
      }).catch(() => {});
    }

    setIsSaved(true);
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

  if (!post || !author) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Post not found.</Text>
      </View>
    );
  }

  const isOwnPost = post.userId === auth.currentUser?.uid;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.topTitle}>Post</Text>

        <View style={{ width: 45 }} />
      </View>

      <ScrollView style={styles.feed}>
        <PostCard
          post={post}
          author={author}
          onSave={!isOwnPost && !isSaved ? saveToBucketlist : undefined}
          saveDone={!isOwnPost && isSaved}
        />
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
  errorText: {
    color: "#777",
    fontSize: 16,
  },
});
