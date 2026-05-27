import { router, useLocalSearchParams } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth, db } from "../(tabs)/firebaseConfig";
import PostThumbnail from "../../components/PostThumbnail";

export default function ProfileCategoryScreen() {
  const { category } = useLocalSearchParams();
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    loadCategoryPosts();
  }, [category]);

  const loadCategoryPosts = async () => {
    if (!auth.currentUser || !category) return;

    const q = query(
      collection(db, "userBucketlistItems"),
      where("userId", "==", auth.currentUser.uid),
      where("completed", "==", true),
      where("category", "==", String(category))
    );

    const snap = await getDocs(q);

    const fetchedPosts = snap.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => {
        const aTime = a.completedAt?.seconds || 0;
        const bTime = b.completedAt?.seconds || 0;
        return bTime - aTime;
      });

    setPosts(fetchedPosts);
  };

  return (
    <ScrollView style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>

      <Text style={styles.title}>{String(category)}</Text>
      <Text style={styles.subtitle}>Your completed posts in this category.</Text>

      {posts.length === 0 ? (
        <Text style={styles.emptyText}>No posts in this category yet.</Text>
      ) : (
        <View style={styles.grid}>
          {posts.map((item) => (
            <PostThumbnail
              key={item.id}
              post={item}
              onPress={() =>
                router.push({
                  pathname: "/post/[id]",
                  params: { id: item.id },
                })
              }
            />
          ))}
        </View>
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
    color: "#777",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -24,
  },
});