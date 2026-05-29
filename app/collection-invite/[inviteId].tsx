import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { acceptCollectionInvite, declineCollectionInvite } from "../../lib/collections";
import { auth, db } from "../../lib/firebaseConfig";
import { createNotification } from "../../lib/notifications";
import { ThemeColors, useTheme } from "../../lib/theme";

export default function CollectionInviteScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();

  const [invite, setInvite] = useState<any>(null);
  const [ownerUsername, setOwnerUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const snap = await getDoc(doc(db, "collectionInvites", inviteId));
        if (!snap.exists()) { setLoading(false); return; }
        const data = snap.data();
        setInvite({ id: snap.id, ...data });

        const ownerSnap = await getDoc(doc(db, "users", data.invitedBy));
        if (ownerSnap.exists()) {
          setOwnerUsername(ownerSnap.data().username || "");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [inviteId]);

  const handleAccept = async () => {
    if (!invite || acting) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setActing(true);
    try {
      await acceptCollectionInvite({
        inviteId: invite.id,
        collectionId: invite.collectionId,
      });
      await createNotification({
        recipientId: invite.invitedBy,
        type: "collection_invite_accepted",
        actorId: uid,
        collectionId: invite.collectionId,
        previewText: invite.collectionName,
      });
      router.replace({
        pathname: "/collection/[id]",
        params: { id: invite.collectionId },
      });
    } catch {
      Alert.alert("Error", "Could not accept invite. Please try again.");
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!invite || acting) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setActing(true);
    try {
      await declineCollectionInvite({
        inviteId: invite.id,
        collectionId: invite.collectionId,
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not decline invite. Please try again.");
      setActing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.textSecondary} />
      </View>
    );
  }

  if (!invite) {
    return (
      <View style={styles.center}>
        <Text style={styles.dimText}>Invite not found.</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (invite.status !== "pending") {
    const label = invite.status === "accepted" ? "already accepted" : "already declined";
    return (
      <View style={styles.center}>
        <Text style={styles.dimText}>You've {label} this invite.</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>You've been invited to join</Text>
        <Text style={styles.collectionName}>{invite.collectionName}</Text>
        {ownerUsername ? (
          <Text style={styles.from}>by @{ownerUsername}</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.acceptBtn, acting && styles.btnDisabled]}
          onPress={handleAccept}
          disabled={acting}
        >
          <Text style={styles.acceptBtnText}>{acting ? "Joining…" : "Join collection"}</Text>
        </Pressable>

        <Pressable
          style={[styles.declineBtn, acting && styles.btnDisabled]}
          onPress={handleDecline}
          disabled={acting}
        >
          <Text style={styles.declineBtnText}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.background, gap: 16 },
    dimText: { color: C.textTertiary, fontSize: 16, textAlign: "center", paddingHorizontal: 32 },
    backLink: { paddingHorizontal: 20, paddingVertical: 10 },
    backLinkText: { color: C.textSecondary, fontWeight: "700", fontSize: 15 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 56,
      paddingBottom: 10,
      paddingHorizontal: 18,
    },
    backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
    backBtnText: { fontSize: 28, fontWeight: "700", color: C.text, lineHeight: 32, marginTop: -2 },
    card: {
      marginTop: 48,
      marginHorizontal: 24,
      backgroundColor: C.surface,
      borderRadius: 22,
      paddingVertical: 36,
      paddingHorizontal: 28,
      alignItems: "center",
      gap: 8,
    },
    label: {
      fontSize: 14,
      color: C.textTertiary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    collectionName: {
      fontSize: 28,
      fontWeight: "900",
      color: C.text,
      textAlign: "center",
      lineHeight: 34,
      marginTop: 4,
    },
    from: {
      fontSize: 15,
      color: C.textSecondary,
      fontWeight: "600",
      marginTop: 4,
    },
    actions: {
      marginTop: 40,
      paddingHorizontal: 24,
      gap: 14,
    },
    acceptBtn: {
      backgroundColor: C.buttonPrimary,
      paddingVertical: 18,
      borderRadius: 18,
      alignItems: "center",
    },
    acceptBtnText: {
      color: C.buttonPrimaryText,
      fontSize: 17,
      fontWeight: "800",
    },
    declineBtn: {
      paddingVertical: 14,
      alignItems: "center",
    },
    declineBtnText: {
      color: C.textSecondary,
      fontSize: 16,
      fontWeight: "700",
    },
    btnDisabled: { opacity: 0.5 },
  });
}
