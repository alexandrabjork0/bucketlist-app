import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ThemeColors, useTheme } from "../lib/theme";

type Post = {
  id: string;
  title?: string;
  media?: Array<{ url: string; type: "image" | "video"; thumbnailUrl?: string }>;
  imageUrl?: string | null;
};

type Props = {
  post: Post;
  onPress: () => void;
};

export default function PostThumbnail({ post, onPress }: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const firstMedia = post.media?.[0];
  const isVideo = firstMedia?.type === "video";

  const thumbnailUri = isVideo
    ? firstMedia?.thumbnailUrl || post.imageUrl || null
    : firstMedia?.url || post.imageUrl || null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText} numberOfLines={2}>
            {post.title || ""}
          </Text>
        </View>
      )}

      {isVideo && (
        <View style={styles.videoBadge}>
          <Text style={styles.videoBadgeText}>▶</Text>
        </View>
      )}
    </Pressable>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: "33.3333%",
      aspectRatio: 3 / 4,
      backgroundColor: C.surfaceElevated,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: C.background,
    },
    image: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 8,
    },
    placeholderText: {
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
      color: C.textSecondary,
    },
    videoBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(0,0,0,0.55)",
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: "center",
      alignItems: "center",
    },
    videoBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "900",
    },
  });
}
