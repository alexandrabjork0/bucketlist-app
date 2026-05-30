import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { auth } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";
import MediaCarousel from "./MediaCarousel";
import PostActions from "./PostActions";
import PostComments from "./PostComments";

type Post = {
  id: string;
  title: string;
  category?: string;
  caption?: string;
  completedAt?: any;
  media?: Array<{ url: string; type: "image" | "video" }>;
  imageUrl?: string | null;
};

type Author = {
  userId: string;
  username?: string;
  profileImage?: string | null;
};

type Props = {
  post: Post;
  author: Author;
  onSave?: () => void;
  savedCount?: number;
  onDelete?: () => void;
};

export default function PostCard({ post, author, onSave, savedCount = 0, onDelete }: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [commentOpen, setCommentOpen] = useState(false);

  const goToProfile = () => {
    if (author.userId === auth.currentUser?.uid) return;
    router.push({ pathname: "/user/[id]", params: { id: author.userId } });
  };

  const formatDate = () => {
    if (!post.completedAt?.seconds) return "";
    const date = new Date(post.completedAt.seconds * 1000);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const date = formatDate();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.headerLeft} onPress={goToProfile}>
          {author.profileImage ? (
            <Image source={{ uri: author.profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {author.username?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <Text style={styles.username}>@{author.username || "user"}</Text>
        </Pressable>

        {onDelete && (
          <Pressable onPress={onDelete} style={styles.menuButton}>
            <Text style={styles.menuText}>⋯</Text>
          </Pressable>
        )}
      </View>

      {post.category ? (
        <Text style={styles.category}>{post.category}</Text>
      ) : null}

      <MediaCarousel media={post.media} imageUrl={post.imageUrl} />

      <View style={styles.body}>
        <Text style={styles.title}>{post.title}</Text>

        <PostActions
            postId={post.id}
            authorId={author.userId}
            onCommentPress={() => setCommentOpen(true)}
            onSave={onSave}
            savedCount={savedCount}
          />

        {post.caption ? (
          <Text style={styles.caption}>
            <Text style={styles.captionUsername} onPress={goToProfile}>
              {author.username || "user"}{" "}
            </Text>
            {post.caption}
          </Text>
        ) : null}

        <PostComments
            postId={post.id}
            authorId={author.userId}
            expanded={commentOpen}
            onClose={() => setCommentOpen(false)}
          />

        {date ? <Text style={styles.date}>{date}</Text> : null}

      </View>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: 32,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 8,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    avatarFallback: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.avatarBg,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarInitial: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
    },
    username: {
      fontWeight: "800",
      fontSize: 15,
      color: C.text,
    },
    menuButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    menuText: {
      fontSize: 26,
      fontWeight: "900",
      color: C.text,
      lineHeight: 26,
    },
    category: {
      paddingHorizontal: 14,
      paddingBottom: 10,
      color: C.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    body: {
      padding: 14,
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: C.textSecondary,
      marginBottom: 4,
    },
    caption: {
      fontSize: 15,
      lineHeight: 21,
      marginTop: 4,
      color: C.text,
    },
    captionUsername: {
      fontWeight: "800",
      color: C.text,
    },
    date: {
      marginTop: 10,
      color: C.textTertiary,
      fontSize: 12,
      textTransform: "uppercase",
    },
  });
}
