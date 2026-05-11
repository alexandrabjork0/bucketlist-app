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
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { auth, db } from "../app/(tabs)/firebaseConfig";
  
  export default function PostComments({
    postId,
    expanded,
    onToggle,
  }: {
    postId: string;
    expanded: boolean;
    onToggle: () => void;
  }) {
    const [comments, setComments] = useState<any[]>([]);
    const [text, setText] = useState("");
  
    useEffect(() => {
      const q = query(
        collection(db, "userBucketlistItems", postId, "comments"),
        orderBy("createdAt", "asc")
      );
  
      const unsub = onSnapshot(q, (snap) => {
        setComments(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });
  
      return unsub;
    }, [postId]);
  
    const addComment = async () => {
      if (!text.trim()) return;
      if (!auth.currentUser) return;
  
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
  
      await addDoc(collection(db, "userBucketlistItems", postId, "comments"), {
        text: text.trim(),
        userId: auth.currentUser.uid,
        username: userData?.username || auth.currentUser.displayName || "user",
        createdAt: serverTimestamp(),
      });
  
      setText("");
    };
  
    const previewComments = comments.slice(0, 3);
  
    return (
      <View style={styles.container}>
        {previewComments.map((c) => (
          <Text key={c.id} style={styles.comment}>
            <Text style={styles.username}>{c.username || "user"} </Text>
            {c.text}
          </Text>
        ))}
  
        {comments.length > 3 ? (
          <Pressable onPress={onToggle}>
            <Text style={styles.viewMoreText}>
              View all {comments.length} comments
            </Text>
          </Pressable>
        ) : null}
  
        <Modal
          visible={expanded}
          animationType="slide"
          transparent
          onRequestClose={onToggle}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
  
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comments</Text>
  
                <Pressable onPress={onToggle}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </View>
  
              <ScrollView style={styles.commentsList}>
                {comments.map((c) => (
                  <Text key={c.id} style={styles.modalComment}>
                    <Text style={styles.username}>{c.username || "user"} </Text>
                    {c.text}
                  </Text>
                ))}
              </ScrollView>
  
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
          </View>
        </Modal>
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
      marginTop: 6,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: "#fff",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingTop: 10,
      paddingHorizontal: 16,
      paddingBottom: 30,
      maxHeight: "75%",
    },
    modalHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: "#ccc",
      alignSelf: "center",
      marginBottom: 12,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
    },
    closeText: {
      fontWeight: "700",
      color: "#777",
    },
    commentsList: {
      marginBottom: 12,
    },
    modalComment: {
      fontSize: 15,
      marginBottom: 12,
      lineHeight: 21,
    },
  });