import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

const SHEET_HEIGHT = Dimensions.get("window").height * 0.75;

function formatRelativeTime(timestamp: any): string {
  if (!timestamp?.seconds) return "";
  const seconds = Math.floor(Date.now() / 1000) - timestamp.seconds;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(weeks / 52)}y`;
}

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
  const [myProfileImage, setMyProfileImage] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string>("");

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, "users", auth.currentUser.uid)).then((snap) => {
      if (snap.exists()) {
        setMyProfileImage(snap.data().profileImage || null);
        setMyUsername(snap.data().username || auth.currentUser?.displayName || "");
      }
    });
  }, []);

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

    await addDoc(collection(db, "userBucketlistItems", postId, "comments"), {
      text: text.trim(),
      userId: auth.currentUser.uid,
      username: myUsername || auth.currentUser.displayName || "user",
      profileImage: myProfileImage,
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

  const deleteComment = (commentId: string, commentUserId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const canDelete = uid === commentUserId || uid === authorId;
    if (!canDelete) return;

    Alert.alert("Delete comment?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(
            doc(db, "userBucketlistItems", postId, "comments", commentId)
          );
          updateDoc(doc(db, "userBucketlistItems", postId), {
            commentsCount: increment(-1),
          }).catch(() => {});
        },
      },
    ]);
  };

  return (
    <Modal
      visible={expanded}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {comments.length === 0 && (
              <Text style={styles.emptyText}>No comments yet. Be the first.</Text>
            )}
            {comments.map((c) => (
              <Pressable
                key={c.id}
                style={styles.commentRow}
                onPress={() => {
                  if (c.userId === auth.currentUser?.uid) return;
                  onClose();
                  router.push({ pathname: "/user/[id]", params: { id: c.userId } });
                }}
                onLongPress={() => deleteComment(c.id, c.userId)}
                delayLongPress={400}
              >
                {c.profileImage ? (
                  <Image source={{ uri: c.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>
                      {(c.username || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.commentContent}>
                  <Text style={styles.commentText}>
                    <Text style={styles.commentUsername}>{c.username || "user"} </Text>
                    {c.text}
                  </Text>
                  <Text style={styles.commentTime}>{formatRelativeTime(c.createdAt)}</Text>
                </View>

                <Pressable hitSlop={10} style={styles.heartBtn}>
                  <Ionicons name="heart-outline" size={13} color={C.textTertiary} />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            {myProfileImage ? (
              <Image source={{ uri: myProfileImage }} style={styles.inputAvatar} />
            ) : (
              <View style={styles.inputAvatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(myUsername || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    keyboardView: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      height: SHEET_HEIGHT,
      backgroundColor: C.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingTop: 10,
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    handle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.handle,
      alignSelf: "center",
      marginBottom: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: C.text,
    },
    closeText: {
      fontWeight: "700",
      color: C.textSecondary,
      fontSize: 15,
    },
    list: {
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
    commentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 18,
      gap: 10,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.avatarBg,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarInitial: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 13,
    },
    commentContent: {
      flex: 1,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
      color: C.text,
    },
    commentUsername: {
      fontWeight: "700",
      color: C.text,
    },
    commentTime: {
      fontSize: 12,
      color: C.textTertiary,
      marginTop: 4,
    },
    heartBtn: {
      paddingTop: 2,
    },
    inputAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    inputAvatarFallback: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.avatarBg,
      justifyContent: "center",
      alignItems: "center",
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
