import { Image, StyleSheet, Text, View } from "react-native";

const PALETTE = [
  "#C9B8A8", "#A8B8C9", "#A8C9B8", "#C9C0A8",
  "#B8A8C9", "#C9A8B8", "#B8C9A8", "#C4B0A0",
];

function bgColor(name: string): string {
  if (!name) return PALETTE[0];
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

interface Props {
  size: number;
  name?: string;
  coverPhoto?: string;
}

export default function CollectionCover({ size, name = "", coverPhoto }: Props) {
  if (coverPhoto) {
    return (
      <Image
        source={{ uri: coverPhoto }}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, backgroundColor: bgColor(name) },
      ]}
    >
      {name.length > 0 && (
        <Text style={[styles.initial, { fontSize: Math.floor(size * 0.32) }]}>
          {name[0].toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  initial: {
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
  },
});
