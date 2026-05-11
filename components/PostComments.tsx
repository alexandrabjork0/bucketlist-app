import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { auth, db } from "../app/(tabs)/firebaseConfig";
  
  export default function PostComments({
    postId,
    expanded,
    onExpand,
  }: {
    postId: string;
    expanded: boolean;
    onExpand: () => void;
  }) {
    const [comments, setComments] = useState<any[]>([]);
    const [text, setText] = useState("");
  
    useEffect(() => {
      const q = query(
        collection(db, "userBucketlistItems", postId, "comments"),
        orderBy("createdAt", "asc")
      );
  
      const unsub = onSnapshot(q, (snap) => {
        setComments(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      });
  
      return unsub;
    }, [postId]);
  
    const addComment = async () => {
      if (!text.trim()) return;
      if (!auth.currentUser) return;
  
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
  
      await addDoc(
        collection(db, "userBucketlistItems", postId, "comments"),
        {
          text: text.trim(),
          userId: auth.currentUser.uid,
          username: userData?.username || auth.currentUser.displayName || "user",
          createdAt: serverTimestamp(),
        }
      );
  
      setText("");
    };
  
    const visibleComments = expanded ? comments : comments.slice(0, 3);
  
    return (
      <View style={styles.container}>
        {visibleComments.map((c) => (
          <Text key={c.id} style={styles.comment}>
            <Text style={styles.username}>
              {c.username || "user"}{" "}
            </Text>
            {c.text}
          </Text>
        ))}
  
        {!expanded && comments.length > 3 ? (
          <Pressable onPress={onExpand}>
            <Text style={styles.viewMoreText}>
              View all {comments.length} comments
            </Text>
          </Pressable>
        ) : null}

{expanded && comments.length > 3 ? (
  <Pressable onPress={onExpand}>
    <Text style={styles.viewMoreText}>Show less</Text>
  </Pressable>
) : null}
  
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a comment..."
            style={styles.input}
          />
  
          <Pressable onPress={addComment}>
            <Text style={styles.post}>Post</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      marginTop: 8,
    },
    comment: {
      fontSize: 14,
      marginBottom: 4,
    },
    username: {
      fontWeight: "700",
    },
    viewMoreText: {
      fontSize: 14,
      color: "#888",
      marginTop: 4,
      marginBottom: 6,
    },
    inputRow: {
      flexDirection: "row",
      marginTop: 8,
    },
    input: {
      flex: 1,
      backgroundColor: "#f2f2f2",
      borderRadius: 16,
      padding: 8,
    },
    post: {
      marginLeft: 8,
      fontWeight: "700",
    },
  });