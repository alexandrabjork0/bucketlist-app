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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
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

const { width: SW } = Dimensions.get("window");
const TILE_W = 150;
const TILE_H = 205;
const COLL_W = 160;
const PERSON_W = 110;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

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
  return (
    <View style={sh.row}>
      <Text style={[sh.title, subtle && sh.subtleTitle]}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={sh.link}>See all →</Text>
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
    color: "#111",
  },
  subtleTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#bbb",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  link: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
  },
});

// ── Trending / recommended experience tile ───────────────────────────────────

function ExperienceTile({ exp, onPress }: { exp: any; onPress: () => void }) {
  return (
    <Pressable style={tt.card} onPress={onPress}>
      {exp.heroImageUrl ? (
        <Image source={{ uri: exp.heroImageUrl }} style={tt.image} resizeMode="cover" />
      ) : (
        <View style={[tt.image, tt.imageFallback]} />
      )}
      <View style={tt.gradient} />
      <View style={tt.content}>
        <Text style={tt.cat}>{exp.category}</Text>
        <Text style={tt.title} numberOfLines={2}>{exp.title}</Text>
        {(exp.savesCount > 0 || exp.completionsCount > 0) && (
          <Text style={tt.meta}>
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
    height: TILE_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#222",
    marginRight: 10,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    backgroundColor: "#333",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "65%",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  cat: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  meta: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
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
  return (
    <Pressable
      style={pc.card}
      onPress={() => router.push({ pathname: "/user/[id]", params: { id: person.id } })}
    >
      <View style={pc.avatar}>
        {person.profileImage ? (
          <Image source={{ uri: person.profileImage }} style={pc.avatarImg} />
        ) : (
          <Text style={pc.avatarText}>
            {person.username?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        )}
      </View>
      <Text style={pc.username} numberOfLines={1}>@{person.username || "user"}</Text>
      <Pressable
        style={[pc.followBtn, isFollowing && pc.followingBtn]}
        onPress={(e) => { e.stopPropagation?.(); onFollow(); }}
      >
        <Text style={[pc.followText, isFollowing && pc.followingText]}>
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
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  username: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
    marginBottom: 10,
  },
  followBtn: {
    backgroundColor: "#111",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  followingBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  followText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  followingText: {
    color: "#888",
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
  const imageUrl = post.imageUrl || post.media?.[0]?.url;

  const shortDate = () => {
    if (!post.completedAt?.seconds) return "";
    const d = new Date(post.completedAt.seconds * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Pressable
      style={ac.card}
      onPress={() =>
        router.push({ pathname: "/user/[id]", params: { id: author.userId } })
      }
    >
      <View style={ac.left}>
        <View style={ac.nameRow}>
          {author.profileImage ? (
            <Image source={{ uri: author.profileImage }} style={ac.avatar} />
          ) : (
            <View style={ac.avatarFallback}>
              <Text style={ac.avatarText}>
                {author.username?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <Text style={ac.username} numberOfLines={1}>@{author.username || "user"}</Text>
        </View>
        <Text style={ac.title} numberOfLines={2}>{post.title}</Text>
        <Text style={ac.meta}>
          {[post.category, shortDate()].filter(Boolean).join(" · ")}
        </Text>
        {youHaveThisSaved && (
          <Text style={ac.savedNote}>You have this saved too ✓</Text>
        )}
        {onSave && (
          <Pressable style={ac.saveBtn} onPress={onSave}>
            <Text style={ac.saveBtnText}>+ Save</Text>
          </Pressable>
        )}
        {!onSave && isSaved && (
          <Text style={ac.savedPill}>Saved ✓</Text>
        )}
      </View>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={ac.thumb} resizeMode="cover" />
      ) : (
        <View style={[ac.thumb, ac.thumbFallback]} />
      )}
    </Pressable>
  );
}

const ac = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 18,
    marginBottom: 10,
    gap: 12,
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
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  username: {
    fontSize: 12,
    fontWeight: "700",
    color: "#777",
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111",
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    color: "#aaa",
    fontWeight: "500",
  },
  savedNote: {
    fontSize: 11,
    color: "#16a34a",
    fontWeight: "600",
    marginTop: 2,
  },
  saveBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#111",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  savedPill: {
    fontSize: 12,
    fontWeight: "600",
    color: "#aaa",
    marginTop: 4,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    flexShrink: 0,
  },
  thumbFallback: {
    backgroundColor: "#E0E0E0",
  },
});

// ── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const didLoadRef = useRef(false);

  // Content sections
  const [username, setUsername] = useState("");
  const [completedThisYear, setCompletedThisYear] = useState(0);
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
    const [userSnap, followsSnap, myCollSnap, myItemsSnap, trendingSnap] =
      await Promise.all([
        getDoc(doc(db, "users", uid)),
        getDocs(query(collection(db, "follows"), where("followerId", "==", uid))),
        getDocs(query(collection(db, "collections"), where("userId", "==", uid))),
        getDocs(query(collection(db, "userBucketlistItems"), where("userId", "==", uid))),
        getDocs(
          query(collection(db, "experiences"), orderBy("savesCount", "desc"), limit(8))
        ),
      ]);

    // User profile
    if (userSnap.exists()) setUsername(userSnap.data().username || "");

    // Following
    const fIds = followsSnap.docs.map((d) => d.data().followingId as string);
    setFollowingIds(fIds);

    // My collections
    setMyCollections(
      myCollSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
    );

    // My items — drive category analysis + "you saved this" + yearly stat
    const myItems = myItemsSnap.docs.map((d) => d.data() as any);
    setSavedTitles(new Set(myItems.map((i: any) => i.title)));
    const thisYear = new Date().getFullYear();
    setCompletedThisYear(
      myItems.filter((i: any) => {
        if (!i.completed || !i.completedAt?.seconds) return false;
        return new Date(i.completedAt.seconds * 1000).getFullYear() === thisYear;
      }).length
    );
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
        {/* ── Greeting header ── */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {getGreeting()}{username ? `, ${username}` : ""}.
          </Text>
          {completedThisYear > 0 ? (
            <Text style={styles.subGreeting}>
              {completedThisYear} experience{completedThisYear !== 1 ? "s" : ""} completed this year. Keep going.
            </Text>
          ) : (
            <Text style={styles.subGreeting}>
              Start building the life you want.
            </Text>
          )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingTop: 72,
    paddingBottom: 20,
  },

  // Header
  header: {
    paddingHorizontal: 18,
    marginBottom: 28,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111",
    lineHeight: 32,
  },
  subGreeting: {
    marginTop: 6,
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
    lineHeight: 21,
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
    color: "#111",
    textAlign: "center",
  },
  emptySub: {
    marginTop: 10,
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: "#111",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});
