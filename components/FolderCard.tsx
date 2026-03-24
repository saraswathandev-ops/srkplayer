import Feather from 'react-native-vector-icons/Feather';
import FastImage from "react-native-fast-image";
import { useNavigation } from "@react-navigation/native";
import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type FolderItem } from "@/types/player";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  folder: FolderItem;
  onPress?: () => void;
};

function FolderCardComponent({ folder, onPress: onPressProp }: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const source = folder.coverUri
    ? folder.coverUri
    : folder.coverHash
      ? { thumbhash: folder.coverHash }
      : null;
  const placeholder =
    folder.coverUri && folder.coverHash ? { thumbhash: folder.coverHash } : undefined;

  const handlePress = useCallback(() => {
    if (onPressProp) {
      onPressProp();
    } else {
      navigation.navigate("folder", { id: folder.id });
    }
  }, [folder.id, onPressProp]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.backgroundTertiary : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.folderArt, { backgroundColor: colors.backgroundTertiary }]}>
        <View style={[styles.folderTab, { backgroundColor: colors.backgroundSecondary }]} />
        {source ? (
          <FastImage
            source={{ uri: typeof source === 'string' ? source : undefined }}
            style={styles.cover}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <Feather name="folder" size={34} color={colors.primary} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {folder.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {folder.videoCount} {folder.videoCount === 1 ? "item" : "items"}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

export const FolderCard = memo(FolderCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  folderArt: {
    width: 92,
    height: 78,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  folderTab: {
    position: "absolute",
    top: 0,
    left: 12,
    width: 36,
    height: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 1,
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
