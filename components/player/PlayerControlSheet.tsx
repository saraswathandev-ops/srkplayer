import React, { memo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerControlItem } from "@/components/player/PlayerControlItem";

export type PlayerControlAction = {
  key: string;
  title: string;
  value?: string;
  section?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  actions: PlayerControlAction[];
  onClose: () => void;
};

function PlayerControlSheetBase({ visible, title, actions, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const sections = new Map<string | undefined, PlayerControlAction[]>();
  for (const action of actions) {
    const section = sections.get(action.section);
    if (section) section.push(action);
    else sections.set(action.section, [action]);
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <Pressable style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no" onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(12, insets.bottom) }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {Array.from(sections, ([label, items]) => (
              <View key={label ?? "actions"} style={styles.section}>
                {label ? <Text style={styles.sectionTitle} accessibilityRole="header">{label}</Text> : null}
                {items.map(action => (
                  <PlayerControlItem
                    key={action.key}
                    title={action.title}
                    value={action.value}
                    icon={action.icon}
                    active={action.active}
                    disabled={action.disabled}
                    onPress={action.onPress}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const PlayerControlSheet = memo(PlayerControlSheetBase);

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { width: "100%", maxWidth: 560, maxHeight: "82%", alignSelf: "center", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: "#101114" },
  header: { minHeight: 56, flexShrink: 0, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.12)" },
  title: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700" },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#fff", fontSize: 30, fontWeight: "300" },
  content: { padding: 12, gap: 16 },
  section: { gap: 6 },
  sectionTitle: { color: "#ADB7C6", fontSize: 13, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 4 },
});
