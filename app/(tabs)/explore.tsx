import { router } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import { auth, db } from "../../lib/firebaseConfig";
import { migrateIdeasToExperiences } from "../../lib/migration";

type ExploreIdea = {
  id: string;
  title: string;
  category: string;
};

export default function ExploreScreen() {
  const [search, setSearch] = useState("");
  const [ideas, setIdeas] = useState<ExploreIdea[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "posts", title: "Posts" },
    { key: "ideas", title: "Ideas" },
    { key: "people", title: "People" },
  ]);

  useEffect(() => {
    fetchExploreData();
  }, []);

  const fetchExploreData = async () => {
    await Promise.all([fetchIdeas(), fetchPosts(), fetchPeople()]);
  };

  const fetchIdeas = async () => {
    const expSnap = await getDocs(query(collection(db, "experiences"), limit(1)));
    if (expSnap.empty) {
      await migrateIdeasToExperiences();
    }

    const snapshot = await getDocs(query(collection(db, "experiences")));

    const fetchedIdeas = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      title: docItem.data().title,
      category: docItem.data().category,
    }));

    setIdeas(shuffleArray(fetchedIdeas));
  };

  const fetchPeople = async () => {
    const snapshot = await getDocs(query(collection(db, "users"), limit(50)));

    const fetchedPeople = snapshot.docs
      .map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))
      .filter((person: any) => person.isPrivate !== true)
      .filter((person: any) => person.id !== auth.currentUser?.uid);

    setPeople(fetchedPeople);
  };

  const fetchPosts = async () => {
    const postsSnap = await getDocs(
      query(
        collection(db, "userBucketlistItems"),
        where("completed", "==", true)
      )
    );

    const rawPosts = postsSnap.docs
      .map((docItem) => ({ id: docItem.id, ...(docItem.data() as any) }))
      .filter((post: any) => post.imageUrl && post.userId);

    const withUsers = await Promise.all(
      rawPosts.map(async (post: any) => {
        const userSnap = await getDoc(doc(db, "users", post.userId));
        return {
          ...post,
          user: userSnap.exists() ? { id: post.userId, ...userSnap.data() } : null,
        };
      })
    );

    const fetchedPosts = withUsers
      .filter((post: any) => post.user?.isPrivate !== true)
      .sort((a: any, b: any) => {
        const aTime = a.completedAt?.seconds || 0;
        const bTime = b.completedAt?.seconds || 0;
        return bTime - aTime;
      });

    setPosts(fetchedPosts);
  };

  const shuffleArray = (array: ExploreIdea[]) => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const categories = [
    "All",
    ...Array.from(new Set(posts.map((post) => post.category || "Other"))).sort(),
  ];

  const filteredPosts = posts.filter((post) => {
    const matchesCategory =
      selectedCategory === "All" || post.category === selectedCategory;

    const matchesSearch =
      post.title?.toLowerCase().includes(search.toLowerCase()) ||
      post.category?.toLowerCase().includes(search.toLowerCase()) ||
      post.user?.username?.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const filteredIdeas = ideas.filter(
    (idea) =>
      idea.title.toLowerCase().includes(search.toLowerCase()) ||
      idea.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPeople = people.filter(
    (person) =>
      person.username?.toLowerCase().includes(search.toLowerCase()) ||
      person.bio?.toLowerCase().includes(search.toLowerCase())
  );

  const addToBucketlist = async (idea: ExploreIdea) => {
    if (!auth.currentUser) {
      Alert.alert("Not logged in", "You need to log in first.");
      return;
    }

    await addDoc(collection(db, "userBucketlistItems"), {
      userId: auth.currentUser.uid,
      title: idea.title,
      category: idea.category,
      completed: false,
      imageUrl: null,
      caption: "",
      media: [],
      createdAt: serverTimestamp(),
      completedAt: null,
      fromExplore: true,
      experienceId: idea.id,
    });

    updateDoc(doc(db, "experiences", idea.id), {
      savesCount: increment(1),
    }).catch(() => {});

    Alert.alert("Added", `${idea.title} was added to your bucketlist.`);
  };

  const goToUserProfile = (userId: string) => {
    if (userId === auth.currentUser?.uid) {
      router.push("/profile");
    } else {
      router.push({
        pathname: "/user/[id]",
        params: { id: userId },
      });
    }
  };

  const renderPosts = () => (
    <ScrollView style={styles.scene}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {categories.map((category) => (
          <Pressable
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive,
              ]}
            >
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {filteredPosts.map((post) => (
          <Pressable
            key={post.id}
            style={styles.postTile}
            onPress={() =>
              router.push({
                pathname: "/explore-post/[id]",
                params: { id: post.id },
              })
            }
          >
            <Image source={{ uri: post.imageUrl }} style={styles.postImage} />

            <View style={styles.postOverlay}>
              <Text style={styles.postCategory}>{post.category}</Text>
              <Text numberOfLines={2} style={styles.postTitle}>
                {post.title}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const renderIdeas = () => (
    <ScrollView style={styles.scene}>
      {filteredIdeas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} onAdd={addToBucketlist} />
      ))}
    </ScrollView>
  );

  const renderPeople = () => (
    <ScrollView style={styles.scene}>
      {filteredPeople.map((person) => (
        <Pressable
          key={person.id}
          style={styles.personCard}
          onPress={() => goToUserProfile(person.id)}
        >
          {person.profileImage ? (
            <Image source={{ uri: person.profileImage }} style={styles.personAvatar} />
          ) : (
            <View style={styles.personAvatarFallback}>
              <Text style={styles.personAvatarText}>
                {person.username?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}

          <View style={styles.personInfo}>
            <Text style={styles.personUsername}>@{person.username || "user"}</Text>
            <Text numberOfLines={2} style={styles.personBio}>
              {person.bio || "No bio yet."}
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderScene = ({ route }: any) => {
    switch (route.key) {
      case "posts":
        return renderPosts();
      case "ideas":
        return renderIdeas();
      case "people":
        return renderPeople();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.header}>
          <Text style={styles.title}>Explore</Text>

          <Pressable onPress={() => router.push("/add-idea")}>
            <Text style={styles.plus}>＋</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search posts, ideas, people..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={(newIndex) => {
          setIndex(newIndex);
          setSearch("");
          setSelectedCategory("All");
        }}
        initialLayout={{ width: Dimensions.get("window").width }}
        renderTabBar={(props: any) => (
          <TabBar
            {...props}
            indicatorStyle={styles.tabIndicator}
            style={styles.tabBar}
            activeColor="#111"
            inactiveColor="#777"
          />
        )}
      />
    </View>
  );
}

function IdeaCard({
  idea,
  onAdd,
}: {
  idea: ExploreIdea;
  onAdd: (idea: ExploreIdea) => void;
}) {
  return (
    <Pressable
      style={styles.ideaCard}
      onPress={() =>
        router.push({
          pathname: "/experience/[id]",
          params: { id: idea.id },
        })
      }
    >
      <View style={styles.cardText}>
        <Text style={styles.ideaTitle}>{idea.title}</Text>
        <Text style={styles.ideaCategory}>{idea.category}</Text>
      </View>

      <Pressable
        style={styles.addButton}
        onPress={(event) => {
          event.stopPropagation();
          onAdd(idea);
        }}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  top: {
    paddingTop: 70,
    paddingHorizontal: 18,
    backgroundColor: "#fff",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
  },

  plus: {
    fontSize: 32,
    fontWeight: "800",
  },

  searchInput: {
    marginTop: 16,
    backgroundColor: "#F4F4F4",
    padding: 14,
    borderRadius: 16,
    fontSize: 16,
  },

  tabBar: {
    backgroundColor: "#fff",
    elevation: 0,
    shadowOpacity: 0,
  },

  tabIndicator: {
    backgroundColor: "#111",
    height: 3,
    borderRadius: 999,
  },

  scene: {
    flex: 1,
    backgroundColor: "#fff",
  },

  categoryScroll: {
    paddingVertical: 12,
    paddingLeft: 10,
  },

  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#F4F4F4",
    borderRadius: 999,
    marginRight: 8,
  },

  categoryChipActive: {
    backgroundColor: "#111",
  },

  categoryChipText: {
    color: "#555",
    fontWeight: "700",
  },

  categoryChipTextActive: {
    color: "#fff",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 2,
  },

  postTile: {
    width: "33.33%",
    aspectRatio: 0.75,
    padding: 2,
  },

  postImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#eee",
  },

  postOverlay: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  postCategory: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  postTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  ideaCard: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: "#F4F4F4",
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardText: {
    flex: 1,
    paddingRight: 12,
  },

  ideaTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  ideaCategory: {
    marginTop: 4,
    color: "#777",
  },

  addButton: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },

  addButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  personCard: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: "#F4F4F4",
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  personAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },

  personAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  personAvatarText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
  },

  personInfo: {
    flex: 1,
    marginLeft: 12,
  },

  personUsername: {
    fontSize: 16,
    fontWeight: "800",
  },

  personBio: {
    marginTop: 4,
    color: "#777",
    lineHeight: 19,
  },

  arrow: {
    fontSize: 30,
    color: "#777",
  },
});