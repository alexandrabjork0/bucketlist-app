import { Ionicons } from "@expo/vector-icons";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    increment,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { auth, db } from "../app/(tabs)/firebaseConfig";

type Comment = {
  id: string;
  text: string;
  userId: string;
  username?: string;
};

export default function PostActions({ postId }: { postId: string }) {
  const user = auth.currentUser;

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!postId || !user) return;

    const postRef = doc(db, "userBucketlistItems", postId);
    const likeRef = doc(db, "userBucketlistItems", postId, "likes", user.uid);

    const unsubscribePost = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikesCount(data.likesCount || 0);
        setCommentsCount(data.commentsCount || 0);
      }
    });

    const unsubscribeLike = onSnapshot(likeRef, (snap) => {
      setLiked(snap.exists());
    });

    const commentsQuery = query(
      collection(db, "userBucketlistItems", postId, "comments"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];

      setComments(list);
    });

    return () => {
      unsubscribePost();
      unsubscribeLike();
      unsubscribeComments();
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
        transaction.update(postRef, {
          likesCount: increment(-1),
        });
      } else {
        transaction.set(likeRef, {
          userId: user.uid,
          createdAt: serverTimestamp(),
        });

        transaction.update(postRef, {
          likesCount: increment(1),
        });
      }
    });
  };

  const addComment = async () => {
    if (!user) {
      Alert.alert("Login required", "You need to be logged in to comment.");
      return;
    }

    const trimmed = commentText.trim();

    if (!trimmed) return;

    const postRef = doc(db, "userBucketlistItems", postId);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const userData = userSnap.exists() ? userSnap.data() : null;

    await addDoc(collection(db, "userBucketlistItems", postId, "comments"), {
      text: trimmed,
      userId: user.uid,
      username: userData?.username || user.displayName || "Someone",
      createdAt: serverTimestamp(),
    });

    await runTransaction(db, async (transaction) => {
      transaction.update(postRef, {
        commentsCount: increment(1),
      });
    });

    setCommentText("");
  };

  const deleteComment = async (commentId: string, commentUserId: string) => {
    if (!user || user.uid !== commentUserId) return;

    Alert.alert("Delete comment?", "This comment will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(
            doc(db, "userBucketlistItems", postId, "comments", commentId)
          );

          await runTransaction(db, async (transaction) => {
            const postRef = doc(db, "userBucketlistItems", postId);
            transaction.update(postRef, {
              commentsCount: increment(-1),
            });
          });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        <Pressable onPress={toggleLike} style={styles.iconButton}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={28}
            color={liked ? "#ff3040" : "#111"}
          />
        </Pressable>
  
        <Ionicons name="chatbubble-outline" size={25} color="#111" />
      </View>
  
      <Text style={styles.likesText}>
        {likesCount} {likesCount === 1 ? "like" : "likes"}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
  marginTop: 12,
},

iconRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 14,
  marginBottom: 6,
},

iconButton: {
  paddingVertical: 4,
},

likesText: {
  fontSize: 14,
  fontWeight: "700",
  color: "#111",
  marginBottom: 8,
},

commentsBox: {
  marginBottom: 10,
  gap: 5,
},

comment: {
  paddingVertical: 1,
},

commentText: {
  fontSize: 14,
  color: "#111",
  lineHeight: 19,
},

username: {
  fontWeight: "700",
},

viewMoreText: {
  fontSize: 14,
  color: "#888",
  marginTop: 2,
},

commentInputRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginTop: 4,
},

input: {
  flex: 1,
  backgroundColor: "#f2f2f2",
  borderRadius: 18,
  paddingHorizontal: 14,
  paddingVertical: 9,
  fontSize: 14,
},

postButton: {
  paddingHorizontal: 8,
  paddingVertical: 8,
},

postButtonText: {
  fontWeight: "700",
  color: "#111",
},
});