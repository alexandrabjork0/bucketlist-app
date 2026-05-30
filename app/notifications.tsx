import { useFocusEffect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import NotificationRow from "../components/NotificationRow";
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

export default function NotificationsScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    let unsubNotifs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubNotifs) { unsubNotifs(); unsubNotifs = null; }

      if (!user) {
        setNotifications([]);
        return;
      }

      unsubNotifs = onSnapshot(
        query(
          collection(db, "notifications"),
          where("recipientId", "==", user.uid),
          orderBy("updatedAt", "desc"),
          limit(100)
        ),
        (snap) => {
          setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubNotifs) unsubNotifs();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!auth.currentUser) return;

      const markRead = async () => {
        const unreadSnap = await getDocs(
          query(
            collection(db, "notifications"),
            where("recipientId", "==", auth.currentUser!.uid),
            where("read", "==", false)
          )
        );
        if (unreadSnap.empty) return;

        const batch = writeBatch(db);
        unreadSnap.docs.forEach((d) => batch.update(d.ref, { read: true }));
        await batch.commit();

        updateDoc(doc(db, "users", auth.currentUser!.uid), {
          notificationsLastSeen: serverTimestamp(),
        }).catch(() => {});
      };

      markRead();
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <Text style={styles.emptyText}>No notifications yet.</Text>
        ) : (
          notifications.map((notif) => (
            <NotificationRow key={notif.id} notification={notif} />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      paddingTop: 70,
      paddingHorizontal: 18,
      paddingBottom: 10,
      color: C.text,
    },
    scroll: {
      flex: 1,
    },
    emptyText: {
      paddingHorizontal: 20,
      paddingTop: 40,
      color: C.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
  });
}
