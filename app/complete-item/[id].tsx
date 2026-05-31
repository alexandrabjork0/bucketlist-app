import { Image as ExpoImage } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import VideoPlayer from "../../components/VideoPlayer";
import {
  completeItem as saveCompletion,
  linkCompletionToExperience,
  publishNewExperience,
} from "../../lib/collections";
import { auth, db, storage } from "../../lib/firebaseConfig";
import {
  createMilestoneNotification,
  createNotification,
} from "../../lib/notifications";
import { ThemeColors, useTheme } from "../../lib/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CELL_SIZE = Math.floor(SCREEN_WIDTH / 3);
const MAX_MEDIA = 10;

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
    await createMilestoneNotification(currentUser.uid, message, count);
  }
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SelectedMedia = {
  uri: string;
  type: "image" | "video";
};


export default function CompleteItemScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { id, isShared } = useLocalSearchParams<{ id: string; isShared?: string }>();

  const [item, setItem] = useState<any>(null);
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [captionIndex, setCaptionIndex] = useState(0);

  // Gallery
  const [galleryPermission, setGalleryPermission] = useState<boolean | null>(null);
  const [galleryAssets, setGalleryAssets] = useState<MediaLibrary.Asset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryHasMore, setGalleryHasMore] = useState(false);
  const [galleryEndCursor, setGalleryEndCursor] = useState<string | undefined>(undefined);
  const [selectedAssets, setSelectedAssets] = useState<MediaLibrary.Asset[]>([]);
  const [previewAsset, setPreviewAsset] = useState<MediaLibrary.Asset | null>(null);

  // Discover sheet
  const [discoverSheet, setDiscoverSheet] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [allExperiences, setAllExperiences] = useState<any[]>([]);
  const [discoverResults, setDiscoverResults] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [pendingCompletionId, setPendingCompletionId] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadItem = async () => {
      if (!id || typeof id !== "string") return;
      const itemSnap = await getDoc(doc(db, "userBucketlistItems", id));
      if (itemSnap.exists()) setItem(itemSnap.data());
    };
    loadItem();
  }, [id]);

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    setGalleryLoading(true);
    const perm = await MediaLibrary.requestPermissionsAsync();
    setGalleryPermission(perm.granted);
    if (!perm.granted) {
      setGalleryLoading(false);
      return;
    }
    const result = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      first: 60,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    setGalleryAssets(result.assets);
    setGalleryHasMore(result.hasNextPage);
    setGalleryEndCursor(result.endCursor);
    if (result.assets.length > 0) {
      setPreviewAsset(result.assets[0]);
      setSelectedAssets([result.assets[0]]);
    }
    setGalleryLoading(false);
  };

  const loadMoreGallery = async () => {
    if (!galleryHasMore || galleryLoading || !galleryEndCursor) return;
    const result = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      first: 60,
      after: galleryEndCursor,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    setGalleryAssets((prev) => [...prev, ...result.assets]);
    setGalleryHasMore(result.hasNextPage);
    setGalleryEndCursor(result.endCursor);
  };

  const toggleAsset = (asset: MediaLibrary.Asset) => {
    setPreviewAsset(asset);
    setSelectedAssets((prev) => {
      const idx = prev.findIndex((a) => a.id === asset.id);
      if (idx !== -1) return prev.filter((a) => a.id !== asset.id);
      if (prev.length >= MAX_MEDIA) return prev;
      return [...prev, asset];
    });
  };

  const goNext = async () => {
    if (selectedAssets.length === 0) {
      Alert.alert("Select media", "Please select at least one photo or video.");
      return;
    }
    const resolvedMedia: SelectedMedia[] = await Promise.all(
      selectedAssets.map(async (asset) => {
        let uri = asset.uri;
        if (Platform.OS === "ios") {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset);
            uri = info.localUri || asset.uri;
          } catch {}
        }
        return { uri, type: asset.mediaType === "video" ? "video" : "image" };
      })
    );
    setMedia(resolvedMedia);
    setStep(2);
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
      const thumbnail = await VideoThumbnails.getThumbnailAsync(mediaItem.uri, { time: 1000 });
      const thumbnailResponse = await fetch(thumbnail.uri);
      const thumbnailBlob = await thumbnailResponse.blob();
      const thumbnailRef = ref(
        storage,
        `completedItems/${id}/${Date.now()}-${index}-thumbnail.jpg`
      );
      await uploadBytes(thumbnailRef, thumbnailBlob, { contentType: "image/jpeg" });
      thumbnailUrl = await getDownloadURL(thumbnailRef);
    }

    return { url: downloadUrl, type: mediaItem.type, thumbnailUrl };
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
      const imageUrl = firstImage?.url || firstMedia?.url || null;

      const completionId = await saveCompletion({
        itemId: id as string,
        collectionId: item?.collectionId ?? null,
        experienceId: item?.experienceId ?? null,
        caption,
        imageUrl,
        media: cleanMedia,
        isPrivate: item?.isPrivate ?? false,
        isShared: isShared === "true",
        ideaTitle: item?.title,
        ideaCategory: item?.category,
      });

      notifyCompletion(completionId).catch(() => {});

      if (!item?.experienceId) {
        setSaving(false);
        openDiscoverSheet(completionId, imageUrl);
        return;
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

  const openDiscoverSheet = async (completionId: string, imageUrl: string | null) => {
    setPendingCompletionId(completionId);
    setPendingImageUrl(imageUrl);
    setDiscoverQuery(item?.title || "");
    setDiscoverLoading(true);
    setDiscoverSheet(true);
    const snap = await getDocs(collection(db, "experiences"));
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setAllExperiences(all);
    filterDiscoverResults(all, item?.title || "");
    setDiscoverLoading(false);
  };

  const filterDiscoverResults = (all: any[], q: string) => {
    const lower = q.trim().toLowerCase();
    if (!lower) { setDiscoverResults([]); return; }
    setDiscoverResults(
      all.filter((e: any) => e.title?.toLowerCase().includes(lower)).slice(0, 8)
    );
  };

  const handleDiscoverSearch = (q: string) => {
    setDiscoverQuery(q);
    filterDiscoverResults(allExperiences, q);
  };

  const handleLinkExperience = async (expId: string) => {
    if (!pendingCompletionId) return;
    await linkCompletionToExperience(pendingCompletionId, expId);
    closeDiscoverSheet();
  };

  const handleCreateNew = async () => {
    if (!pendingCompletionId || !discoverQuery.trim() || !auth.currentUser) return;
    await publishNewExperience({
      completionId: pendingCompletionId,
      title: discoverQuery.trim(),
      category: item?.category || "Other",
      heroImageUrl: pendingImageUrl,
      createdBy: auth.currentUser.uid,
    });
    closeDiscoverSheet();
  };

  const closeDiscoverSheet = () => {
    setDiscoverSheet(false);
    router.back();
  };

  const renderGridItem = ({ item: asset }: { item: MediaLibrary.Asset }) => {
    const selectedIndex = selectedAssets.findIndex((a) => a.id === asset.id);
    const isSelected = selectedIndex !== -1;
    return (
      <Pressable onPress={() => toggleAsset(asset)} style={styles.gridCell}>
        <ExpoImage source={{ uri: asset.uri }} style={styles.gridCellImage} contentFit="cover" />
        {asset.mediaType === "video" && (
          <Text style={styles.videoDuration}>{formatDuration(asset.duration || 0)}</Text>
        )}
        {isSelected ? (
          <View style={styles.selectionBadge}>
            <Text style={styles.selectionBadgeText}>{selectedIndex + 1}</Text>
          </View>
        ) : (
          selectedAssets.length > 0 && <View style={styles.selectionCircleEmpty} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (step === 2) setStep(1);
            else router.back();
          }}
          disabled={saving}
        >
          <Text style={styles.backText}>{step === 2 ? "Back" : "Cancel"}</Text>
        </Pressable>

        <Text style={styles.topTitle}>{step === 1 ? "New post" : "Caption"}</Text>

        {step === 1 ? (
          <Pressable onPress={goNext} disabled={selectedAssets.length === 0}>
            <Text style={[styles.actionText, selectedAssets.length === 0 && styles.actionTextDisabled]}>
              Next
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={completeItem} disabled={saving || media.length === 0}>
            <Text style={[styles.actionText, (saving || media.length === 0) && styles.actionTextDisabled]}>
              {saving ? "Posting..." : "Post"}
            </Text>
          </Pressable>
        )}
      </View>

      {step === 1 ? (
        <View style={{ flex: 1 }}>
          {/* Large preview */}
          <View style={styles.previewBox}>
            {previewAsset ? (
              <>
                <ExpoImage
                  source={{ uri: previewAsset.uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
                {previewAsset.mediaType === "video" && (
                  <View style={styles.previewPlayIcon}>
                    <Text style={styles.previewPlayIconText}>▶</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.previewEmpty}>
                <Text style={styles.previewEmptyText}>Select a photo or video</Text>
              </View>
            )}
            {selectedAssets.length > 1 && (
              <View style={styles.multiSelectBadge}>
                <Text style={styles.multiSelectBadgeText}>
                  {selectedAssets.length}/{MAX_MEDIA}
                </Text>
              </View>
            )}
          </View>

          {/* Gallery header */}
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryAlbumName}>Recents</Text>
          </View>

          {galleryPermission === false ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>
                Allow photo access to select media.
              </Text>
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={styles.permissionLink}>Open Settings</Text>
              </Pressable>
            </View>
          ) : galleryLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={C.text} />
          ) : (
            <FlatList
              data={galleryAssets}
              keyExtractor={(a) => a.id}
              numColumns={3}
              renderItem={renderGridItem}
              onEndReached={loadMoreGallery}
              onEndReachedThreshold={0.3}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
            />
          )}
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.captionPreview}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.previewScroll}
              onMomentumScrollEnd={(e) => {
                setCaptionIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
              }}
            >
              {media.map((mediaItem, index) => (
                <View
                  key={`${mediaItem.uri}-${index}`}
                  style={[styles.captionPreviewPage, { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.05 }]}
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

      <Modal
        visible={discoverSheet}
        animationType="slide"
        transparent
        onRequestClose={closeDiscoverSheet}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.discoverOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDiscoverSheet} />
          <View style={styles.discoverSheet}>
            <View style={styles.discoverHandle} />

            <View style={styles.discoverHeader}>
              <Text style={styles.discoverTitle}>Add to Discover</Text>
              <Pressable onPress={closeDiscoverSheet}>
                <Text style={styles.discoverSkip}>Not now</Text>
              </Pressable>
            </View>

            <Text style={styles.discoverSubtitle}>
              Your post is live! Want to add it to Discover so others can find and save it?
            </Text>

            <TextInput
              style={styles.discoverSearchInput}
              value={discoverQuery}
              onChangeText={handleDiscoverSearch}
              placeholder="Search experiences…"
              placeholderTextColor={C.inputPlaceholder}
              autoCorrect={false}
            />

            {discoverLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={C.text} />
            ) : discoverResults.length > 0 ? (
              <ScrollView style={styles.discoverList} showsVerticalScrollIndicator={false}>
                {discoverResults.map((exp) => (
                  <Pressable
                    key={exp.id}
                    style={styles.discoverResultRow}
                    onPress={() => handleLinkExperience(exp.id)}
                  >
                    {exp.heroImageUrl ? (
                      <Image source={{ uri: exp.heroImageUrl }} style={styles.discoverResultThumb} />
                    ) : (
                      <View style={[styles.discoverResultThumb, { backgroundColor: C.surfaceElevated }]} />
                    )}
                    <View style={styles.discoverResultInfo}>
                      <Text style={styles.discoverResultTitle} numberOfLines={1}>{exp.title}</Text>
                      <Text style={styles.discoverResultMeta}>
                        {exp.completionsCount || 0} {exp.completionsCount === 1 ? "completion" : "completions"}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.discoverEmpty}>
                <Text style={styles.discoverEmptyText}>No matching experiences found.</Text>
                {discoverQuery.trim().length > 0 && (
                  <Pressable style={styles.discoverNewBtn} onPress={handleCreateNew}>
                    <Text style={styles.discoverNewBtnText}>
                      Add "{discoverQuery.trim()}" as new experience
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

    // Step 1 — gallery
    previewBox: {
      height: SCREEN_HEIGHT * 0.42,
      backgroundColor: "#000",
    },
    previewEmpty: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    previewEmptyText: {
      color: "#888",
      fontSize: 15,
    },
    previewPlayIcon: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: -24,
      marginLeft: -24,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    previewPlayIconText: {
      color: "#fff",
      fontSize: 18,
      marginLeft: 3,
    },
    multiSelectBadge: {
      position: "absolute",
      bottom: 12,
      right: 12,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    multiSelectBadgeText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },
    galleryHeader: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    galleryAlbumName: {
      fontSize: 15,
      fontWeight: "800",
      color: C.text,
    },
    permissionBox: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      gap: 12,
    },
    permissionText: {
      textAlign: "center",
      color: C.textSecondary,
      fontSize: 15,
    },
    permissionLink: {
      color: C.text,
      fontWeight: "800",
      fontSize: 15,
    },
    gridCell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      padding: 1,
    },
    gridCellImage: {
      width: CELL_SIZE - 2,
      height: CELL_SIZE - 2,
    },
    videoDuration: {
      position: "absolute",
      bottom: 5,
      right: 6,
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
      textShadowColor: "rgba(0,0,0,0.7)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    selectionBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.buttonPrimary,
      justifyContent: "center",
      alignItems: "center",
    },
    selectionBadgeText: {
      color: C.buttonPrimaryText,
      fontSize: 12,
      fontWeight: "900",
    },
    selectionCircleEmpty: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.8)",
    },

    // Step 2 — caption
    previewScroll: {
      width: "100%",
      backgroundColor: "#000",
    },
    captionPreviewPage: {
      backgroundColor: "#000",
    },
    previewMedia: {
      width: "100%",
      height: "100%",
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

    // Discover sheet
    discoverOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    discoverSheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: 48,
      maxHeight: "80%",
    },
    discoverHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.handle,
      alignSelf: "center",
      marginBottom: 16,
    },
    discoverHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    discoverTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: C.text,
    },
    discoverSkip: {
      fontSize: 15,
      fontWeight: "700",
      color: C.textSecondary,
    },
    discoverSubtitle: {
      fontSize: 14,
      color: C.textSecondary,
      marginBottom: 16,
    },
    discoverSearchInput: {
      backgroundColor: C.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: C.text,
      marginBottom: 16,
    },
    discoverList: {
      maxHeight: 320,
    },
    discoverResultRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.divider,
    },
    discoverResultThumb: {
      width: 52,
      height: 52,
      borderRadius: 10,
    },
    discoverResultInfo: {
      flex: 1,
    },
    discoverResultTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: C.text,
    },
    discoverResultMeta: {
      fontSize: 13,
      color: C.textTertiary,
      marginTop: 2,
    },
    discoverEmpty: {
      paddingTop: 20,
      alignItems: "center",
      gap: 16,
    },
    discoverEmptyText: {
      fontSize: 15,
      color: C.textSecondary,
    },
    discoverNewBtn: {
      backgroundColor: C.buttonPrimary,
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 13,
      width: "100%",
      alignItems: "center",
    },
    discoverNewBtnText: {
      color: C.buttonPrimaryText,
      fontWeight: "800",
      fontSize: 15,
    },
  });
}
