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
import { useEffect, useMemo, useState } from "react";
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
import { ThemeColors, useTheme } from "../../lib/theme";

type SubTab = "all" | "completed" | "todo";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HEADER_HEIGHT = SCREEN_WIDTH * 0.65;

export default function CollectionDetailScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

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
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
        </View>

        {/* Header meta */}
        <View style={styles.headerMeta}>
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
                    router.push({
                      pathname: "/post-feed/[id]",
                      params: { id: item.id, mode: "collection", filterId: id },
                    })
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
                      router.push({
                        pathname: "/post-feed/[id]",
                        params: { id: item.id, mode: "collection", filterId: id },
                      });
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
                    {item.category ? (
                      <Text style={styles.itemCat} numberOfLines={1}>{item.category}</Text>
                    ) : null}
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

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.background,
    },
    dimText: {
      color: C.textTertiary,
      fontSize: 16,
    },

    header: {
      width: "100%",
      overflow: "hidden",
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
    headerMeta: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 4,
    },
    privateLbl: {
      fontSize: 11,
      fontWeight: "800",
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6,
    },
    headerName: {
      fontSize: 30,
      fontWeight: "900",
      color: C.text,
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
      backgroundColor: C.border,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: 4,
      backgroundColor: C.text,
      borderRadius: 2,
    },
    progressLbl: {
      fontSize: 13,
      fontWeight: "800",
      color: C.textSecondary,
    },

    // Sub-tabs
    subTabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    subTab: {
      flex: 1,
      paddingVertical: 13,
      alignItems: "center",
    },
    subTabActive: {
      borderBottomWidth: 2,
      borderBottomColor: C.text,
    },
    subTabText: {
      fontSize: 12,
      fontWeight: "700",
      color: C.textTertiary,
    },
    subTabTextActive: {
      color: C.text,
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
      color: C.textTertiary,
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.divider,
    },
    itemThumb: {
      width: 64,
      height: 64,
      borderRadius: 12,
      resizeMode: "cover",
    },
    itemThumbFallback: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: C.surface,
    },
    itemInfo: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: C.text,
      lineHeight: 20,
    },
    itemMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 5,
    },
    itemCat: {
      fontSize: 12,
      fontWeight: "500",
      color: C.textTertiary,
    },
    doneBadge: {
      fontSize: 12,
      color: C.accent,
      fontWeight: "800",
    },
    tapHint: {
      fontSize: 12,
      color: C.textTertiary,
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
      color: C.border,
      fontWeight: "300",
      lineHeight: 28,
    },
  });
}
