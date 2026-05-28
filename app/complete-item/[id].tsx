import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
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
import { auth, db, storage } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import VideoPlayer from "../../components/VideoPlayer";
import { ThemeColors, useTheme } from "../../lib/theme";

const MILESTONES: Record<number, string> = {
  1: "You completed your first experience! 🎉",
  5: "5 experiences completed. You're on a roll!",
  10: "10 experiences! You're living life to the fullest.",
  25: "25 experiences completed. Keep going!",
  50: "50 experiences. You're an inspiration!",
  100: "100 experiences. You're a legend!",
};

async function notifyCompletion(postId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const followersSnap = await getDocs(
    query(collection(db, "follows"), where("followingId", "==", currentUser.uid))
  );

  await Promise.all(
    followersSnap.docs.map((followDoc) =>
      createNotification({
        recipientId: followDoc.data().followerId,
        type: "friend_completion",
        actorId: currentUser.uid,
        postId,
      }).catch(() => {})
    )
  );

  const completedSnap = await getDocs(
    query(
      collection(db, "userBucketlistItems"),
      where("userId", "==", currentUser.uid),
      where("completed", "==", true)
    )
  );

  const count = completedSnap.size;
  const message = MILESTONES[count];

  if (message) {
    await setDoc(
      doc(db, "notifications", `milestone_${currentUser.uid}_${count}`),
      {
        recipientId: currentUser.uid,
        type: "milestone",
        tab: "personal",
        actors: [],
        actorCount: 0,
        postId: null,
        postTitle: null,
        postImageUrl: null,
        previewText: message,
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
  }
}

type SelectedMedia = {
  uri: string;
  type: "image" | "video";
};

export default function CompleteItemScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const [item, setItem] = useState<any>(null);
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [captionIndex, setCaptionIndex] = useState(0);

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
        mediaTypes: ["images", "videos"],
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
    setPreviewIndex(0);
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

      notifyCompletion(id).catch(() => {});

      const firstImageUrl = cleanMedia.find((m: any) => m.type === "image")?.url;

      if (item?.experienceId) {
        const heroUpdate: Record<string, any> = { completionsCount: increment(1) };
        if (firstImageUrl) heroUpdate.heroImageUrl = firstImageUrl;
        updateDoc(doc(db, "experiences", item.experienceId), heroUpdate).catch(() => {});
      }

      if (item?.collectionId) {
        const collUpdate: Record<string, any> = {
          completedCount: increment(1),
          updatedAt: serverTimestamp(),
        };
        if (firstImageUrl) collUpdate.coverImages = arrayUnion(firstImageUrl);
        updateDoc(doc(db, "collections", item.collectionId), collUpdate).catch(() => {});
      }

      Alert.alert("Posted", "Your experience is now posted!");
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
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.previewScroll}
                  onMomentumScrollEnd={(e) => {
                    setPreviewIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                  }}
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

                {media.length > 1 && (
                  <View style={styles.counter}>
                    <Text style={styles.counterText}>{previewIndex + 1}/{media.length}</Text>
                  </View>
                )}
              </View>

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
              onMomentumScrollEnd={(e) => {
                setCaptionIndex(Math.round(e.nativeEvent.contentOffset.x / width));
              }}
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
              <View style={styles.counter}>
                <Text style={styles.counterText}>{captionIndex + 1}/{media.length}</Text>
              </View>
            )}
          </View>

          <View style={styles.captionBox}>
            <Text style={styles.captionLabel}>Write a caption</Text>

            <TextInput
              style={styles.captionInput}
              placeholder="Say something about this moment..."
              placeholderTextColor={C.inputPlaceholder}
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

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },

    topBar: {
      paddingTop: 60,
      paddingHorizontal: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    backText: {
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },

    topTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: C.text,
    },

    actionText: {
      fontSize: 16,
      fontWeight: "900",
      color: C.text,
    },

    actionTextDisabled: {
      color: C.disabled,
    },

    content: {
      flex: 1,
    },

    itemBox: {
      padding: 18,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },

    itemLabel: {
      color: C.textSecondary,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
    },

    itemTitle: {
      marginTop: 6,
      fontSize: 20,
      fontWeight: "900",
      color: C.text,
    },

    category: {
      marginTop: 4,
      color: C.textSecondary,
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
      color: C.textSecondary,
      fontWeight: "700",
    },

    emptyMediaBox: {
      margin: 18,
      height: 330,
      borderRadius: 24,
      backgroundColor: C.surface,
      justifyContent: "center",
      alignItems: "center",
    },

    emptyMediaIcon: {
      fontSize: 42,
      fontWeight: "300",
      color: C.text,
    },

    emptyMediaTitle: {
      marginTop: 8,
      fontSize: 17,
      fontWeight: "900",
      color: C.text,
    },

    emptyMediaSubtitle: {
      marginTop: 4,
      color: C.textSecondary,
      fontWeight: "600",
    },

    addMoreButton: {
      marginHorizontal: 18,
      marginTop: 16,
      backgroundColor: C.surface,
      padding: 14,
      borderRadius: 16,
      alignItems: "center",
    },

    addMoreText: {
      fontWeight: "900",
      color: C.text,
    },

    captionPreview: {
      backgroundColor: "#000",
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

    captionBox: {
      padding: 18,
    },

    captionLabel: {
      fontSize: 15,
      fontWeight: "900",
      marginBottom: 10,
      color: C.text,
    },

    captionInput: {
      minHeight: 130,
      fontSize: 16,
      textAlignVertical: "top",
      color: C.text,
    },

    captionCount: {
      marginTop: 8,
      color: C.textTertiary,
      fontWeight: "600",
      textAlign: "right",
    },
  });
}