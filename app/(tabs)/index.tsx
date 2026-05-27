import { router } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import PostCard from "../../components/PostCard";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);

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
    if (!user) return;

    let unsubPosts: (() => void) | null = null;

    const init = async () => {
      const [followsSnap, userItemsSnap] = await Promise.all([
        getDocs(query(collection(db, "follows"), where("followerId", "==", user.uid))),
        getDocs(
          query(
            collection(db, "userBucketlistItems"),
            where("userId", "==", user.uid),
            where("completed", "==", false)
          )
        ),
      ]);

      const userTitles = new Set(userItemsSnap.docs.map((d) => d.data().title as string));

      const followingIds = followsSnap.docs.map((d) => d.data().followingId);
      const allowedUserIds = [user.uid, ...followingIds].slice(0, 30);

      unsubPosts = onSnapshot(
        query(
          collection(db, "userBucketlistItems"),
          where("completed", "==", true),
          where("userId", "in", allowedUserIds)
        ),
        async (snap) => {
          const rawPosts = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((p: any) => p.imageUrl || p.media?.length > 0);

          const postsWithAuthors = await Promise.all(
            rawPosts.map(async (post: any) => {
              const userSnap = await getDoc(doc(db, "users", post.userId));
              return {
                ...post,
                author: userSnap.exists()
                  ? { userId: post.userId, ...userSnap.data() }
                  : { userId: post.userId },
              };
            })
          );

          postsWithAuthors.sort((a: any, b: any) => {
            const aTime = a.completedAt?.seconds || 0;
            const bTime = b.completedAt?.seconds || 0;
            return bTime - aTime;
          });

          const alreadySavedIds = postsWithAuthors
            .filter((p: any) => userTitles.has(p.title))
            .map((p: any) => p.id);
          setSavedIds(alreadySavedIds);
          setPosts(postsWithAuthors);
        }
      );
    };

    init();

    return () => {
      if (unsubPosts) unsubPosts();
    };
  }, [user]);

  const saveToBucketlist = async (post: any) => {
    if (!auth.currentUser) return;

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

    setSavedIds((prev) => [...prev, post.id]);
    Alert.alert("Added", `${post.title} was added to your bucketlist.`);

    createNotification({
      recipientId: post.userId,
      type: "save",
      actorId: auth.currentUser.uid,
      postId: post.id,
    }).catch(() => {});
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
        posts.map((post) => {
          const isOwnPost = post.userId === user?.uid;
          const isSaved = savedIds.includes(post.id);

          return (
            <PostCard
              key={post.id}
              post={post}
              author={post.author}
              onSave={!isOwnPost && !isSaved ? () => saveToBucketlist(post) : undefined}
              saveDone={!isOwnPost && isSaved}
            />
          );
        })
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
});