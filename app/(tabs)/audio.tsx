import Feather from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Alert,
  Animated,
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
import { useTrackPlayer } from "@/context/TrackPlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDeviceVideoSync } from "@/hooks/useDeviceVideoSync";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { type FolderItem, type VideoItem } from "@/types/player";
import { getThumbnailUri } from "@/utils/thumbnailSource";
import { log } from "@/utils/logger";

const L = log('AudioScreen');

type AudioView = "songs" | "folders" | "artists" | "albums" | "favorites" | "recent" | "mostPlayed";

const PAGE_SIZE = 50;

const VIEW_LABELS: Record<AudioView, string> = {
  songs: "Songs",
  folders: "Folders",
  artists: "Artists",
  albums: "Albums",
  favorites: "Favorites",
  recent: "Recent",
  mostPlayed: "Most Played",
};

const GROUP_VIEWS = new Set<AudioView>(["folders", "artists", "albums"]);

type AudioGroup = FolderItem & {
  tracks: VideoItem[];
};

function normalizeGroupName(value: string | undefined, fallback: string) {
  const next = value?.trim();
  return next || fallback;
}

function compareByTitle(left: VideoItem, right: VideoItem) {
  return (left.title || "").localeCompare(right.title || "");
}

function buildAudioGroups(
  tracks: VideoItem[],
  getName: (track: VideoItem) => string
): AudioGroup[] {
  const groups = new Map<string, AudioGroup>();

  for (const track of tracks) {
    const name = getName(track);
    const existing = groups.get(name);

    if (!existing) {
      groups.set(name, {
        id: name,
        name,
        videoCount: 1,
        unwatchedCount: track.playCount === 0 ? 1 : 0,
        updatedAt: track.dateAdded,
        coverUri: getThumbnailUri(track.thumbnail) ?? undefined,
        coverHash: track.thumbnailHash,
        isPrivate: false,
        tracks: [track],
      });
      continue;
    }

    existing.videoCount += 1;
    if (track.playCount === 0) existing.unwatchedCount += 1;
    existing.tracks.push(track);
    if (track.dateAdded > existing.updatedAt) existing.updatedAt = track.dateAdded;
    if (!existing.coverUri) {
      existing.coverUri = getThumbnailUri(track.thumbnail) ?? undefined;
      existing.coverHash = track.thumbnailHash;
    }
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export default function AudioScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const {
    videos,
    fetchVideosPage,
    fetchRecentVideos,
    fetchFavorites,
    fetchMostPlayed,
    removeVideos,
    addVideosToPlaylist,
    videoCount,
  } = usePlayer();
  const { playAudio } = useTrackPlayer();
  const { refreshDeviceVideos, isRefreshing, syncError } = useDeviceVideoSync();
  const swipeNavigation = useTabSwipeNavigation("audio");

  const [query, setQuery] = useState("");
  const [selectedAudioIds, setSelectedAudioIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<AudioView>("songs");
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const flashListRef = useRef<FlashList<any>>(null);
  const handleScroll = useCallback(() => {
    // Keep a concrete JS function for FlashList. Animated.event can crash on
    // Hermes here because FlashList calls the prop as a normal callback.
  }, []);

  // Paginated state
  const [pagedTracks, setPagedTracks] = useState<VideoItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Full audio for grouping
  const [fullAudio, setFullAudio] = useState<VideoItem[]>([]);

  const loadInitialTracks = useCallback(async () => {
    setIsLoadingMore(true);
    let results: VideoItem[] = [];
    
    if (activeView === "songs") {
      results = await fetchVideosPage({ limit: PAGE_SIZE, offset: 0, mediaType: "audio", query, sortMode: "name" });
    } else if (activeView === "favorites") {
      results = await fetchFavorites(PAGE_SIZE, 0);
    } else if (activeView === "recent") {
      results = await fetchRecentVideos(PAGE_SIZE, 0);
    } else if (activeView === "mostPlayed") {
      results = await fetchMostPlayed(PAGE_SIZE, 0);
    }

    const audioResults = results.filter(v => v.mediaType === "audio");
    
    setPagedTracks(audioResults);
    setOffset(results.length);
    setHasMore(results.length === PAGE_SIZE);
    setIsLoadingMore(false);
  }, [activeView, fetchVideosPage, fetchFavorites, fetchRecentVideos, fetchMostPlayed, query]);

  useEffect(() => {
    if (!GROUP_VIEWS.has(activeView)) {
      loadInitialTracks();
    } else {
      void fetchVideosPage({ limit: 5000, offset: 0, mediaType: "audio" }).then(setFullAudio);
    }
  }, [loadInitialTracks, activeView]);

  const loadMoreTracks = useCallback(async () => {
    if (!hasMore || isLoadingMore || GROUP_VIEWS.has(activeView)) return;
    setIsLoadingMore(true);
    
    let results: VideoItem[] = [];
    if (activeView === "songs") {
      results = await fetchVideosPage({ limit: PAGE_SIZE, offset, mediaType: "audio", query, sortMode: "name" });
    } else if (activeView === "favorites") {
      results = await fetchFavorites(PAGE_SIZE, offset);
    } else if (activeView === "recent") {
      results = await fetchRecentVideos(PAGE_SIZE, offset);
    } else if (activeView === "mostPlayed") {
      results = await fetchMostPlayed(PAGE_SIZE, offset);
    }

    const audioResults = results.filter(v => v.mediaType === "audio");

    setPagedTracks(prev => [...prev, ...audioResults]);
    setOffset(prev => prev + results.length);
    setHasMore(results.length === PAGE_SIZE);
    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, activeView, fetchVideosPage, offset, query, fetchFavorites, fetchRecentVideos, fetchMostPlayed]);

  const folders = useMemo(
    () =>
      buildAudioGroups(fullAudio, (track) =>
        normalizeGroupName(track.folder, "Unknown Folder")
      ),
    [fullAudio]
  );

  const artists = useMemo(
    () =>
      buildAudioGroups(fullAudio, (track) =>
        normalizeGroupName(track.artist, "Unknown Artist")
      ),
    [fullAudio]
  );

  const albums = useMemo(
    () =>
      buildAudioGroups(fullAudio, (track) =>
        normalizeGroupName(track.album ?? track.folder, "Unknown Album")
      ),
    [fullAudio]
  );

  const visibleTracks = pagedTracks;
  const visibleGroups = activeView === "folders" ? folders : activeView === "artists" ? artists : albums;
  const latestArtwork = pagedTracks.find((item) => item.thumbnail)?.thumbnail;
  const selectionMode = !GROUP_VIEWS.has(activeView) && selectedAudioIds.length > 0;
  const selectedAudioIdSet = useMemo(() => new Set(selectedAudioIds), [selectedAudioIds]);
  const allVisibleAudioIds = useMemo(
    () => visibleTracks.map((track) => track.id),
    [visibleTracks]
  );
  const allVisibleSelected =
    allVisibleAudioIds.length > 0 &&
    allVisibleAudioIds.every((id) => selectedAudioIdSet.has(id));

  useEffect(() => {
    setSelectedAudioIds((prev) => prev.filter((id) => videos.some((video) => video.id === id)));
  }, [videos]);

  useEffect(() => {
    setSelectedAudioIds([]);
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeView]);

  const playQueue = (tracks: VideoItem[], startIndex = 0) => {
    if (tracks.length === 0) return;
    L.audio('playQueue', { count: tracks.length, startIndex, first: tracks[startIndex]?.title });
    void playAudio(tracks, startIndex);
    navigation.navigate("audio-player");
  };

  const toggleSelection = useCallback((id: string) => {
    setSelectedAudioIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedAudioIds([]), []);

  const handleSelectAllToggle = useCallback(() => {
    setSelectedAudioIds(allVisibleSelected ? [] : allVisibleAudioIds);
  }, [allVisibleSelected, allVisibleAudioIds]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedAudioIds.length === 0) return;

    const count = selectedAudioIds.length;
    Alert.alert(
      "Delete Selected",
      `Move ${count} items to the recycle bin?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ids = [...selectedAudioIds];
            clearSelection();
            await removeVideos(ids, "temporary");
          },
        },
      ]
    );
  }, [selectedAudioIds, removeVideos, clearSelection]);

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    const ids = [...selectedAudioIds];
    setPlaylistModalVisible(false);
    clearSelection();
    void addVideosToPlaylist(playlistId, ids);
  }, [selectedAudioIds, addVideosToPlaylist, clearSelection]);

  const renderEmpty = () => (
    <ScrollView
      contentContainerStyle={styles.emptyWrap}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void refreshDeviceVideos()}
          tintColor={colors.primary}
        />
      }
    >
      <EmptyState
        icon={query ? "search" : activeView === "favorites" ? "heart" : "music"}
        title={query ? "No Results" : `No ${VIEW_LABELS[activeView]}`}
        subtitle={
          syncError ??
          (query
            ? `No audio matching "${query}"`
            : "Pull to scan storage for songs, albums, artists, and folders.")
        }
      />
    </ScrollView>
  );

  const countLabel = GROUP_VIEWS.has(activeView)
    ? `${visibleGroups.length} ${visibleGroups.length === 1 ? "group" : "groups"}`
    : `${visibleTracks.length} ${visibleTracks.length === 1 ? "song" : "songs"}`;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={latestArtwork} />
        <ScreenHeader
          title={selectionMode ? `${selectedAudioIds.length} selected` : "Audio"}
          topPad={topPad}
          right={
            selectionMode ? (
              <View style={styles.headerActions}>
                <Pressable
                  onPress={clearSelection}
                  style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Feather name="x" size={20} color={colors.text} />
                </Pressable>
              </View>
            ) : undefined
          }
        />

        <View style={styles.headerArea}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search songs, artists, albums..." />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.viewTabs}
          >
            {(Object.keys(VIEW_LABELS) as AudioView[]).map((view) => (
              <Pressable
                key={view}
                onPress={() => setActiveView(view)}
                style={[
                  styles.browserChip,
                  {
                    backgroundColor: activeView === view ? `${colors.primary}33` : colors.card,
                    borderColor: activeView === view ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.browserChipText,
                    { color: activeView === view ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {VIEW_LABELS[view]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.actionRow}>
            {!GROUP_VIEWS.has(activeView) && visibleTracks.length > 0 && selectionMode ? (
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
            ) : (
              <Pressable
                onPress={() => void refreshDeviceVideos()}
                disabled={isRefreshing}
                style={[styles.selectAllChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="rotate-cw" size={14} color={colors.textSecondary} />
                  <Text style={[styles.selectAllChipText, { color: colors.textSecondary }]}>
                    {isRefreshing ? "Scanning..." : "Scan"}
                  </Text>
                </View>
              </Pressable>
            )}

            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
              {selectionMode ? `${selectedAudioIds.length} picked` : countLabel}
            </Text>
          </View>
        </View>

        {GROUP_VIEWS.has(activeView) ? (
          visibleGroups.length === 0 ? (
            renderEmpty()
          ) : (
            <View style={styles.listHost}>
              <FlashList
                data={visibleGroups}
                estimatedItemSize={115}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad + 24 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => void refreshDeviceVideos()}
                  tintColor={colors.primary}
                />
              }
              renderItem={({ item }) => (
                <FolderCard folder={item} onPress={() => playQueue(item.tracks.sort(compareByTitle), 0)} />
              )}
            />
            </View>
          )
        ) : visibleTracks.length === 0 ? (
          renderEmpty()
        ) : (
          <View style={styles.listHost}>
            <FlashList
              ref={flashListRef}
              estimatedItemSize={90}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              data={visibleTracks}
              onEndReached={loadMoreTracks}
              onEndReachedThreshold={0.5}
              extraData={selectedAudioIds}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ ...styles.list, paddingBottom: selectionMode ? 160 : bottomPad + 24 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => void refreshDeviceVideos()}
                  tintColor={colors.primary}
                />
              }
              renderItem={({ item, index }) => (
                <VideoCard
                  video={item}
                  compact
                  selectionMode={selectionMode}
                  selected={selectedAudioIdSet.has(item.id)}
                  onPress={() => {
                    if (selectionMode) {
                      toggleSelection(item.id);
                      return;
                    }
                    playQueue(visibleTracks, index);
                  }}
                  onLongPress={() => toggleSelection(item.id)}
                />
              )}
            />
          </View>
        )}
      </Animated.View>

      <MultiSelectActionBar
        visible={selectionMode}
        selectedCount={selectedAudioIds.length}
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
  headerArea: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    gap: 8,
  },
  viewTabs: {
    gap: 10,
    paddingRight: 16,
  },
  browserChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  browserChipText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  countLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  selectAllChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  selectAllChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyWrap: {
    flexGrow: 1,
    paddingBottom: 40,
  },
});
