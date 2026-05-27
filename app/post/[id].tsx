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
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,

    View,
} from "react-native";
import { auth, db } from "../(tabs)/firebaseConfig";
import MediaCarousel from "../../components/MediaCarousel";
import PostActions from "../../components/PostActions";
import PostComments from "../../components/PostComments";

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

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

  const formatDate = (post: any) => {
    if (!post.completedAt?.seconds) return "";

    const date = new Date(post.completedAt.seconds * 1000);

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

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
          <View key={post.id} style={styles.post}>
            <View style={styles.postHeader}>
              {profile?.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>
                    {profile?.username?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}

              <View style={styles.headerTextBox}>
                <Text style={styles.username}>
                  @{profile?.username || "user"}
                </Text>
              </View>

              <Pressable onPress={() => deletePost(post.id)} style={styles.menuButton}>
                <Text style={styles.menuText}>⋯</Text>
              </Pressable>
            </View>

            <Text style={styles.category}>{post.category}</Text>

            <MediaCarousel media={post.media} imageUrl={post.imageUrl} />

            <View style={styles.captionBox}>
  <Text style={styles.postTitle}>{post.title}</Text>

  <PostActions
  postId={post.id}
  onCommentPress={() =>
    setExpandedComments((prev) => ({
      ...prev,
      [post.id]: true,
    }))
  }
/>

  {post.caption ? (
    <Text style={styles.caption}>
      <Text style={styles.captionUsername}>
        {profile?.username || "user"}{" "}
      </Text>
      {post.caption}
    </Text>
  ) : null}

  <PostComments
    postId={post.id}
    expanded={!!expandedComments[post.id]}
    onToggle={() =>
      setExpandedComments((prev) => ({
        ...prev,
        [post.id]: !prev[post.id],
      }))
    }
  />

  <Text style={styles.dateText}>
    Completed {formatDate(post)}
  </Text>
</View>

          </View>
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

  post: {
    marginBottom: 32,
  },

  postHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  headerTextBox: {
    flex: 1,
  },

  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  menuText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111",
    lineHeight: 26,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#fff",
    fontWeight: "800",
  },

  username: {
    fontWeight: "800",
    fontSize: 15,
  },

  category: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    color: "#777",
    fontSize: 14,
    fontWeight: "600",
  },

  captionBox: {
    padding: 14,
  },

  postTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#777",
    marginBottom: 8,
  },

  caption: {
    fontSize: 15,
    lineHeight: 21,
  },

  captionUsername: {
    fontWeight: "800",
  },

  dateText: {
    marginTop: 10,
    color: "#999",
    fontSize: 12,
    textTransform: "uppercase",
  },
});