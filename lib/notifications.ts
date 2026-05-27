import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "save"
  | "friend_completion"
  | "milestone"
  | "system";

type Params = {
  recipientId: string;
  type: NotificationType;
  actorId: string;
  postId?: string;
  previewText?: string;
};

export async function createNotification({
  recipientId,
  type,
  actorId,
  postId,
  previewText,
}: Params): Promise<void> {
  if (recipientId === actorId) return;

  const actorSnap = await getDoc(doc(db, "users", actorId));
  const actorData = actorSnap.exists() ? actorSnap.data() : {};
  const actor = {
    userId: actorId,
    username: actorData.username || "user",
    profileImage: actorData.profileImage || null,
  };

  let postTitle: string | null = null;
  let postImageUrl: string | null = null;
  if (postId) {
    const postSnap = await getDoc(doc(db, "userBucketlistItems", postId));
    if (postSnap.exists()) {
      const postData = postSnap.data();
      postTitle = postData.title || null;
      postImageUrl = postData.imageUrl || null;
    }
  }

  let groupKey: string;
  let tab: "personal" | "friends" | "system";

  switch (type) {
    case "like":
      groupKey = `like_${recipientId}_${postId}`;
      tab = "personal";
      break;
    case "comment":
      groupKey = `comment_${recipientId}_${postId}`;
      tab = "personal";
      break;
    case "save":
      groupKey = `save_${recipientId}_${postId}`;
      tab = "personal";
      break;
    case "follow":
      groupKey = `follow_${recipientId}`;
      tab = "personal";
      break;
    case "friend_completion":
      groupKey = `friend_completion_${actorId}_${postId}`;
      tab = "friends";
      break;
    case "milestone":
      groupKey = `milestone_${recipientId}_${previewText}`;
      tab = "personal";
      break;
    case "system":
      groupKey = `system_${recipientId}_${previewText}`;
      tab = "system";
      break;
    default:
      return;
  }

  const notifRef = doc(db, "notifications", groupKey);
  const notifSnap = await getDoc(notifRef);

  if (notifSnap.exists()) {
    const existing = notifSnap.data();
    const existingActors: any[] = existing.actors || [];
    const alreadyActed = existingActors.some((a: any) => a.userId === actorId);
    const filtered = existingActors.filter((a: any) => a.userId !== actorId);
    const newActors = [actor, ...filtered].slice(0, 3);

    await setDoc(
      notifRef,
      {
        actors: newActors,
        actorCount: alreadyActed ? existing.actorCount : (existing.actorCount || 0) + 1,
        read: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await setDoc(notifRef, {
      recipientId,
      type,
      tab,
      actors: [actor],
      actorCount: 1,
      postId: postId || null,
      postTitle,
      postImageUrl,
      previewText: previewText || null,
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
