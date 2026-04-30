import Feather from 'react-native-vector-icons/Feather';
import FastImage from "react-native-fast-image";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { MultiSelectActionBar } from "@/components/MultiSelectActionBar";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDeviceVideoSync } from "@/hooks/useDeviceVideoSync";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { useVideoImport } from "@/hooks/useVideoImport";
import { getFolderCount, getFolders } from "@/services/folderService";
import { ensureVideoThumbnail } from "@/services/videoService";
import { type FolderItem, type VideoItem, type SortMode } from "@/types/player";
import { getThumbnailUri } from "@/utils/thumbnailSource";
import { log } from "@/utils/logger";

const L = log('LibraryScreen');

type BrowserMode = "folders" | "videos";

const PAGE_SIZE = 50;

export default function LibraryScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const {
    fetchVideosPage,
    recentVideos,
    setCurrentVideo,
    reloadVideos,
    removeVideos,
    addVideosToPlaylist,
    toggleFolderPrivacy,
    videoCount,
  } = usePlayer();
  const { importVideos, isImporting } = useVideoImport();
  const { refreshDeviceVideos, isRefreshing, syncError } = useDeviceVideoSync();
  const swipeNavigation = useTabSwipeNavigation("library");

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [browserMode, setBrowserMode] = useState<BrowserMode>("folders");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderCount, setFolderCount] = useState(0);
  const [folderOffset, setFolderOffset] = useState(0);
  const [hasMoreFolders, setHasMoreFolders] = useState(true);
  const [isLoadingMoreFolders, setIsLoadingMoreFolders] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const flashListRef = useRef<FlashList<any>>(null);
  const handleScroll = useCallback((event: any) => {
    const offsetY = Number(event?.nativeEvent?.contentOffset?.y ?? 0);
    setShowScrollToTop(offsetY > 300);
  }, []);

  // Paginated state
  const [pagedVideos, setPagedVideos] = useState<VideoItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadInitialVideos = useCallback(async () => {
    setIsLoadingMore(true);
    const results = await fetchVideosPage({ 
      limit: PAGE_SIZE, 
      offset: 0, 
      mediaType: "video", 
      query,
      sortMode,
    });
    setPagedVideos(results);
    setOffset(results.length);
    setHasMore(results.length === PAGE_SIZE);
    setIsLoadingMore(false);
  }, [fetchVideosPage, query, sortMode]);

  useEffect(() => {
    if (browserMode === "videos") {
      loadInitialVideos();
    }
  }, [loadInitialVideos, browserMode]);

  const loadMoreVideos = useCallback(async () => {
    if (!hasMore || isLoadingMore || browserMode !== "videos") return;
    setIsLoadingMore(true);
    const results = await fetchVideosPage({ 
      limit: PAGE_SIZE, 
      offset, 
      mediaType: "video", 
      query,
      sortMode,
    });
    setPagedVideos(prev => [...prev, ...results]);
    setOffset(prev => prev + results.length);
    setHasMore(results.length === PAGE_SIZE);
    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, browserMode, fetchVideosPage, offset, query, sortMode]);

  const loadInitialFolders = useCallback(async () => {
    setIsLoadingMoreFolders(true);
    const [nextFolders, count] = await Promise.all([
      getFolders(PAGE_SIZE, 0, query),
      getFolderCount(query),
    ]);
    L.db('folders page loaded', { count: nextFolders.length, total: count, offset: 0 });
    setFolders(nextFolders);
    setFolderCount(count);
    setFolderOffset(nextFolders.length);
    setHasMoreFolders(nextFolders.length < count);
    setIsLoadingMoreFolders(false);
  }, [query]);

  const loadMoreFolders = useCallback(async () => {
    if (!hasMoreFolders || isLoadingMoreFolders || browserMode !== "folders") return;
    setIsLoadingMoreFolders(true);
    const nextFolders = await getFolders(PAGE_SIZE, folderOffset, query);
    setFolders((prev) => [...prev, ...nextFolders]);
    setFolderOffset((prev) => prev + nextFolders.length);
    setHasMoreFolders(folderOffset + nextFolders.length < folderCount);
    setIsLoadingMoreFolders(false);
  }, [browserMode, folderCount, folderOffset, hasMoreFolders, isLoadingMoreFolders, query]);

  const recentVideoItems = useMemo(
    () => recentVideos.filter((video) => video.mediaType === "video"),
    [recentVideos]
  );
  const selectionMode = browserMode === "videos" && selectedVideoIds.length > 0;
  const selectedVideoIdSet = useMemo(
    () => new Set(selectedVideoIds),
    [selectedVideoIds]
  );

  useEffect(() => {
    setShowScrollToTop(false);
  }, [query, sortMode, browserMode]);

  useEffect(() => {
    if (browserMode === "folders") {
      void loadInitialFolders();
    }
  }, [browserMode, loadInitialFolders, videoCount]);

  useEffect(() => {
    const candidates = recentVideoItems
      .filter(
        (video) =>
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
  }, [recentVideoItems, reloadVideos]);

  const allVisibleVideoIds = useMemo(
    () => pagedVideos.map((video) => video.id),
    [pagedVideos]
  );

  const allVisibleSelected =
    allVisibleVideoIds.length > 0 &&
    allVisibleVideoIds.every((videoId) => selectedVideoIdSet.has(videoId));

  // Cleanup selection when videos are removed from the library
  useEffect(() => {
    setSelectedVideoIds((prev) => prev.filter((id) => pagedVideos.some((video) => video.id === id) || !hasMore));
  }, [pagedVideos, hasMore]);

  useEffect(() => {
    if (browserMode !== "videos") {
      setSelectedVideoIds([]);
    }
  }, [browserMode]);


  const toggleSelection = useCallback((videoId: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((item) => item !== videoId)
        : [...prev, videoId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedVideoIds([]);
  }, []);

  const handleSelectAllToggle = useCallback(() => {
    if (allVisibleSelected) {
      clearSelection();
      return;
    }

    setSelectedVideoIds(allVisibleVideoIds);
  }, [allVisibleSelected, allVisibleVideoIds, clearSelection]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedVideoIds.length === 0) return;

    const count = selectedVideoIds.length;
    Alert.alert(
      "Delete Selected",
      `Move ${count} items to the recycle bin?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ids = [...selectedVideoIds];
            clearSelection();
            await removeVideos(ids, "temporary");
          },
        },
      ]
    );
  }, [selectedVideoIds, removeVideos, clearSelection]);

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    const ids = [...selectedVideoIds];
    setPlaylistModalVisible(false);
    clearSelection();
    void addVideosToPlaylist(playlistId, ids);
  }, [selectedVideoIds, addVideosToPlaylist, clearSelection]);

  const handleRefresh = () => {
    L.sync('manual refresh triggered');
    void refreshDeviceVideos();
  };

  const handleFolderLongPress = useCallback((folder: FolderItem) => {
    Alert.alert(
      folder.isPrivate ? "Unlock Folder" : "Lock Folder",
      folder.isPrivate 
        ? "Make this folder public again?" 
        : "Mark this folder as private? A lock icon will be shown.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: folder.isPrivate ? "Unlock" : "Lock", 
          onPress: () => void toggleFolderPrivacy(folder.id) 
        }
      ]
    );
  }, [toggleFolderPrivacy]);


  const scrollToTop = () => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderRecentRail = recentVideoItems.length > 0 ? (
    <View
      style={[
        styles.recentPanel,
        { backgroundColor: `${colors.backgroundSecondary}ED`, borderColor: colors.border },
      ]}
    >
      <View style={styles.recentHeading}>
        <Text style={[styles.recentTitle, { color: colors.text }]}>Local History</Text>
        <Text style={[styles.recentMeta, { color: colors.textSecondary }]}>
          {recentVideoItems.length} watched
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {recentVideoItems.slice(0, 8).map((video) => {
          const source = getThumbnailUri(video.thumbnail);

          return (
            <Pressable
              key={video.id}
              style={[styles.railItem, { borderColor: colors.border }]}
              onPress={() => {
                L.nav('open player (rail)', { id: video.id, title: video.title });
                setCurrentVideo(video);
                navigation.navigate("player", { id: video.id, folder: video.folder });
              }}
            >
              <View style={[styles.railThumb, { backgroundColor: colors.backgroundTertiary }]}>
                {source ? (
                  <FastImage
                    source={{ uri: source }}
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
        <ScreenBackdrop artwork={recentVideoItems[0]?.thumbnail ?? pagedVideos[0]?.thumbnail} />
        <ScreenHeader
          title={selectionMode ? `${selectedVideoIds.length} selected` : "Media Library"}
          topPad={topPad}
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
              {!selectionMode && (
                <>
                  <Pressable
                    onPress={handleRefresh}
                    disabled={isRefreshing}
                    style={[
                      styles.addBtn,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Feather
                      name="rotate-cw"
                      size={18}
                      color={isRefreshing ? colors.primary : colors.text}
                    />
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
                    <Feather name="plus" size={18} color="#fff" />
                  </Pressable>
                </>
              )}
            </View>
          }
        />

        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
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
            {browserMode === "videos" && pagedVideos.length > 0 ? (
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
                : `${browserMode === "folders" ? folderCount : videoCount} results`}
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
          folders.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyStateWrap}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
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
            <View style={styles.listHost}>
              <FlashList
                data={folders}
                estimatedItemSize={80}
                keyExtractor={(item) => item.id}
                onEndReached={loadMoreFolders}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad }}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                  />
                }
                renderItem={({ item }) => (
                  <FolderCard 
                    folder={item} 
                    onLongPress={handleFolderLongPress}
                  />
                )}
              />
            </View>
          )
        ) : pagedVideos.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyStateWrap}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
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
          <View style={styles.listHost}>
            <FlashList
              ref={flashListRef}
              estimatedItemSize={viewMode === "grid" ? 210 : 90}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              data={pagedVideos}
              onEndReached={loadMoreVideos}
              onEndReachedThreshold={0.5}
              extraData={selectedVideoIds}
              keyExtractor={(item) => item.id}
              numColumns={viewMode === "grid" ? 2 : 1}
              key={viewMode}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                ...styles.list,
                paddingBottom: selectionMode ? 160 : bottomPad,
                ...(viewMode === "grid" ? styles.gridList : {}),
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
              }
              renderItem={({ item }) => (
                <View style={viewMode === "grid" ? styles.gridItem : null}>
                  <VideoCard
                    video={item}
                    compact={viewMode === "list"}
                    onPress={selectionMode ? () => toggleSelection(item.id) : () => {
                      L.nav('open player (list)', { id: item.id, title: item.title });
                      setCurrentVideo(item);
                      navigation.navigate("player", { id: item.id, folder: item.folder });
                    }}
                    onLongPress={() => toggleSelection(item.id)}
                    selected={selectedVideoIdSet.has(item.id)}
                    selectionMode={selectionMode}
                    hideFavorite={selectionMode}
                  />
                </View>
              )}
            />
          </View>
        )}
        {showScrollToTop && (
          <Pressable
            onPress={scrollToTop}
            style={({ pressed }) => [
              styles.scrollToTopBtn,
              {
                backgroundColor: colors.primary,
                bottom: selectionMode ? 180 : bottomPad + 24,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Feather name="arrow-up" size={24} color="#fff" />
          </Pressable>
        )}
      </Animated.View>

      <MultiSelectActionBar
        visible={selectionMode}
        selectedCount={selectedVideoIds.length}
        onCancel={clearSelection}
        onSelectAll={handleSelectAllToggle}
        actions={[
          {
            icon: "plus",
            label: "Add to Playlist",
            onPress: () => setPlaylistModalVisible(true),
          },
          {
            icon: "trash-2",
            label: "Delete",
            onPress: handleDeleteSelected,
            destructive: true,
          },
        ]}
      />

      <PlaylistPickerModal
        visible={playlistModalVisible}
        onClose={() => setPlaylistModalVisible(false)}
        onSelect={handleAddToPlaylist}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listHost: {
    flex: 1,
    minHeight: 2,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  browserChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  browserChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  selectAllChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectAllChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  countLabel: {
    marginLeft: "auto",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  recentPanel: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
    marginVertical: 4,
  },
  recentHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  recentMeta: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  rail: {
    paddingHorizontal: 16,
    gap: 12,
  },
  railItem: {
    width: 100,
    gap: 4,
  },
  railThumb: {
    width: 100,
    height: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  railImage: {
    width: "100%",
    height: "100%",
  },
  railLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  folderHint: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
  syncErrorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncErrorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
  },
  gridList: {
    paddingHorizontal: 8,
  },
  gridItem: {
    flex: 1,
    padding: 8,
  },
  emptyStateWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  scrollToTopBtn: {
    position: "absolute",
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
