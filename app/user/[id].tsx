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
import { useEffect, useState } from "react";
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

type ActiveTab = "posts" | "collections";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_PAD = 16;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - CARD_PAD * 2 - CARD_GAP) / 2);

export default function UserProfileScreen() {
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

    // Only show public collections on other users' profiles
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
      {/* Header */}
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

          <Pressable onPress={() => router.back()}>
            <Text style={styles.backBtn}>‹</Text>
          </Pressable>
        </View>

        <Text style={styles.bio}>{profile?.bio || "No bio yet."}</Text>

        {!isOwnProfile && (
          <Pressable
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={handleFollowToggle}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  profileHeader: {
    padding: 24,
    paddingTop: 72,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111",
    paddingHorizontal: 4,
    marginTop: -4,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  avatarText: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
  },
  username: {
    fontSize: 26,
    fontWeight: "800",
  },
  bio: {
    marginTop: 24,
    fontSize: 16,
    lineHeight: 22,
    color: "#333",
  },
  followBtn: {
    marginTop: 18,
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  followingBtn: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ddd",
  },
  followBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  followingBtnText: {
    color: "#111",
  },
  statsRow: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F4F4F4",
    padding: 18,
    borderRadius: 22,
  },
  stat: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  statLabel: {
    color: "#777",
    marginTop: 4,
    fontSize: 13,
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#111",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#999",
  },
  tabTextActive: {
    color: "#111",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emptyText: {
    color: "#777",
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
