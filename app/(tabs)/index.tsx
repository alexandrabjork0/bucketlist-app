import { router, useFocusEffect } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import CollectionPickerSheet from "../../components/CollectionPickerSheet";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import { ThemeColors, useTheme } from "../../lib/theme";

const { width: SW } = Dimensions.get("window");
const TILE_W = 150;
const TILE_H = 205;
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

// ── Trending / recommended experience tile ───────────────────────────────────

function ExperienceTile({ exp, onPress }: { exp: any; onPress: () => void }) {
  const C = useTheme();
  return (
    <Pressable style={tt.card} onPress={onPress}>
      <View style={[tt.imageWrapper, { backgroundColor: C.surfaceElevated }]}>
        {exp.heroImageUrl ? (
          <Image source={{ uri: exp.heroImageUrl }} style={tt.image} resizeMode="cover" />
        ) : (
          <View style={tt.image} />
        )}
      </View>
      <View style={tt.meta}>
        <Text style={[tt.cat, { color: C.textTertiary }]}>{exp.category}</Text>
        <Text style={[tt.title, { color: C.text }]} numberOfLines={2}>{exp.title}</Text>
        {(exp.savesCount > 0 || exp.completionsCount > 0) && (
          <Text style={[tt.saves, { color: C.textTertiary }]}>
            {exp.savesCount > 0 ? `${exp.savesCount} saved` : `${exp.completionsCount} completed`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const tt = StyleSheet.create({
  card: {
    width: TILE_W,
    marginRight: 10,
  },
  imageWrapper: {
    width: TILE_W,
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  meta: {
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  cat: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  saves: {
    fontSize: 11,
    marginTop: 3,
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
    marginRight: 12,
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

// ── Compact activity card (friends' completions) ─────────────────────────────

function ActivityCard({
  post,
  author,
  isSaved,
  youHaveThisSaved,
  onSave,
}: {
  post: any;
  author: any;
  isSaved: boolean;
  youHaveThisSaved: boolean;
  onSave?: () => void;
}) {
  const C = useTheme();
  const imageUrl = post.imageUrl || post.media?.[0]?.url;

  const shortDate = () => {
    if (!post.completedAt?.seconds) return "";
    const d = new Date(post.completedAt.seconds * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Pressable
      style={[ac.card, { borderBottomColor: C.divider }]}
      onPress={() =>
        router.push({ pathname: "/user/[id]", params: { id: author.userId } })
      }
    >
      <View style={ac.left}>
        <View style={ac.nameRow}>
          {author.profileImage ? (
            <Image source={{ uri: author.profileImage }} style={ac.avatar} />
          ) : (
            <View style={[ac.avatarFallback, { backgroundColor: C.avatarBg }]}>
              <Text style={ac.avatarText}>
                {author.username?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <Text style={[ac.username, { color: C.textSecondary }]} numberOfLines={1}>@{author.username || "user"}</Text>
        </View>
        <Text style={[ac.title, { color: C.text }]} numberOfLines={2}>{post.title}</Text>
        <Text style={[ac.meta, { color: C.textTertiary }]}>
          {[post.category, shortDate()].filter(Boolean).join(" · ")}
        </Text>
        {youHaveThisSaved && (
          <Text style={[ac.savedNote, { color: C.accent }]}>You have this saved too ✓</Text>
        )}
        {onSave && (
          <Pressable style={[ac.saveBtn, { backgroundColor: C.buttonPrimary }]} onPress={onSave}>
            <Text style={[ac.saveBtnText, { color: C.buttonPrimaryText }]}>+ Save</Text>
          </Pressable>
        )}
        {!onSave && isSaved && (
          <Text style={[ac.savedPill, { color: C.textTertiary }]}>Saved ✓</Text>
        )}
      </View>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={ac.thumb} resizeMode="cover" />
      ) : (
        <View style={[ac.thumb, { backgroundColor: C.surfaceElevated }]} />
      )}
    </Pressable>
  );
}

const ac = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
  },
  username: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    fontWeight: "500",
  },
  savedNote: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  saveBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  savedPill: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    flexShrink: 0,
  },
});

// ── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeHomeStyles(C), [C]);

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const didLoadRef = useRef(false);

  // Content sections
  const [unreadCount, setUnreadCount] = useState(0);
  const [myCollections, setMyCollections] = useState<any[]>([]);
  const [friendsPosts, setFriendsPosts] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [friendsCollections, setFriendsCollections] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [topCategory, setTopCategory] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [savedTitles, setSavedTitles] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followedSuggestions, setFollowedSuggestions] = useState<Set<string>>(new Set());

  // Save picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingPost, setPendingPost] = useState<any | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      const uid = auth.currentUser?.uid;
      if (uid && didLoadRef.current) loadHome(uid);
    }, [])
  );

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadHome = async (uid: string) => {
    didLoadRef.current = true;

    // ── Phase 1: independent queries ──────────────────────────────────────
    const [followsSnap, myCollSnap, myItemsSnap, trendingSnap] =
      await Promise.all([
        getDocs(query(collection(db, "follows"), where("followerId", "==", uid))),
        getDocs(query(collection(db, "collections"), where("userId", "==", uid))),
        getDocs(query(collection(db, "userBucketlistItems"), where("userId", "==", uid))),
        getDocs(
          query(collection(db, "experiences"), orderBy("savesCount", "desc"), limit(8))
        ),
      ]);

    // Following
    const fIds = followsSnap.docs.map((d) => d.data().followingId as string);
    setFollowingIds(fIds);

    // My collections
    setMyCollections(
      myCollSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
    );

    // My items — category analysis + "you saved this"
    const myItems = myItemsSnap.docs.map((d) => d.data() as any);
    setSavedTitles(new Set(myItems.map((i: any) => i.title)));
    const catCount: Record<string, number> = {};
    myItems.forEach((i: any) => {
      if (i.category) catCount[i.category] = (catCount[i.category] || 0) + 1;
    });
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    setTopCategory(topCat);

    // Trending
    setTrending(trendingSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

    // ── Phase 2: queries that depend on fIds / topCat ──────────────────────
    const phase2: Promise<void>[] = [];

    // Friends' recent posts
    if (fIds.length > 0) {
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
            .slice(0, 5);

          const withAuthors = await Promise.all(
            raw.map(async (post: any) => {
              const uSnap = await getDoc(doc(db, "users", post.userId));
              return {
                ...post,
                author: uSnap.exists()
                  ? { userId: post.userId, ...uSnap.data() }
                  : { userId: post.userId },
              };
            })
          );
          setFriendsPosts(withAuthors);
        })
      );

      // Friends' public collections
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

          const withOwners = await Promise.all(
            pub.map(async (coll: any) => {
              const ownerSnap = await getDoc(doc(db, "users", coll.userId));
              return {
                ...coll,
                ownerUsername: ownerSnap.exists() ? ownerSnap.data().username : "",
              };
            })
          );
          setFriendsCollections(withOwners);
        })
      );
    }

    // Recommended (based on top category)
    if (topCat) {
      phase2.push(
        getDocs(
          query(
            collection(db, "experiences"),
            where("category", "==", topCat),
            limit(10)
          )
        ).then((snap) => {
          const results = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .sort((a: any, b: any) => (b.savesCount || 0) - (a.savesCount || 0))
            .slice(0, 6);
          setRecommended(results);
        }).catch(() => {})
      );
    }

    // People suggestions — recently active users not yet followed
    phase2.push(
      getDocs(
        query(
          collection(db, "userBucketlistItems"),
          where("completed", "==", true),
          limit(40)
        )
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

  // ── Save to collection ────────────────────────────────────────────────────

  const handlePickerSelect = async (collectionId: string, collectionName: string) => {
    setPickerVisible(false);
    const post = pendingPost;
    setPendingPost(null);
    if (!auth.currentUser || !post) return;

    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
      collectionId,
      title: post.title,
      category: post.category,
      completed: false,
      imageUrl: null,
      caption: "",
      media: [],
      createdAt: serverTimestamp(),
      completedAt: null,
      fromPost: true,
      inspiredByPostId: post.id,
      inspiredByUserId: post.userId,
      experienceId: post.experienceId || null,
    });

    if (post.experienceId) {
      updateDoc(doc(db, "experiences", post.experienceId), {
        savesCount: increment(1),
      }).catch(() => {});
    }

    updateDoc(doc(db, "collections", collectionId), {
      itemCount: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    setSavedPostIds((prev) => new Set([...prev, post.id]));

    createNotification({
      recipientId: post.userId,
      type: "save",
      actorId: auth.currentUser.uid,
      postId: post.id,
    }).catch(() => {});
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
      await setDoc(ref, {
        followerId: uid,
        followingId: personId,
        createdAt: serverTimestamp(),
      });
      setFollowedSuggestions((prev) => new Set([...prev, personId]));
      createNotification({ recipientId: personId, type: "follow", actorId: uid }).catch(() => {});
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!authChecked) return null;

  const isNewUser = followingIds.length === 0 && myCollections.length === 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Home</Text>
          <Pressable
            style={styles.bellBtn}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color={C.text} />
            {unreadCount > 0 && <View style={styles.bellBadge} />}
          </Pressable>
        </View>

        {/* ── My collections strip ── */}
        {myCollections.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Your collections"
              onSeeAll={() => router.push("/profile")}
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
                  onPress={() =>
                    router.push({ pathname: "/collection/[id]", params: { id: coll.id } })
                  }
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Friends' collections ── */}
        {friendsCollections.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Friends' collections" />
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

        {/* ── Recommended for you ── */}
        {recommended.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={topCategory ? `Because you love ${topCategory}` : "Recommended for you"}
              onSeeAll={() => router.push("/explore")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {recommended.map((exp) => (
                <ExperienceTile
                  key={exp.id}
                  exp={exp}
                  onPress={() =>
                    router.push({ pathname: "/experience/[id]", params: { id: exp.id } })
                  }
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Trending this week ── */}
        {trending.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Trending this week"
              onSeeAll={() => router.push("/explore")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {trending.map((exp) => (
                <ExperienceTile
                  key={exp.id}
                  exp={exp}
                  onPress={() =>
                    router.push({ pathname: "/experience/[id]", params: { id: exp.id } })
                  }
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── People to discover ── */}
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

        {/* ── Friends' activity ── */}
        {friendsPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Friends' activity" subtle />
            {friendsPosts.map((post) => {
              const isOwnPost = post.userId === user?.uid;
              const isSaved = savedPostIds.has(post.id);
              const youHaveThisSaved = !isOwnPost && savedTitles.has(post.title);
              return (
                <ActivityCard
                  key={post.id}
                  post={post}
                  author={post.author}
                  isSaved={!isOwnPost && isSaved}
                  youHaveThisSaved={youHaveThisSaved}
                  onSave={
                    !isOwnPost && !isSaved
                      ? () => { setPendingPost(post); setPickerVisible(true); }
                      : undefined
                  }
                />
              );
            })}
          </View>
        )}

        {/* ── Empty / new-user state ── */}
        {isNewUser && trending.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your feed is ready.</Text>
            <Text style={styles.emptySub}>
              Follow people and save experiences to build your personalised Home.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push("/explore")}
            >
              <Text style={styles.emptyBtnText}>Explore experiences →</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <CollectionPickerSheet
        visible={pickerVisible}
        onClose={() => { setPickerVisible(false); setPendingPost(null); }}
        onSelect={handlePickerSelect}
      />
    </>
  );
}

function makeHomeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    content: {
      paddingTop: 0,
      paddingBottom: 20,
    },

    // Top bar
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

    // Sections
    section: {
      marginBottom: 32,
    },
    hScroll: {
      paddingHorizontal: 18,
      paddingBottom: 4,
    },

    // Empty state
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
