import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PostThumbnail from "../../components/PostThumbnail";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();

  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    loadUserProfile(id);
  }, [id]);

  const loadUserProfile = async (userId: string) => {
    const [userSnap, itemsSnap, followersSnap, followingSnap] = await Promise.all([
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
    ]);

    if (userSnap.exists()) setProfile(userSnap.data());

    setItems(
      itemsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
    );

    setFollowersCount(followersSnap.size);
    setFollowingCount(followingSnap.size);

    const currentUserId = auth.currentUser?.uid;
    if (currentUserId && currentUserId !== userId) {
      const followSnap = await getDoc(doc(db, "follows", `${currentUserId}_${userId}`));
      setIsFollowing(followSnap.exists());
    }
  };

  const handleFollowToggle = async () => {
    if (!auth.currentUser || !id || typeof id !== "string") return;

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
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        {/* Top row: avatar + username + back */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              {profile?.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
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

        {/* Bio */}
        <Text style={styles.bio}>{profile?.bio || "No bio yet."}</Text>

        {/* Follow button */}
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

        {/* Stats */}
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statNumber}>{items.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View>
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>

      {/* Post grid */}
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No completed posts yet.</Text>
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <PostThumbnail
              key={item.id}
              post={item}
              onPress={() =>
                router.push({ pathname: "/explore-post/[id]", params: { id: item.id } })
              }
            />
          ))}
        </View>
      )}
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
  profileImage: {
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
  emptyText: {
    color: "#777",
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 24,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
