import { router, useLocalSearchParams } from "expo-router";
import {
    addDoc,
    collection,
    getDocs,
    query,
    serverTimestamp
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

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);

  useEffect(() => {
    const loadPosts = async () => {
      const postsSnap = await getDocs(query(collection(db, "userBucketlistItems")));
      const usersSnap = await getDocs(query(collection(db, "users")));

      const usersById: any = {};

      usersSnap.docs.forEach((docItem) => {
        usersById[docItem.id] = {
          id: docItem.id,
          ...docItem.data(),
        };
      });

      const fetchedPosts = postsSnap.docs
        .map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
        .filter((post: any) => post.completed === true)
        .filter((post: any) => post.imageUrl)
        .filter((post: any) => post.userId)
        .map((post: any) => ({
          ...post,
          user: usersById[post.userId] || null,
        }))
        .filter((post: any) => post.user?.isPrivate !== true)
        .sort((a: any, b: any) => {
          const aTime = a.completedAt?.seconds || 0;
          const bTime = b.completedAt?.seconds || 0;
          return bTime - aTime;
        });

      setPosts(fetchedPosts);

      setTimeout(() => {
        const selectedIndex = fetchedPosts.findIndex((post: any) => post.id === id);

        if (selectedIndex !== -1) {
          scrollViewRef.current?.scrollTo({
            y: selectedIndex * 720,
            animated: false,
          });
        }
      }, 300);
    };

    loadPosts();
  }, [id]);

  const saveToBucketlist = async (post: any) => {
    if (!auth.currentUser) {
      Alert.alert("Not logged in", "You need to log in first.");
      return;
    }

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
    });

    setSavedPostIds((prev) => [...prev, post.id]);
    Alert.alert("Added", `${post.title} was added to your bucketlist.`);
  };

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
        {posts.map((post) => {
          const isOwnPost = post.userId === auth.currentUser?.uid;
          const isSaved = savedPostIds.includes(post.id);

          return (
            <View key={post.id} style={styles.post}>
              <Pressable
                style={styles.postHeader}
                onPress={() => goToUserProfile(post.userId)}
              >
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

                <Text style={styles.username}>
                  @{post.user?.username || "user"}
                </Text>
              </Pressable>

              <Text style={styles.category}>{post.category}</Text>

              <Image source={{ uri: post.imageUrl }} style={styles.postImage} />

              <View style={styles.captionBox}>
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

                <Text style={styles.dateText}>Completed {formatDate(post)}</Text>

                {!isOwnPost && (
                  <Pressable
                    style={[styles.saveButton, isSaved && styles.savedButton]}
                    onPress={() => saveToBucketlist(post)}
                    disabled={isSaved}
                  >
                    <Text
                      style={[
                        styles.saveButtonText,
                        isSaved && styles.savedButtonText,
                      ]}
                    >
                      {isSaved ? "Added to your list" : "Add this to my list"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
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
  
    postImage: {
      width: "100%",
      aspectRatio: 4 / 5,
      resizeMode: "cover",
      backgroundColor: "#F4F4F4",
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
  
    saveButton: {
      marginTop: 18,
      backgroundColor: "#111",
      paddingVertical: 13,
      borderRadius: 999,
      alignItems: "center",
    },
  
    savedButton: {
      backgroundColor: "#F4F4F4",
    },
  
    saveButtonText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 15,
    },
  
    savedButtonText: {
      color: "#111",
    },
  });