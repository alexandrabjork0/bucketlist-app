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
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
  const pagerRef = useRef<ScrollView>(null);

  const { id } = useLocalSearchParams<{ id: string }>();
  const [coll, setColl] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [loading, setLoading] = useState(true);

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

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
          // Update Firestore counts
          const updates: Record<string, any> = {
            itemCount: increment(-1),
            updatedAt: serverTimestamp(),
          };
          if (target?.completed) updates.completedCount = increment(-1);
          updateDoc(doc(db, "collections", id), updates).catch(() => {});
          setColl((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              itemCount: Math.max(0, (prev.itemCount ?? 0) - 1),
              completedCount: target?.completed
                ? Math.max(0, (prev.completedCount ?? 0) - 1)
                : prev.completedCount ?? 0,
            };
          });
        },
      },
    ]);
  };

  const openEditSheet = () => {
    setEditName(coll?.name ?? "");
    setEditPrivate(coll?.isPrivate ?? false);
    setEditSheetOpen(true);
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "collections", id), {
        name: editName.trim(),
        isPrivate: editPrivate,
        updatedAt: serverTimestamp(),
      });
      setColl((prev: any) => ({ ...prev, name: editName.trim(), isPrivate: editPrivate }));
      setEditSheetOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const switchSubTab = (tab: SubTab) => {
    setSubTab(tab);
    const index = tab === "all" ? 0 : tab === "completed" ? 1 : 2;
    pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const isOwner = coll?.userId === auth.currentUser?.uid;
  const completedItems = items.filter((i) => i.completed);
  const todoItems = items.filter((i) => !i.completed);

  const total = coll ? (coll.itemCount ?? items.length) : 0;
  const done = coll ? (coll.completedCount ?? completedItems.length) : 0;

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

  const renderPage = (pageItems: any[], emptyMessage: string, isCompletedTab: boolean) => (
    <ScrollView
      style={{ width: SCREEN_WIDTH }}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {pageItems.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : isCompletedTab ? (
        <View style={styles.grid}>
          {pageItems.map((item) => (
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
        pageItems.map((item) => (
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
    </ScrollView>
  );

  return (
    <>
      <View style={styles.container}>
        {/* Hero header */}
        <View style={[styles.header, { height: HEADER_HEIGHT }]}>
          <CollectionCover
            images={coll.coverImages ?? []}
            coverPhoto={coll.coverPhoto}
            size={SCREEN_WIDTH}
            name={coll.name}
          />
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
          {isOwner && (
            <Pressable style={styles.editBtn} onPress={openEditSheet}>
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          )}
        </View>

        {/* Meta */}
        <View style={styles.headerMeta}>
          {coll.isPrivate && <Text style={styles.privateLbl}>Private</Text>}
          <Text style={styles.headerName}>{coll.name}</Text>
          <Text style={styles.metaText}>
            {total === 0
              ? "No items yet"
              : done > 0
              ? `${total} saved · ${done} completed`
              : `${total} saved`}
          </Text>
        </View>

        {/* Sub-tabs */}
        <View style={styles.subTabs}>
          {(["all", "completed", "todo"] as SubTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.subTab, subTab === tab && styles.subTabActive]}
              onPress={() => switchSubTab(tab)}
            >
              <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
                {tab === "all" ? `All (${items.length})` :
                 tab === "completed" ? `Completed (${completedItems.length})` :
                 `To Do (${todoItems.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Swipeable pages */}
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setSubTab(page === 0 ? "all" : page === 1 ? "completed" : "todo");
          }}
          style={{ flex: 1 }}
        >
          {renderPage(items, "No items yet. Save experiences to this collection.", false)}
          {renderPage(completedItems, "Nothing completed yet. Go do something!", true)}
          {renderPage(todoItems, "Everything is done! 🎉", false)}
        </ScrollView>
      </View>

      {/* Edit collection sheet */}
      <Modal
        visible={editSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditSheetOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setEditSheetOpen(false); }}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit collection</Text>

            <TextInput
              style={styles.sheetInput}
              placeholder="Collection name"
              placeholderTextColor={C.inputPlaceholder}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />

            <View style={styles.privateRow}>
              <Text style={styles.privateLabel}>Private collection</Text>
              <Switch
                value={editPrivate}
                onValueChange={setEditPrivate}
                trackColor={{ false: C.border, true: C.text }}
                thumbColor={C.background}
              />
            </View>

            <Pressable
              style={[styles.sheetBtn, saving && styles.sheetBtnOff]}
              onPress={saveEdit}
              disabled={saving}
            >
              <Text style={styles.sheetBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>

            <Pressable style={styles.sheetCancel} onPress={() => setEditSheetOpen(false)}>
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
    editBtn: {
      position: "absolute",
      top: 56,
      right: 18,
      backgroundColor: "rgba(0,0,0,0.35)",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    editBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
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
    metaText: {
      fontSize: 13,
      fontWeight: "500",
      color: C.textTertiary,
      marginTop: 6,
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

    // Pages
    pageContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 48,
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

    // Edit sheet
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
      marginBottom: 18,
      color: C.text,
    },
    sheetInput: {
      backgroundColor: C.inputBackground,
      padding: 15,
      borderRadius: 14,
      fontSize: 16,
      marginBottom: 16,
      color: C.text,
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
  });
}
