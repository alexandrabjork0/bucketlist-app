import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import CollectionCover from "../../components/CollectionCover";
import PostThumbnail from "../../components/PostThumbnail";
import { auth, db } from "../../lib/firebaseConfig";

type SubTab = "all" | "completed" | "todo";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HEADER_HEIGHT = SCREEN_WIDTH * 0.65;

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [coll, setColl] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    try {
      const [collSnap, itemsSnap] = await Promise.all([
        getDoc(doc(db, "collections", id)),
        getDocs(
          query(
            collection(db, "userBucketlistItems"),
            where("collectionId", "==", id)
          )
        ),
      ]);

      if (!collSnap.exists()) {
        setLoading(false);
        return;
      }

      setColl({ id: collSnap.id, ...collSnap.data() });
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = (itemId: string) => {
    Alert.alert("Remove item?", "This will permanently remove this from your collection.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const target = items.find((i) => i.id === itemId);
          await deleteDoc(doc(db, "userBucketlistItems", itemId));
          setItems((prev) => prev.filter((i) => i.id !== itemId));
          const updates: Record<string, any> = {
            itemCount: increment(-1),
            updatedAt: serverTimestamp(),
          };
          if (target?.completed) updates.completedCount = increment(-1);
          updateDoc(doc(db, "collections", id), updates).catch(() => {});
        },
      },
    ]);
  };

  const isOwner = coll?.userId === auth.currentUser?.uid;
  const completedItems = items.filter((i) => i.completed);
  const todoItems = items.filter((i) => !i.completed);
  const visibleItems =
    subTab === "completed" ? completedItems :
    subTab === "todo" ? todoItems :
    items;

  const total = coll ? (coll.itemCount ?? items.length) : 0;
  const done = coll ? (coll.completedCount ?? completedItems.length) : 0;
  const progress = total > 0 ? done / total : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.dimText}>Loading…</Text>
      </View>
    );
  }

  if (!coll) {
    return (
      <View style={styles.center}>
        <Text style={styles.dimText}>Collection not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* Header */}
        <View style={[styles.header, { height: HEADER_HEIGHT }]}>
          <CollectionCover images={coll.coverImages ?? []} size={SCREEN_WIDTH} name={coll.name} />
          <View style={styles.headerGradient} />

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>

          <View style={styles.headerContent}>
            {coll.isPrivate && <Text style={styles.privateLbl}>Private</Text>}
            <Text style={styles.headerName}>{coll.name}</Text>
            {total > 0 ? (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
                </View>
                <Text style={styles.progressLbl}>{done}/{total}</Text>
              </View>
            ) : (
              <Text style={styles.progressLbl}>No items yet</Text>
            )}
          </View>
        </View>

        {/* Sub-tabs */}
        <View style={styles.subTabs}>
          {(["all", "completed", "todo"] as SubTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.subTab, subTab === tab && styles.subTabActive]}
              onPress={() => setSubTab(tab)}
            >
              <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
                {tab === "all" ? `All (${items.length})` :
                 tab === "completed" ? `Completed (${completedItems.length})` :
                 `To Do (${todoItems.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {visibleItems.length === 0 ? (
            <Text style={styles.emptyText}>
              {subTab === "all"
                ? "No items yet. Save experiences to this collection."
                : subTab === "completed"
                ? "Nothing completed yet. Go do something!"
                : "Everything is done! 🎉"}
            </Text>
          ) : subTab === "completed" ? (
            <View style={styles.grid}>
              {visibleItems.map((item) => (
                <PostThumbnail
                  key={item.id}
                  post={item}
                  onPress={() =>
                    router.push({ pathname: "/post/[id]", params: { id: item.id } })
                  }
                />
              ))}
            </View>
          ) : (
            visibleItems.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} />
                ) : (
                  <View style={styles.itemThumbFallback} />
                )}

                <Pressable
                  style={styles.itemInfo}
                  onPress={() => {
                    if (item.completed) {
                      router.push({ pathname: "/post/[id]", params: { id: item.id } });
                    } else if (isOwner) {
                      router.push({
                        pathname: "/complete-item/[id]",
                        params: { id: item.id },
                      });
                    }
                  }}
                >
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.itemMeta}>
                    <View style={styles.catPill}>
                      <Text style={styles.catPillText}>{item.category}</Text>
                    </View>
                    {item.completed ? (
                      <Text style={styles.doneBadge}>Done</Text>
                    ) : isOwner ? (
                      <Text style={styles.tapHint}>Tap to complete →</Text>
                    ) : null}
                  </View>
                </Pressable>

                {isOwner && (
                  <Pressable onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>×</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dimText: {
    color: "#999",
    fontSize: 16,
  },

  // Header
  header: {
    width: "100%",
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "72%",
    backgroundColor: "rgba(0,0,0,0.56)",
  },
  backBtn: {
    position: "absolute",
    top: 56,
    left: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
    marginTop: -2,
  },
  headerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  privateLbl: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  headerName: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  progressLbl: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "800",
  },

  // Sub-tabs
  subTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  subTab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
  },
  subTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#111",
  },
  subTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#aaa",
  },
  subTabTextActive: {
    color: "#111",
  },

  // Content
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -16,
  },
  emptyText: {
    color: "#999",
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 24,
  },

  // List item
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F4",
  },
  itemThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    resizeMode: "cover",
  },
  itemThumbFallback: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#E8E8E8",
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    lineHeight: 20,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  catPill: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  catPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
  },
  doneBadge: {
    fontSize: 12,
    color: "#2ecc71",
    fontWeight: "800",
  },
  tapHint: {
    fontSize: 12,
    color: "#aaa",
    fontWeight: "600",
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 24,
    color: "#ccc",
    fontWeight: "300",
    lineHeight: 28,
  },
});
