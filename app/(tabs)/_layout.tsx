import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../lib/theme";
import ExploreScreen from "./explore";
import HomeScreen from "./index";
import ProfileScreen from "./profile";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type TabDef = {
  key: string;
  label: string;
  icon: IoniconName;
  iconOutline: IoniconName;
};

const TABS: TabDef[] = [
  { key: "home", label: "Home", icon: "home", iconOutline: "home-outline" },
  {
    key: "explore",
    label: "Explore",
    icon: "compass",
    iconOutline: "compass-outline",
  },
  {
    key: "profile",
    label: "Profile",
    icon: "person-circle",
    iconOutline: "person-circle-outline",
  },
];

export default function TabLayout() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const [activePage, setActivePage] = useState(0);

  const goToPage = (page: number) => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    pagerRef.current?.setPage(page);
    setActivePage(page);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        <View key="0" style={{ flex: 1 }}>
          <HomeScreen isFocused={activePage === 0} />
        </View>
        <View key="1" style={{ flex: 1 }}>
          <ExploreScreen />
        </View>
        <View key="2" style={{ flex: 1 }}>
          <ProfileScreen isFocused={activePage === 2} />
        </View>
      </PagerView>

      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: C.background,
            borderTopColor: C.border,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {TABS.map((tab, index) => {
          const active = activePage === index;
          return (
            <Pressable
              key={tab.key}
              style={styles.tabItem}
              onPress={() => goToPage(index)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={active ? tab.icon : tab.iconOutline}
                size={26}
                color={active ? C.text : C.textTertiary}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
});
