import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemeColors, useTheme } from "../lib/theme";
import CollectionCover from "./CollectionCover";

export interface CollectionData {
  id: string;
  name: string;
  isPrivate?: boolean;
  coverImages?: string[];
  itemCount?: number;
  completedCount?: number;
  itemIds?: string[]; // legacy field, kept for backward compat
}

interface Props {
  collection: CollectionData;
  cardWidth: number;
  onPress: () => void;
  onLongPress?: () => void;
  ownerUsername?: string;
}

export default function CollectionCard({ collection, cardWidth, onPress, onLongPress, ownerUsername }: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { name, isPrivate, coverImages = [], itemCount, completedCount = 0, itemIds } = collection;
  const total = itemCount ?? (itemIds?.length ?? 0);
  const progress = total > 0 ? completedCount / total : 0;
  const fillWidth = Math.round(progress * (cardWidth - 20));

  return (
    <Pressable
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={{ width: cardWidth, height: cardWidth, overflow: "hidden" }}>
        <CollectionCover images={coverImages} size={cardWidth} name={name} />
        {isPrivate && (
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        {ownerUsername && (
          <Text style={styles.owner} numberOfLines={1}>@{ownerUsername}</Text>
        )}
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {total > 0 ? (
          <>
            <Text style={styles.count}>{completedCount}/{total} completed</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: fillWidth }]} />
            </View>
          </>
        ) : (
          <Text style={styles.count}>No items yet</Text>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: C.surface,
    },
    lockBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: 999,
      width: 26,
      height: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    lockIcon: {
      fontSize: 12,
    },
    info: {
      padding: 10,
    },
    owner: {
      fontSize: 11,
      color: C.textTertiary,
      fontWeight: "600",
      marginBottom: 2,
    },
    name: {
      fontSize: 14,
      fontWeight: "800",
      color: C.text,
    },
    count: {
      fontSize: 12,
      color: C.textSecondary,
      marginTop: 2,
      fontWeight: "600",
    },
    track: {
      marginTop: 6,
      height: 3,
      backgroundColor: C.border,
      borderRadius: 2,
      overflow: "hidden",
    },
    fill: {
      height: 3,
      backgroundColor: C.buttonPrimary,
      borderRadius: 2,
    },
  });
}
