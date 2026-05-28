import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";
import CollectionCover from "./CollectionCover";

interface CollectionRow {
  id: string;
  name: string;
  coverImages?: string[];
  itemCount?: number;
}

export interface CollectionRef {
  id: string;
  name: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onDone: (toAdd: CollectionRef[], toRemove: string[]) => void;
  initiallySelected?: string[];
}

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 16;
const GAP = 10;
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP) / 2;
const CARD_H = CARD_W * 1.12;
const BASE_GRID_H = 360;

type ListItem = CollectionRow | "new";

export default function CollectionPickerSheet({
  visible,
  onClose,
  onDone,
  initiallySelected = [],
}: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { bottom: safeBottom } = useSafeAreaInsets();

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);

  const prevInitiallySelected = useRef<string[]>([]);

  // ── Keyboard listeners (iOS only — Android handles via adjustResize) ──────

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const handleShow = (e: KeyboardEvent) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardH(e.endCoordinates.height);
    };
    const handleHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardH(0);
    };

    const showSub = Keyboard.addListener("keyboardWillShow", handleShow);
    const hideSub = Keyboard.addListener("keyboardWillHide", handleHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Reset keyboard state when sheet closes
  useEffect(() => {
    if (!visible) setKeyboardH(0);
  }, [visible]);

  // ── Data loading & selection sync ─────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set(initiallySelected));
      prevInitiallySelected.current = initiallySelected;
      setShowNewInput(false);
      setNewName("");
      loadCollections();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const prev = prevInitiallySelected.current;
    if (
      initiallySelected.length !== prev.length ||
      initiallySelected.some((id, i) => id !== prev[i])
    ) {
      setSelectedIds(new Set(initiallySelected));
      prevInitiallySelected.current = initiallySelected;
    }
  }, [initiallySelected, visible]);

  const loadCollections = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "collections"),
          where("userId", "==", auth.currentUser.uid)
        )
      );
      setCollections(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as CollectionRow))
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const toggleCollection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createCollection = async () => {
    if (!auth.currentUser || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "collections"), {
        userId: auth.currentUser.uid,
        name: newName.trim(),
        isPrivate: false,
        coverImages: [],
        itemCount: 0,
        completedCount: 0,
        order: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const newRow: CollectionRow = {
        id: ref.id,
        name: newName.trim(),
        coverImages: [],
        itemCount: 0,
      };
      setCollections((prev) => [newRow, ...prev]);
      setSelectedIds((prev) => new Set([...prev, ref.id]));
      setShowNewInput(false);
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  const handleDone = () => {
    const initialSet = new Set(initiallySelected);
    const toAdd = [...selectedIds]
      .filter((id) => !initialSet.has(id))
      .map((id) => {
        const col = collections.find((c) => c.id === id);
        return { id, name: col?.name ?? "" };
      });
    const toRemove = initiallySelected.filter((id) => !selectedIds.has(id));
    onDone(toAdd, toRemove);
  };

  const hasChanges =
    [...selectedIds].some((id) => !new Set(initiallySelected).has(id)) ||
    initiallySelected.some((id) => !selectedIds.has(id));

  // ── Computed layout values ────────────────────────────────────────────────

  // Sheet stays at bottom: 0. When keyboard is up we push content above it
  // via paddingBottom, and shrink the grid to compensate.
  const sheetPadBottom = keyboardH > 0 ? keyboardH + 8 : safeBottom + 20;
  const gridMaxH = Math.max(80, BASE_GRID_H - keyboardH);

  // ── Render ────────────────────────────────────────────────────────────────

  const listData: ListItem[] = ["new", ...collections];

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item === "new") {
      return (
        <Pressable
          style={[styles.card, styles.newCard]}
          onPress={() => setShowNewInput(true)}
        >
          <Text style={styles.newPlus}>＋</Text>
          <Text style={styles.newLabel}>New collection</Text>
        </Pressable>
      );
    }

    const isSelected = selectedIds.has(item.id);
    const total = item.itemCount ?? 0;

    return (
      <Pressable style={styles.card} onPress={() => toggleCollection(item.id)}>
        <View style={styles.cardCover}>
          <CollectionCover
            images={item.coverImages ?? []}
            size={CARD_W}
            name={item.name}
          />
        </View>

        <View style={styles.cardOverlay}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardCount}>
            {total} {total === 1 ? "idea" : "ideas"}
          </Text>
        </View>

        {isSelected && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        )}
        {isSelected && <View style={styles.selectedRing} />}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Dimmed backdrop — tapping closes the sheet */}
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      {/* Sheet — anchored hard to the bottom, never moves */}
      <View style={styles.sheetAnchor}>
        <View style={[styles.sheet, { paddingBottom: sheetPadBottom }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Save to</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          {showNewInput && (
            <View style={styles.newInputRow}>
              <TextInput
                style={styles.newInput}
                placeholder="Collection name…"
                placeholderTextColor={C.inputPlaceholder}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createCollection}
              />
              <Pressable
                style={[
                  styles.createBtn,
                  (!newName.trim() || creating) && styles.createBtnOff,
                ]}
                onPress={createCollection}
                disabled={!newName.trim() || creating}
              >
                <Text style={styles.createBtnText}>
                  {creating ? "…" : "Create"}
                </Text>
              </Pressable>
            </View>
          )}

          {loading ? (
            <ActivityIndicator
              style={styles.loadingSpinner}
              color={C.textSecondary}
            />
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) =>
                typeof item === "string" ? "new" : item.id
              }
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.gridContent}
              style={[styles.grid, { maxHeight: gridMaxH }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={renderItem}
            />
          )}

          <Pressable style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>
              {hasChanges ? "Save changes" : "Done"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: C.overlay,
    },
    // Hard-anchored to the bottom of the screen — never moves
    sheetAnchor: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: H_PAD,
      paddingTop: 14,
      maxHeight: "88%",
      // paddingBottom is set dynamically (safeArea or keyboard)
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.handle,
      alignSelf: "center",
      marginBottom: 18,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    title: {
      fontSize: 22,
      fontWeight: "900",
      color: C.text,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    closeIcon: {
      fontSize: 12,
      fontWeight: "700",
      color: C.textSecondary,
    },
    newInputRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
      alignItems: "center",
    },
    newInput: {
      flex: 1,
      backgroundColor: C.inputBackground,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      fontSize: 15,
      color: C.text,
    },
    createBtn: {
      backgroundColor: C.buttonPrimary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
    },
    createBtnOff: {
      backgroundColor: C.disabled,
    },
    createBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 14,
    },
    loadingSpinner: {
      marginVertical: 48,
    },
    grid: {
      flexGrow: 0,
      // maxHeight is set dynamically
    },
    gridContent: {
      paddingBottom: 4,
    },
    columnWrapper: {
      gap: GAP,
      marginBottom: GAP,
    },
    card: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: C.surface,
    },
    cardCover: {
      position: "absolute",
      top: 0,
      left: 0,
      width: CARD_W,
      height: CARD_H,
    },
    cardOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 10,
      paddingVertical: 10,
      paddingTop: 20,
      backgroundColor: "rgba(0,0,0,0.58)",
    },
    cardName: {
      fontSize: 13,
      fontWeight: "800",
      color: "#fff",
    },
    cardCount: {
      fontSize: 11,
      fontWeight: "600",
      color: "rgba(255,255,255,0.6)",
      marginTop: 2,
    },
    checkBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    checkMark: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 13,
    },
    selectedRing: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 16,
      borderWidth: 2.5,
      borderColor: C.accent,
    },
    newCard: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: C.border,
      borderStyle: "dashed",
      gap: 6,
    },
    newPlus: {
      fontSize: 26,
      fontWeight: "300",
      color: C.textSecondary,
    },
    newLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: C.textSecondary,
    },
    doneBtn: {
      marginTop: 16,
      backgroundColor: C.buttonPrimary,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: "center",
    },
    doneBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 16,
    },
  });
}
