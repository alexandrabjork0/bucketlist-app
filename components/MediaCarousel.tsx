import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import VideoPlayer from "./VideoPlayer";

type MediaItem = {
  url: string;
  type: "image" | "video";
};

type Props = {
  media?: MediaItem[];
  imageUrl?: string | null;
  height?: number;
};

export default function MediaCarousel({ media, imageUrl, height }: Props) {
  const { width } = useWindowDimensions();

  const cleanMedia =
    media && media.length > 0
      ? media
      : imageUrl
      ? [{ url: imageUrl, type: "image" as const }]
      : [];

  if (cleanMedia.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
      >
        {cleanMedia.map((item, index) => (
          <View
            key={`${item.url}-${index}`}
            style={[
              styles.slide,
              {
                width,
                height: height || width * 1.15,
              },
            ]}
          >
            {item.type === "image" ? (
              <Image source={{ uri: item.url }} style={styles.media} />
            ) : (
                <VideoPlayer uri={item.url} style={styles.media} />
            )}
          </View>
        ))}
      </ScrollView>

      {cleanMedia.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>1/{cleanMedia.length}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    width: "100%",
    backgroundColor: "#000",
  },

  slide: {
    backgroundColor: "#000",
  },

  media: {
    width: "100%",
    height: "100%",
  },

  counter: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  counterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
});