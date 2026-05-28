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
      style={{ width: cardWidth }}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.imageWrapper}>
        <CollectionCover images={coverImages} size={cardWidth} name={name} />
        {isPrivate && (
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        {ownerUsername && (
          <Text style={[styles.owner, { color: C.textTertiary }]} numberOfLines={1}>
            @{ownerUsername}
          </Text>
        )}
        <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>{name}</Text>
        {total > 0 ? (
          <>
            <Text style={[styles.count, { color: C.textTertiary }]}>
              {completedCount}/{total} done
            </Text>
            <View style={[styles.track, { backgroundColor: C.border }]}>
              <View style={[styles.fill, { width: fillWidth, backgroundColor: C.text }]} />
            </View>
          </>
        ) : (
          <Text style={[styles.count, { color: C.textTertiary }]}>Empty</Text>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    imageWrapper: {
      borderRadius: 14,
      overflow: "hidden",
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
      paddingTop: 8,
      paddingHorizontal: 2,
    },
    owner: {
      fontSize: 10,
      fontWeight: "600",
      marginBottom: 2,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    name: {
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 18,
    },
    count: {
      fontSize: 11,
      marginTop: 2,
      fontWeight: "500",
    },
    track: {
      marginTop: 6,
      height: 2,
      borderRadius: 1,
      overflow: "hidden",
    },
    fill: {
      height: 2,
      borderRadius: 1,
    },
  });
}
