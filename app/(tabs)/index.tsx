import { router } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
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
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MediaCarousel from "../../components/MediaCarousel";
import { auth, db } from "./firebaseConfig";

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);

      if (!u) {
        router.replace("/login");
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadPosts = async () => {
      if (!user) return;

      const followsQuery = query(
        collection(db, "follows"),
        where("followerId", "==", user.uid)
      );

      const followsSnap = await getDocs(followsQuery);

      const followingIds = followsSnap.docs.map(
        (doc) => doc.data().followingId
      );

      const allowedUserIds = [user.uid, ...followingIds];

      const postsQuery = query(
        collection(db, "userBucketlistItems"),
        where("completed", "==", true)
      );

      const postsSnap = await getDocs(postsQuery);

      const rawPosts = postsSnap.docs
  .map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }))
  .filter((post: any) => post.imageUrl || post.media?.length > 0)
  .filter((post: any) => {
    if (!post.userId) return false;
    return allowedUserIds.includes(post.userId);
  });
      const postsWithUsers = await Promise.all(
        rawPosts.map(async (post: any) => {
          const userRef = doc(db, "users", post.userId);
          const userSnap = await getDoc(userRef);

          return {
            ...post,
            user: userSnap.exists() ? userSnap.data() : null,
          };
        })
      );

      postsWithUsers.sort((a: any, b: any) => {
        const aTime = a.completedAt?.seconds || 0;
        const bTime = b.completedAt?.seconds || 0;
        return bTime - aTime;
      });

      setPosts(postsWithUsers);
    };

    loadPosts();
  }, [user]);

  const goToUserProfile = (userId: string) => {
    if (userId === auth.currentUser?.uid) {
      router.push("/profile");
    } else {
      router.push({
        pathname: "/user/[id]",
        params: { id: userId },
      });
    }
  };

  const formatDate = (post: any) => {
    if (!post.completedAt?.seconds) return "";

    const date = new Date(post.completedAt.seconds * 1000);

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!authChecked) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>HOME</Text>

      {posts.length === 0 ? (
        <Text style={styles.emptyText}>
          Follow people to see their completed bucketlist posts here.
        </Text>
      ) : (
        posts.map((post) => (
          <View key={post.id} style={styles.post}>
            <View style={styles.header}>
              <Pressable onPress={() => goToUserProfile(post.userId)}>
                {post.user?.profileImage ? (
                  <Image
                    source={{ uri: post.user.profileImage }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>
                      {post.user?.username?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable onPress={() => goToUserProfile(post.userId)}>
                <Text style={styles.username}>
                  {post.user?.username || "user"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.category}>{post.category}</Text>

            <MediaCarousel media={post.media} imageUrl={post.imageUrl} />

            <View style={styles.textBox}>
              <Text style={styles.postTitle}>{post.title}</Text>

              {post.caption ? (
                <Text style={styles.caption}>
                  <Text
                    style={styles.captionUsername}
                    onPress={() => goToUserProfile(post.userId)}
                  >
                    {post.user?.username || "user"}{" "}
                  </Text>
                  {post.caption}
                </Text>
              ) : null}

              <Text style={styles.date}>{formatDate(post)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    paddingTop: 80,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  emptyText: {
    paddingHorizontal: 20,
    paddingTop: 30,
    color: "#777",
    fontSize: 15,
    lineHeight: 22,
  },

  post: {
    marginBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
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

  image: {
    width: "100%",
    aspectRatio: 4 / 5,
    resizeMode: "cover",
    backgroundColor: "#F4F4F4",
  },

  textBox: {
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

  date: {
    marginTop: 10,
    color: "#999",
    fontSize: 12,
    textTransform: "uppercase",
  },
});