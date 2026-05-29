import * as ImagePicker from "expo-image-picker";
import { Link, router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { createCollection, executeDeleteCollection } from "../../lib/collections";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import CollectionCard from "../../components/CollectionCard";
import PostThumbnail from "../../components/PostThumbnail";
import { auth, db, storage } from "../../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../../lib/theme";

type ActiveTab = "collections" | "posts";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_PAD = 16;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - CARD_PAD * 2 - CARD_GAP) / 2);

export default function ProfileScreen({ isFocused }: { isFocused: boolean }) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const pagerRef = useRef<ScrollView>(null);

  const [profile, setProfile] = useState<any>(null);
  const [completedItems, setCompletedItems] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("collections");
  const [collections, setCollections] = useState<any[]>([]);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionCover, setNewCollectionCover] = useState<string | null>(null);
  const [newCollectionPrivate, setNewCollectionPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [followListUsers, setFollowListUsers] = useState<any[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);

  useEffect(() => {
    if (!isFocused) return;
    load();
  }, [isFocused]);

  const load = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const [userSnap, postsSnap, followersSnap, followingSnap, ownedSnap, sharedSnap] =
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
        getDocs(query(collection(db, "collections"), where("memberIds", "array-contains", uid))),
      ]);

    if (userSnap.exists()) setProfile(userSnap.data());
    setCompletedItems(
      postsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
    );
    setFollowersCount(followersSnap.size);
    setFollowingCount(followingSnap.size);

    const ownedRaw = ownedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sharedRaw = sharedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const allIdsToFetch = [...new Set([
      ...ownedRaw.flatMap((c: any) => c.memberIds || []),
      ...sharedRaw.map((c: any) => c.userId as string),
      ...sharedRaw.flatMap((c: any) => c.memberIds || []),
    ])] as string[];
    const userDataMap = new Map<string, any>();
    if (allIdsToFetch.length > 0) {
      const userDocs = await Promise.all(allIdsToFetch.map((id) => getDoc(doc(db, "users", id))));
      userDocs.forEach((d) => { if (d.exists()) userDataMap.set(d.id, d.data()); });
    }
    const ownedCollections = ownedRaw.map((c: any) => ({
      ...c,
      isShared: (c.memberIds || []).length > 0,
      memberAvatars: (c.memberIds || []).map((mid: string) => userDataMap.get(mid)?.profileImage || null).filter(Boolean).slice(0, 3),
    }));
    const sharedCollections = sharedRaw.map((c: any) => {
      const ownerData = userDataMap.get(c.userId);
      const memberAvatars = [
        ownerData?.profileImage,
        ...(c.memberIds || []).map((mid: string) => userDataMap.get(mid)?.profileImage || null),
      ].filter(Boolean).slice(0, 3);
      return { ...c, isShared: true, ownerUsername: ownerData?.username || "user", memberAvatars };
    });
    setCollections([...ownedCollections, ...sharedCollections]);
  };

  const reloadCollections = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const [ownedSnap, sharedSnap] = await Promise.all([
      getDocs(query(collection(db, "collections"), where("userId", "==", uid))),
      getDocs(query(collection(db, "collections"), where("memberIds", "array-contains", uid))),
    ]);
    const ownedRaw = ownedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sharedRaw = sharedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const allIdsToFetch = [...new Set([
      ...ownedRaw.flatMap((c: any) => c.memberIds || []),
      ...sharedRaw.map((c: any) => c.userId as string),
      ...sharedRaw.flatMap((c: any) => c.memberIds || []),
    ])] as string[];
    const userDataMap = new Map<string, any>();
    if (allIdsToFetch.length > 0) {
      const userDocs = await Promise.all(allIdsToFetch.map((id) => getDoc(doc(db, "users", id))));
      userDocs.forEach((d) => { if (d.exists()) userDataMap.set(d.id, d.data()); });
    }
    const ownedCollections = ownedRaw.map((c: any) => ({
      ...c,
      isShared: (c.memberIds || []).length > 0,
      memberAvatars: (c.memberIds || []).map((mid: string) => userDataMap.get(mid)?.profileImage || null).filter(Boolean).slice(0, 3),
    }));
    const sharedCollections = sharedRaw.map((c: any) => {
      const ownerData = userDataMap.get(c.userId);
      const memberAvatars = [
        ownerData?.profileImage,
        ...(c.memberIds || []).map((mid: string) => userDataMap.get(mid)?.profileImage || null),
      ].filter(Boolean).slice(0, 3);
      return { ...c, isShared: true, ownerUsername: ownerData?.username || "user", memberAvatars };
    });
    setCollections([...ownedCollections, ...sharedCollections]);
  };

  const pickCoverPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewCollectionCover(result.assets[0].uri);
    }
  };

  const handleCreateCollection = async () => {
    if (!auth.currentUser || !newCollectionName.trim()) return;
    setCreating(true);
    try {
      let coverPhoto: string | undefined;
      if (newCollectionCover) {
        const uid = auth.currentUser.uid;
        const resp = await fetch(newCollectionCover);
        const blob = await resp.blob();
        const storageRef = ref(storage, `collections/${uid}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        coverPhoto = await getDownloadURL(storageRef);
      }
      await createCollection({
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim(),
        isPrivate: newCollectionPrivate,
        ...(coverPhoto ? { coverPhoto } : {}),
      });
      setNewCollectionName("");
      setNewCollectionDesc("");
      setNewCollectionCover(null);
      setNewCollectionPrivate(false);
      setCreateSheetOpen(false);
      await reloadCollections();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCollection = (collId: string, name: string) => {
    const coll = collections.find((c) => c.id === collId);
    const completedCount = coll?.completedCount ?? 0;
    const todoCount = Math.max(0, (coll?.itemCount ?? 0) - completedCount);

    const lines: string[] = [];
    if (todoCount > 0)
      lines.push(`${todoCount} to-do ${todoCount === 1 ? "item" : "items"} will be removed.`);
    if (completedCount > 0)
      lines.push(
        `${completedCount} completed ${completedCount === 1 ? "memory" : "memories"} will stay in your Posts.`
      );
    const body = lines.length > 0 ? lines.join(" ") : "This collection is empty.";

    Alert.alert(`Delete "${name}"?`, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await executeDeleteCollection(collId);
          setCollections((prev) => prev.filter((c) => c.id !== collId));
        },
      },
    ]);
  };

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    pagerRef.current?.scrollTo({ x: (tab === "collections" ? 0 : 1) * SCREEN_WIDTH, animated: true });
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

  // ── Shared page header (profile info + tab row) ───────────────────────────

  const openMenu = () =>
    Alert.alert("Profile options", "", [
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => signOut(auth),
      },
      { text: "Cancel", style: "cancel" },
    ]);

  // ── Root render ────────────────────────────────────────────────────────────

  return (
    <>
      <View style={styles.container}>
        {/* Top bar — always fixed */}
        <View style={styles.topBar}>
          <Pressable onPress={() => setCreateSheetOpen(true)} style={styles.topBarBtn} hitSlop={8}>
            <Text style={styles.topBarPlus}>+</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={openMenu} style={styles.topBarBtn} hitSlop={8}>
            <Text style={styles.topBarMenu}>⋯</Text>
          </Pressable>
        </View>

        {/* Single vertical scroll: header → tabs (sticky) → content */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* 0 — profile header, scrolls away */}
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

            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            <Link href="/edit-profile" style={styles.editBtn}>
              Edit profile
            </Link>
          </View>

          {/* 1 — tab row, becomes sticky */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === "collections" && styles.tabActive]}
              onPress={() => switchTab("collections")}
            >
              <Text style={[styles.tabText, activeTab === "collections" && styles.tabTextActive]}>
                Collections
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "posts" && styles.tabActive]}
              onPress={() => switchTab("posts")}
            >
              <Text style={[styles.tabText, activeTab === "posts" && styles.tabTextActive]}>
                Posts
              </Text>
            </Pressable>
          </View>

          {/* 2 — horizontal pager, no flex:1 so height comes from content */}
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveTab(page === 0 ? "collections" : "posts");
            }}
          >
            {/* Collections page */}
            <View style={{ width: SCREEN_WIDTH, paddingTop: 16, paddingBottom: 100 }}>
              <View style={styles.collectionsGrid}>
                {collections.map((coll) => (
                  <CollectionCard
                    key={coll.id}
                    collection={coll}
                    cardWidth={CARD_WIDTH}
                    memberAvatars={coll.memberAvatars}
                    ownerUsername={coll.ownerUsername}
                    onPress={() =>
                      router.push({ pathname: "/collection/[id]", params: { id: coll.id } })
                    }
                    onLongPress={coll.userId === auth.currentUser?.uid ? () => handleDeleteCollection(coll.id, coll.name) : undefined}
                  />
                ))}
              </View>
              {collections.length === 0 && (
                <Text style={styles.emptyText}>
                  Collections are your personal boards — Japan 2027, Dream Honeymoon, Food Goals…{"\n"}
                  Create one and start saving experiences.
                </Text>
              )}
            </View>

            {/* Posts page */}
            <View style={{ width: SCREEN_WIDTH, paddingTop: 16, paddingBottom: 100 }}>
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
          </ScrollView>
        </ScrollView>
      </View>

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
        onRequestClose={() => {
          setCreateSheetOpen(false);
          setNewCollectionCover(null);
          setNewCollectionPrivate(false);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setCreateSheetOpen(false);
            setNewCollectionCover(null);
            setNewCollectionPrivate(false);
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

            {/* Cover photo picker */}
            <Pressable style={styles.coverPickerBtn} onPress={pickCoverPhoto}>
              {newCollectionCover ? (
                <Image source={{ uri: newCollectionCover }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverPickerEmpty}>
                  <Text style={styles.coverPickerIcon}>+</Text>
                  <Text style={styles.coverPickerLabel}>Cover photo</Text>
                </View>
              )}
            </Pressable>

            <TextInput
              style={styles.sheetInput}
              placeholder="Collection name"
              placeholderTextColor={C.inputPlaceholder}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateCollection}
            />

            <TextInput
              style={[styles.sheetInput, { marginTop: -6 }]}
              placeholder="Description (optional)"
              placeholderTextColor={C.inputPlaceholder}
              value={newCollectionDesc}
              onChangeText={setNewCollectionDesc}
              returnKeyType="done"
              onSubmitEditing={handleCreateCollection}
            />

            <View style={styles.privateRow}>
              <Text style={styles.privateLabel}>Private collection</Text>
              <Switch
                value={newCollectionPrivate}
                onValueChange={setNewCollectionPrivate}
                trackColor={{ false: C.border, true: C.text }}
                thumbColor={C.background}
              />
            </View>

            <Pressable
              style={[styles.sheetBtn, creating && styles.sheetBtnOff]}
              onPress={handleCreateCollection}
              disabled={creating}
            >
              <Text style={styles.sheetBtnText}>
                {creating ? "Creating…" : "Create collection"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.sheetCancel}
              onPress={() => {
                setCreateSheetOpen(false);
                setNewCollectionCover(null);
                setNewCollectionPrivate(false);
              }}
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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 52,
      paddingBottom: 8,
    },
    topBarBtn: {
      padding: 6,
    },
    topBarPlus: {
      fontSize: 28,
      fontWeight: "300",
      color: C.text,
      lineHeight: 30,
    },
    topBarMenu: {
      fontSize: 24,
      fontWeight: "800",
      color: C.text,
      lineHeight: 24,
    },
    profileHeader: {
      paddingHorizontal: 24,
      paddingTop: 8,
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
      width: SCREEN_WIDTH,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    tab: {
      width: SCREEN_WIDTH / 2,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
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
    collectionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CARD_GAP,
      paddingHorizontal: CARD_PAD,
    },

    privateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
      paddingHorizontal: 2,
    },
    privateLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: C.text,
    },

    // Cover photo picker
    coverPickerBtn: {
      alignSelf: "center",
      marginBottom: 16,
      width: 100,
      height: 100,
      borderRadius: 14,
      overflow: "hidden",
    },
    coverPreview: {
      width: 100,
      height: 100,
      resizeMode: "cover",
    },
    coverPickerEmpty: {
      width: 100,
      height: 100,
      borderRadius: 14,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    coverPickerIcon: {
      fontSize: 22,
      fontWeight: "300",
      color: C.textTertiary,
      lineHeight: 26,
    },
    coverPickerLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: C.textTertiary,
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
