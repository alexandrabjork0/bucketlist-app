import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CollectionCard from "../components/CollectionCard";
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

const { width: SW } = Dimensions.get("window");
const PADDING = 18;
const GAP = 12;
const CARD_W = (SW - PADDING * 2 - GAP) / 2;

export default function FriendsListsScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const followsSnap = await getDocs(
      query(collection(db, "follows"), where("followerId", "==", uid))
    );
    const fIds = followsSnap.docs.map((d) => d.data().followingId as string);
    if (fIds.length === 0) { setLoading(false); return; }

    const collSnap = await getDocs(
      query(
        collection(db, "collections"),
        where("userId", "in", fIds.slice(0, 30)),
        limit(40)
      )
    );

    const pub = collSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((c: any) => !c.isPrivate)
      .sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

    const uniqueOwnerIds = [...new Set(pub.map((c: any) => c.userId as string))];
    const ownerDocs = await Promise.all(
      uniqueOwnerIds.map((id) => getDoc(doc(db, "users", id)))
    );
    const ownerMap = new Map(ownerDocs.map((d) => [d.id, d.exists() ? d.data() : null]));

    setCollections(
      pub.map((coll: any) => ({
        ...coll,
        ownerUsername: ownerMap.get(coll.userId)?.username || "",
      }))
    );
    setLoading(false);
  };

  const rows: any[][] = [];
  for (let i = 0; i < collections.length; i += 2) {
    rows.push(collections.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Friends' lists</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((coll) => (
              <CollectionCard
                key={coll.id}
                collection={coll}
                cardWidth={CARD_W}
                ownerUsername={coll.ownerUsername}
                onPress={() =>
                  router.push({ pathname: "/collection/[id]", params: { id: coll.id } })
                }
              />
            ))}
          </View>
        ))}
        {!loading && collections.length === 0 && (
          <Text style={[styles.empty, { color: C.textTertiary }]}>
            No public collections from people you follow.
          </Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingTop: 60,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backBtn: { width: 60 },
    back: { fontSize: 16, fontWeight: "700", color: C.text },
    title: { fontSize: 18, fontWeight: "900", color: C.text },
    spacer: { width: 60 },
    grid: { padding: PADDING, gap: GAP },
    row: { flexDirection: "row", gap: GAP },
    empty: { marginTop: 60, textAlign: "center", fontSize: 15 },
  });
}
