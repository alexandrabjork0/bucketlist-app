import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

const PALETTE = [
  "#C9B8A8", "#A8B8C9", "#A8C9B8", "#C9C0A8",
  "#B8A8C9", "#C9A8B8", "#B8C9A8", "#C4B0A0",
];

function bgColor(name: string): string {
  if (!name) return PALETTE[0];
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

interface Props {
  images: string[];
  size: number;
  name?: string;
}

export default function CollectionCover({ images, size, name = "" }: Props) {
  const C = useTheme();
  const gap = C.background;

  const imgs = images.slice(0, 4);
  const half = Math.floor((size - 2) / 2);

  if (imgs.length === 0) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, backgroundColor: bgColor(name) }]}>
        {name.length > 0 && (
          <Text style={[styles.initial, { fontSize: Math.floor(size * 0.32) }]}>
            {name[0].toUpperCase()}
          </Text>
        )}
      </View>
    );
  }

  if (imgs.length === 1) {
    return (
      <Image
        source={{ uri: imgs[0] }}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    );
  }

  if (imgs.length === 2) {
    return (
      <View style={{ width: size, height: size, flexDirection: "row" }}>
        <Image source={{ uri: imgs[0] }} style={{ width: half, height: size }} resizeMode="cover" />
        <View style={{ width: 2, height: size, backgroundColor: gap }} />
        <Image source={{ uri: imgs[1] }} style={{ flex: 1, height: size }} resizeMode="cover" />
      </View>
    );
  }

  if (imgs.length === 3) {
    const leftW = Math.floor(size * 0.58);
    const rightW = size - leftW - 2;
    const rightH = Math.floor((size - 2) / 2);
    return (
      <View style={{ width: size, height: size, flexDirection: "row" }}>
        <Image source={{ uri: imgs[0] }} style={{ width: leftW, height: size }} resizeMode="cover" />
        <View style={{ width: 2, height: size, backgroundColor: gap }} />
        <View style={{ width: rightW }}>
          <Image source={{ uri: imgs[1] }} style={{ width: rightW, height: rightH }} resizeMode="cover" />
          <View style={{ height: 2, backgroundColor: gap }} />
          <Image source={{ uri: imgs[2] }} style={{ width: rightW, flex: 1 }} resizeMode="cover" />
        </View>
      </View>
    );
  }

  // 4 images: 2×2 grid
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ flexDirection: "row", height: half }}>
        <Image source={{ uri: imgs[0] }} style={{ flex: 1, height: half }} resizeMode="cover" />
        <View style={{ width: 2, height: half, backgroundColor: gap }} />
        <Image source={{ uri: imgs[1] }} style={{ flex: 1, height: half }} resizeMode="cover" />
      </View>
      <View style={{ height: 2, backgroundColor: gap }} />
      <View style={{ flexDirection: "row", height: half }}>
        <Image source={{ uri: imgs[2] }} style={{ flex: 1, height: half }} resizeMode="cover" />
        <View style={{ width: 2, height: half, backgroundColor: gap }} />
        <Image source={{ uri: imgs[3] }} style={{ flex: 1, height: half }} resizeMode="cover" />
      </View>
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
