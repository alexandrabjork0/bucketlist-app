import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemeColors, useTheme } from "../lib/theme";
import CollectionCover from "./CollectionCover";

export interface CollectionData {
  id: string;
  name: string;
  isPrivate?: boolean;
  coverPhoto?: string;
  itemCount?: number;
  completedCount?: number;
  description?: string;
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

  const { name, isPrivate, coverPhoto, itemCount, completedCount = 0 } = collection;
  const total = itemCount ?? 0;

  return (
    <Pressable
      style={{ width: cardWidth }}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.imageWrapper}>
        <CollectionCover coverPhoto={coverPhoto} size={cardWidth} name={name} />
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
        <Text style={[styles.count, { color: C.textTertiary }]}>
          {total === 0
            ? "Empty"
            : completedCount > 0
            ? `${total} saved · ${completedCount} completed`
            : `${total} saved`}
        </Text>
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
  });
}
