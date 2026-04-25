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
import { getFolders } from "@/services/folderService";
import { ensureVideoThumbnail } from "@/services/videoService";
import { type FolderItem } from "@/types/player";
import { getThumbnailUri } from "@/utils/thumbnailSource";

type SortMode = "name" | "date" | "size";
type BrowserMode = "folders" | "videos";

const PAGE_SIZE = 50;

export default function LibraryScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { videos, recentVideos, searchVideos, setCurrentVideo, reloadVideos, removeVideos, addVideosToPlaylist, toggleFolderPrivacy } =
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
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const flashListRef = useRef<FlashList<any>>(null);

  const isNativeLibrary = true;
  const videoItems = useMemo(
    () => videos.filter((video) => video.mediaType === "video"),
    [videos]
  );
  const recentVideoItems = useMemo(
    () => recentVideos.filter((video) => video.mediaType === "video"),
    [recentVideos]
  );
  const selectionMode = browserMode === "videos" && selectedVideoIds.length > 0;
  const selectedVideoIdSet = useMemo(
    () => new Set(selectedVideoIds),
    [selectedVideoIds]
  );

  const folderRefreshKey = useMemo(
    () =>
      videoItems
        .map((video) => {
          const thumbnail =
            typeof video.thumbnail === "string" ? video.thumbnail : "";
          return `${video.id}:${video.folder ?? ""}:${thumbnail}:${video.thumbnailHash ?? ""}`;
        })
        .join("|"),
    [videoItems]
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

  const filteredVideos = useMemo(
    () =>
      (query ? searchVideos(query) : videoItems).filter(
        (video) => video.mediaType === "video"
      ),
    [query, searchVideos, videoItems]
  );
  const filteredFolders = useMemo(() => {
    if (!query.trim()) return folders;
    const normalizedQuery = query.trim().toLowerCase();
    return folders.filter((folder) => (folder.name || "").toLowerCase().includes(normalizedQuery));
  }, [folders, query]);

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
    () => sortedVideos.map((video) => video.id),
    [sortedVideos]
  );

  const allVisibleSelected =
    allVisibleVideoIds.length > 0 &&
    allVisibleVideoIds.every((videoId) => selectedVideoIdSet.has(videoId));

  useEffect(() => {
    setSelectedVideoIds((prev) => prev.filter((id) => videoItems.some((video) => video.id === id)));
  }, [videoItems]);

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

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollToTop(offsetY > 300);
  };

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
                setCurrentVideo(video);
                navigation.navigate("player", { id: video.id });
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
        <ScreenBackdrop artwork={recentVideoItems[0]?.thumbnail ?? videoItems[0]?.thumbnail} />
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
                data={filteredFolders}
                estimatedItemSize={80}
                keyExtractor={(item) => item.id}
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
        ) : sortedVideos.length === 0 ? (
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
              data={sortedVideos}
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
                      setCurrentVideo(item);
                      navigation.navigate("player", { id: item.id });
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
