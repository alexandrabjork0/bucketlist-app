import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
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
import { executeDeleteCollection } from "../../lib/collections";
import { auth, db, storage } from "../../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../../lib/theme";

type SubTab = "ideas" | "memories";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HEADER_HEIGHT = SCREEN_WIDTH * 0.65;

export default function CollectionDetailScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const pagerRef = useRef<ScrollView>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [coll, setColl] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [subTab, setSubTab] = useState<SubTab>("ideas");
  const [loading, setLoading] = useState(true);

  // ── (···) menu ────────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Add idea sheet ────────────────────────────────────────────────────────
  const [addIdeaOpen, setAddIdeaOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [savingIdea, setSavingIdea] = useState(false);

  // ── Collection edit sheet ─────────────────────────────────────────────────
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // ── Item edit sheet ───────────────────────────────────────────────────────
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemNotes, setEditItemNotes] = useState("");
  const [editItemPrivate, setEditItemPrivate] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    try {
      const [collSnap, itemsSnap] = await Promise.all([
        getDoc(doc(db, "collections", id)),
        getDocs(
          query(collection(db, "userBucketlistItems"), where("collectionId", "==", id))
        ),
      ]);
      if (!collSnap.exists()) { setLoading(false); return; }
      setColl({ id: collSnap.id, ...collSnap.data() });
      setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  // ── Item deletion — completed items can never be deleted ──────────────────
  const deleteItem = (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    if (!target || target.completed) return;

    Alert.alert("Remove item?", "This will permanently remove this from your collection.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "userBucketlistItems", itemId));
          setItems((prev) => prev.filter((i) => i.id !== itemId));
          updateDoc(doc(db, "collections", id), {
            itemCount: increment(-1),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          setColl((prev: any) => prev
            ? { ...prev, itemCount: Math.max(0, (prev.itemCount ?? 0) - 1) }
            : prev
          );
        },
      },
    ]);
  };

  // ── Collection edit ───────────────────────────────────────────────────────
  const openEditSheet = () => {
    setEditName(coll?.name ?? "");
    setEditDesc(coll?.description ?? "");
    setEditPrivate(coll?.isPrivate ?? false);
    setEditSheetOpen(true);
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "collections", id), {
        name: editName.trim(),
        description: editDesc.trim(),
        isPrivate: editPrivate,
        updatedAt: serverTimestamp(),
      });
      setColl((prev: any) => ({
        ...prev,
        name: editName.trim(),
        description: editDesc.trim(),
        isPrivate: editPrivate,
      }));
      setEditSheetOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const pickCoverPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setUploadingCover(true);
    try {
      const resp = await fetch(result.assets[0].uri);
      const blob = await resp.blob();
      const storageRef = ref(storage, `collections/${uid}/${id}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "collections", id), { coverPhoto: url, updatedAt: serverTimestamp() });
      setColl((prev: any) => ({ ...prev, coverPhoto: url }));
    } finally {
      setUploadingCover(false);
    }
  };

  // ── Item edit ─────────────────────────────────────────────────────────────
  const openEditItem = (item: any) => {
    setEditingItem(item);
    setEditItemTitle(item.title ?? "");
    setEditItemCategory(item.category ?? "");
    setEditItemNotes(item.notes ?? "");
    setEditItemPrivate(item.isPrivate ?? false);
    setEditItemOpen(true);
  };

  const saveEditItem = async () => {
    if (!editingItem || !editItemTitle.trim()) return;
    setSavingItem(true);
    try {
      await updateDoc(doc(db, "userBucketlistItems", editingItem.id), {
        title: editItemTitle.trim(),
        category: editItemCategory.trim(),
        notes: editItemNotes.trim(),
        isPrivate: editItemPrivate,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                title: editItemTitle.trim(),
                category: editItemCategory.trim(),
                notes: editItemNotes.trim(),
                isPrivate: editItemPrivate,
              }
            : i
        )
      );
      setEditItemOpen(false);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteCollection = () => {
    setMenuOpen(false);
    Alert.alert(
      "Delete collection?",
      "To-do ideas will be removed. Completed memories stay in your Posts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await executeDeleteCollection(id);
            router.back();
          },
        },
      ]
    );
  };

  const addIdea = async () => {
    if (!newIdeaTitle.trim() || !auth.currentUser) return;
    setSavingIdea(true);
    try {
      const uid = auth.currentUser.uid;
      const newRef = await addDoc(collection(db, "userBucketlistItems"), {
        userId: uid,
        createdBy: uid,
        savedBy: uid,
        completedBy: null,
        collectionId: id,
        title: newIdeaTitle.trim(),
        category: "",
        notes: "",
        source: "custom",
        completed: false,
        isPrivate: coll?.isPrivate ?? true,
        publishedToDiscover: false,
        imageUrl: null,
        media: [],
        caption: "",
        likesCount: 0,
        commentsCount: 0,
        completedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => [
        ...prev,
        {
          id: newRef.id,
          userId: uid,
          createdBy: uid,
          savedBy: uid,
          completedBy: null,
          collectionId: id,
          title: newIdeaTitle.trim(),
          category: "",
          notes: "",
          source: "custom",
          completed: false,
          isPrivate: coll?.isPrivate ?? true,
          publishedToDiscover: false,
          imageUrl: null,
          media: [],
          caption: "",
        },
      ]);
      setColl((prev: any) =>
        prev ? { ...prev, itemCount: (prev.itemCount ?? 0) + 1 } : prev
      );
      updateDoc(doc(db, "collections", id), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      setNewIdeaTitle("");
      setAddIdeaOpen(false);
    } finally {
      setSavingIdea(false);
    }
  };

  const switchSubTab = (tab: SubTab) => {
    setSubTab(tab);
    const index = tab === "ideas" ? 0 : 1;
    pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const isOwner = coll?.userId === auth.currentUser?.uid;
  const completedItems = items.filter((i) => i.completed);
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
    <View style={styles.pageContent}>
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
                  router.push({ pathname: "/complete-item/[id]", params: { id: item.id } });
                }
              }}
              onLongPress={() => {
                if (isOwner && !item.completed) openEditItem(item);
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
                  <Text style={styles.tapHint}>
                    {item.notes ? "Hold to edit · Tap to complete" : "Tap to complete →"}
                  </Text>
                ) : null}
              </View>
              {item.notes ? (
                <Text style={styles.itemNotes} numberOfLines={1}>{item.notes}</Text>
              ) : null}
            </Pressable>

            {/* Delete button only for to-do items */}
            {isOwner && !item.completed && (
              <Pressable onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>×</Text>
              </Pressable>
            )}
          </View>
        ))
      )}
    </View>
  );

  return (
    <>
      <View style={styles.container}>
        {/* Always-visible top bar: back · title · edit */}
        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>{coll.name}</Text>
          {isOwner ? (
            <Pressable style={styles.menuBtn} onPress={() => setMenuOpen(true)}>
              <Text style={styles.menuBtnText}>···</Text>
            </Pressable>
          ) : (
            <View style={styles.editBtnSpacer} />
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero image */}
          <View style={[styles.header, { height: HEADER_HEIGHT }]}>
            <CollectionCover coverPhoto={coll.coverPhoto} size={SCREEN_WIDTH} name={coll.name} />
          </View>

          {/* Meta: name, description, counts */}
          <View style={styles.headerMeta}>
            {coll.isPrivate && <Text style={styles.privateLbl}>Private</Text>}
            <Text style={styles.headerName}>{coll.name}</Text>
            {coll.description ? (
              <Text style={styles.descText}>{coll.description}</Text>
            ) : null}
            <Text style={styles.metaText}>
              {total === 0
                ? "No items yet"
                : done > 0
                ? `${total} saved · ${done} completed`
                : `${total} saved`}
            </Text>
          </View>

          {/* Tab row — sits naturally between meta and content */}
          <View style={styles.subTabs}>
            {(["ideas", "memories"] as SubTab[]).map((tab) => (
              <Pressable
                key={tab}
                style={[styles.subTab, subTab === tab && styles.subTabActive]}
                onPress={() => switchSubTab(tab)}
              >
                <Text
                  style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}
                  numberOfLines={1}
                >
                  {tab === "ideas" ? "Ideas" : "Memories"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Horizontal pager — swipe between tabs */}
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setSubTab(page === 0 ? "ideas" : "memories");
            }}
          >
            <View style={{ width: SCREEN_WIDTH, minHeight: SCREEN_HEIGHT * 0.7 }}>
              {isOwner && (
                <View style={styles.addIdeaRow}>
                  <Pressable style={styles.addIdeaBtn} onPress={() => setAddIdeaOpen(true)}>
                    <Text style={styles.addIdeaBtnText}>+</Text>
                  </Pressable>
                </View>
              )}
              {renderPage(items, "No items yet.", false)}
            </View>
            <View style={{ width: SCREEN_WIDTH, minHeight: SCREEN_HEIGHT * 0.7 }}>
              {renderPage(completedItems, "Nothing completed yet. Go do something!", true)}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      {/* ── (···) menu ───────────────────────────────────────────────────── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <View style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Pressable
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); openEditSheet(); }}
            >
              <Text style={styles.menuItemText}>Edit Collection</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={handleDeleteCollection}>
              <Text style={[styles.menuItemText, styles.menuItemDestructive]}>Delete Collection</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Add idea sheet ────────────────────────────────────────────────── */}
      <Modal
        visible={addIdeaOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddIdeaOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setAddIdeaOpen(false); }}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add an idea</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="What do you want to do?"
              placeholderTextColor={C.inputPlaceholder}
              value={newIdeaTitle}
              onChangeText={setNewIdeaTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addIdea}
            />
            <Pressable
              style={[styles.sheetBtn, (!newIdeaTitle.trim() || savingIdea) && styles.sheetBtnOff]}
              onPress={addIdea}
              disabled={!newIdeaTitle.trim() || savingIdea}
            >
              <Text style={styles.sheetBtnText}>{savingIdea ? "Saving…" : "Save"}</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setAddIdeaOpen(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit collection sheet ─────────────────────────────────────────── */}
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
              returnKeyType="next"
            />

            <TextInput
              style={[styles.sheetInput, { marginTop: -6 }]}
              placeholder="Description (optional)"
              placeholderTextColor={C.inputPlaceholder}
              value={editDesc}
              onChangeText={setEditDesc}
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />

            {/* Cover photo */}
            <Pressable style={styles.coverRow} onPress={pickCoverPhoto} disabled={uploadingCover}>
              {coll.coverPhoto ? (
                <Image source={{ uri: coll.coverPhoto }} style={styles.coverThumb} />
              ) : (
                <View style={styles.coverThumbEmpty} />
              )}
              <Text style={styles.coverRowLabel}>
                {uploadingCover ? "Uploading…" : coll.coverPhoto ? "Change cover photo" : "Add cover photo"}
              </Text>
            </Pressable>

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
              style={[styles.sheetBtn, (saving || uploadingCover) && styles.sheetBtnOff]}
              onPress={saveEdit}
              disabled={saving || uploadingCover}
            >
              <Text style={styles.sheetBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>

            <Pressable style={styles.sheetCancel} onPress={() => setEditSheetOpen(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit item sheet ───────────────────────────────────────────────── */}
      <Modal
        visible={editItemOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditItemOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setEditItemOpen(false); }}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit item</Text>

            <TextInput
              style={styles.sheetInput}
              placeholder="Title"
              placeholderTextColor={C.inputPlaceholder}
              value={editItemTitle}
              onChangeText={setEditItemTitle}
              autoFocus
              returnKeyType="next"
            />

            <TextInput
              style={[styles.sheetInput, { marginTop: -6 }]}
              placeholder="Category"
              placeholderTextColor={C.inputPlaceholder}
              value={editItemCategory}
              onChangeText={setEditItemCategory}
              returnKeyType="next"
            />

            <TextInput
              style={[styles.sheetInput, styles.notesInput, { marginTop: -6 }]}
              placeholder="Notes (optional)"
              placeholderTextColor={C.inputPlaceholder}
              value={editItemNotes}
              onChangeText={setEditItemNotes}
              multiline
              returnKeyType="done"
            />

            <View style={styles.privateRow}>
              <Text style={styles.privateLabel}>Keep this item private</Text>
              <Switch
                value={editItemPrivate}
                onValueChange={setEditItemPrivate}
                trackColor={{ false: C.border, true: C.text }}
                thumbColor={C.background}
              />
            </View>

            <Pressable
              style={[styles.sheetBtn, savingItem && styles.sheetBtnOff]}
              onPress={saveEditItem}
              disabled={savingItem}
            >
              <Text style={styles.sheetBtnText}>{savingItem ? "Saving…" : "Save"}</Text>
            </Pressable>

            <Pressable style={styles.sheetCancel} onPress={() => setEditItemOpen(false)}>
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
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.background },
    dimText: { color: C.textTertiary, fontSize: 16 },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 56,
      paddingBottom: 10,
      paddingHorizontal: 18,
      backgroundColor: C.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    topBarTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: C.text,
      textAlign: "center",
      marginHorizontal: 8,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    backBtnText: { color: C.text, fontSize: 28, fontWeight: "700", lineHeight: 32, marginTop: -2 },
    menuBtn: {
      width: 44,
      alignItems: "flex-end",
      justifyContent: "center",
      paddingRight: 2,
    },
    menuBtnText: { fontSize: 20, fontWeight: "700", color: C.text, letterSpacing: 1 },
    editBtnSpacer: { width: 44 },

    menuItem: { paddingVertical: 16, paddingHorizontal: 4 },
    menuItemText: { fontSize: 17, fontWeight: "600", color: C.text },
    menuItemDestructive: { color: "#E53935" },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },

    addIdeaRow: { alignItems: "flex-start", paddingVertical: 14, paddingHorizontal: 16 },
    addIdeaBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
    },
    addIdeaBtnText: { fontSize: 24, fontWeight: "300", color: C.text, lineHeight: 28, marginTop: -1 },
    header: { width: "100%", overflow: "hidden" },

    headerMeta: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
    privateLbl: {
      fontSize: 11,
      fontWeight: "800",
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6,
    },
    headerName: { fontSize: 30, fontWeight: "900", color: C.text, lineHeight: 36 },
    descText: {
      fontSize: 14,
      color: C.textSecondary,
      marginTop: 6,
      lineHeight: 20,
    },
    metaText: { fontSize: 13, fontWeight: "500", color: C.textTertiary, marginTop: 6 },

    subTabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    subTab: { flex: 1, paddingVertical: 13, alignItems: "center" },
    subTabActive: { borderBottomWidth: 2, borderBottomColor: C.text },
    subTabText: { fontSize: 12, fontWeight: "700", color: C.textTertiary },
    subTabTextActive: { color: C.text },

    pageContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
    grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -16 },
    emptyText: {
      color: C.textTertiary,
      textAlign: "center",
      marginTop: 40,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 24,
    },

    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.divider,
    },
    itemThumb: { width: 64, height: 64, borderRadius: 12, resizeMode: "cover" },
    itemThumbFallback: { width: 64, height: 64, borderRadius: 12, backgroundColor: C.surface },
    itemInfo: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: "700", color: C.text, lineHeight: 20 },
    itemMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
    itemCat: { fontSize: 12, fontWeight: "500", color: C.textTertiary },
    doneBadge: { fontSize: 12, color: C.accent, fontWeight: "800" },
    tapHint: { fontSize: 12, color: C.textTertiary, fontWeight: "600" },
    itemNotes: { fontSize: 12, color: C.textTertiary, marginTop: 4, fontStyle: "italic" },
    deleteBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    deleteBtnText: { fontSize: 24, color: C.border, fontWeight: "300", lineHeight: 28 },

    // Sheets
    overlay: { flex: 1, backgroundColor: C.overlay },
    sheetWrapper: { position: "absolute", bottom: 0, left: 0, right: 0 },
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
    sheetTitle: { fontSize: 22, fontWeight: "800", marginBottom: 18, color: C.text },
    sheetInput: {
      backgroundColor: C.inputBackground,
      padding: 15,
      borderRadius: 14,
      fontSize: 16,
      marginBottom: 16,
      color: C.text,
    },
    notesInput: { minHeight: 80, textAlignVertical: "top" },

    coverRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    coverThumb: {
      width: 48,
      height: 48,
      borderRadius: 10,
      resizeMode: "cover",
    },
    coverThumbEmpty: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    coverRowLabel: { fontSize: 15, fontWeight: "600", color: C.textSecondary },

    privateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
      paddingHorizontal: 2,
    },
    privateLabel: { fontSize: 15, fontWeight: "600", color: C.text },

    sheetBtn: {
      backgroundColor: C.buttonPrimary,
      padding: 16,
      borderRadius: 18,
      alignItems: "center",
    },
    sheetBtnOff: { backgroundColor: C.disabled },
    sheetBtnText: { color: C.buttonPrimaryText, fontWeight: "800", fontSize: 16 },
    sheetCancel: { alignItems: "center", marginTop: 14 },
    sheetCancelText: { color: C.textSecondary, fontWeight: "700", fontSize: 15 },
  });
}
