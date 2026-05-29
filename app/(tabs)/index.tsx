import { router } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CollectionCard from "../../components/CollectionCard";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import { ThemeColors, useTheme } from "../../lib/theme";

const { width: SW } = Dimensions.get("window");
const TILE_W = Math.round(SW * 0.42);
const TILE_H = Math.round(TILE_W * 1.42);
const COLL_W = 160;
const PERSON_W = 110;

// ── Section header ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  onSeeAll,
  subtle,
}: {
  title: string;
  onSeeAll?: () => void;
  subtle?: boolean;
}) {
  const C = useTheme();
  return (
    <View style={sh.row}>
      <Text style={[sh.title, { color: subtle ? C.textTertiary : C.text }, subtle && sh.subtleTitle]}>
        {title}
      </Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={[sh.link, { color: C.textSecondary }]}>See all →</Text>
        </Pressable>
      )}
    </View>
  );
}

const sh = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
  },
  subtleTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  link: {
    fontSize: 13,
    fontWeight: "700",
  },
});

// ── Activity tile (friends' completed posts) ─────────────────────────────────

function ActivityTile({ post, author }: { post: any; author: any }) {
  const C = useTheme();
  const imageUrl = post.imageUrl || post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url;

  const shortDate = () => {
    if (!post.completedAt?.seconds) return "";
    const diff = Date.now() - post.completedAt.seconds * 1000;
    if (diff < 86400000) return "Today";
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    const d = new Date(post.completedAt.seconds * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <View style={at.card}>
      <View style={[at.imageWrapper, { backgroundColor: C.surfaceElevated }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={at.image} resizeMode="cover" />
        ) : (
          <View style={[at.imageFallback, { backgroundColor: C.surface }]}>
            <Text style={[at.fallbackText, { color: C.textTertiary }]}>
              {post.category?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
      </View>
      <View style={at.meta}>
        <View style={at.authorRow}>
          {author?.profileImage ? (
            <Image source={{ uri: author.profileImage }} style={at.avatar} />
          ) : (
            <View style={[at.avatarFallback, { backgroundColor: C.avatarBg }]}>
              <Text style={at.avatarInitial}>
                {author?.username?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <Text style={[at.username, { color: C.textSecondary }]} numberOfLines={1}>
            @{author?.username || "user"}
          </Text>
        </View>
        <Text style={[at.title, { color: C.text }]} numberOfLines={2}>{post.title}</Text>
        <Text style={[at.date, { color: C.textTertiary }]}>{shortDate()}</Text>
      </View>
    </View>
  );
}

const at = StyleSheet.create({
  card: {
    width: TILE_W,
  },
  imageWrapper: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 18,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontSize: 32,
    fontWeight: "800",
  },
  meta: {
    paddingTop: 8,
    paddingHorizontal: 2,
    gap: 2,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
  },
  avatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  avatarFallback: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 8,
    fontWeight: "800",
    color: "#fff",
  },
  username: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  date: {
    fontSize: 11,
    marginTop: 2,
  },
});

// ── Person suggestion card ───────────────────────────────────────────────────

function PersonCard({
  person,
  isFollowing,
  onFollow,
}: {
  person: any;
  isFollowing: boolean;
  onFollow: () => void;
}) {
  const C = useTheme();
  return (
    <Pressable
      style={pc.card}
      onPress={() => router.push({ pathname: "/user/[id]", params: { id: person.id } })}
    >
      <View style={[pc.avatar, { backgroundColor: C.avatarBg }]}>
        {person.profileImage ? (
          <Image source={{ uri: person.profileImage }} style={pc.avatarImg} />
        ) : (
          <Text style={pc.avatarText}>
            {person.username?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        )}
      </View>
      <Text style={[pc.username, { color: C.text }]} numberOfLines={1}>@{person.username || "user"}</Text>
      <Pressable
        style={[pc.followBtn, { backgroundColor: C.buttonPrimary }, isFollowing && { backgroundColor: "transparent", borderWidth: 1, borderColor: C.border }]}
        onPress={(e) => { e.stopPropagation?.(); onFollow(); }}
      >
        <Text style={[pc.followText, { color: C.buttonPrimaryText }, isFollowing && { color: C.textSecondary }]}>
          {isFollowing ? "Following" : "Follow"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const pc = StyleSheet.create({
  card: {
    width: PERSON_W,
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  username: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  followBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  followText: {
    fontSize: 11,
    fontWeight: "800",
  },
});

// ── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ isFocused }: { isFocused: boolean }) {
  const C = useTheme();
  const styles = useMemo(() => makeHomeStyles(C), [C]);

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const didLoadRef = useRef(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [myCollections, setMyCollections] = useState<any[]>([]);
  const [friendsPosts, setFriendsPosts] = useState<any[]>([]);
  const [friendsCollections, setFriendsCollections] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followedSuggestions, setFollowedSuggestions] = useState<Set<string>>(new Set());

  // ── Auth ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      if (!u) router.replace("/login");
    });
    return unsub;
  }, []);

  // ── Unread notification count ─────────────────────────────────────────────

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        where("read", "==", false)
      ),
      (snap) => setUnreadCount(snap.size)
    );
    return unsub;
  }, [user?.uid]);

  // ── Load on auth and on tab focus ────────────────────────────────────────

  useEffect(() => {
    if (user?.uid) {
      didLoadRef.current = false;
      loadHome(user.uid);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!isFocused) return;
    const uid = auth.currentUser?.uid;
    if (uid && didLoadRef.current) loadHome(uid);
  }, [isFocused]);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadHome = async (uid: string) => {
    didLoadRef.current = true;

    // Phase 1: independent queries
    const [followsSnap, ownedCollSnap, memberCollSnap] = await Promise.all([
      getDocs(query(collection(db, "follows"), where("followerId", "==", uid))),
      getDocs(query(collection(db, "collections"), where("userId", "==", uid))),
      getDocs(query(collection(db, "collections"), where("memberIds", "array-contains", uid))),
    ]);

    const fIds = followsSnap.docs.map((d) => d.data().followingId as string);
    setFollowingIds(fIds);

    // Build merged collections with member avatars
    const ownedRaw = ownedCollSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const memberRaw = memberCollSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const avatarIdsToFetch = [...new Set([
      ...ownedRaw.flatMap((c: any) => c.memberIds || []),
      ...memberRaw.map((c: any) => c.userId as string),
      ...memberRaw.flatMap((c: any) => c.memberIds || []),
    ])] as string[];

    const avatarMap = new Map<string, any>();
    if (avatarIdsToFetch.length > 0) {
      const docs = await Promise.all(avatarIdsToFetch.map((id) => getDoc(doc(db, "users", id))));
      docs.forEach((d) => { if (d.exists()) avatarMap.set(d.id, d.data()); });
    }

    const ownedColls = ownedRaw.map((c: any) => ({
      ...c,
      isShared: (c.memberIds || []).length > 0,
      memberAvatars: (c.memberIds || [])
        .map((mid: string) => avatarMap.get(mid)?.profileImage || null)
        .filter(Boolean)
        .slice(0, 3),
    }));

    const memberColls = memberRaw.map((c: any) => {
      const ownerData = avatarMap.get(c.userId);
      const memberAvatars = [
        ownerData?.profileImage,
        ...(c.memberIds || []).map((mid: string) => avatarMap.get(mid)?.profileImage || null),
      ].filter(Boolean).slice(0, 3);
      return {
        ...c,
        isShared: true,
        ownerUsername: ownerData?.username || "user",
        memberAvatars,
      };
    });

    setMyCollections(
      [...ownedColls, ...memberColls].sort(
        (a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)
      )
    );

    // Phase 2: queries that depend on fIds
    const phase2: Promise<void>[] = [];

    if (fIds.length > 0) {
      // Friends' activity
      phase2.push(
        getDocs(
          query(
            collection(db, "userBucketlistItems"),
            where("userId", "in", fIds.slice(0, 30)),
            where("completed", "==", true),
            limit(20)
          )
        ).then(async (snap) => {
          const raw = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((p: any) => p.imageUrl || p.media?.length > 0)
            .sort((a: any, b: any) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
            .slice(0, 15);

          // Deduplicated author fetches
          const uniqueAuthorIds = [...new Set(raw.map((p: any) => p.userId as string))];
          const authorDocs = await Promise.all(uniqueAuthorIds.map((id) => getDoc(doc(db, "users", id))));
          const authorMap = new Map(
            authorDocs.map((d) => [d.id, d.exists() ? { userId: d.id, ...d.data() } : { userId: d.id }])
          );
          setFriendsPosts(raw.map((post: any) => ({ ...post, author: authorMap.get(post.userId) })));
        })
      );

      // Friends' public collections (Friends' Lists)
      phase2.push(
        getDocs(
          query(
            collection(db, "collections"),
            where("userId", "in", fIds.slice(0, 30)),
            limit(20)
          )
        ).then(async (snap) => {
          const pub = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((c: any) => !c.isPrivate)
            .sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
            .slice(0, 6);

          const uniqueOwnerIds = [...new Set(pub.map((c: any) => c.userId as string))];
          const ownerDocs = await Promise.all(uniqueOwnerIds.map((id) => getDoc(doc(db, "users", id))));
          const ownerMap = new Map(ownerDocs.map((d) => [d.id, d.exists() ? d.data() : null]));

          setFriendsCollections(
            pub.map((coll: any) => ({
              ...coll,
              ownerUsername: ownerMap.get(coll.userId)?.username || "",
            }))
          );
        })
      );
    }

    // People to discover — active users not yet followed
    phase2.push(
      getDocs(
        query(collection(db, "userBucketlistItems"), where("completed", "==", true), limit(40))
      ).then(async (snap) => {
        const excluded = new Set([uid, ...fIds]);
        const seen = new Set<string>();
        const candidateIds: string[] = [];
        for (const d of snap.docs) {
          const userId = d.data().userId as string;
          if (!excluded.has(userId) && !seen.has(userId) && candidateIds.length < 8) {
            seen.add(userId);
            candidateIds.push(userId);
          }
        }
        const profiles = await Promise.all(
          candidateIds.map(async (personId) => {
            const pSnap = await getDoc(doc(db, "users", personId));
            return pSnap.exists() ? { id: personId, ...pSnap.data() } : null;
          })
        );
        setSuggestions(profiles.filter(Boolean) as any[]);
      }).catch(() => {})
    );

    await Promise.all(phase2);
  };

  // ── Follow a suggestion ───────────────────────────────────────────────────

  const followSuggestion = async (personId: string) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const ref = doc(db, "follows", `${uid}_${personId}`);

    if (followedSuggestions.has(personId)) {
      await deleteDoc(ref);
      setFollowedSuggestions((prev) => { const s = new Set(prev); s.delete(personId); return s; });
    } else {
      await setDoc(ref, { followerId: uid, followingId: personId, createdAt: serverTimestamp() });
      setFollowedSuggestions((prev) => new Set([...prev, personId]));
      createNotification({ recipientId: personId, type: "follow", actorId: uid }).catch(() => {});
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!authChecked) return null;

  const isNewUser = followingIds.length === 0 && myCollections.length === 0;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Home</Text>
        <Pressable style={styles.bellBtn} onPress={() => router.push("/notifications")}>
          <Ionicons name="notifications-outline" size={24} color={C.text} />
          {unreadCount > 0 && <View style={styles.bellBadge} />}
        </Pressable>
      </View>

      {/* ── 1. Collections ── */}
      {myCollections.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="My collections"
            onSeeAll={() => router.push("/my-collections")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {myCollections.map((coll) => (
              <CollectionCard
                key={coll.id}
                collection={coll}
                cardWidth={COLL_W}
                memberAvatars={coll.memberAvatars}
                ownerUsername={coll.ownerUsername}
                onPress={() =>
                  router.push({ pathname: "/collection/[id]", params: { id: coll.id } })
                }
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── 2. Friends' activity ── */}
      {friendsPosts.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Friends' activity" onSeeAll={() => router.push("/friends-activity")} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {friendsPosts.map((post) => (
              <ActivityTile key={post.id} post={post} author={post.author} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── 3. People to discover ── */}
      {suggestions.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="People to discover" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {suggestions.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                isFollowing={followedSuggestions.has(person.id)}
                onFollow={() => followSuggestion(person.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── 4. Friends' lists ── */}
      {friendsCollections.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Friends' collections" subtle onSeeAll={() => router.push("/friends-lists")} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {friendsCollections.map((coll) => (
              <CollectionCard
                key={coll.id}
                collection={coll}
                cardWidth={COLL_W}
                ownerUsername={coll.ownerUsername}
                onPress={() =>
                  router.push({ pathname: "/collection/[id]", params: { id: coll.id } })
                }
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Empty / new-user state ── */}
      {isNewUser && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your feed is ready.</Text>
          <Text style={styles.emptySub}>
            Follow people and save experiences to build your personalised Home.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/explore")}>
            <Text style={styles.emptyBtnText}>Explore experiences →</Text>
          </Pressable>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function makeHomeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      paddingBottom: 20,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingTop: 60,
      paddingBottom: 16,
      marginBottom: 4,
    },
    topBarTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: C.text,
    },
    bellBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    bellBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#ff3040",
    },
    section: {
      marginBottom: 32,
    },
    hScroll: {
      paddingHorizontal: 18,
      paddingBottom: 4,
      gap: 10,
    },
    emptyState: {
      marginTop: 60,
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: C.text,
      textAlign: "center",
    },
    emptySub: {
      marginTop: 10,
      fontSize: 15,
      color: C.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    emptyBtn: {
      marginTop: 24,
      backgroundColor: C.buttonPrimary,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 999,
    },
    emptyBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 15,
    },
  });
}
