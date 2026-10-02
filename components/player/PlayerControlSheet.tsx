import React, { memo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Action = {
  key: string;
  title: string;
  value?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  actions: Action[];
  onClose: () => void;
};

function PlayerControlSheetBase({ visible, title, actions, onClose }: Props) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {actions.map(action => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                disabled={action.disabled}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.action,
                  action.active && styles.active,
                  pressed && styles.pressed,
                  action.disabled && styles.disabled,
                ]}
              >
                <View style={styles.icon}>{action.icon}</View>
                <Text numberOfLines={1} style={styles.actionTitle}>{action.title}</Text>
                {action.value ? <Text numberOfLines={1} style={styles.value}>{action.value}</Text> : null}
              </Pressable>
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
  sheet: { maxHeight: "72%", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: "#101114", paddingBottom: 24 },
  header: { minHeight: 60, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.12)" },
  title: { color: "#fff", fontSize: 17, fontWeight: "700" },
  close: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#fff", fontSize: 30, fontWeight: "300" },
  grid: { padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { width: "31%", minHeight: 72, padding: 9, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  active: { backgroundColor: "rgba(74,163,255,0.22)" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  icon: { minHeight: 24, alignItems: "center", justifyContent: "center" },
  actionTitle: { color: "#fff", fontSize: 11, fontWeight: "600", marginTop: 4 },
  value: { color: "rgba(255,255,255,0.58)", fontSize: 9, marginTop: 2 },
});
