import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { sendCollectionInvite } from "../../lib/collections";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import { ThemeColors, useTheme } from "../../lib/theme";

export default function InviteToCollectionScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { id: collectionId } = useLocalSearchParams<{ id: string }>();

  const [collName, setCollName] = useState("");
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedLocal, setInvitedLocal] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchColl = async () => {
      const snap = await getDoc(doc(db, "collections", collectionId));
      if (!snap.exists()) return;
      const data = snap.data();
      setCollName(data.name ?? "");
      setBlockedIds([
        data.userId,
        ...(data.memberIds ?? []),
        ...(data.invitedIds ?? []),
      ]);
    };
    fetchColl();
  }, [collectionId]);

  const search = async (text: string) => {
    setSearchText(text);
    if (!text.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const lower = text.toLowerCase();
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("username", ">=", lower),
          where("username", "<=", lower + ""),
          limit(15)
        )
      );
      const uid = auth.currentUser?.uid ?? "";
      setResults(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u: any) => !blockedIds.includes(u.id) && u.id !== uid && !invitedLocal.has(u.id))
      );
    } finally {
      setSearching(false);
    }
  };

  const invite = async (user: any) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const inviteId = `${collectionId}_${user.id}`;
      await sendCollectionInvite({
        collectionId,
        collectionName: collName,
        invitedUserId: user.id,
      });
      await createNotification({
        recipientId: user.id,
        type: "collection_invite",
        actorId: uid,
        inviteId,
        collectionId,
        previewText: collName,
      });
      setInvitedLocal((prev) => new Set([...prev, user.id]));
      setResults((prev) => prev.filter((u: any) => u.id !== user.id));
    } catch {
      Alert.alert("Error", "Could not send invite. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          Invite to {collName || "collection"}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by username…"
        placeholderTextColor={C.inputPlaceholder}
        value={searchText}
        onChangeText={search}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      {searching ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={C.textSecondary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.username?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
              <Text style={styles.username}>@{item.username}</Text>
              <Pressable style={styles.inviteBtn} onPress={() => invite(item)}>
                <Text style={styles.inviteBtnText}>Invite</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            searchText.length > 0 ? (
              <Text style={styles.emptyText}>No users found</Text>
            ) : (
              <Text style={styles.emptyText}>Type a username to search</Text>
            )
          }
        />
      )}

      {invitedLocal.size > 0 && (
        <View style={styles.sentBanner}>
          <Text style={styles.sentBannerText}>
            {invitedLocal.size} invite{invitedLocal.size > 1 ? "s" : ""} sent
          </Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 56,
      paddingBottom: 10,
      paddingHorizontal: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
    backBtnText: { fontSize: 28, fontWeight: "700", color: C.text, lineHeight: 32, marginTop: -2 },
    title: { flex: 1, fontSize: 16, fontWeight: "800", color: C.text, textAlign: "center", marginHorizontal: 8 },
    searchInput: {
      margin: 16,
      backgroundColor: C.inputBackground,
      borderRadius: 14,
      padding: 14,
      fontSize: 16,
      color: C.text,
    },
    list: { paddingHorizontal: 16 },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.divider,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.surface,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    avatarText: { fontWeight: "700", fontSize: 16, color: C.text },
    username: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },
    inviteBtn: {
      backgroundColor: C.buttonPrimary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    inviteBtnText: { color: C.buttonPrimaryText, fontWeight: "700", fontSize: 14 },
    emptyText: {
      marginTop: 40,
      textAlign: "center",
      color: C.textTertiary,
      fontSize: 15,
    },
    sentBanner: {
      position: "absolute",
      bottom: 32,
      alignSelf: "center",
      backgroundColor: C.text,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
    },
    sentBannerText: { color: C.background, fontWeight: "700", fontSize: 14 },
  });
}
