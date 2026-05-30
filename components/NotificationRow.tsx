import { router } from "expo-router";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ThemeColors, useTheme } from "../lib/theme";

type Props = { notification: any };

function getDisplayText(notification: any): string {
  const { type, actors = [], actorCount = 1, postTitle, previewText } = notification;
  const names = actors.map((a: any) => a.username || "Someone");

  let actorLabel = "";
  if (actorCount === 1) {
    actorLabel = names[0] || "Someone";
  } else if (actorCount === 2) {
    actorLabel = `${names[0]} and ${names[1] || "another"}`;
  } else if (actorCount === 3) {
    actorLabel = `${names[0]}, ${names[1]} and ${names[2] || "another"}`;
  } else {
    const others = actorCount - 2;
    actorLabel = `${names[0]}, ${names[1]} and ${others} others`;
  }

  const postLabel = postTitle ? ` your "${postTitle}"` : " your post";

  switch (type) {
    case "like":
      return `${actorLabel} liked${postLabel}`;
    case "comment": {
      const preview = notification.previewText
        ? `: "${notification.previewText.slice(0, 60)}"`
        : "";
      return `${actorLabel} commented on${postLabel}${preview}`;
    }
    case "follow":
      return `${actorLabel} followed you`;
    case "save":
      return `${actorLabel} saved${postLabel} to their bucketlist`;
    case "friend_completion":
      return postTitle
        ? `${actorLabel} just completed "${postTitle}"`
        : `${actorLabel} just completed something new`;
    case "milestone":
      return previewText || "You reached a milestone!";
    case "system":
      return previewText || "Welcome to Bucketlist!";
    case "collection_invite":
      return previewText
        ? `${actorLabel} invited you to join "${previewText}"`
        : `${actorLabel} invited you to a collection`;
    case "collection_invite_accepted":
      return previewText
        ? `${actorLabel} joined your "${previewText}" collection`
        : `${actorLabel} joined your collection`;
    default:
      return "New notification";
  }
}

function getRelativeTime(updatedAt: any): string {
  if (!updatedAt?.seconds) return "";
  const diff = Date.now() - updatedAt.seconds * 1000;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return `${Math.floor(diff / 604800000)}w`;
}

function getOnPress(notification: any): (() => void) | undefined {
  const { type, postId, collectionId, inviteId, actors } = notification;
  const actorId = actors?.[0]?.userId;

  switch (type) {
    case "like":
    case "comment":
    case "save":
    case "friend_completion":
      if (postId) return () => router.push({ pathname: "/explore-post/[id]", params: { id: postId } });
      return undefined;
    case "follow":
      if (actorId) return () => router.push({ pathname: "/user/[id]", params: { id: actorId } });
      return undefined;
    case "collection_invite":
      if (inviteId) return () => router.push({ pathname: "/collection-invite/[inviteId]", params: { inviteId } });
      return undefined;
    case "collection_invite_accepted":
      if (collectionId) return () => router.push({ pathname: "/collection/[id]", params: { id: collectionId } });
      return undefined;
    default:
      return undefined;
  }
}

export default function NotificationRow({ notification }: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const firstActor = notification.actors?.[0];
  const isUnread = notification.read === false;
  const onPress = getOnPress(notification);

  return (
    <Pressable
      style={[styles.row, isUnread && styles.unreadRow]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.avatarWrapper}>
        {isUnread && <View style={styles.unreadDot} />}
        {firstActor?.profileImage ? (
          <Image source={{ uri: firstActor.profileImage }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>
              {firstActor?.username?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.text}>{getDisplayText(notification)}</Text>
        <Text style={styles.time}>{getRelativeTime(notification.updatedAt)}</Text>
      </View>

      {notification.postImageUrl ? (
        <Image source={{ uri: notification.postImageUrl }} style={styles.thumbnail} />
      ) : null}
    </Pressable>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.divider,
    },
    unreadRow: {
      backgroundColor: C.surface,
    },
    avatarWrapper: {
      position: "relative",
      marginRight: 12,
    },
    unreadDot: {
      position: "absolute",
      top: 0,
      left: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: C.text,
      zIndex: 1,
      borderWidth: 2,
      borderColor: C.background,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontWeight: "700",
      fontSize: 16,
      color: C.text,
    },
    content: {
      flex: 1,
      paddingRight: 8,
    },
    text: {
      fontSize: 14,
      lineHeight: 20,
      color: C.text,
    },
    time: {
      fontSize: 12,
      color: C.textTertiary,
      marginTop: 3,
    },
    thumbnail: {
      width: 50,
      height: 50,
      borderRadius: 6,
      backgroundColor: C.surfaceElevated,
    },
  });
}
