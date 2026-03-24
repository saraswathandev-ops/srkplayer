import Feather from 'react-native-vector-icons/Feather';
import FastImage from "react-native-fast-image";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { EmptyState } from "@/components/EmptyState";
import { FolderCard } from "@/components/FolderCard";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDeviceVideoSync } from "@/hooks/useDeviceVideoSync";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { useVideoImport } from "@/hooks/useVideoImport";
import { getFolders } from "@/services/folderService";
import { ensureVideoThumbnail } from "@/services/videoService";
import { type FolderItem } from "@/types/player";

type SortMode = "name" | "date" | "size";
type BrowserMode = "folders" | "videos";

const PAGE_SIZE = 50;

export default function LibraryScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { videos, recentVideos, searchVideos, setCurrentVideo, reloadVideos, removeVideo } =
    usePlayer();
  const { importVideos, isImporting } = useVideoImport();
  const { refreshDeviceVideos, isRefreshing, syncError } = useDeviceVideoSync();
  const swipeNavigation = useTabSwipeNavigation("library");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [browserMode, setBrowserMode] = useState<BrowserMode>("folders");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const flashListRef = useRef<FlashList<any>>(null);
  const isNativeLibrary = true;
  const selectionMode = browserMode === "videos" && selectedVideoIds.length > 0;
  const selectedVideoIdSet = useMemo(
    () => new Set(selectedVideoIds),
    [selectedVideoIds]
  );
  const folderRefreshKey = useMemo(
    () =>
      videos
        .map((video) => {
          const thumbnail =
            typeof video.thumbnail === "string" ? video.thumbnail : "";
          return `${video.id}:${video.folder ?? ""}:${thumbnail}:${video.thumbnailHash ?? ""}`;
        })
        .join("|"),
    [videos]
  );

  useEffect(() => {
    setShowScrollToTop(false);
  }, [query, sortMode, browserMode]);

  useEffect(() => {
    let cancelled = false;

    void getFolders().then((nextFolders) => {
      if (!cancelled) {
        setFolders(nextFolders);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [folderRefreshKey]);

  useEffect(() => {
    const candidates = recentVideos
      .filter(
        (video) =>
          video.mediaType === "video" &&
          !video.isClip &&
          !video.thumbnail &&
          !video.thumbnailHash
      )
      .slice(0, 8);

    if (candidates.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      for (const video of candidates) {
        if (cancelled) return;

        const updated = await ensureVideoThumbnail(video.id);

        if (!updated || cancelled) {
          continue;
        }

        await reloadVideos();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recentVideos, reloadVideos]);

  const filteredVideos = query ? searchVideos(query) : videos;
  const filteredFolders = useMemo(() => {
    if (!query.trim()) return folders;
    const normalizedQuery = query.trim().toLowerCase();
    return folders.filter((folder) => (folder.name || "").toLowerCase().includes(normalizedQuery));
  }, [folders, query]);

  const mediaCount = videos.length;
  const videoCount = videos.filter((video) => video.mediaType === "video").length;
  const audioCount = videos.filter((video) => video.mediaType === "audio").length;
  const folderCount = folders.length;
  const watchedCount = videos.filter((video) => video.playCount > 0).length;
  const latestArtwork = recentVideos[0]?.thumbnail ?? videos[0]?.thumbnail;

  const sortedVideos = useMemo(() => {
    const nextVideos = [...filteredVideos];
    return nextVideos.sort((left, right) => {
      if (sortMode === "name") {
        const a = (left.title || "").toLowerCase();
        const b = (right.title || "").toLowerCase();
        return a < b ? -1 : a > b ? 1 : 0;
      }
      if (sortMode === "date") return (right.dateAdded || 0) - (left.dateAdded || 0);
      if (sortMode === "size") return (right.size || 0) - (left.size || 0);
      return 0;
    });
  }, [filteredVideos, sortMode]);
  const allVisibleVideoIds = useMemo(
    () => filteredVideos.map((video) => video.id),
    [filteredVideos]
  );
  const allVisibleSelected =
    allVisibleVideoIds.length > 0 &&
    allVisibleVideoIds.every((videoId) => selectedVideoIdSet.has(videoId));

  useEffect(() => {
    setSelectedVideoIds((prev) => prev.filter((id) => videos.some((video) => video.id === id)));
  }, [videos]);

  useEffect(() => {
    if (browserMode !== "videos") {
      setSelectedVideoIds([]);
    }
  }, [browserMode]);

  const toggleSelection = (videoId: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((item) => item !== videoId)
        : [...prev, videoId]
    );
  };

  const clearSelection = () => {
    setSelectedVideoIds([]);
  };

  const handleSelectAllToggle = () => {
    if (allVisibleSelected) {
      clearSelection();
      return;
    }

    setSelectedVideoIds(allVisibleVideoIds);
  };

  const handleDeleteSelected = () => {
    if (selectedVideoIds.length === 0) return;

    const count = selectedVideoIds.length;
    const message = `Choose how to delete ${count} selected item${count !== 1 ? "s" : ""}.`;

    Alert.alert("Delete Selected", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove from Library",
        onPress: () => {
          void (async () => {
            await Promise.all(
              selectedVideoIds.map((videoId) => removeVideo(videoId, "temporary"))
            );
            clearSelection();
          })();
        },
      },
      {
        text: "Delete Permanently",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await Promise.all(
              selectedVideoIds.map((videoId) => removeVideo(videoId, "permanent"))
            );
            clearSelection();
          })();
        },
      },
    ]);
  };

  const handleRefresh = () => {
    void refreshDeviceVideos();
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollToTop(offsetY > 300);
  };

  const scrollToTop = () => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderRecentRail = recentVideos.length > 0 ? (
    <View
      style={[
        styles.recentPanel,
        { backgroundColor: `${colors.backgroundSecondary}ED`, borderColor: colors.border },
      ]}
    >
      <View style={styles.recentHeading}>
        <Text style={[styles.recentTitle, { color: colors.text }]}>Local History</Text>
        <Text style={[styles.recentMeta, { color: colors.textSecondary }]}>
          {recentVideos.length} watched
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {recentVideos.slice(0, 8).map((video) => {
          const source = video.thumbnail
            ? video.thumbnail
            : video.thumbnailHash
              ? { thumbhash: video.thumbnailHash }
              : null;
          const placeholder =
            video.thumbnail && video.thumbnailHash
              ? { thumbhash: video.thumbnailHash }
              : undefined;

          return (
            <Pressable
              key={video.id}
              style={[styles.railItem, { borderColor: colors.border }]}
              onPress={() => {
                setCurrentVideo(video);
                navigation.navigate("player", { id: video.id });
              }}
            >
              <View style={[styles.railThumb, { backgroundColor: colors.backgroundTertiary }]}>
                {source ? (
                  <FastImage
                    source={{ uri: typeof source === 'string' ? source : undefined }}
                    style={styles.railImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <Feather
                    name={video.mediaType === "audio" ? "music" : "film"}
                    size={18}
                    color={colors.primary}
                  />
                )}
              </View>
              <Text style={[styles.railLabel, { color: colors.text }]} numberOfLines={1}>
                {video.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  ) : null;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={latestArtwork} />
        <ScreenHeader
          title={selectionMode ? `${selectedVideoIds.length} selected` : "Media Library"}
          topPad={topPad}
          right={
            <>
              <Pressable
                onPress={() => {
                  if (selectionMode) {
                    clearSelection();
                    return;
                  }
                  setViewMode(viewMode === "list" ? "grid" : "list");
                }}
                style={[
                  styles.headerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                hitSlop={8}
              >
                <Feather
                  name={selectionMode ? "x" : viewMode === "list" ? "grid" : "list"}
                  size={20}
                  color={colors.text}
                />
              </Pressable>
              {selectionMode ? (
                <Pressable
                  onPress={handleDeleteSelected}
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="trash-2" size={20} color="#fff" />
                </Pressable>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pressable
                    onPress={() => navigation.navigate("network-stream")}
                    style={[
                      styles.addBtn,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Feather name="globe" size={20} color={colors.text} />
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
                    <Feather name="plus" size={20} color="#fff" />
                  </Pressable>
                </View>
              )}
            </>
          }
        />

        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
          {/* <View
          style={[
            styles.heroCard,
            { backgroundColor: `${colors.card}F2`, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Library Status</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Sync phone folders, browse local audio and video, and jump back into recent media.
          </Text>
          <View style={styles.heroStats}>
            <View style={[styles.heroStatCard, { backgroundColor: colors.backgroundTertiary }]}>
              <Text style={[styles.heroStatValue, { color: colors.primary }]}>{folderCount}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Folders</Text>
            </View>
            <View style={[styles.heroStatCard, { backgroundColor: colors.backgroundTertiary }]}>
              <Text style={[styles.heroStatValue, { color: colors.primary }]}>{mediaCount}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Media</Text>
            </View>
            <View style={[styles.heroStatCard, { backgroundColor: colors.backgroundTertiary }]}>
              <Text style={[styles.heroStatValue, { color: colors.primary }]}>{videoCount}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Videos</Text>
            </View>
            <View style={[styles.heroStatCard, { backgroundColor: colors.backgroundTertiary }]}>
              <Text style={[styles.heroStatValue, { color: colors.primary }]}>{audioCount}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Audio</Text>
            </View>
            <View style={[styles.heroStatCard, { backgroundColor: colors.backgroundTertiary }]}>
              <Text style={[styles.heroStatValue, { color: colors.primary }]}>{watchedCount}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Played</Text>
            </View>
          </View>
        </View> */}

          <SearchBar value={query} onChangeText={setQuery} />

          <View style={styles.toggleRow}>
            {(["folders", "videos"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setBrowserMode(mode)}
                style={[
                  styles.browserChip,
                  {
                    backgroundColor:
                      browserMode === mode ? `${colors.primary}33` : colors.card,
                    borderColor: browserMode === mode ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.browserChipText,
                    { color: browserMode === mode ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {mode === "folders" ? "Folders" : "Media"}
                </Text>
              </Pressable>
            ))}
            {browserMode === "videos" && sortedVideos.length > 0 ? (
              <Pressable
                onPress={handleSelectAllToggle}
                style={[
                  styles.selectAllChip,
                  {
                    backgroundColor: allVisibleSelected ? colors.primary : colors.card,
                    borderColor: allVisibleSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.selectAllChipText,
                    { color: allVisibleSelected ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {allVisibleSelected ? "Clear all" : "Select all"}
                </Text>
              </Pressable>
            ) : null}
            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
              {selectionMode
                ? `${selectedVideoIds.length} picked`
                : `${browserMode === "folders" ? filteredFolders.length : sortedVideos.length} results`}
            </Text>
          </View>

          {browserMode === "videos" ? (
            <View style={styles.sortRow}>
              {(["date", "name", "size"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setSortMode(mode)}
                  style={[
                    styles.sortChip,
                    {
                      backgroundColor: sortMode === mode ? colors.primary : colors.card,
                      borderColor: sortMode === mode ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      { color: sortMode === mode ? "#fff" : colors.textSecondary },
                    ]}
                  >
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {browserMode === "folders" ? renderRecentRail : null}

          <Text style={[styles.folderHint, { color: colors.textTertiary }]}>
            Swipe down to sync phone audio and video in batches.
          </Text>

          {syncError ? (
            <View
              style={[
                styles.syncErrorCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="alert-triangle" size={16} color={colors.warning} />
              <Text style={[styles.syncErrorText, { color: colors.textSecondary }]}>
                {syncError}
              </Text>
            </View>
          ) : null}
        </View>

        {browserMode === "folders" ? (
          filteredFolders.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyStateWrap}
              refreshControl={
                isNativeLibrary ? (
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                  />
                ) : undefined
              }
            >
              <EmptyState
                icon={query ? "search" : "folder"}
                title={query ? "No Folders Found" : "No Local Folders Yet"}
                subtitle={
                  query
                    ? `No folders matching "${query}"`
                    : "Sync device media to build a folder-based local browser."
                }
              />
            </ScrollView>
          ) : (
            <FlashList
              data={filteredFolders}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad }}
              refreshControl={
                isNativeLibrary ? (
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                  />
                ) : undefined
              }
              renderItem={({ item }) => <FolderCard folder={item} />}
            />
          )
        ) : sortedVideos.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyStateWrap}
            refreshControl={
              isNativeLibrary ? (
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
          >
            <EmptyState
              icon={query ? "search" : "film"}
              title={query ? "No Results" : "Library Empty"}
              subtitle={
                query
                  ? `No media matching "${query}"`
                  : "Add or sync audio and video from your device to build your library"
              }
            />
          </ScrollView>
        ) : (
          <FlashList
            ref={flashListRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            data={sortedVideos}
            keyExtractor={(item) => item.id}
            numColumns={viewMode === "grid" ? 2 : 1}
            key={viewMode}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              ...styles.list,
              paddingBottom: bottomPad,
              ...(viewMode === "grid" ? styles.gridList : {}),
            }}
            refreshControl={
              isNativeLibrary ? (
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
            renderItem={({ item }) =>
              viewMode === "grid" ? (
                <View style={styles.gridItem}>
                  <VideoCard
                    video={item}
                    onPress={() => {
                      if (selectionMode) {
                        toggleSelection(item.id);
                        return;
                      }
                      setCurrentVideo(item);
                      navigation.navigate("player", { id: item.id });
                    }}
                    onLongPress={() => toggleSelection(item.id)}
                    selected={selectedVideoIdSet.has(item.id)}
                    selectionMode={selectionMode}
                    hideFavorite={selectionMode}
                  />
                </View>
              ) : (
                <VideoCard
                  video={item}
                  compact
                  onPress={() => {
                    if (selectionMode) {
                      toggleSelection(item.id);
                      return;
                    }
                    setCurrentVideo(item);
                    navigation.navigate("player", { id: item.id });
                  }}
                  onLongPress={() => toggleSelection(item.id)}
                  selected={selectedVideoIdSet.has(item.id)}
                  selectionMode={selectionMode}
                  hideFavorite={selectionMode}
                />
              )
            }
          />
        )}
        {showScrollToTop && (
          <Pressable
            onPress={scrollToTop}
            style={({ pressed }) => [
              styles.scrollToTopBtn,
              {
                backgroundColor: colors.primary,
                bottom: bottomPad + 24,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Feather name="arrow-up" size={24} color="#fff" />
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Inter_700Bold",
  },
  heroStats: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  heroStatCard: {
    minWidth: 100,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroStatValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  heroStatLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  browserChip: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  browserChipText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  selectAllChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectAllChipText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  countLabel: {
    marginLeft: "auto",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sortRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  sortChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  recentPanel: {
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 16,
  },
  recentHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
  },
  recentMeta: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  rail: {
    paddingHorizontal: 16,
    gap: 12,
  },
  railItem: {
    width: 126,
  },
  railThumb: {
    width: 126,
    height: 74,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  railImage: {
    width: "100%",
    height: "100%",
  },
  railLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  folderHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  syncErrorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  syncErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 16,
  },
  emptyStateWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  gridList: {
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
  scrollToTopBtn: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10,
  },
});
