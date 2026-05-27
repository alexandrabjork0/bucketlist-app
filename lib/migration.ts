import { collection, doc, getDocs, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export async function migrateIdeasToExperiences(): Promise<void> {
  const ideasSnap = await getDocs(query(collection(db, "exploreIdeas")));
  await Promise.all(
    ideasSnap.docs.map(async (ideaDoc) => {
      const data = ideaDoc.data();
      await setDoc(doc(db, "experiences", ideaDoc.id), {
        title: data.title || "",
        slug: (data.title || "").toLowerCase().replace(/\s+/g, "-"),
        category: data.category || "Other",
        tags: [],
        description: "",
        heroImageUrl: null,
        savesCount: 0,
        completionsCount: 0,
        trending: false,
        relatedIds: [],
        createdAt: data.createdAt || serverTimestamp(),
        createdBy: data.createdBy || "system",
        source: data.source || "system",
      });
    })
  );
}
