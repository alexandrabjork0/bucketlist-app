import { Ionicons } from "@expo/vector-icons";
import {
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebaseConfig";
import { createNotification } from "../lib/notifications";
import { ThemeColors, useTheme } from "../lib/theme";

interface Props {
  postId: string;
  authorId: string;
  onCommentPress: () => void;
  onSave?: () => void;
  savedCount?: number;
}

export default function PostActions({
  postId,
  authorId,
  onCommentPress,
  onSave,
  savedCount = 0,
}: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const user = auth.currentUser;
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);

  useEffect(() => {
    if (!postId || !user) return;

    const postRef = doc(db, "userBucketlistItems", postId);
    const likeRef = doc(db, "userBucketlistItems", postId, "likes", user.uid);

    const unsubPost = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        setLikesCount(snap.data().likesCount || 0);
        setCommentsCount(snap.data().commentsCount || 0);
      }
    }, () => {});
    const unsubLike = onSnapshot(likeRef, (snap) => {
      setLiked(snap.exists());
    }, () => {});

    return () => {
      unsubPost();
      unsubLike();
    };
  }, [postId, user]);

  const toggleLike = async () => {
    if (!user) {
      Alert.alert("Login required", "You need to be logged in to like posts.");
      return;
    }

    const postRef = doc(db, "userBucketlistItems", postId);
    const likeRef = doc(db, "userBucketlistItems", postId, "likes", user.uid);
    const wasLiked = liked;

    await runTransaction(db, async (tx) => {
      const likeDoc = await tx.get(likeRef);
      if (likeDoc.exists()) {
        tx.delete(likeRef);
        tx.update(postRef, { likesCount: increment(-1) });
      } else {
        tx.set(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
        tx.update(postRef, { likesCount: increment(1) });
      }
    });

    if (!wasLiked) {
      createNotification({
        recipientId: authorId,
        type: "like",
        actorId: user.uid,
        postId,
      }).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        <View style={styles.iconCol}>
          <Pressable onPress={toggleLike} hitSlop={8}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={26}
              color={liked ? "#ff3040" : C.text}
            />
          </Pressable>
          {likesCount > 0 && (
            <Text style={styles.countText}>{likesCount}</Text>
          )}
        </View>

        <View style={styles.iconCol}>
          <Pressable onPress={onCommentPress} hitSlop={8}>
            <Ionicons name="chatbubble-outline" size={24} color={C.text} />
          </Pressable>
          {commentsCount > 0 && (
            <Text style={styles.countText}>{commentsCount}</Text>
          )}
        </View>

        {onSave && (
          <View style={styles.iconCol}>
            <Pressable onPress={onSave} hitSlop={8}>
              <Ionicons
                name={savedCount > 0 ? "bookmark" : "bookmark-outline"}
                size={24}
                color={C.text}
              />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: 10,
      marginBottom: 2,
    },
    iconRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 18,
    },
    iconCol: {
      alignItems: "center",
      gap: 3,
    },
    countText: {
      fontSize: 12,
      fontWeight: "700",
      color: C.text,
    },
  });
}
