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
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import NotificationRow from "../components/NotificationRow";
import { auth, db } from "../lib/firebaseConfig";
import { ThemeColors, useTheme } from "../lib/theme";

export default function NotificationsScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [personalNotifs, setPersonalNotifs] = useState<any[]>([]);
  const [friendNotifs, setFriendNotifs] = useState<any[]>([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [routes] = useState([
    { key: "personal", title: "Personal" },
    { key: "friends", title: "Friends" },
  ]);

  useEffect(() => {
    let unsubNotifs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubNotifs) { unsubNotifs(); unsubNotifs = null; }

      if (!user) {
        setPersonalNotifs([]);
        setFriendNotifs([]);
        return;
      }

      unsubNotifs = onSnapshot(
        query(
          collection(db, "notifications"),
          where("recipientId", "==", user.uid),
          orderBy("updatedAt", "desc"),
          limit(50)
        ),
        (snap) => {
          const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setPersonalNotifs(
            all.filter((n: any) => n.tab === "personal" || n.tab === "system")
          );
          setFriendNotifs(all.filter((n: any) => n.tab === "friends"));
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
        });
      };

      markRead();
    }, [])
  );

  const renderScene = ({ route }: any) => {
    const data = route.key === "personal" ? personalNotifs : friendNotifs;

    return (
      <ScrollView style={styles.scene}>
        {data.length === 0 ? (
          <Text style={styles.emptyText}>
            {route.key === "personal"
              ? "No notifications yet.\nComplete something and share it!"
              : "Follow people to see their activity here."}
          </Text>
        ) : (
          data.map((notif) => <NotificationRow key={notif.id} notification={notif} />)
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>

      <TabView
        navigationState={{ index: tabIndex, routes }}
        renderScene={renderScene}
        onIndexChange={setTabIndex}
        initialLayout={{ width: Dimensions.get("window").width }}
        renderTabBar={(props: any) => (
          <TabBar
            {...props}
            indicatorStyle={styles.tabIndicator}
            style={styles.tabBar}
            activeColor={C.text}
            inactiveColor={C.textTertiary}
          />
        )}
      />
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
    tabBar: {
      backgroundColor: C.background,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabIndicator: {
      backgroundColor: C.text,
      height: 3,
      borderRadius: 999,
    },
    scene: {
      flex: 1,
      backgroundColor: C.background,
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
