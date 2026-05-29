import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CollectionPickerSheet from "../../components/CollectionPickerSheet";
import { CollectionRef, saveToCollections } from "../../lib/collections";
import PostCard from "../../components/PostCard";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import { ThemeColors, useTheme } from "../../lib/theme";

export default function PostFeedScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { id, mode, filterId } = useLocalSearchParams<{
    id: string;
    mode: string;
    filterId: string;
  }>();

  const scrollViewRef = useRef<ScrollView>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // postId → Map<collectionId, docId> — tracks saved state per post for this session
  const [savedItemMaps, setSavedItemMaps] = useState<Map<string, Map<string, string>>>(new Map());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingPost, setPendingPost] = useState<any | null>(null);
  const [pickerInitial, setPickerInitial] = useState<string[]>([]);

  useEffect(() => {
    if (filterId) load();
  }, [filterId]);

  const load = async () => {
    try {
      const q =
        mode === "experience"
          ? query(
              collection(db, "userBucketlistItems"),
              where("experienceId", "==", filterId),
              where("completed", "==", true)
            )
          : query(
              collection(db, "userBucketlistItems"),
              where("collectionId", "==", filterId),
              where("completed", "==", true)
            );

      const snap = await getDocs(q);
      const raw = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((p) => p.imageUrl || p.media?.length > 0)
        .sort(
          (a, b) =>
            (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)
        );

      const withAuthors = await Promise.all(
        raw.map(async (post) => {
          const uSnap = await getDoc(doc(db, "users", post.userId));
          return {
            ...post,
            author: uSnap.exists()
              ? { userId: post.userId, ...uSnap.data() }
              : { userId: post.userId },
          };
        })
      );

      setPosts(withAuthors);

      setTimeout(() => {
        const idx = withAuthors.findIndex((p) => p.id === id);
        if (idx > 0) {
          scrollViewRef.current?.scrollTo({ y: idx * 680, animated: false });
        }
      }, 300);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (post: any) => {
    setPendingPost(post);
    const existing = savedItemMaps.get(post.id);
    setPickerInitial(existing ? Array.from(existing.keys()) : []);
    setPickerVisible(true);
  };

  const handleDone = async (toAdd: CollectionRef[], toRemove: string[]) => {
    setPickerVisible(false);
    const post = pendingPost;
    setPendingPost(null);
    if (!auth.currentUser || !post) return;

    const existingMap = savedItemMaps.get(post.id) ?? new Map<string, string>();
    const isFirstSave = existingMap.size === 0 && toAdd.length > 0;

    const newMap = await saveToCollections(
      {
        title: post.title,
        category: post.category,
        source: "post",
        experienceId: post.experienceId || null,
        inspiredByPostId: post.id,
        inspiredByUserId: post.userId,
      },
      toAdd,
      toRemove,
      existingMap
    );

    setSavedItemMaps((prev) => new Map([...prev, [post.id, newMap]]));

    if (isFirstSave) {
      createNotification({
        recipientId: post.userId,
        type: "save",
        actorId: auth.currentUser.uid,
        postId: post.id,
      }).catch(() => {});
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Posts</Text>
          <View style={{ width: 32 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.textSecondary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No posts yet.</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.feed}
            showsVerticalScrollIndicator={false}
          >
            {posts.map((post) => {
              const isOwn = post.userId === auth.currentUser?.uid;
              const postSavedMap = savedItemMaps.get(post.id);
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  author={post.author}
                  onSave={!isOwn ? () => handleSave(post) : undefined}
                  savedCount={!isOwn ? (postSavedMap?.size ?? 0) : 0}
                />
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      <CollectionPickerSheet
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setPendingPost(null);
        }}
        onDone={handleDone}
        initiallySelected={pickerInitial}
      />
    </>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
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
      borderBottomColor: C.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    backText: {
      fontSize: 28,
      fontWeight: "700",
      color: C.text,
      marginTop: -2,
    },
    topTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: C.text,
    },
    feed: {
      flex: 1,
    },
    emptyText: {
      color: C.textTertiary,
      fontSize: 15,
    },
  });
}
