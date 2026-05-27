import { Ionicons } from "@expo/vector-icons";
import {
    doc,
    increment,
    onSnapshot,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../app/(tabs)/firebaseConfig";

export default function PostActions({ postId }: { postId: string }) {
  const user = auth.currentUser;

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    if (!postId || !user) return;

    const postRef = doc(db, "userBucketlistItems", postId);
    const likeRef = doc(db, "userBucketlistItems", postId, "likes", user.uid);

    const unsubscribePost = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        setLikesCount(snap.data().likesCount || 0);
      }
    });

    const unsubscribeLike = onSnapshot(likeRef, (snap) => {
      setLiked(snap.exists());
    });

    return () => {
      unsubscribePost();
      unsubscribeLike();
    };
  }, [postId, user]);

  const toggleLike = async () => {
    if (!user) {
      Alert.alert("Login required", "You need to be logged in to like posts.");
      return;
    }

    const postRef = doc(db, "userBucketlistItems", postId);
    const likeRef = doc(db, "userBucketlistItems", postId, "likes", user.uid);

    await runTransaction(db, async (transaction) => {
      const likeDoc = await transaction.get(likeRef);
      if (likeDoc.exists()) {
        transaction.delete(likeRef);
        transaction.update(postRef, { likesCount: increment(-1) });
      } else {
        transaction.set(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
        transaction.update(postRef, { likesCount: increment(1) });
      }
    });
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={toggleLike} style={styles.iconButton}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={28}
          color={liked ? "#ff3040" : "#111"}
        />
      </Pressable>
      <Text style={styles.likesText}>
        {likesCount} {likesCount === 1 ? "like" : "likes"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 4,
  },
  iconButton: {
    paddingVertical: 4,
    marginBottom: 6,
  },
  likesText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
});
