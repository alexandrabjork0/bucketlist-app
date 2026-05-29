import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

export interface CollectionRef {
  id: string;
  name: string;
}

export interface NewItemData {
  title: string;
  category: string;
  isPrivate?: boolean;
  source: "custom" | "explore" | "post";
  experienceId?: string | null;
  inspiredByPostId?: string | null;
  inspiredByUserId?: string | null;
}

// Create a collection. Returns the new doc ID.
export async function createCollection(params: {
  name: string;
  description?: string;
  isPrivate?: boolean;
  coverPhoto?: string;
}): Promise<string> {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const batch = writeBatch(db);
  const ref = doc(collection(db, "collections"));
  batch.set(ref, {
    userId: auth.currentUser.uid,
    name: params.name.trim(),
    description: params.description?.trim() ?? "",
    isPrivate: params.isPrivate ?? false,
    ...(params.coverPhoto ? { coverPhoto: params.coverPhoto } : {}),
    itemCount: 0,
    completedCount: 0,
    memberIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

// Save/remove an item to/from collections atomically.
// Returns the updated collectionId → docId map.
export async function saveToCollections(
  itemData: NewItemData,
  toAdd: CollectionRef[],
  toRemove: string[],
  existingSaved: Map<string, string>
): Promise<Map<string, string>> {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const uid = auth.currentUser.uid;
  const newMap = new Map(existingSaved);

  // Resolve createdBy once — it's the original idea creator, not necessarily the saver.
  let createdBy: string = uid;
  if (itemData.source === "post" && itemData.inspiredByUserId) {
    createdBy = itemData.inspiredByUserId;
  } else if (itemData.source === "explore" && itemData.experienceId) {
    try {
      const expSnap = await getDoc(doc(db, "experiences", itemData.experienceId));
      if (expSnap.exists() && expSnap.data().userId) {
        createdBy = expSnap.data().userId;
      }
    } catch {
      // Fall back to saver's uid if the fetch fails
    }
  }

  for (const col of toAdd) {
    const batch = writeBatch(db);
    const itemRef = doc(collection(db, "userBucketlistItems"));
    batch.set(itemRef, {
      userId: uid,
      createdBy,
      savedBy: uid,
      completedBy: null,
      collectionId: col.id,
      title: itemData.title,
      category: itemData.category,
      isPrivate: itemData.isPrivate ?? false,
      publishedToDiscover: false,
      source: itemData.source,
      experienceId: itemData.experienceId ?? null,
      inspiredByPostId: itemData.inspiredByPostId ?? null,
      inspiredByUserId: itemData.inspiredByUserId ?? null,
      completed: false,
      imageUrl: null,
      caption: "",
      notes: "",
      media: [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
    });
    batch.update(doc(db, "collections", col.id), {
      itemCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    newMap.set(col.id, itemRef.id);

    // Non-critical: increment experience saves count
    if (itemData.experienceId && itemData.source !== "custom") {
      updateDoc(doc(db, "experiences", itemData.experienceId), {
        savesCount: increment(1),
      }).catch(() => {});
    }
  }

  for (const colId of toRemove) {
    const docId = existingSaved.get(colId);
    if (!docId) continue;
    const batch = writeBatch(db);
    batch.delete(doc(db, "userBucketlistItems", docId));
    batch.update(doc(db, "collections", colId), {
      itemCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    newMap.delete(colId);
  }

  return newMap;
}

// Delete a collection safely:
//   - Deletes to-do items
//   - Sets collectionId=null on completed memories (they remain in Posts tab)
//   - Deletes the collection doc
export async function executeDeleteCollection(collectionId: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, "userBucketlistItems"),
      where("collectionId", "==", collectionId)
    )
  );

  let batch = writeBatch(db);
  let count = 0;

  const flush = async () => {
    await batch.commit();
    batch = writeBatch(db);
    count = 0;
  };

  for (const d of snap.docs) {
    if (d.data().completed) {
      batch.update(d.ref, { collectionId: null });
    } else {
      batch.delete(d.ref);
    }
    count++;
    // Firestore batch limit is 500; leave one slot for the collection doc
    if (count === 499) await flush();
  }

  batch.delete(doc(db, "collections", collectionId));
  await batch.commit();
}

// Complete an item. Caller handles media uploads and passes the resulting URLs.
export async function completeItem(params: {
  itemId: string;
  collectionId?: string | null;
  experienceId?: string | null;
  caption: string;
  imageUrl: string | null;
  media: any[];
  isPrivate?: boolean;
}): Promise<void> {
  const batch = writeBatch(db);

  batch.update(doc(db, "userBucketlistItems", params.itemId), {
    completed: true,
    completedAt: serverTimestamp(),
    completedBy: auth.currentUser?.uid ?? null,
    publishedToDiscover: false,
    caption: params.caption.trim(),
    imageUrl: params.imageUrl,
    media: params.media,
    updatedAt: serverTimestamp(),
  });

  if (params.collectionId) {
    batch.update(doc(db, "collections", params.collectionId), {
      completedCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  // Only count towards public completions if the item is not private
  if (params.experienceId && !params.isPrivate) {
    batch.update(doc(db, "experiences", params.experienceId), {
      completionsCount: increment(1),
    });
  }

  await batch.commit();
}
