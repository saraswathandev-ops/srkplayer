import Feather from 'react-native-vector-icons/Feather';
import React, { useEffect } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { type VideoItem } from "@/types/player";
import { EmptyState } from "@/components/EmptyState";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { SectionHeader } from "@/components/SectionHeader";
import { VideoCard } from "@/components/VideoCard";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { useVideoImport } from "@/hooks/useVideoImport";
import { formatDuration } from "@/utils/formatters";
import { log } from "@/utils/logger";
import { getRecommendations, SuggestionCategory } from "@/services/recommendationService";

const L = log('HomeScreen');

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const {
    stats,
    videoCount,
    clearMediaLibrary,
    fetchVideosPage,
    fetchContinueWatching,
    fetchRecentVideos,
    fetchFavorites,
  } = usePlayer();
  const { importVideos: _importVideos, isImporting } = useVideoImport();
  const importVideos = () => { L.info('import videos triggered'); _importVideos(); };
  const swipeNavigation = useTabSwipeNavigation("index");

  const [allMediaPreview, setAllMediaPreview] = React.useState<VideoItem[]>([]);
  const [continueWatchingPreview, setContinueWatchingPreview] = React.useState<VideoItem[]>([]);
  const [recentPreview, setRecentPreview] = React.useState<VideoItem[]>([]);
  const [favoritesPreview, setFavoritesPreview] = React.useState<VideoItem[]>([]);
  const [suggestedCategories, setSuggestedCategories] = React.useState<SuggestionCategory[]>([]);

  const loadPreviews = React.useCallback(() => {
    let cancelled = false;
    void Promise.all([
      fetchVideosPage({ limit: 4, offset: 0 }),
      fetchContinueWatching(3, 0),
      fetchRecentVideos(3, 0),
      fetchFavorites(3, 0),
      fetchVideosPage({ limit: 100, offset: 0 }),
    ]).then(([media, continueWatching, recent, favorites, allVideos]) => {
      if (cancelled) return;
      setAllMediaPreview(media);
      setContinueWatchingPreview(continueWatching);
      setRecentPreview(recent);
      setFavoritesPreview(favorites);

      void getRecommendations(allVideos, recent, [], undefined).then((categories) => {
        if (!cancelled) {
          setSuggestedCategories(categories);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchContinueWatching, fetchFavorites, fetchRecentVideos, fetchVideosPage]);

  useEffect(() => {
    L.info('mounted');
    const cleanup = loadPreviews();
    return () => {
      cleanup();
      L.info('unmounted');
    };
  }, [loadPreviews]);

  useFocusEffect(
    React.useCallback(() => {
      const cleanup = loadPreviews();
      return cleanup;
    }, [loadPreviews])
  );

  // Use stats from context for the dashboard
  const totalCount = videoCount;
  const favoritesCount = stats?.favoriteCount ?? 0;
  const watchedCount = stats?.watchedCount ?? 0;
  const playlistCount = stats?.playlistCount ?? 0;
  const totalDuration = stats?.totalDuration ?? 0;
  const folderCount = stats?.folderCount ?? 0;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={allMediaPreview[0]?.thumbnail} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 16, paddingBottom: bottomPad },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                SKR Player
              </Text>
              <Text style={[styles.headline, { color: colors.text }]}>
                Your Media Hub
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Wipe Library?",
                    "Remove all indexed items from your library? Actual files will stay on your device.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Wipe",
                        style: "destructive",
                        onPress: () => clearMediaLibrary(),
                      },
                    ]
                  );
                }}
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="trash-2" size={20} color={colors.error} />
              </Pressable>
              <Pressable
                onPress={importVideos}
                disabled={isImporting}
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: isImporting ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="plus" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>

        {totalCount > 0 ? (
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Dashboard</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              One view for your full offline media library.
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Track audio, video, favorites, watched items, playlists, and folders without
              digging through separate pages.
            </Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{totalCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Media</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{favoritesCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Favorites</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{watchedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Watched</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{playlistCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Playlists</Text>
              </View>
            </View>
            <View style={[styles.statsRow, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.primary }]}>
                  {formatDuration(totalDuration)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Time</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{folderCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Folders</Text>
              </View>
            </View>
          </View>
        ) : null}

        {continueWatchingPreview.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Continue Watching" />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Resume videos from where you stopped.
            </Text>
            {continueWatchingPreview.map((video) => (
              <VideoCard key={video.id} video={video} compact />
            ))}
          </View>
        ) : null}

        {recentPreview.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Recently Played" />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Items opened most recently from your library.
            </Text>
            {recentPreview.map((video) => (
              <VideoCard key={video.id} video={video} compact />
            ))}
          </View>
        ) : null}

        {favoritesPreview.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Favorites" />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Quick access to the media you marked for repeat watching.
            </Text>
            {favoritesPreview.map((video) => (
              <VideoCard key={video.id} video={video} compact />
            ))}
          </View>
        ) : null}

        {allMediaPreview.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="All Media" />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Latest additions from your offline collection.
            </Text>
            {allMediaPreview.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </View>
        ) : null}

        {suggestedCategories.map((category) => (
          <View key={category.id} style={styles.section}>
            <SectionHeader title={category.label} />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Recommended for you
            </Text>
            {category.videos.slice(0, 3).map((video) => (
              <VideoCard key={video.id} video={video} compact />
            ))}
          </View>
        ))}

        {videoCount === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="film"
              title="No Media Yet"
              subtitle="Tap the + button to add video or audio from your device"
              action={
                <Pressable
                  onPress={importVideos}
                  disabled={isImporting}
                  style={[
                    styles.emptyBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: isImporting ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="plus" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>
                    {isImporting ? "Adding..." : "Add Media"}
                  </Text>
                </Pressable>
              }
            />
          </View>
        ) : null}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    marginBottom: 26,
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Inter_700Bold",
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  greeting: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  headline: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    borderRadius: 22,
    padding: 16,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    textAlign: "center",
  },
  divider: {
    width: 1,
    marginHorizontal: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionCopy: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  emptyWrap: {
    height: 400,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
