import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import RNFS from "react-native-fs";
import FastImage from "react-native-fast-image";
import { useNavigation } from "@react-navigation/native";
import React, { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { VideoItem, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { convertVideoToAudio } from "@/services/converterService";
import { formatDate, formatDuration, formatFileSize } from "@/utils/formatters";
import { getThumbnailUri } from "@/utils/thumbnailSource";

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
  const { toggleFavorite, removeVideo, setCurrentVideo, addVideo } = usePlayer();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
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
  const isNew = video.playCount === 0;
  const resolvedTagLabel = video.isClip ? "CLIP" : (isNew ? "NEW" : tagLabel);
  const resolvedThumbnailUri = getThumbnailUri(video.thumbnail);
  const hasImage = Boolean(resolvedThumbnailUri);
  const artworkInitial = (video.artist ?? video.album ?? video.folder ?? video.title ?? "A")
    .trim()
    .charAt(0)
    .toUpperCase();
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

  const durationSeconds =
    video.duration > 10000 ? video.duration / 1000 : video.duration;
  const progress =
    durationSeconds > 0 && video.lastPosition
      ? Math.min(video.lastPosition / durationSeconds, 1)
      : 0;

  const playbackLabel =
    video.playCount > 0 ? (isAudio ? "PLAYED" : "WATCHED") : undefined;
  const detailItems = useMemo(
    () =>
      [
        {
          icon: "clock",
          label: formatDuration(video.duration > 10000 ? video.duration / 1000 : video.duration),
        },
        {
          icon: "hard-drive",
          label: formatFileSize(video.size),
        },
        {
          icon: "folder",
          label: video.folder ?? (isAudio ? "Unknown folder" : "No folder"),
        },
        {
          icon: isAudio ? "user" : "calendar",
          label: isAudio
            ? video.artist ?? "Unknown artist"
            : video.dateAdded
              ? formatDate(video.dateAdded)
              : "No date",
        },
        ...(isAudio
          ? [
              {
                icon: "disc",
                label: video.album ?? video.folder ?? "Unknown album",
              },
            ]
          : []),
      ].filter((item) => item.label && item.label !== "0 B"),
    [isAudio, video.album, video.artist, video.dateAdded, video.duration, video.folder, video.size]
  );
  const visibleDetailItems = detailsExpanded ? detailItems : detailItems.slice(0, 2);

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
        size={compact ? 14 : 16}
        color={video.isFavorite ? colors.accent : colors.textSecondary}
      />
    </Pressable>
  );

  const trailingNode = selectionMode ? defaultTrailing : (trailing ?? defaultTrailing);

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
              source={{ uri: resolvedThumbnailUri ?? undefined }}
              style={styles.thumbImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : isAudio ? (
            <View style={[styles.audioArtwork, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[styles.audioArtworkInitial, { color: colors.primary }]}>
                {artworkInitial}
              </Text>
              <Feather name="music" size={16} color={colors.primary} />
            </View>
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
            <View style={[styles.typeBadge, { backgroundColor: isNew ? `${colors.accent}24` : `${colors.primary}24` }]}>
              <Text style={[styles.typeBadgeText, { color: isNew ? colors.accent : colors.primary }]}>
                {resolvedTagLabel}
              </Text>
            </View>
            {video.duration > 0 ? (
              <Text style={[styles.compactMeta, { color: colors.textSecondary }]}>
                {formatDuration(video.duration > 10000 ? video.duration / 1000 : video.duration)}
              </Text>
            ) : null}
            {video.size > 0 ? (
              <Text style={[styles.compactMeta, { color: colors.textTertiary }]}>
                {formatFileSize(video.size)}
              </Text>
            ) : null}
            {playbackLabel ? (
              <View style={[styles.statusBadge, { borderColor: colors.border }]}>
                <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                  {playbackLabel}
                </Text>
              </View>
            ) : null}
          </View>
          {video.folder ? (
            <View style={styles.compactFolderRow}>
              <Feather name="folder" size={10} color={colors.textTertiary} />
              <Text style={[styles.compactFolderText, { color: colors.textTertiary }]} numberOfLines={1}>
                {video.folder}
              </Text>
            </View>
          ) : null}
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
      <View style={styles.cardContent}>
        <View
          style={[
            styles.thumbnail,
            { backgroundColor: `${colors.primary}18` },
          ]}
        >
          {hasImage ? (
            <FastImage
              source={{ uri: resolvedThumbnailUri ?? undefined }}
              style={styles.thumbImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : isAudio ? (
            <View style={[styles.audioArtwork, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[styles.audioArtworkInitial, { color: colors.primary }]}>
                {artworkInitial}
              </Text>
              <Feather name="music" size={20} color={colors.primary} />
            </View>
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
              <View style={[styles.typeBadge, { backgroundColor: isNew ? `${colors.accent}24` : `${colors.primary}24` }]}>
                <Text style={[styles.typeBadgeText, { color: isNew ? colors.accent : colors.primary }]}>
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
      </View>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          setDetailsExpanded((value) => !value);
        }}
        style={[styles.detailsPanel, { borderTopColor: colors.border }]}
      >
        <View style={styles.detailsList}>
          {visibleDetailItems.map((item) => (
            <View key={`${item.icon}:${item.label}`} style={styles.detailItem}>
              <Feather name={item.icon as any} size={13} color={colors.textTertiary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        <Feather
          name={detailsExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
    </Pressable>
  );
}

export const VideoCard = memo(VideoCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thumbnail: {
    width: 80,
    height: 64,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  audioArtwork: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  audioArtworkInitial: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  progressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
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
    gap: 8,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 16,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  meta: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  dot: {
    fontSize: 11,
  },
  detailsPanel: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  detailsList: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  detailItem: {
    minWidth: 0,
    maxWidth: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  favoriteBtn: {
    padding: 4,
  },
  selectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1,
  },
  compactThumb: {
    width: 62,
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
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
    minWidth: 0,
    gap: 2,
  },
  compactMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  compactTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
    lineHeight: 15,
  },
  compactMeta: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  compactFolderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  compactFolderText: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    flexShrink: 1,
  },
});
