import { Link, router, useFocusEffect } from "expo-router";
import { signOut } from "firebase/auth";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth, db } from "./firebaseConfig";
import PostThumbnail from "../../components/PostThumbnail";

type ActiveTab = "posts" | "cards" | "bucketlist" | "collections";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("posts");
  const [selectedBucketlistCategory, setSelectedBucketlistCategory] =
    useState<string | null>(null);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const deleteCompletedPost = async (itemId: string) => {
    Alert.alert(
      "Delete post?",
      "This will permanently delete this post from your profile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "userBucketlistItems", itemId));
            setItems((prevItems) =>
              prevItems.filter((item) => item.id !== itemId)
            );
          },
        },
      ]
    );
  };

  const deleteBucketlistItem = async (itemId: string) => {
    Alert.alert("Delete item?", "This will remove it from your bucketlist.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "userBucketlistItems", itemId));
          setItems((prevItems) =>
            prevItems.filter((item) => item.id !== itemId)
          );
        },
      },
    ]);
  };

  const completedItems = items
    .filter((item) => item.completed === true)
    .sort((a, b) => {
      const aTime = a.completedAt?.seconds || 0;
      const bTime = b.completedAt?.seconds || 0;
      return bTime - aTime;
    });

  const uncompletedItems = items.filter((item) => item.completed !== true);

  const completedCategories = Array.from(
    new Set(completedItems.map((item) => item.category || "Other"))
  ).sort();

  const bucketlistCategories = [
    "All",
    ...Array.from(
      new Set(uncompletedItems.map((item) => item.category || "Other"))
    ).sort(),
  ];

  const visibleBucketlistItems =
    selectedBucketlistCategory === null || selectedBucketlistCategory === "All"
      ? uncompletedItems
      : uncompletedItems.filter(
          (item) => item.category === selectedBucketlistCategory
        );

  useFocusEffect(
    useCallback(() => {
      const loadProfileAndBucketlist = async () => {
        if (!auth.currentUser) return;

        const userId = auth.currentUser.uid;

        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setProfile(userSnap.data());
        }

        const bucketlistQuery = query(
          collection(db, "userBucketlistItems"),
          where("userId", "==", userId)
        );

        const bucketlistSnap = await getDocs(bucketlistQuery);

        const fetchedItems = bucketlistSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        setItems(fetchedItems);

        const followersQuery = query(
          collection(db, "follows"),
          where("followingId", "==", userId)
        );

        const followersSnap = await getDocs(followersQuery);
        setFollowersCount(followersSnap.size);

        const followingQuery = query(
          collection(db, "follows"),
          where("followerId", "==", userId)
        );

        const followingSnap = await getDocs(followingQuery);
        setFollowingCount(followingSnap.size);
      };

      loadProfileAndBucketlist();
    }, [])
  );


  const renderPosts = () => (
    <View style={styles.scene}>
      {completedItems.length === 0 ? (
        <Text style={styles.emptyText}>
          No completed items yet. Complete a bucketlist item to see it here.
        </Text>
      ) : (
        <View style={styles.grid}>
          {completedItems.map((item) => (
            <PostThumbnail
              key={item.id}
              post={item}
              onPress={() =>
                router.push({
                  pathname: "/post/[id]",
                  params: { id: item.id },
                })
              }
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderCards = () => (
    <View style={styles.scene}>
      {completedCategories.length === 0 ? (
        <Text style={styles.emptyText}>No completed categories yet.</Text>
      ) : (
        <View style={styles.grid}>
          {completedCategories.map((category) => {
            const categoryItems = completedItems.filter(
              (item) => item.category === category
            );

            const thumbnail = categoryItems.find((item) => item.imageUrl)?.imageUrl;

            return (
              <Pressable
                key={category}
                style={styles.categoryImageCard}
                onPress={() =>
                  router.push({
                    pathname: "/profile-category/[category]",
                    params: { category },
                  })
                }
              >
                {thumbnail ? (
                  <Image source={{ uri: thumbnail }} style={styles.completedImage} />
                ) : (
                  <View style={styles.categoryThumbnailFallback}>
                    <Text style={styles.categoryThumbnailText}>{category}</Text>
                  </View>
                )}

                <View style={styles.cardOverlay}>
                  <Text style={styles.cardOverlayTitle}>{category}</Text>
                  <Text style={styles.cardOverlayCount}>
                    {categoryItems.length} posts
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderBucketlist = () => (
    <View style={styles.scene}>
      {selectedBucketlistCategory === null ? (
        bucketlistCategories.map((category) => {
          const count =
            category === "All"
              ? uncompletedItems.length
              : uncompletedItems.filter((item) => item.category === category)
                  .length;

          return (
            <Pressable
              key={category}
              style={styles.categoryCard}
              onPress={() => setSelectedBucketlistCategory(category)}
            >
              <View>
                <Text style={styles.categoryTitle}>{category}</Text>
                <Text style={styles.categoryCount}>{count} ideas</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          );
        })
      ) : (
        <>
          <Pressable onPress={() => setSelectedBucketlistCategory(null)}>
            <Text style={styles.backText}>‹ Back to bucketlist categories</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>{selectedBucketlistCategory}</Text>

          {visibleBucketlistItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Pressable
                style={styles.itemContent}
                onPress={() =>
                  router.push({
                    pathname: "/complete-item/[id]",
                    params: { id: item.id },
                  })
                }
              >
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
                <Text style={styles.completeHint}>Tap to complete</Text>
              </Pressable>

              <Pressable
                style={styles.deleteItemButton}
                onPress={() => deleteBucketlistItem(item.id)}
              >
                <Text style={styles.deleteItemText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </View>
  );

  const renderCollections = () => (
    <View style={styles.scene}>
      <Text style={styles.emptyText}>
        Collections coming next. This is where boards like Summer 2026, This Week,
        Date Ideas, and Friend Challenges can live.
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              {profile?.profileImage ? (
                <Image
                  source={{ uri: profile.profileImage }}
                  style={styles.profileImage}
                />
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
                { text: "Log out", style: "destructive", onPress: handleLogout },
                { text: "Cancel", style: "cancel" },
              ])
            }
          >
            <Text style={styles.menuButton}>⋯</Text>
          </Pressable>
        </View>

        <Text style={styles.bio}>
          {profile?.bio || "No bio yet. Add your dreams here soon."}
        </Text>

        <Link href="/edit-profile" style={styles.editButton}>
          Edit profile
        </Link>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statNumber}>
              {completedItems.length}/{items.length}
            </Text>
            <Text style={styles.statLabel}>Bucketlist</Text>
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

      <View style={styles.customTabs}>
        {[
          { key: "posts", title: "Posts" },
          { key: "cards", title: "Cards" },
          { key: "bucketlist", title: "Bucketlist" },
          { key: "collections", title: "Collections" },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.customTab,
              activeTab === tab.key && styles.customTabActive,
            ]}
            onPress={() => {
              setActiveTab(tab.key as ActiveTab);
              setSelectedBucketlistCategory(null);
            }}
          >
            <Text
              style={[
                styles.customTabText,
                activeTab === tab.key && styles.customTabTextActive,
              ]}
            >
              {tab.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "posts" && renderPosts()}
      {activeTab === "cards" && renderCards()}
      {activeTab === "bucketlist" && renderBucketlist()}
      {activeTab === "collections" && renderCollections()}
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
    paddingTop: 80,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  menuButton: {
    fontSize: 26,
    fontWeight: "800",
    paddingHorizontal: 8,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
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
  profileImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  bio: {
    marginTop: 24,
    fontSize: 16,
    lineHeight: 22,
  },
  editButton: {
    marginTop: 18,
    backgroundColor: "#111",
    color: "#fff",
    padding: 14,
    borderRadius: 16,
    textAlign: "center",
    fontWeight: "700",
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
  tabBar: {
    backgroundColor: "#fff",
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tabStyle: {
    width: "auto",
    paddingHorizontal: 18,
  },
  tabIndicator: {
    backgroundColor: "#111",
    height: 3,
    borderRadius: 3,
  },
  scene: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: "#777",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -24,
  },
  completedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  categoryCard: {
    backgroundColor: "#F4F4F4",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  categoryCount: {
    marginTop: 4,
    color: "#777",
    fontWeight: "600",
  },
  categoryThumbnailFallback: {
    flex: 1,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryThumbnailText: {
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
    padding: 8,
  },
  cardOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  cardOverlayTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  cardOverlayCount: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 2,
  },
  categoryImageCard: {
    width: "33.3333%",
    aspectRatio: 3 / 4,
    backgroundColor: "#F4F4F4",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#fff",
  },
  arrow: {
    fontSize: 30,
    color: "#777",
  },
  backText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: "#F4F4F4",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  itemCategory: {
    marginTop: 4,
    color: "#777",
  },
  completeHint: {
    marginTop: 8,
    color: "#111",
    fontWeight: "700",
    fontSize: 13,
  },
  itemContent: {
    flex: 1,
  },
  
  deleteItemButton: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  
  deleteItemText: {
    color: "#C0392B",
    fontWeight: "800",
    fontSize: 14,
  },
  deletePostOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  
  deletePostText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  
  customTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  
  customTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  
  customTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#111",
  },
  
  customTabText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#777",
  },
  
  customTabTextActive: {
    color: "#111",
  },
});