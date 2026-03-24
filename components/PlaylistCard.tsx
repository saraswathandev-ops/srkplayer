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

type Props = {
  playlist: Playlist;
  onPress: (playlist: Playlist) => void;
};

export function PlaylistCard({ playlist, onPress }: Props) {
  const { colors } = useAppTheme();
  const { deletePlaylist } = usePlayer();

  const videoCount = playlist.videoCount;
  const artworkSource = playlist.coverUri
    ? playlist.coverUri
    : playlist.coverHash
      ? { thumbhash: playlist.coverHash }
      : null;
  const artworkPlaceholder = undefined; // thumbhash placeholders not supported without expo-image

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
        { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient
        colors={[`${colors.primary}30`, `${colors.primaryDark}22`]}
        style={styles.iconBox}
      >
        {artworkSource ? (
          <FastImage
            source={typeof artworkSource === "string" ? { uri: artworkSource } : undefined}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="list" size={18} color={colors.primary} />
        )}
      </LinearGradient>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {videoCount} {videoCount === 1 ? "video" : "videos"}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    gap: 14,
    borderWidth: 1,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 5,
  },
  count: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
