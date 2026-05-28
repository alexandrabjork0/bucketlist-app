import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { auth, db } from "../lib/firebaseConfig";
import CollectionCover from "./CollectionCover";

interface CollectionRow {
  id: string;
  name: string;
  coverImages?: string[];
  itemCount?: number;
  itemIds?: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (collectionId: string, collectionName: string) => void;
  savedCollectionIds?: string[];
}

export default function CollectionPickerSheet({
  visible,
  onClose,
  onSelect,
  savedCollectionIds = [],
}: Props) {
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCollections();
      setShowNew(false);
      setNewName("");
    }
  }, [visible]);

  const loadCollections = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "collections"), where("userId", "==", auth.currentUser.uid))
      );
      setCollections(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CollectionRow)));
    } finally {
      setLoading(false);
    }
  };

  const createAndSelect = async () => {
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
      onSelect(ref.id, newName.trim());
    } finally {
      setCreating(false);
    }
  };

  const THUMB = 52;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Save to a collection</Text>

          {showNew ? (
            <View style={styles.newRow}>
              <TextInput
                style={styles.newInput}
                placeholder="e.g. Japan 2027, Dream Honeymoon…"
                placeholderTextColor="#aaa"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createAndSelect}
              />
              <Pressable
                style={[styles.createBtn, (!newName.trim() || creating) && styles.createBtnOff]}
                onPress={createAndSelect}
                disabled={!newName.trim() || creating}
              >
                <Text style={styles.createBtnText}>{creating ? "…" : "Create"}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.newCollRow} onPress={() => setShowNew(true)}>
              <View style={styles.newIcon}>
                <Text style={styles.newIconText}>＋</Text>
              </View>
              <Text style={styles.newCollText}>New collection</Text>
            </Pressable>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : collections.length === 0 ? (
            <Text style={styles.empty}>No collections yet — create one above.</Text>
          ) : (
            <FlatList
              data={collections}
              keyExtractor={(c) => c.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const already = savedCollectionIds.includes(item.id);
                const total = item.itemCount ?? (item.itemIds?.length ?? 0);
                return (
                  <Pressable
                    style={[styles.row, already && styles.rowDim]}
                    onPress={() => !already && onSelect(item.id, item.name)}
                    disabled={already}
                  >
                    <View style={[styles.thumb, { width: THUMB, height: THUMB }]}>
                      <CollectionCover images={item.coverImages ?? []} size={THUMB} name={item.name} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowCount}>
                        {total} {total === 1 ? "idea" : "ideas"}
                      </Text>
                    </View>
                    <Text style={[styles.check, already && styles.checkDone]}>
                      {already ? "✓" : "+"}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 14,
    maxHeight: "82%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16,
  },
  newCollRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 4,
  },
  newIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  newIconText: {
    fontSize: 24,
    fontWeight: "300",
    color: "#555",
  },
  newCollText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  newRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  newInput: {
    flex: 1,
    backgroundColor: "#F4F4F4",
    padding: 13,
    borderRadius: 12,
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
  },
  createBtnOff: {
    backgroundColor: "#ccc",
  },
  createBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  list: {
    flexGrow: 0,
    maxHeight: 340,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f8f8",
  },
  rowDim: {
    opacity: 0.45,
  },
  thumb: {
    borderRadius: 10,
    overflow: "hidden",
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  rowCount: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
    fontWeight: "600",
  },
  check: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    width: 28,
    textAlign: "center",
  },
  checkDone: {
    color: "#2ecc71",
    fontSize: 18,
  },
  empty: {
    color: "#999",
    textAlign: "center",
    marginVertical: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  cancel: {
    alignItems: "center",
    marginTop: 16,
  },
  cancelText: {
    color: "#777",
    fontWeight: "700",
    fontSize: 15,
  },
});
