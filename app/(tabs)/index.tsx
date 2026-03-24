import Feather from 'react-native-vector-icons/Feather';
import React from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { videos, recentVideos, favorites, playlists } = usePlayer();
  const { importVideos, isImporting } = useVideoImport();
  const swipeNavigation = useTabSwipeNavigation("index");

  const totalCount = videos.length;
  const totalDuration = videos.reduce(
    (duration, video) => duration + (video.duration || 0),
    0
  );
  const watchedCount = videos.filter((video) => video.playCount > 0).length;
  const folderCount = new Set(videos.map((video) => video.folder || "Unknown")).size;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={videos[0]?.thumbnail} />
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
                <Text style={[styles.statNum, { color: colors.primary }]}>{favorites.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Favorites</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{watchedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Watched</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{playlists.length}</Text>
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

        {recentVideos.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Continue Playing" />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Jump back into the items you touched most recently.
            </Text>
            {recentVideos.slice(0, 3).map((video) => (
              <VideoCard key={video.id} video={video} compact />
            ))}
          </View>
        ) : null}

        {favorites.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Favorites" />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Quick access to the media you marked for repeat watching.
            </Text>
            {favorites.slice(0, 3).map((video) => (
              <VideoCard key={video.id} video={video} compact />
            ))}
          </View>
        ) : null}

        {videos.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="All Media" />
            <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>
              Latest additions from your offline collection.
            </Text>
            {videos.slice(0, 4).map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </View>
        ) : null}

        {videos.length === 0 ? (
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
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Inter_700Bold",
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "Inter_400Regular",
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  headline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statsRow: {
    flexDirection: "row",
    borderRadius: 22,
    padding: 16,
    marginTop: 4,
  },
  statCard: {
    width: "48%",
    borderRadius: 20,
    padding: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  divider: {
    width: 1,
    marginHorizontal: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionCopy: {
    fontSize: 14,
    lineHeight: 21,
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
