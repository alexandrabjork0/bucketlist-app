import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CollectionCard from "../../components/CollectionCard";
import PostThumbnail from "../../components/PostThumbnail";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import { ThemeColors, useTheme } from "../../lib/theme";

type ActiveTab = "posts" | "collections";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_PAD = 16;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - CARD_PAD * 2 - CARD_GAP) / 2);

export default function UserProfileScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { id } = useLocalSearchParams<{ id: string }>();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [publicCollections, setPublicCollections] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("posts");

  useEffect(() => {
    if (id) loadProfile(id);
  }, [id]);

  const loadProfile = async (userId: string) => {
    const [userSnap, postsSnap, followersSnap, followingSnap, collectionsSnap] =
      await Promise.all([
        getDoc(doc(db, "users", userId)),
        getDocs(
          query(
            collection(db, "userBucketlistItems"),
            where("userId", "==", userId),
            where("completed", "==", true)
          )
        ),
        getDocs(query(collection(db, "follows"), where("followingId", "==", userId))),
        getDocs(query(collection(db, "follows"), where("followerId", "==", userId))),
        getDocs(query(collection(db, "collections"), where("userId", "==", userId))),
      ]);

    if (userSnap.exists()) setProfile(userSnap.data());

    setPosts(
      postsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
    );

    setFollowersCount(followersSnap.size);
    setFollowingCount(followingSnap.size);

    setPublicCollections(
      collectionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c: any) => !c.isPrivate)
    );

    const currentUserId = auth.currentUser?.uid;
    if (currentUserId && currentUserId !== userId) {
      const followSnap = await getDoc(doc(db, "follows", `${currentUserId}_${userId}`));
      setIsFollowing(followSnap.exists());
    }
  };

  const handleFollowToggle = async () => {
    if (!auth.currentUser || !id) return;
    const currentUserId = auth.currentUser.uid;
    const followRef = doc(db, "follows", `${currentUserId}_${id}`);

    if (isFollowing) {
      await deleteDoc(followRef);
      setIsFollowing(false);
      setFollowersCount((prev) => Math.max(prev - 1, 0));
    } else {
      await setDoc(followRef, {
        followerId: currentUserId,
        followingId: id,
        createdAt: serverTimestamp(),
      });
      setIsFollowing(true);
      setFollowersCount((prev) => prev + 1);
      createNotification({
        recipientId: id,
        type: "follow",
        actorId: currentUserId,
      }).catch(() => {});
    }
  };

  const isOwnProfile = auth.currentUser?.uid === id;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>

        {/* Avatar row + back button */}
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

          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtn}>‹</Text>
          </Pressable>
        </View>

        {/* Stats — same floating style as own profile */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{publicCollections.length}</Text>
            <Text style={styles.statLabel}>Collections</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {/* Follow button — same slot as "Edit profile" on own profile */}
        {!isOwnProfile && (
          <Pressable
            style={[styles.actionBtn, isFollowing && styles.actionBtnFollowing]}
            onPress={handleFollowToggle}
          >
            <Text style={[styles.actionBtnText, isFollowing && styles.actionBtnTextFollowing]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
        )}
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

      {/* Posts tab */}
      {activeTab === "posts" && (
        posts.length === 0 ? (
          <Text style={styles.emptyText}>No posts yet.</Text>
        ) : (
          <View style={styles.grid}>
            {posts.map((item) => (
              <PostThumbnail
                key={item.id}
                post={item}
                onPress={() =>
                  router.push({ pathname: "/explore-post/[id]", params: { id: item.id } })
                }
              />
            ))}
          </View>
        )
      )}

      {/* Collections tab */}
      {activeTab === "collections" && (
        <View style={styles.collectionsScene}>
          {publicCollections.length === 0 ? (
            <Text style={styles.emptyText}>No public collections yet.</Text>
          ) : (
            <View style={styles.collectionsGrid}>
              {publicCollections.map((coll) => (
                <CollectionCard
                  key={coll.id}
                  collection={coll}
                  cardWidth={CARD_WIDTH}
                  onPress={() =>
                    router.push({ pathname: "/collection/[id]", params: { id: coll.id } })
                  }
                />
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
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
    backBtn: {
      fontSize: 28,
      fontWeight: "700",
      color: C.textSecondary,
      paddingHorizontal: 6,
      marginTop: -2,
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
    actionBtn: {
      marginTop: 18,
      backgroundColor: C.buttonPrimary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    actionBtnFollowing: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: C.divider,
    },
    actionBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "700",
      fontSize: 14,
    },
    actionBtnTextFollowing: {
      color: C.textSecondary,
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
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    emptyText: {
      color: C.textSecondary,
      textAlign: "center",
      marginTop: 24,
      paddingHorizontal: 24,
      lineHeight: 22,
    },
    collectionsScene: {
      paddingTop: 20,
    },
    collectionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CARD_GAP,
      paddingHorizontal: CARD_PAD,
    },
  });
}
