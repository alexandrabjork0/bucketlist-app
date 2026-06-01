import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "save"
  | "friend_completion"
  | "milestone"
  | "system"
  | "collection_invite"
  | "collection_invite_accepted";

type Params = {
  recipientId: string;
  type: NotificationType;
  actorId: string;
  postId?: string;
  previewText?: string;
  inviteId?: string;
  collectionId?: string;
};

export async function createNotification({
  recipientId,
  type,
  actorId,
  postId,
  previewText,
  inviteId,
  collectionId,
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
      groupKey = `friend_completion_${recipientId}_${actorId}_${postId}`;
      tab = "personal";
      break;
    case "milestone":
      groupKey = `milestone_${recipientId}_${previewText}`;
      tab = "personal";
      break;
    case "system":
      groupKey = `system_${recipientId}_${previewText}`;
      tab = "system";
      break;
    case "collection_invite":
      groupKey = `collection_invite_${inviteId ?? collectionId}_${recipientId}`;
      tab = "personal";
      break;
    case "collection_invite_accepted":
      groupKey = `collection_invite_accepted_${collectionId}_${actorId}`;
      tab = "personal";
      break;
    default:
      return;
  }

  const notifRef = doc(db, "notifications", groupKey);

  // Single atomic write — setDoc with merge supports arrayUnion and increment,
  // so actors are included in the same write that creates the document.
  // No read needed, avoiding the permission problem where actor ≠ recipient.
  await setDoc(
    notifRef,
    {
      recipientId,
      type,
      tab,
      actors: arrayUnion(actor),
      actorCount: increment(1),
      postId: postId || null,
      postTitle,
      postImageUrl,
      previewText: previewText || null,
      inviteId: inviteId || null,
      collectionId: collectionId || null,
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createMilestoneNotification(
  uid: string,
  message: string,
  count: number
): Promise<void> {
  const notifRef = doc(db, "notifications", `milestone_${uid}_${count}`);
  await setDoc(
    notifRef,
    {
      recipientId: uid,
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
    },
    { merge: true }
  );
}
