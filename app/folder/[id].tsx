import Feather from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";

import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { ListEmptyState, ListLoadingState } from "@/components/library/ListStates";
import { AppHeader } from "@/components/layout/AppHeader";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { VideoCard } from "@/components/VideoCard";
import { MultiSelectActionBar } from "@/components/MultiSelectActionBar";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDeviceVideoSync } from "@/hooks/useDeviceVideoSync";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import {
  getFolderById,
  getFolderVideos,
  type FolderVideoSortDirection,
  type FolderVideoSortField,
} from "@/services/folderService";
import { type FolderItem, type VideoItem } from "@/types/player";
import { formatFileSize } from "@/utils/formatters";
import { log } from "@/utils/logger";

const L = log('FolderScreen');

const PAGE_SIZE = 10;

function decodeFolderId(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return "";

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export default function FolderDetailScreen() {
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { videos, removeVideos, addVideosToPlaylist } = usePlayer();
  const { refreshDeviceVideos, isRefreshing } = useDeviceVideoSync();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params || { id: "" };
  const folderId = decodeFolderId(id);

  const [folder, setFolder] = useState<FolderItem | null>(null);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<FolderVideoSortField>("dateAdded");
  const [sortDirection, setSortDirection] = useState<FolderVideoSortDirection>("desc");

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);

  useEffect(() => {
    L.info('mounted', { folderId });
    return () => L.info('unmounted', { folderId });
  }, [folderId]);

  const folderContentVersion = useMemo(
    () =>
      videos.reduce((version, video) => {
        if (video.folder !== folderId) {
          return version;
        }

        return (
          version +
          1 +
          Math.max(video.dateAdded || 0, 0) +
          Math.max(video.size || 0, 0)
        );
      }, 0),
    [folderId, videos]
  );

  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
  }, [folderId, folderContentVersion, sortBy, sortDirection]);

  useEffect(() => {
    let cancelled = false;

    if (!folderId) {
      setFolder(null);
      return () => {
        cancelled = true;
      };
    }

    void getFolderById(folderId)
      .then((nextFolder) => {
        if (!cancelled) {
          setFolder(nextFolder);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFolder(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [folderId, folderContentVersion]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!folderId) {
        setItems([]);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const nextItems = await getFolderVideos(
          folderId,
          PAGE_SIZE,
          page * PAGE_SIZE,
          sortBy,
          sortDirection
        );
        if (cancelled) return;

        L.db('folder videos loaded', { folderId, page, count: nextItems.length });
        setItems((prev) => (page === 0 ? nextItems : [...prev, ...nextItems]));
        setHasMore(nextItems.length === PAGE_SIZE);
      } catch (err) {
        L.error('folder videos load failed', err);
        if (cancelled) return;

        setItems((prev) => (page === 0 ? [] : prev));
        setHasMore(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [folderId, folderContentVersion, page, sortBy, sortDirection]);

  const toggleSelection = useCallback((videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
        if (next.size === 0) setSelectionMode(false);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }, []);

  const handleLongPress = useCallback((video: VideoItem) => {
    setSelectionMode(true);
    setSelectedIds(new Set([video.id]));
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedIds.size;
    Alert.alert(
      "Delete Selected",
      `Are you sure you want to move ${count} items to the recycle bin?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ids = Array.from(selectedIds);
            handleCancelSelection();
            await removeVideos(ids, "temporary");
          },
        },
      ]
    );
  }, [selectedIds, removeVideos, handleCancelSelection]);

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    const ids = Array.from(selectedIds);
    setPlaylistModalVisible(false);
    handleCancelSelection();
    void addVideosToPlaylist(playlistId, ids);
  }, [selectedIds, addVideosToPlaylist, handleCancelSelection]);

  const heroArtwork = folder?.coverUri ?? items[0]?.thumbnail;
  const visibleSizeBytes = useMemo(
    () => items.reduce((total, item) => total + Math.max(item.size || 0, 0), 0),
    [items]
  );
  const subtitle = useMemo(() => {
    if (!folder) return "";
    if (folder.videoCount === 1) return "1 item stored in this folder";
    return `${folder.videoCount} items stored in this folder`;
  }, [folder]);
  const sortLabel = useMemo(() => {
    if (sortBy === "title") return "Name";
    if (sortBy === "size") return "Size";
    return "Date";
  }, [sortBy]);

  const footerLabel = useMemo(() => {
    if (isLoading && items.length > 0) {
      return "Loading next batch...";
    }
    return "All files loaded";
  }, [hasMore, isLoading, items.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenBackdrop artwork={heroArtwork} />
      <AppHeader
        title={folder?.name ?? "Folder"}
        topPad={topPad + 4}
        onBack={() => navigation.goBack()}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onCancelSelection={handleCancelSelection}
        right={
          !selectionMode ? (
            <Pressable
              onPress={() => {
                setItems([]);
                setPage(0);
                setHasMore(true);
                void refreshDeviceVideos();
              }}
              style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="refresh-cw" size={18} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.heroWrap}>
        <View
          style={[
            styles.heroCard,
            { backgroundColor: `${colors.card}EE`, borderColor: colors.border },
          ]}
        >
          <View style={styles.infoRow}>
            <View
              style={[
                styles.infoChip,
                { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}28` },
              ]}
            >
              <Text style={[styles.infoChipText, { color: colors.text }]}>
                {items.length}/{folder?.videoCount ?? 0} files
              </Text>
            </View>
            <View
              style={[
                styles.infoChip,
                { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}28` },
              ]}
            >
              <Text style={[styles.infoChipText, { color: colors.text }]}>
                {formatFileSize(visibleSizeBytes)}
              </Text>
            </View>
          </View>
          <LibraryToolbar
            sortField={
              sortBy === "dateAdded" ? "date" : sortBy === "title" ? "name" : "size"
            }
            sortDirection={sortDirection}
            sortFields={["date", "name", "size"]}
            onChangeSortField={(field) =>
              setSortBy(field === "date" ? "dateAdded" : field === "name" ? "title" : "size")
            }
            onToggleSortDirection={() =>
              setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
            }
            rightSlot={
              selectionMode ? (
                <Pressable
                  onPress={handleSelectAll}
                  style={[styles.selectAllChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.selectAllChipText, { color: colors.textSecondary }]}>
                    Select all
                  </Text>
                </Pressable>
              ) : undefined
            }
          />
        </View>
      </View>

      {items.length === 0 && isLoading ? (
        <ListLoadingState count={5} variant="list" />
      ) : items.length === 0 && !isLoading ? (
        <ListEmptyState
          icon="folder"
          title="No Media In Folder"
          subtitle="Sync device media again or add audio or video to this folder."
          onRefresh={() => void refreshDeviceVideos()}
          refreshing={isRefreshing}
        />
      ) : (
        <View style={styles.listHost}>
          <FlashList
            data={items}
            estimatedItemSize={115}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ ...styles.list, paddingBottom: selectionMode ? 160 : bottomPad }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => {
                  setItems([]);
                  setPage(0);
                  setHasMore(true);
                  void refreshDeviceVideos();
                }}
                tintColor={colors.primary}
              />
            }
            onEndReached={() => {
              if (hasMore && !isLoading) {
                setPage((p) => p + 1);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              items.length > 0 ? (
                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                    {footerLabel}
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <VideoCard
                video={item}
                compact
                selectionMode={selectionMode}
                selected={selectedIds.has(item.id)}
                onPress={selectionMode ? () => toggleSelection(item.id) : undefined}
                onLongPress={selectionMode ? undefined : handleLongPress}
              />
            )}
            extraData={selectedIds}
          />
        </View>
      )}

      <MultiSelectActionBar
        visible={selectionMode}
        selectedCount={selectedIds.size}
        onCancel={handleCancelSelection}
        onSelectAll={handleSelectAll}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listHost: {
    flex: 1,
    minHeight: 2,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  infoChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  selectAllChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectAllChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
