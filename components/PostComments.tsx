import { Ionicons } from "@expo/vector-icons";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    increment,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { auth, db } from "../lib/firebaseConfig";
import { createNotification } from "../lib/notifications";
import { ThemeColors, useTheme } from "../lib/theme";
  
  export default function PostComments({ postId, authorId }: { postId: string; authorId: string }) {
    const C = useTheme();
    const styles = useMemo(() => makeStyles(C), [C]);

    const [comments, setComments] = useState<any[]>([]);
    const [text, setText] = useState("");
    const [expanded, setExpanded] = useState(false);
  
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

      const postRef = doc(db, "userBucketlistItems", postId);
      await runTransaction(db, async (transaction) => {
        transaction.update(postRef, { commentsCount: increment(1) });
      });

      setText("");

      createNotification({
        recipientId: authorId,
        type: "comment",
        actorId: auth.currentUser.uid,
        postId,
        previewText: text.trim(),
      }).catch(() => {});
    };
  
    const previewComments = comments.slice(-2);

    return (
      <View style={styles.container}>
        <Pressable onPress={() => setExpanded(true)} style={styles.bubbleRow}>
          <Ionicons name="chatbubble-outline" size={25} color={C.text} />
          <Text style={styles.countText}>
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </Text>
        </Pressable>

        {previewComments.map((c) => (
          <Text key={c.id} style={styles.comment}>
            <Text style={styles.username}>{c.username || "user"} </Text>
            {c.text}
          </Text>
        ))}

        <Pressable onPress={() => setExpanded(true)}>
          <Text style={styles.addCommentText}>Add a comment...</Text>
        </Pressable>

        <Modal
          visible={expanded}
          animationType="slide"
          transparent
          onRequestClose={() => setExpanded(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setExpanded(false)}>
            <Pressable style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comments</Text>
                <Pressable onPress={() => setExpanded(false)}>
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
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
      container: {
        marginTop: 8,
      },
      bubbleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      },
      countText: {
        fontSize: 14,
        fontWeight: "700",
        color: C.text,
      },
      comment: {
        fontSize: 14,
        marginBottom: 4,
        color: C.text,
      },
      username: {
        fontWeight: "700",
        color: C.text,
      },
      addCommentText: {
        fontSize: 14,
        color: C.textTertiary,
        marginTop: 6,
      },
      inputRow: {
        flexDirection: "row",
        marginTop: 8,
        alignItems: "center",
        gap: 8,
      },
      input: {
        flex: 1,
        backgroundColor: C.inputBackground,
        borderRadius: 16,
        padding: 8,
        color: C.text,
      },
      post: {
        marginLeft: 8,
        fontWeight: "700",
        color: C.text,
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: C.overlay,
        justifyContent: "flex-end",
      },
      modalContent: {
        backgroundColor: C.background,
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
        backgroundColor: C.handle,
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
        color: C.text,
      },
      closeText: {
        fontWeight: "700",
        color: C.textSecondary,
      },
      commentsList: {
        marginBottom: 12,
      },
      modalComment: {
        fontSize: 15,
        marginBottom: 12,
        lineHeight: 21,
        color: C.text,
      },
    });
  }