import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PostCard from "../../components/PostCard";
import { auth, db } from "../../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../../lib/theme";

export default function FriendsFeedScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const scrollViewRef = useRef<ScrollView>(null);

  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const followsSnap = await getDocs(
        query(collection(db, "follows"), where("followerId", "==", uid))
      );
      const fIds = followsSnap.docs.map((d) => d.data().followingId as string);
      if (fIds.length === 0) return;

      const postsSnap = await getDocs(
        query(
          collection(db, "userBucketlistItems"),
          where("userId", "in", fIds.slice(0, 30)),
          where("completed", "==", true),
          limit(60)
        )
      );

      const raw = postsSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((p: any) => p.imageUrl || p.media?.length > 0)
        .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));

      const uniqueAuthorIds = [...new Set(raw.map((p: any) => p.userId as string))];
      const authorDocs = await Promise.all(
        uniqueAuthorIds.map((uid) => getDoc(doc(db, "users", uid)))
      );
      const authorMap = new Map(
        authorDocs.map((d) => [d.id, d.exists() ? d.data() : {}])
      );

      const withAuthors = raw.map((p: any) => ({
        ...p,
        author: authorMap.get(p.userId) || {},
      }));

      setPosts(withAuthors);

      setTimeout(() => {
        const selectedIndex = withAuthors.findIndex((p) => p.id === id);
        if (selectedIndex !== -1) {
          scrollViewRef.current?.scrollTo({
            y: selectedIndex * 680,
            animated: false,
          });
        }
      }, 300);
    };

    load();
  }, [id]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Friends' activity</Text>
        <View style={{ width: 45 }} />
      </View>

      <ScrollView ref={scrollViewRef} style={styles.feed}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            author={{
              userId: post.userId,
              username: post.author?.username,
              profileImage: post.author?.profileImage,
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
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
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },
    topTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: C.text,
    },
    feed: {
      flex: 1,
    },
  });
}
