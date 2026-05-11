import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { db, storage } from "../(tabs)/firebaseConfig";
import VideoPlayer from "../../components/VideoPlayer";

type SelectedMedia = {
  uri: string;
  type: "image" | "video";
};

export default function CompleteItemScreen() {
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const [item, setItem] = useState<any>(null);
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    const loadItem = async () => {
      if (!id || typeof id !== "string") return;

      const itemRef = doc(db, "userBucketlistItems", id);
      const itemSnap = await getDoc(itemRef);

      if (itemSnap.exists()) {
        setItem(itemSnap.data());
      }
    };

    loadItem();
  }, [id]);

  const pickMedia = async () => {
    if (saving) return;

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: 6,
        quality: 0.8,
      });
      
    if (result.canceled) return;

    const selectedMedia: SelectedMedia[] = result.assets.slice(0, 6).map((asset) => ({
      uri: asset.uri,
      type: asset.type === "video" ? "video" : "image",
    }));

    setMedia(selectedMedia);
  };

  const removeMedia = (indexToRemove: number) => {
    setMedia((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const uploadMedia = async (mediaItem: SelectedMedia, index: number) => {
    if (!id || typeof id !== "string") return null;
  
    const response = await fetch(mediaItem.uri);
    const blob = await response.blob();
  
    const extension = mediaItem.type === "video" ? "mp4" : "jpg";
    const contentType = mediaItem.type === "video" ? "video/mp4" : "image/jpeg";
  
    const mediaRef = ref(
      storage,
      `completedItems/${id}/${Date.now()}-${index}.${extension}`
    );
  
    await uploadBytes(mediaRef, blob, { contentType });
  
    const downloadUrl = await getDownloadURL(mediaRef);
  
    let thumbnailUrl = null;
  
    if (mediaItem.type === "video") {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(mediaItem.uri, {
        time: 1000,
      });
  
      const thumbnailResponse = await fetch(thumbnail.uri);
      const thumbnailBlob = await thumbnailResponse.blob();
  
      const thumbnailRef = ref(
        storage,
        `completedItems/${id}/${Date.now()}-${index}-thumbnail.jpg`
      );
  
      await uploadBytes(thumbnailRef, thumbnailBlob, {
        contentType: "image/jpeg",
      });
  
      thumbnailUrl = await getDownloadURL(thumbnailRef);
    }
  
    return {
      url: downloadUrl,
      type: mediaItem.type,
      thumbnailUrl,
    };
  };

  const goNext = () => {
    if (media.length === 0) {
      Alert.alert("Add media", "Please select at least one photo or video.");
      return;
    }

    setStep(2);
  };

  const completeItem = async () => {
    if (!id || typeof id !== "string") return;

    if (media.length === 0) {
      Alert.alert("Add media", "Please add at least one photo or video before posting.");
      return;
    }

    try {
      setSaving(true);

      const uploadedMedia = await Promise.all(
        media.map((mediaItem, index) => uploadMedia(mediaItem, index))
      );

      const cleanMedia = uploadedMedia.filter(Boolean);

      const firstImage = cleanMedia.find((m: any) => m.type === "image");
      const firstMedia = cleanMedia[0] as any;

      const itemRef = doc(db, "userBucketlistItems", id);

      await updateDoc(itemRef, {
        completed: true,
        completedAt: serverTimestamp(),
        caption: caption.trim(),
        imageUrl: firstImage?.url || firstMedia?.url || null,
        media: cleanMedia,
      });

      Alert.alert("Posted", "Your bucketlist item is now posted!");
      router.back();
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Something went wrong while posting this item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (step === 2) {
              setStep(1);
            } else {
              router.back();
            }
          }}
          disabled={saving}
        >
          <Text style={styles.backText}>{step === 2 ? "Back" : "Cancel"}</Text>
        </Pressable>

        <Text style={styles.topTitle}>{step === 1 ? "New post" : "Caption"}</Text>

        {step === 1 ? (
          <Pressable onPress={goNext} disabled={media.length === 0}>
            <Text
              style={[
                styles.actionText,
                media.length === 0 && styles.actionTextDisabled,
              ]}
            >
              Next
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={completeItem} disabled={saving || media.length === 0}>
            <Text
              style={[
                styles.actionText,
                (saving || media.length === 0) && styles.actionTextDisabled,
              ]}
            >
              {saving ? "Posting..." : "Post"}
            </Text>
          </Pressable>
        )}
      </View>

      {step === 1 ? (
        <ScrollView style={styles.content}>
          <View style={styles.itemBox}>
            <Text style={styles.itemLabel}>Completing</Text>
            <Text style={styles.itemTitle}>{item?.title || "Loading..."}</Text>
            <Text style={styles.category}>{item?.category}</Text>
          </View>

          {media.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.previewScroll}
              >
                {media.map((mediaItem, index) => (
                  <View
                    key={`${mediaItem.uri}-${index}`}
                    style={[
                      styles.previewPage,
                      {
                        width,
                        height: width * 1.15,
                      },
                    ]}
                  >
                    {mediaItem.type === "image" ? (
                      <Image source={{ uri: mediaItem.uri }} style={styles.previewMedia} />
                    ) : (
                        <VideoPlayer uri={mediaItem.uri} style={styles.previewMedia} />
                    )}

                    <Pressable
                      style={styles.removeButton}
                      onPress={() => removeMedia(index)}
                      disabled={saving}
                    >
                      <Text style={styles.removeButtonText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.mediaCount}>{media.length}/6 selected</Text>

              <Pressable style={styles.addMoreButton} onPress={pickMedia} disabled={saving}>
                <Text style={styles.addMoreText}>Change selected media</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.emptyMediaBox} onPress={pickMedia}>
              <Text style={styles.emptyMediaIcon}>＋</Text>
              <Text style={styles.emptyMediaTitle}>Add photos or videos</Text>
              <Text style={styles.emptyMediaSubtitle}>Select up to 6</Text>
            </Pressable>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.captionPreview}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.previewScroll}
            >
              {media.map((mediaItem, index) => (
                <View
                  key={`${mediaItem.uri}-${index}`}
                  style={[
                    styles.captionPreviewPage,
                    {
                      width,
                      height: width * 1.05,
                    },
                  ]}
                >
                  {mediaItem.type === "image" ? (
                    <Image source={{ uri: mediaItem.uri }} style={styles.previewMedia} />
                  ) : (
                    <VideoPlayer uri={mediaItem.uri} style={styles.previewMedia} />
                  )}
                </View>
              ))}
            </ScrollView>

            {media.length > 1 && (
              <Text style={styles.mediaCount}>{media.length} media selected</Text>
            )}
          </View>

          <View style={styles.captionBox}>
            <Text style={styles.captionLabel}>Write a caption</Text>

            <TextInput
              style={styles.captionInput}
              placeholder="Say something about this moment..."
              value={caption}
              onChangeText={setCaption}
              multiline
              editable={!saving}
              maxLength={500}
            />

            <Text style={styles.captionCount}>{caption.length}/500</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  topBar: {
    paddingTop: 60,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  topTitle: {
    fontSize: 17,
    fontWeight: "900",
  },

  actionText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#007AFF",
  },

  actionTextDisabled: {
    color: "#bbb",
  },

  content: {
    flex: 1,
  },

  itemBox: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  itemLabel: {
    color: "#777",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  itemTitle: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "900",
  },

  category: {
    marginTop: 4,
    color: "#777",
    fontWeight: "600",
  },

  previewScroll: {
    width: "100%",
    backgroundColor: "#000",
  },

  previewPage: {
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  captionPreviewPage: {
    backgroundColor: "#000",
  },

  previewMedia: {
    width: "100%",
    height: "100%",
  },

  removeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  removeButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 26,
  },

  mediaCount: {
    padding: 12,
    textAlign: "center",
    color: "#777",
    fontWeight: "700",
  },

  emptyMediaBox: {
    margin: 18,
    height: 330,
    borderRadius: 24,
    backgroundColor: "#F4F4F4",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyMediaIcon: {
    fontSize: 42,
    fontWeight: "300",
    color: "#111",
  },

  emptyMediaTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: "900",
  },

  emptyMediaSubtitle: {
    marginTop: 4,
    color: "#777",
    fontWeight: "600",
  },

  addMoreButton: {
    marginHorizontal: 18,
    marginTop: 16,
    backgroundColor: "#F4F4F4",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },

  addMoreText: {
    fontWeight: "900",
    color: "#111",
  },

  captionPreview: {
    backgroundColor: "#000",
  },

  captionBox: {
    padding: 18,
  },

  captionLabel: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 10,
  },

  captionInput: {
    minHeight: 130,
    fontSize: 16,
    textAlignVertical: "top",
  },

  captionCount: {
    marginTop: 8,
    color: "#999",
    fontWeight: "600",
    textAlign: "right",
  },
});