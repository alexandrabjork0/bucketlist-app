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
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../(tabs)/firebaseConfig";
import PostThumbnail from "../../components/PostThumbnail";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();

  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!id || typeof id !== "string") return;

      const userRef = doc(db, "users", id);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setProfile(userSnap.data());
      }

      const itemsQuery = query(
        collection(db, "userBucketlistItems"),
        where("userId", "==", id),
        where("completed", "==", true)
      );

      const itemsSnap = await getDocs(itemsQuery);

      const fetchedItems = itemsSnap.docs
        .map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
        .sort((a: any, b: any) => {
          const aTime = a.completedAt?.seconds || 0;
          const bTime = b.completedAt?.seconds || 0;
          return bTime - aTime;
        });

      setItems(fetchedItems);

      const followersQuery = query(
        collection(db, "follows"),
        where("followingId", "==", id)
      );

      const followersSnap = await getDocs(followersQuery);
      setFollowersCount(followersSnap.size);

      const followingQuery = query(
        collection(db, "follows"),
        where("followerId", "==", id)
      );

      const followingSnap = await getDocs(followingQuery);
      setFollowingCount(followingSnap.size);

      const currentUserId = auth.currentUser?.uid;

      if (currentUserId && currentUserId !== id) {
        const followId = `${currentUserId}_${id}`;
        const followSnap = await getDoc(doc(db, "follows", followId));
        setIsFollowing(followSnap.exists());
      }
    };

    loadUserProfile();
  }, [id]);

  const handleFollowToggle = async () => {
    if (!auth.currentUser || !id || typeof id !== "string") return;

    const currentUserId = auth.currentUser.uid;
    const followId = `${currentUserId}_${id}`;
    const followRef = doc(db, "follows", followId);

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
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile?.profileImage ? (
            <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
          ) : (
            <Text style={styles.avatarText}>
              {profile?.username?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          )}
        </View>

        <View>
          <Text style={styles.username}>@{profile?.username || "loading"}</Text>
          <Text style={styles.bio}>{profile?.bio || "No bio yet."}</Text>
        </View>
      </View>

      {auth.currentUser?.uid !== id && (
        <Pressable
          onPress={handleFollowToggle}
          style={[
            styles.followButton,
            isFollowing && styles.followingButton,
          ]}
        >
          <Text
            style={[
              styles.followButtonText,
              isFollowing && styles.followingButtonText,
            ]}
          >
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </Pressable>
      )}

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

      <View style={styles.grid}>
        {items.map((item) => (
          <PostThumbnail
            key={item.id}
            post={item}
            onPress={() =>
              router.push({
                pathname: "/explore-post/[id]",
                params: { id: item.id },
              })
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  backText: {
    marginTop: 60,
    marginLeft: 20,
    fontSize: 16,
    fontWeight: "600",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  avatarText: {
    fontSize: 30,
    fontWeight: "700",
  },

  username: {
    fontSize: 22,
    fontWeight: "800",
  },

  bio: {
    marginTop: 6,
    color: "#666",
    maxWidth: 220,
  },

  followButton: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#111",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },

  followingButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  followButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  followingButtonText: {
    color: "#111",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  statNumber: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
  },

  statLabel: {
    textAlign: "center",
    marginTop: 4,
    color: "#666",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 2,
  },

});