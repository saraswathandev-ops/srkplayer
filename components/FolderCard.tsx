import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from "@react-navigation/native";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type FolderItem } from "@/types/player";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatFileSize } from "@/utils/formatters";

type Props = {
  folder: FolderItem;
  onPress?: () => void;
  onLongPress?: (folder: FolderItem) => void;
};

function formatRelativeDate(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function FolderCardComponent({ folder, onPress: onPressProp, onLongPress }: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();

  const handlePress = useCallback(() => {
    if (onPressProp) {
      onPressProp();
    } else {
      navigation.navigate("folder", { id: folder.id });
    }
  }, [folder.id, onPressProp]);

  const updatedLabel = formatRelativeDate(folder.updatedAt);
  const itemCountLabel =
    folder.videoCount === 1 ? "1 item" : `${folder.videoCount} items`;
  const unwatchedLabel = folder.unwatchedCount > 0 ? `${folder.unwatchedCount} unwatched` : null;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => onLongPress?.(folder)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.backgroundTertiary : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Folder icon — always shown, no cover image */}
      <View style={[styles.iconWrap, { backgroundColor: folder.isPrivate ? `${colors.accent}18` : `${colors.primary}18` }]}>
        <Feather name={folder.isPrivate ? "lock" : "folder"} size={26} color={folder.isPrivate ? colors.accent : colors.primary} />
      </View>

      {/* Info block */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {folder.name}
        </Text>
        <View style={styles.metaRow}>
          <Feather name="layers" size={11} color={colors.textTertiary} />
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {itemCountLabel}
          </Text>
          {unwatchedLabel ? (
            <>
              <Text style={[styles.sep, { color: colors.textTertiary }]}>·</Text>
              <Text style={[styles.meta, { color: colors.accent, fontFamily: 'Inter_700Bold' }]}>
                {unwatchedLabel}
              </Text>
            </>
          ) : null}
          {updatedLabel ? (
            <>
              <Text style={[styles.sep, { color: colors.textTertiary }]}>·</Text>
              <Feather name="clock" size={9} color={colors.textTertiary} />
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {updatedLabel}
              </Text>
            </>
          ) : null}
        </View>
        <View style={styles.pathRow}>
          <Feather name="hard-drive" size={10} color={colors.textTertiary} />
          <Text
            style={[styles.pathText, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {folder.id}
          </Text>
        </View>
      </View>

      <Feather name="chevron-right" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

export const FolderCard = memo(FolderCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  meta: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  sep: {
    fontSize: 11,
  },
  pathRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  pathText: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    flexShrink: 1,
  },
});
