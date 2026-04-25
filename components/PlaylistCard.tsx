import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FastImage from "react-native-fast-image";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import LinearGradient from "react-native-linear-gradient";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Playlist, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getThumbnailUri } from "@/utils/thumbnailSource";

type Props = {
  playlist: Playlist;
  onPress: (playlist: Playlist) => void;
};

export function PlaylistCard({ playlist, onPress }: Props) {
  const { colors } = useAppTheme();
  const { deletePlaylist } = usePlayer();

  const videoCount = playlist.videoCount;
  const artworkSource = getThumbnailUri(playlist.coverUri);

  const handleLongPress = () => {
    if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactMedium", { enableVibrateFallback: true });
    Alert.alert(playlist.name, "Delete this playlist?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deletePlaylist(playlist.id),
      },
    ]);
  };

  return (
    <Pressable
      onPress={() => onPress(playlist)}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient
        colors={[`${colors.primary}30`, `${colors.primaryDark}22`]}
        style={styles.iconBox}
      >
        {artworkSource ? (
          <FastImage
            source={{ uri: artworkSource }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="list" size={14} color={colors.primary} />
        )}
      </LinearGradient>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {videoCount} {videoCount === 1 ? "item" : "items"}
        </Text>
      </View>
      <Feather name="chevron-right" size={14} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  count: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
