import { Link, router, useFocusEffect } from "expo-router";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import CollectionCard from "../../components/CollectionCard";
import PostThumbnail from "../../components/PostThumbnail";
import { auth, db } from "../../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../../lib/theme";

type ActiveTab = "posts" | "collections";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_PAD = 16;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - CARD_PAD * 2 - CARD_GAP) / 2);

export default function ProfileScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [profile, setProfile] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("posts");
  const [collections, setCollections] = useState<any[]>([]);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [followListUsers, setFollowListUsers] = useState<any[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const [userSnap, postsSnap, followersSnap, followingSnap, collectionsSnap] =
      await Promise.all([
        getDoc(doc(db, "users", uid)),
        getDocs(
          query(
            collection(db, "userBucketlistItems"),
            where("userId", "==", uid),
            where("completed", "==", true)
          )
        ),
        getDocs(query(collection(db, "follows"), where("followingId", "==", uid))),
        getDocs(query(collection(db, "follows"), where("followerId", "==", uid))),
        getDocs(query(collection(db, "collections"), where("userId", "==", uid))),
      ]);

    if (userSnap.exists()) setProfile(userSnap.data());
    setCompletedItems(
      postsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
    );
    setFollowersCount(followersSnap.size);
    setFollowingCount(followingSnap.size);
    setCollections(collectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const reloadCollections = async () => {
    if (!auth.currentUser) return;
    const snap = await getDocs(
      query(collection(db, "collections"), where("userId", "==", auth.currentUser.uid))
    );
    setCollections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const createCollection = async () => {
    if (!auth.currentUser || !newCollectionName.trim()) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "collections"), {
        userId: auth.currentUser.uid,
        name: newCollectionName.trim(),
        isPrivate: false,
        coverImages: [],
        itemCount: 0,
        completedCount: 0,
        order: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewCollectionName("");
      setCreateSheetOpen(false);
      await reloadCollections();
    } finally {
      setCreating(false);
    }
  };

  const deleteCollection = (collId: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, "Items in this collection won't be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "collections", collId));
          setCollections((prev) => prev.filter((c) => c.id !== collId));
        },
      },
    ]);
  };

  const openFollowList = async (type: "followers" | "following") => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setFollowListType(type);
    setLoadingFollowList(true);
    setFollowListUsers([]);
    try {
      const field = type === "followers" ? "followingId" : "followerId";
      const resultField = type === "followers" ? "followerId" : "followingId";
      const snap = await getDocs(query(collection(db, "follows"), where(field, "==", uid)));
      const userIds = snap.docs.map((d) => d.data()[resultField] as string);
      const profiles = await Promise.all(userIds.map((id) => getDoc(doc(db, "users", id))));
      setFollowListUsers(
        profiles.filter((d) => d.exists()).map((d) => ({ id: d.id, ...(d.data() as any) }))
      );
    } finally {
      setLoadingFollowList(false);
    }
  };

  // ── Tab renderers ──────────────────────────────────────────────────────────

  const renderPosts = () => (
    <View style={styles.scene}>
      {completedItems.length === 0 ? (
        <Text style={styles.emptyText}>
          No posts yet. Complete an experience to see it here.
        </Text>
      ) : (
        <View style={styles.grid}>
          {completedItems.map((item) => (
            <PostThumbnail
              key={item.id}
              post={item}
              onPress={() =>
                router.push({ pathname: "/post/[id]", params: { id: item.id } })
              }
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderCollections = () => (
    <View style={styles.scene}>
      <Pressable
        style={styles.newCollBtn}
        onPress={() => setCreateSheetOpen(true)}
      >
        <Text style={styles.newCollBtnText}>＋ New collection</Text>
      </Pressable>

      {collections.length === 0 ? (
        <Text style={styles.emptyText}>
          Collections are your personal boards — Japan 2027, Dream Honeymoon, Food Goals…{"\n"}
          Create one and start saving experiences.
        </Text>
      ) : (
        <View style={styles.collectionsGrid}>
          {collections.map((coll) => (
            <CollectionCard
              key={coll.id}
              collection={coll}
              cardWidth={CARD_WIDTH}
              onPress={() =>
                router.push({ pathname: "/collection/[id]", params: { id: coll.id } })
              }
              onLongPress={() => deleteCollection(coll.id, coll.name)}
            />
          ))}
        </View>
      )}
    </View>
  );

  // ── Root render ────────────────────────────────────────────────────────────

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                {profile?.profileImage ? (
                  <Image source={{ uri: profile.profileImage }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {profile?.username?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                )}
              </View>
              <Text style={styles.username}>@{profile?.username || "loading"}</Text>
            </View>

            <Pressable
              onPress={() =>
                Alert.alert("Profile options", "", [
                  {
                    text: "Log out",
                    style: "destructive",
                    onPress: async () => signOut(auth),
                  },
                  { text: "Cancel", style: "cancel" },
                ])
              }
            >
              <Text style={styles.menuBtn}>⋯</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{collections.length}</Text>
              <Text style={styles.statLabel}>Collections</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{completedItems.length}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <Pressable style={styles.stat} onPress={() => openFollowList("followers")}>
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => openFollowList("following")}>
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
          </View>

          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          <Link href="/edit-profile" style={styles.editBtn}>
            Edit profile
          </Link>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["posts", "collections"] as ActiveTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "posts" && renderPosts()}
        {activeTab === "collections" && renderCollections()}
      </ScrollView>

      {/* Followers / Following list sheet */}
      <Modal
        visible={followListType !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setFollowListType(null)}
      >
        <TouchableWithoutFeedback onPress={() => setFollowListType(null)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View style={styles.followSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.followSheetHeader}>
            <Text style={styles.sheetTitle}>
              {followListType === "followers" ? "Followers" : "Following"}
            </Text>
            <Pressable onPress={() => setFollowListType(null)}>
              <Text style={styles.followSheetClose}>✕</Text>
            </Pressable>
          </View>

          {loadingFollowList ? (
            <ActivityIndicator color={C.textSecondary} style={{ marginTop: 32 }} />
          ) : followListUsers.length === 0 ? (
            <Text style={styles.followSheetEmpty}>
              {followListType === "followers" ? "No followers yet." : "Not following anyone yet."}
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {followListUsers.map((user) => (
                <Pressable
                  key={user.id}
                  style={styles.followUserRow}
                  onPress={() => {
                    setFollowListType(null);
                    router.push({ pathname: "/user/[id]", params: { id: user.id } });
                  }}
                >
                  <View style={styles.followAvatar}>
                    {user.profileImage ? (
                      <Image source={{ uri: user.profileImage }} style={styles.followAvatarImage} />
                    ) : (
                      <Text style={styles.followAvatarText}>
                        {user.username?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.followUsername}>@{user.username}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Create collection sheet */}
      <Modal
        visible={createSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateSheetOpen(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setCreateSheetOpen(false);
          }}
        >
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New collection</Text>
            <Text style={styles.sheetSubtitle}>
              Give your collection a name — Japan 2027, Dream Honeymoon, Food Goals…
            </Text>

            <TextInput
              style={styles.sheetInput}
              placeholder="Collection name"
              placeholderTextColor={C.inputPlaceholder}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createCollection}
            />

            <Pressable
              style={[styles.sheetBtn, creating && styles.sheetBtnOff]}
              onPress={createCollection}
              disabled={creating}
            >
              <Text style={styles.sheetBtnText}>
                {creating ? "Creating…" : "Create collection"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.sheetCancel}
              onPress={() => setCreateSheetOpen(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    profileHeader: {
      paddingHorizontal: 24,
      paddingTop: 72,
      paddingBottom: 8,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    menuBtn: {
      fontSize: 24,
      fontWeight: "800",
      paddingHorizontal: 6,
      color: C.textSecondary,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.avatarBg,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarText: {
      color: "#fff",
      fontSize: 30,
      fontWeight: "800",
    },
    username: {
      fontSize: 20,
      fontWeight: "800",
      color: C.text,
    },
    statsRow: {
      marginTop: 20,
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 4,
    },
    stat: {
      alignItems: "center",
      paddingHorizontal: 4,
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: C.border,
    },
    statNumber: {
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
      color: C.text,
    },
    statLabel: {
      color: C.textTertiary,
      marginTop: 3,
      fontSize: 11,
      fontWeight: "400",
      textAlign: "center",
    },
    bio: {
      marginTop: 16,
      fontSize: 14,
      lineHeight: 21,
      color: C.textSecondary,
    },
    editBtn: {
      marginTop: 18,
      borderWidth: 1,
      borderColor: C.divider,
      borderRadius: 10,
      paddingVertical: 9,
      color: C.textSecondary,
      textAlign: "center",
      fontWeight: "600",
      fontSize: 14,
    },
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
    },
    tabActive: {
      borderBottomWidth: 3,
      borderBottomColor: C.text,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "800",
      color: C.textTertiary,
    },
    tabTextActive: {
      color: C.text,
    },
    scene: {
      flex: 1,
      backgroundColor: C.background,
      paddingTop: 20,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    emptyText: {
      color: C.textSecondary,
      textAlign: "center",
      marginTop: 24,
      lineHeight: 22,
      paddingHorizontal: 40,
    },
    newCollBtn: {
      backgroundColor: C.buttonPrimary,
      padding: 15,
      borderRadius: 16,
      alignItems: "center",
      marginHorizontal: CARD_PAD,
      marginBottom: 20,
    },
    newCollBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 15,
    },
    collectionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CARD_GAP,
      paddingHorizontal: CARD_PAD,
    },

    // Sheet
    overlay: {
      flex: 1,
      backgroundColor: C.overlay,
    },
    sheetWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingBottom: 40,
      paddingTop: 14,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.handle,
      alignSelf: "center",
      marginBottom: 20,
    },
    sheetTitle: {
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 6,
      color: C.text,
    },
    sheetSubtitle: {
      color: C.textSecondary,
      fontSize: 14,
      marginBottom: 18,
      lineHeight: 20,
    },
    sheetInput: {
      backgroundColor: C.inputBackground,
      padding: 15,
      borderRadius: 14,
      fontSize: 16,
      marginBottom: 16,
      color: C.text,
    },
    sheetBtn: {
      backgroundColor: C.buttonPrimary,
      padding: 16,
      borderRadius: 18,
      alignItems: "center",
    },
    sheetBtnOff: {
      backgroundColor: C.disabled,
    },
    sheetBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 16,
    },
    sheetCancel: {
      alignItems: "center",
      marginTop: 14,
    },
    sheetCancelText: {
      color: C.textSecondary,
      fontWeight: "700",
      fontSize: 15,
    },

    // Follow list sheet
    followSheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: C.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingBottom: 48,
      paddingTop: 14,
      maxHeight: "70%",
    },
    followSheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    followSheetClose: {
      fontSize: 16,
      color: C.textSecondary,
      fontWeight: "700",
      padding: 4,
    },
    followSheetEmpty: {
      textAlign: "center",
      color: C.textTertiary,
      marginTop: 32,
      fontSize: 15,
    },
    followUserRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.divider,
    },
    followAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.avatarBg,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    followAvatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    followAvatarText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "800",
    },
    followUsername: {
      fontSize: 15,
      fontWeight: "700",
      color: C.text,
    },
  });
}
