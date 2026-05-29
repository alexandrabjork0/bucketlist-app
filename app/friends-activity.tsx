import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

const { width: SW } = Dimensions.get("window");
const IMG_W = SW - 36;
const IMG_H = IMG_W * (4 / 3);

export default function FriendsActivityScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const followsSnap = await getDocs(
      query(collection(db, "follows"), where("followerId", "==", uid))
    );
    const fIds = followsSnap.docs.map((d) => d.data().followingId as string);
    if (fIds.length === 0) { setLoading(false); return; }

    const postsSnap = await getDocs(
      query(
        collection(db, "userBucketlistItems"),
        where("userId", "in", fIds.slice(0, 30)),
        where("completed", "==", true),
        limit(40)
      )
    );

    const raw = postsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((p: any) => p.imageUrl || p.media?.length > 0)
      .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));

    const uniqueAuthorIds = [...new Set(raw.map((p: any) => p.userId as string))];
    const authorDocs = await Promise.all(
      uniqueAuthorIds.map((id) => getDoc(doc(db, "users", id)))
    );
    const authorMap = new Map(
      authorDocs.map((d) => [d.id, d.exists() ? d.data() : {}])
    );

    setPosts(raw.map((p: any) => ({ ...p, author: authorMap.get(p.userId) || {} })));
    setLoading(false);
  };

  const formatDate = (seconds?: number) => {
    if (!seconds) return "";
    const diff = Date.now() - seconds * 1000;
    if (diff < 86400000) return "Today";
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    const d = new Date(seconds * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Friends' activity</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {posts.map((post) => {
          const imageUrl = post.imageUrl || post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url;
          const author = post.author;
          return (
            <Pressable
              key={post.id}
              style={styles.card}
              onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })}
            >
              <View style={styles.imageWrapper}>
                <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
              </View>
              <View style={styles.meta}>
                <View style={styles.authorRow}>
                  {author?.profileImage ? (
                    <Image source={{ uri: author.profileImage }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: C.avatarBg }]}>
                      <Text style={styles.avatarInitial}>
                        {author?.username?.[0]?.toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.username, { color: C.textSecondary }]} numberOfLines={1}>
                    @{author?.username || "user"}
                  </Text>
                  <Text style={[styles.date, { color: C.textTertiary }]}>
                    {formatDate(post.completedAt?.seconds)}
                  </Text>
                </View>
                <Text style={[styles.postTitle, { color: C.text }]} numberOfLines={2}>
                  {post.title}
                </Text>
                {post.category ? (
                  <Text style={[styles.category, { color: C.textTertiary }]}>{post.category}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}

        {!loading && posts.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: C.textTertiary }]}>
              No activity yet. Follow people to see their experiences here.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingTop: 60,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backBtn: { width: 60 },
    back: { fontSize: 16, fontWeight: "700", color: C.text },
    title: { fontSize: 18, fontWeight: "900", color: C.text },
    spacer: { width: 60 },
    list: { paddingHorizontal: 18, paddingTop: 24, gap: 32 },
    card: {},
    imageWrapper: {
      width: IMG_W,
      height: IMG_H,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: C.surface,
    },
    image: { width: "100%", height: "100%" },
    meta: { marginTop: 10, gap: 4 },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    avatar: { width: 20, height: 20, borderRadius: 10 },
    avatarFallback: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: { fontSize: 9, fontWeight: "800", color: "#fff" },
    username: { fontSize: 13, fontWeight: "700", flex: 1 },
    date: { fontSize: 12 },
    postTitle: { fontSize: 16, fontWeight: "800", lineHeight: 21 },
    category: { fontSize: 13, fontWeight: "500" },
    empty: { marginTop: 80, alignItems: "center" },
    emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  });
}
