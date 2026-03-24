import Feather from 'react-native-vector-icons/Feather';
import FastImage from "react-native-fast-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import {
  downloadRemoteVideoVariant,
  YOUTUBE_DOWNLOAD_QUALITIES,
  type YouTubeDownloadQuality,
} from "../../services/directVideoDownloads";
import {
  getYouTubeHomeFeed,
  getYouTubeTopViewed,
  hasYouTubeApiKey,
  searchYouTubeVideos,
  type YouTubeVideoItem,
} from "../../services/youtubeService";

const DISCOVERY_TABS = ["Search", "YouTube", "Music", "More"] as const;

export default function YouTubeScreen() {
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { addVideo, videos } = usePlayer();
  const [selectedCard, setSelectedCard] = useState<YouTubeVideoItem | null>(null);
  const [selectedQuality, setSelectedQuality] =
    useState<YouTubeDownloadQuality>("720p");
  const [searchQuery, setSearchQuery] = useState("");
  const [qualityUrls, setQualityUrls] = useState<
    Record<YouTubeDownloadQuality, string>
  >({
    "360p": "",
    "480p": "",
    "720p": "",
    "1080p": "",
    "2K": "",
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [feedVideos, setFeedVideos] = useState<YouTubeVideoItem[]>([]);
  const [topViewedVideos, setTopViewedVideos] = useState<YouTubeVideoItem[]>([]);
  const [searchResults, setSearchResults] = useState<YouTubeVideoItem[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);
  const apiConfigured = hasYouTubeApiKey();

  const downloadedVideos = useMemo(
    () => videos.filter((video) => video.folder === "YouTube Downloads"),
    [videos]
  );
  const activeList = searchQuery.trim() ? searchResults : feedVideos;

  useEffect(() => {
    let isMounted = true;

    async function loadFeed() {
      if (!apiConfigured) {
        setIsLoadingFeed(false);
        setFeedError(
          "Add EXPO_PUBLIC_YOUTUBE_API_KEY in your Expo environment to load live YouTube videos."
        );
        return;
      }

      try {
        setIsLoadingFeed(true);
        setFeedError(null);

        const [feed, topViewed] = await Promise.all([
          getYouTubeHomeFeed(),
          getYouTubeTopViewed(),
        ]);

        if (!isMounted) return;
        setFeedVideos(feed);
        setTopViewedVideos(topViewed);
      } catch (error) {
        if (!isMounted) return;
        setFeedError(
          error instanceof Error ? error.message : "Failed to load YouTube videos."
        );
      } finally {
        if (isMounted) {
          setIsLoadingFeed(false);
        }
      }
    }

    void loadFeed();

    return () => {
      isMounted = false;
    };
  }, [apiConfigured]);

  useEffect(() => {
    let isMounted = true;

    async function runSearch() {
      const trimmedQuery = searchQuery.trim();

      if (!trimmedQuery) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      if (!apiConfigured) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        const results = await searchYouTubeVideos(trimmedQuery);
        if (!isMounted) return;
        setSearchResults(results);
      } catch (error) {
        if (!isMounted) return;
        setSearchResults([]);
        setFeedError(
          error instanceof Error ? error.message : "Failed to search YouTube videos."
        );
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }

    const timeoutId = setTimeout(() => {
      void runSearch();
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [apiConfigured, searchQuery]);

  const closeSheet = () => {
    if (isDownloading) return;
    setSelectedCard(null);
    setDownloadProgress(0);
  };

  const updateSelectedQualityUrl = (value: string) => {
    setQualityUrls((current) => ({
      ...current,
      [selectedQuality]: value,
    }));
  };

  const handleDownload = async () => {
    if (!selectedCard) return;

    const sourceUrl = qualityUrls[selectedQuality]?.trim();
    if (!sourceUrl) {
      Alert.alert(
        "Direct link required",
        `Paste a direct video file URL for ${selectedQuality} before downloading.`
      );
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      const draft = await downloadRemoteVideoVariant({
        sourceUrl,
        title: selectedCard.title,
        quality: selectedQuality,
        onProgress: setDownloadProgress,
      });

      await addVideo(draft);

      Alert.alert(
        "Download complete",
        `${selectedCard.title} was saved to your offline library.`
      );
      setSelectedCard(null);
      setDownloadProgress(0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The download could not be completed.";
      Alert.alert("Download failed", message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenVideo = async (item: YouTubeVideoItem) => {
    try {
      await Linking.openURL(item.videoUrl);
    } catch {
      Alert.alert("Open failed", "Could not open this YouTube video.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenBackdrop artwork={feedVideos[0]?.thumbnail} />
      <ScreenHeader title="YouTube" topPad={topPad} bottomSpacing={10} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 24 },
        ]}
      >
        <View style={styles.discoveryTabs}>
          {DISCOVERY_TABS.map((tab) => {
            const isActive = tab === "YouTube";

            return (
              <View key={tab} style={styles.discoveryTabWrap}>
                <Text
                  style={[
                    styles.discoveryTabText,
                    { color: isActive ? colors.text : colors.textSecondary },
                  ]}
                >
                  {tab}
                </Text>
                {isActive ? (
                  <View
                    style={[
                      styles.discoveryUnderline,
                      { backgroundColor: "#FFC107" },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search live YouTube videos..."
        />

        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>
            YouTube-style downloads
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Live integrated YouTube feed with top-view videos and offline download slots.
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Search, browse trending videos, open the live YouTube page, and save direct
            file streams from 360p up to 2K into the app library.
          </Text>
        </View>

        {feedError ? (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="info" size={22} color={colors.primary} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Live feed not ready
            </Text>
            <Text style={[styles.infoCopy, { color: colors.textSecondary }]}>
              {feedError}
            </Text>
          </View>
        ) : null}

        {isLoadingFeed ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading live YouTube feed...
            </Text>
          </View>
        ) : null}

        {!isLoadingFeed && activeList.map((item) => (
          <View
            key={item.id}
            style={[
              styles.featureCard,
              { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
            ]}
          >
            <Pressable onPress={() => handleOpenVideo(item)} style={styles.thumbnailWrap}>
              <FastImage
                source={{ uri: item.thumbnail }}
                style={styles.featureImage}
                resizeMode={FastImage.resizeMode.cover}
              />
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{item.duration}</Text>
              </View>
            </Pressable>

            <View style={styles.featureMetaRow}>
              <View style={styles.channelAvatar}>
                <Text style={styles.channelAvatarText}>
                  {item.channel.slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <View style={styles.featureTextWrap}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.featureMeta, { color: colors.textSecondary }]}>
                  {item.channel} | {item.views} | {item.age}
                </Text>
              </View>

              <View style={styles.featureActions}>
                <Pressable
                  onPress={() => handleOpenVideo(item)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.backgroundTertiary : colors.card,
                    },
                  ]}
                >
                  <Feather name="external-link" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => setSelectedCard(item)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.backgroundTertiary : colors.card,
                    },
                  ]}
                >
                  <Feather name="download" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Views</Text>
          <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
            Most popular YouTube videos for your region, shown as a live top-view list.
          </Text>
        </View>

        <View style={styles.quickGrid}>
          {topViewedVideos.slice(0, 3).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleOpenVideo(item)}
              style={[
                styles.quickCard,
                { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
              ]}
            >
              <FastImage
                source={{ uri: item.thumbnail }}
                style={styles.quickImage}
                resizeMode={FastImage.resizeMode.cover}
              />
              <View style={styles.quickBody}>
                <Text style={[styles.quickTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.quickMeta, { color: colors.textSecondary }]}>
                  {item.views} | {item.duration}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {isSearching ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Searching YouTube...
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Downloaded Here
          </Text>
          <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
            Files saved from this screen land in your library as offline media.
          </Text>
        </View>

        {downloadedVideos.length > 0 ? (
          downloadedVideos.slice(0, 4).map((video) => (
            <VideoCard key={video.id} video={video} compact />
          ))
        ) : (
          <View
            style={[
              styles.emptyPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="download-cloud" size={28} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No downloads yet
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
              Tap a download icon, choose a quality, and paste the direct file URL for that
              stream.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={selectedCard != null}
        animationType="slide"
        transparent
        onRequestClose={closeSheet}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
            ]}
          >
            <KeyboardAwareScrollViewCompat
              contentContainerStyle={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetHandleWrap}>
                <View
                  style={[styles.sheetHandle, { backgroundColor: colors.border }]}
                />
              </View>

              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleBlock}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    {selectedCard?.title}
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                    Add direct links for each quality and save the stream you want offline.
                  </Text>
                </View>
                <Pressable
                  onPress={closeSheet}
                  disabled={isDownloading}
                  style={styles.closeButton}
                >
                  <Feather name="x" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.qualityGrid}>
                {YOUTUBE_DOWNLOAD_QUALITIES.map((quality) => {
                  const isActive = quality === selectedQuality;
                  const hasLink = Boolean(qualityUrls[quality]?.trim());

                  return (
                    <Pressable
                      key={quality}
                      onPress={() => setSelectedQuality(quality)}
                      style={[
                        styles.qualityChip,
                        {
                          borderColor: isActive ? colors.primary : colors.border,
                          backgroundColor: isActive
                            ? `${colors.primary}18`
                            : colors.background,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.qualityChipText,
                          { color: isActive ? colors.primary : colors.text },
                        ]}
                      >
                        {quality}
                      </Text>
                      {hasLink ? (
                        <View
                          style={[
                            styles.qualityDot,
                            { backgroundColor: colors.success },
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.inputBlock}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {selectedQuality} direct video URL
                </Text>
                <TextInput
                  value={qualityUrls[selectedQuality]}
                  onChangeText={updateSelectedQualityUrl}
                  placeholder="https://example.com/video-720p.mp4"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  The downloader accepts direct file links like MP4 or WebM. It does not
                  resolve standard YouTube page URLs by itself.
                </Text>
              </View>

              {isDownloading ? (
                <View
                  style={[
                    styles.progressCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
                  <View style={styles.progressMeta}>
                    <Text style={[styles.progressTitle, { color: colors.text }]}>
                      Downloading {selectedQuality}
                    </Text>
                    <Text style={[styles.progressCopy, { color: colors.textSecondary }]}>
                      {Math.round(downloadProgress * 100)}% complete
                    </Text>
                    <View
                      style={[
                        styles.progressTrack,
                        { backgroundColor: colors.backgroundTertiary },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(downloadProgress * 100, 4)}%` as const,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={handleDownload}
                disabled={isDownloading}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: isDownloading ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="download" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  Download {selectedQuality}
                </Text>
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 18,
  },
  discoveryTabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 2,
    marginBottom: 8,
  },
  discoveryTabWrap: {
    alignItems: "center",
    gap: 10,
  },
  discoveryTabText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  discoveryUnderline: {
    width: 92,
    height: 4,
    borderRadius: 999,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  infoCopy: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  loadingCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  featureCard: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumbnailWrap: {
    position: "relative",
  },
  featureImage: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  durationBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(20,20,20,0.82)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  featureMetaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  channelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#131313",
    alignItems: "center",
    justifyContent: "center",
  },
  channelAvatarText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  featureTextWrap: {
    flex: 1,
    gap: 6,
  },
  featureTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontFamily: "Inter_500Medium",
  },
  featureMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  downloadButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  featureActions: {
    gap: 10,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  sectionCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  quickGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  quickImage: {
    width: "100%",
    aspectRatio: 0.8,
  },
  quickBody: {
    padding: 12,
    gap: 5,
  },
  quickTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter_600SemiBold",
  },
  quickMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  emptyPanel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sheetScroll: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  sheetHandleWrap: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
  },
  sheetHandle: {
    width: 58,
    height: 5,
    borderRadius: 999,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },
  sheetTitleBlock: {
    flex: 1,
    gap: 6,
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 29,
    fontFamily: "Inter_700Bold",
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  qualityChip: {
    minWidth: 86,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qualityChipText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  inputBlock: {
    gap: 8,
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  progressCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  progressMeta: {
    flex: 1,
    gap: 6,
  },
  progressTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  progressCopy: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
