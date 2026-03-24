import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import RNFS from "react-native-fs";
import FastImage from "react-native-fast-image";
import { useNavigation } from "@react-navigation/native";
import React, { memo, type ReactNode, useCallback, useEffect, useRef } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { VideoItem, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ensureVideoThumbnail } from "@/services/videoService";
import { convertVideoToAudio } from "@/services/converterService";

type Props = {
  video: VideoItem;
  compact?: boolean;
  onPress?: (video: VideoItem) => void;
  onLongPress?: (video: VideoItem) => void;
  selected?: boolean;
  selectionMode?: boolean;
  hideFavorite?: boolean;
  trailing?: ReactNode;
};

function VideoCardComponent({
  video,
  compact = false,
  onPress,
  onLongPress,
  selected = false,
  selectionMode = false,
  hideFavorite = false,
  trailing,
}: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const { toggleFavorite, removeVideo, setCurrentVideo, reloadVideos, addVideo } = usePlayer();
  const thumbnailRequestRef = useRef<string | null>(null);
  const isAudio = video.mediaType === "audio";
  const mediaLabel = isAudio ? "SONG" : "MV";
  const mediaIconName = isAudio ? "music" : "film";
  const qualityLabel =
    video.title.toLowerCase().includes("4k") || video.size > 250 * 1024 * 1024
      ? "4K"
      : "HD";
  const tagLabel = video.title.toLowerCase().includes("lyric")
    ? "LYRIC"
    : video.title.toLowerCase().includes("film") || video.title.toLowerCase().includes("movie")
      ? "FILM"
      : video.title.toLowerCase().includes("pop")
        ? "POP"
        : mediaLabel;
  const resolvedTagLabel = video.isClip ? "CLIP" : tagLabel;
  const resolvedThumbnailSource = video.thumbnail && video.thumbnail !== "failed" ? video.thumbnail : null;
  const thumbnailPlaceholder = video.thumbnailHash ? { thumbhash: video.thumbnailHash } : null;
  const hasImage = Boolean(resolvedThumbnailSource || thumbnailPlaceholder);
  const appStorageRoots = [RNFS.DocumentDirectoryPath, RNFS.CachesDirectoryPath].filter(
    (value): value is string => Boolean(value)
  ).map(root => 'file://' + root);
  const supportsPermanentDelete =
    !video.isClip && appStorageRoots.some((root) => video.uri.startsWith(root));

  // Removed on-the-fly ensureVideoThumbnail to improve scroll performance.
  // Thumbnails are now fully generated automatically in the background by PlayerContext.

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger('impactLight');
    }

    if (onPress) {
      onPress(video);
      return;
    }

    setCurrentVideo(video);
    navigation.navigate("player", { id: video.id });
  }, [onPress, setCurrentVideo, video]);

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger('impactMedium');
    }

    if (onLongPress) {
      onLongPress(video);
      return;
    }

    Alert.alert(video.title, "What would you like to do?", [
      {
        text: video.isFavorite ? "Remove from Favorites" : "Add to Favorites",
        onPress: () => toggleFavorite(video.id),
      },
      {
        text: "Temporary Remove",
        onPress: () =>
          Alert.alert("Temporary Remove", "Remove this video from the library only?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: () => removeVideo(video.id, "temporary"),
            },
          ]),
      },
      ...(video.mediaType === "video" && !video.isClip && !video.uri.startsWith("http")
        ? [
          {
            text: "Extract Audio (MP3)",
            onPress: () => {
              Alert.alert("Extracting Audio", "Depending on video size, this may take a few seconds.");
              convertVideoToAudio(video).then((audioUri) => {
                return addVideo({
                  title: `${video.title} (Audio)`,
                  uri: audioUri,
                  duration: video.duration,
                  size: Math.max(Math.round(video.size / 5), 1024),
                  dateAdded: Date.now(),
                  mediaType: "audio",
                  folder: video.folder,
                });
              }).then(() => {
                Alert.alert("Success", "Audio has been extracted and added to your Audio Library!");
              }).catch((err) => {
                Alert.alert("Conversion Failed", err.message || "Unknown error occurred.");
              });
            },
          },
        ]
        : []),
      ...(supportsPermanentDelete
        ? [
          {
            text: "Permanent Delete",
            style: "destructive" as const,
            onPress: () =>
              Alert.alert(
                "Permanent Delete",
                "Delete this item directly. Recycle bin is not available here, so this cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive" as const,
                    onPress: () => removeVideo(video.id, "permanent"),
                  },
                ]
              ),
          },
        ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }, [onLongPress, removeVideo, toggleFavorite, video]);

  const handleFavorite = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      if (Platform.OS !== "web") {
        ReactNativeHapticFeedback.trigger('impactLight');
      }
      void toggleFavorite(video.id);
    },
    [toggleFavorite, video.id]
  );

  const progress =
    video.duration > 0 && video.lastPosition
      ? Math.min(video.lastPosition / video.duration, 1)
      : 0;

  const playbackLabel =
    video.playCount > 0 ? (isAudio ? "PLAYED" : "WATCHED") : undefined;

  const defaultTrailing = selectionMode ? (
    <View
      style={[
        styles.selectionBadge,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : "transparent",
        },
      ]}
    >
      <Feather
        name={selected ? "check" : "circle"}
        size={16}
        color={selected ? "#fff" : colors.textSecondary}
      />
    </View>
  ) : hideFavorite ? null : (
    <Pressable onPress={handleFavorite} style={styles.favoriteBtn} hitSlop={10}>
      <Ionicons
        name={video.isFavorite ? "heart" : "heart-outline"}
        size={compact ? 18 : 20}
        color={video.isFavorite ? colors.accent : colors.textSecondary}
      />
    </Pressable>
  );

  const trailingNode = trailing ?? defaultTrailing;

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={({ pressed }) => [
          styles.compactCard,
          {
            backgroundColor: selected ? `${colors.primary}12` : colors.card,
            borderColor: selected ? colors.primary : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.compactThumb,
            { backgroundColor: `${colors.primary}18` },
          ]}
        >
          {hasImage ? (
            <FastImage
              source={{ uri: resolvedThumbnailSource ?? undefined }}
              style={styles.thumbImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <Feather name={mediaIconName} size={18} color={colors.primary} />
          )}
          {progress > 0 ? (
            <View style={styles.compactProgressBar}>
              <View
                style={[
                  styles.compactProgressFill,
                  {
                    width: `${progress * 100}%` as const,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.compactInfo}>
          <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>
            {video.title}
          </Text>
          <View style={styles.compactMetaRow}>
            <Text style={[styles.compactMeta, { color: colors.textSecondary }]}>
              {qualityLabel}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: `${colors.primary}24` }]}>
              <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                {resolvedTagLabel}
              </Text>
            </View>
            {playbackLabel ? (
              <View style={[styles.statusBadge, { borderColor: colors.border }]}>
                <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                  {playbackLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {trailingNode}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? `${colors.primary}12` : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.thumbnail,
          { backgroundColor: `${colors.primary}18` },
        ]}
      >
        {hasImage ? (
          <FastImage
            source={{ uri: resolvedThumbnailSource ?? undefined }}
            style={styles.thumbImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <Feather name={mediaIconName} size={24} color={colors.primary} />
        )}
        {progress > 0 ? (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%` as const,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.infoRow}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {video.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {qualityLabel}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: `${colors.primary}24` }]}>
              <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                {resolvedTagLabel}
              </Text>
            </View>
            {playbackLabel ? (
              <View style={[styles.statusBadge, { borderColor: colors.border }]}>
                <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                  {playbackLabel}
                </Text>
              </View>
            ) : null}
            {video.playCount > 0 ? (
              <>
                <Text style={[styles.dot, { color: colors.textTertiary }]}>|</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {video.playCount}x
                </Text>
              </>
            ) : null}
          </View>
        </View>
        {trailingNode}
      </View>
    </Pressable>
  );
}

export const VideoCard = memo(VideoCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 30,
    padding: 16,
    marginBottom: 14,
    gap: 16,
    borderWidth: 1,
  },
  thumbnail: {
    width: 108,
    height: 86,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  progressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  infoRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  meta: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  typeBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  dot: {
    fontSize: 14,
  },
  favoriteBtn: {
    padding: 4,
  },
  selectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
  },
  compactThumb: {
    width: 88,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  compactProgressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  compactProgressFill: {
    height: "100%",
  },
  compactInfo: {
    flex: 1,
  },
  compactMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  compactTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  compactMeta: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
