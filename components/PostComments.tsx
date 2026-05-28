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

interface Props {
  postId: string;
  authorId: string;
  expanded: boolean;
  onClose: () => void;
}

export default function PostComments({ postId, authorId, expanded, onClose }: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "userBucketlistItems", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [postId]);

  const addComment = async () => {
    if (!text.trim() || !auth.currentUser) return;

    const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : null;

    await addDoc(collection(db, "userBucketlistItems", postId, "comments"), {
      text: text.trim(),
      userId: auth.currentUser.uid,
      username: userData?.username || auth.currentUser.displayName || "user",
      createdAt: serverTimestamp(),
    });

    const postRef = doc(db, "userBucketlistItems", postId);
    await runTransaction(db, async (tx) => {
      tx.update(postRef, { commentsCount: increment(1) });
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
      {previewComments.map((c) => (
        <Text key={c.id} style={styles.comment}>
          <Text style={styles.username}>{c.username || "user"} </Text>
          {c.text}
        </Text>
      ))}

      <Modal
        visible={expanded}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.commentsList} keyboardShouldPersistTaps="handled">
              {comments.length === 0 && (
                <Text style={styles.emptyText}>No comments yet. Be the first.</Text>
              )}
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
                placeholder="Add a comment…"
                placeholderTextColor={C.inputPlaceholder}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={addComment}
              />
              <Pressable onPress={addComment} hitSlop={8}>
                <Text style={[styles.postBtn, !text.trim() && styles.postBtnDim]}>
                  Post
                </Text>
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
      marginTop: 6,
    },
    comment: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 3,
      color: C.text,
    },
    username: {
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
      paddingBottom: 32,
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
      fontSize: 17,
      fontWeight: "800",
      color: C.text,
    },
    closeText: {
      fontWeight: "700",
      color: C.textSecondary,
      fontSize: 15,
    },
    commentsList: {
      flex: 1,
      marginBottom: 12,
    },
    emptyText: {
      color: C.textTertiary,
      fontSize: 14,
      textAlign: "center",
      marginTop: 24,
      marginBottom: 8,
    },
    modalComment: {
      fontSize: 15,
      marginBottom: 14,
      lineHeight: 21,
      color: C.text,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingTop: 12,
    },
    input: {
      flex: 1,
      backgroundColor: C.inputBackground,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontSize: 15,
      color: C.text,
    },
    postBtn: {
      fontWeight: "700",
      fontSize: 15,
      color: C.text,
    },
    postBtnDim: {
      opacity: 0.35,
    },
  });
}
