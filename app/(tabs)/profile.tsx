import { Link, router, useFocusEffect } from "expo-router";
import { signOut } from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  Alert,
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
import PostThumbnail from "../../components/PostThumbnail";
import { auth, db } from "../../lib/firebaseConfig";

type ActiveTab = "posts" | "cards" | "bucketlist" | "collections";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("posts");
  const [selectedBucketlistCategory, setSelectedBucketlistCategory] =
    useState<string | null>(null);

  const [collections, setCollections] = useState<any[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addToCollectionItemId, setAddToCollectionItemId] = useState<string | null>(null);

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
            setItems((prev) => prev.filter((i) => i.id !== itemId));
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
          setItems((prev) => prev.filter((i) => i.id !== itemId));
        },
      },
    ]);
  };

  const completedItems = items
    .filter((item) => item.completed === true)
    .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));

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
      : uncompletedItems.filter((item) => item.category === selectedBucketlistCategory);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!auth.currentUser) return;
        const userId = auth.currentUser.uid;

        const [userSnap, bucketlistSnap, followersSnap, followingSnap, collectionsSnap] =
          await Promise.all([
            getDoc(doc(db, "users", userId)),
            getDocs(query(collection(db, "userBucketlistItems"), where("userId", "==", userId))),
            getDocs(query(collection(db, "follows"), where("followingId", "==", userId))),
            getDocs(query(collection(db, "follows"), where("followerId", "==", userId))),
            getDocs(query(collection(db, "collections"), where("userId", "==", userId))),
          ]);

        if (userSnap.exists()) setProfile(userSnap.data());
        setItems(bucketlistSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setFollowersCount(followersSnap.size);
        setFollowingCount(followingSnap.size);
        setCollections(collectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      };

      load();
    }, [])
  );

  const reloadCollections = async () => {
    if (!auth.currentUser) return;
    const snap = await getDocs(
      query(collection(db, "collections"), where("userId", "==", auth.currentUser.uid))
    );
    setCollections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const createCollection = async () => {
    if (!auth.currentUser || !newCollectionName.trim()) return;
    try {
      setCreating(true);
      await addDoc(collection(db, "collections"), {
        userId: auth.currentUser.uid,
        name: newCollectionName.trim(),
        createdAt: serverTimestamp(),
        itemIds: [],
      });
      setNewCollectionName("");
      setCreateSheetOpen(false);
      await reloadCollections();
    } finally {
      setCreating(false);
    }
  };

  const deleteCollection = (collId: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, "This won't delete the items, just the collection.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "collections", collId));
          if (activeCollectionId === collId) setActiveCollectionId(null);
          await reloadCollections();
        },
      },
    ]);
  };

  const addItemToCollection = async (collId: string, itemId: string) => {
    await updateDoc(doc(db, "collections", collId), { itemIds: arrayUnion(itemId) });
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collId
          ? { ...c, itemIds: [...(c.itemIds || []), itemId] }
          : c
      )
    );
    setAddToCollectionItemId(null);
  };

  const removeItemFromCollection = async (collId: string, itemId: string) => {
    await updateDoc(doc(db, "collections", collId), { itemIds: arrayRemove(itemId) });
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collId
          ? { ...c, itemIds: (c.itemIds || []).filter((id: string) => id !== itemId) }
          : c
      )
    );
  };

  // ─── Tab renderers ────────────────────────────────────────────────────────

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
                router.push({ pathname: "/post/[id]", params: { id: item.id } })
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
            const categoryItems = completedItems.filter((i) => i.category === category);
            const thumbnail = categoryItems.find((i) => i.imageUrl)?.imageUrl;

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
                  <Text style={styles.cardOverlayCount}>{categoryItems.length} posts</Text>
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
              : uncompletedItems.filter((i) => i.category === category).length;

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
            <Text style={styles.backText}>‹ Back to categories</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>{selectedBucketlistCategory}</Text>

          {visibleBucketlistItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Pressable
                style={styles.itemContent}
                onPress={() =>
                  router.push({ pathname: "/complete-item/[id]", params: { id: item.id } })
                }
              >
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
                <Text style={styles.completeHint}>Tap to complete</Text>
              </Pressable>

              <View style={styles.itemActions}>
                {collections.length > 0 && (
                  <Pressable
                    style={styles.addToCollectionBtn}
                    onPress={() => setAddToCollectionItemId(item.id)}
                  >
                    <Text style={styles.addToCollectionText}>+ Collection</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => deleteBucketlistItem(item.id)}>
                  <Text style={styles.deleteItemText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );

  const renderCollections = () => {
    if (activeCollectionId) {
      const coll = collections.find((c) => c.id === activeCollectionId);
      if (!coll) return null;

      const collItems = items.filter((i) => (coll.itemIds || []).includes(i.id));

      return (
        <View style={styles.scene}>
          <Pressable onPress={() => setActiveCollectionId(null)}>
            <Text style={styles.backText}>‹ Back to collections</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>{coll.name}</Text>

          {collItems.length === 0 ? (
            <Text style={styles.emptyText}>No items in this collection yet.</Text>
          ) : (
            collItems.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <Pressable
                  style={styles.itemContent}
                  onPress={() => {
                    if (item.completed) {
                      router.push({ pathname: "/post/[id]", params: { id: item.id } });
                    } else {
                      router.push({ pathname: "/complete-item/[id]", params: { id: item.id } });
                    }
                  }}
                >
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemCategory}>{item.category}</Text>
                  {item.completed ? (
                    <Text style={styles.completedBadge}>Completed</Text>
                  ) : (
                    <Text style={styles.completeHint}>Tap to complete</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => removeItemFromCollection(activeCollectionId, item.id)}>
                  <Text style={styles.deleteItemText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      );
    }

    return (
      <View style={styles.scene}>
        <Pressable style={styles.createCollectionBtn} onPress={() => setCreateSheetOpen(true)}>
          <Text style={styles.createCollectionText}>＋ New collection</Text>
        </Pressable>

        {collections.length === 0 ? (
          <Text style={styles.emptyText}>
            Collections are personal boards for grouping your ideas. Create one to get started.
          </Text>
        ) : (
          <View style={styles.collectionsGrid}>
            {collections.map((coll) => {
              const collItems = items.filter((i) => (coll.itemIds || []).includes(i.id));
              const coverImage = collItems.find((i) => i.imageUrl)?.imageUrl || null;

              return (
                <Pressable
                  key={coll.id}
                  style={styles.collectionCard}
                  onPress={() => setActiveCollectionId(coll.id)}
                  onLongPress={() => deleteCollection(coll.id, coll.name)}
                >
                  {coverImage ? (
                    <Image source={{ uri: coverImage }} style={styles.collectionCover} />
                  ) : (
                    <View style={styles.collectionCoverPlaceholder} />
                  )}
                  <View style={styles.collectionInfo}>
                    <Text style={styles.collectionName} numberOfLines={1}>
                      {coll.name}
                    </Text>
                    <Text style={styles.collectionCount}>
                      {(coll.itemIds || []).length} items
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // ─── Root render ─────────────────────────────────────────────────────────

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.profileHeader}>
          <View style={styles.header}>
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
          {(["posts", "cards", "bucketlist", "collections"] as ActiveTab[]).map((key) => (
            <Pressable
              key={key}
              style={[styles.customTab, activeTab === key && styles.customTabActive]}
              onPress={() => {
                setActiveTab(key);
                setSelectedBucketlistCategory(null);
                setActiveCollectionId(null);
              }}
            >
              <Text
                style={[styles.customTabText, activeTab === key && styles.customTabTextActive]}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "posts" && renderPosts()}
        {activeTab === "cards" && renderCards()}
        {activeTab === "bucketlist" && renderBucketlist()}
        {activeTab === "collections" && renderCollections()}
      </ScrollView>

      {/* Create collection sheet */}
      <Modal
        visible={createSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateSheetOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setCreateSheetOpen(false); }}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New collection</Text>
            <Text style={styles.sheetSubtitle}>Give your collection a name.</Text>

            <TextInput
              style={styles.sheetInput}
              placeholder="e.g. Summer 2026, Date Ideas…"
              placeholderTextColor="#999"
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createCollection}
            />

            <Pressable
              style={[styles.sheetButton, creating && styles.sheetButtonDisabled]}
              onPress={createCollection}
              disabled={creating}
            >
              <Text style={styles.sheetButtonText}>
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

      {/* Add to collection sheet */}
      <Modal
        visible={addToCollectionItemId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAddToCollectionItemId(null)}
      >
        <TouchableWithoutFeedback onPress={() => setAddToCollectionItemId(null)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add to collection</Text>

            {collections.map((coll) => {
              const alreadyIn = (coll.itemIds || []).includes(addToCollectionItemId);
              return (
                <Pressable
                  key={coll.id}
                  style={styles.collectionPickRow}
                  onPress={() =>
                    !alreadyIn && addItemToCollection(coll.id, addToCollectionItemId!)
                  }
                  disabled={alreadyIn}
                >
                  <View style={styles.collectionPickInfo}>
                    <Text style={styles.collectionPickName}>{coll.name}</Text>
                    <Text style={styles.collectionPickCount}>
                      {(coll.itemIds || []).length} items
                    </Text>
                  </View>
                  <Text style={[styles.collectionPickCheck, alreadyIn && styles.collectionPickCheckDone]}>
                    {alreadyIn ? "✓" : "+"}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              style={styles.sheetCancel}
              onPress={() => setAddToCollectionItemId(null)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
  completedBadge: {
    marginTop: 8,
    color: "#2ecc71",
    fontWeight: "700",
    fontSize: 13,
  },
  itemContent: {
    flex: 1,
  },
  itemActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  addToCollectionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: "#111",
    borderRadius: 10,
  },
  addToCollectionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteItemText: {
    color: "#C0392B",
    fontWeight: "800",
    fontSize: 14,
    paddingVertical: 5,
  },

  // Collections grid
  createCollectionBtn: {
    backgroundColor: "#111",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  createCollectionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  collectionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  collectionCard: {
    width: "47%",
    borderRadius: 16,
    backgroundColor: "#F4F4F4",
    overflow: "hidden",
  },
  collectionCover: {
    width: "100%",
    aspectRatio: 1,
  },
  collectionCoverPlaceholder: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#E0E0E0",
  },
  collectionInfo: {
    padding: 10,
  },
  collectionName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
  },
  collectionCount: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: "#fff",
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
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  sheetSubtitle: {
    color: "#777",
    fontSize: 14,
    marginBottom: 18,
  },
  sheetInput: {
    backgroundColor: "#F4F4F4",
    padding: 15,
    borderRadius: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  sheetButton: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  sheetButtonDisabled: {
    backgroundColor: "#ccc",
  },
  sheetButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  sheetCancel: {
    alignItems: "center",
    marginTop: 14,
  },
  sheetCancelText: {
    color: "#777",
    fontWeight: "700",
    fontSize: 15,
  },

  // Collection picker rows
  collectionPickRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  collectionPickInfo: {
    flex: 1,
  },
  collectionPickName: {
    fontSize: 16,
    fontWeight: "700",
  },
  collectionPickCount: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  collectionPickCheck: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    width: 28,
    textAlign: "center",
  },
  collectionPickCheckDone: {
    color: "#2ecc71",
  },
});
