import Feather from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";

import { EmptyState } from "@/components/EmptyState";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { VideoCard } from "@/components/VideoCard";
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

const PAGE_SIZE = 10;
const AUTO_NEXT_BATCH_DELAY_MS = 1000;

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
  const { videos } = usePlayer();
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
  const autoBatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

        setItems((prev) => (page === 0 ? nextItems : [...prev, ...nextItems]));
        setHasMore(nextItems.length === PAGE_SIZE);
      } catch {
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

  // Removed redundant autoBatch timer. Pagination is now natively bound to onEndReached.

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
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {folder?.name ?? "Folder"}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
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
      </View>

      <View style={styles.heroWrap}>
        <View
          style={[
            styles.heroCard,
            { backgroundColor: `${colors.card}EE`, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Folder Browser</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
            {folder?.name ?? "Local Folder"}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Open synced audio and video from this folder directly from SQLite.
          </Text>
          <View style={styles.infoRow}>
            <View
              style={[
                styles.infoChip,
                { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}28` },
              ]}
            >
              <Text style={[styles.infoChipText, { color: colors.text }]}>
                {items.length}/{folder?.videoCount ?? 0} loaded
              </Text>
            </View>
            <View
              style={[
                styles.infoChip,
                { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}28` },
              ]}
            >
              <Text style={[styles.infoChipText, { color: colors.text }]}>
                Batch {PAGE_SIZE}
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
          <View style={styles.sortRow}>
            {(
              [
                { key: "dateAdded", label: "Date" },
                { key: "title", label: "Name" },
                { key: "size", label: "Size" },
              ] as const
            ).map((option) => {
              const active = sortBy === option.key;

              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSortBy(option.key)}
                  style={[
                    styles.sortChip,
                    {
                      backgroundColor: active ? `${colors.primary}1C` : colors.card,
                      borderColor: active ? `${colors.primary}52` : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      { color: active ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() =>
                setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
              }
              style={[
                styles.directionChip,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather
                name={sortDirection === "desc" ? "arrow-down" : "arrow-up"}
                size={15}
                color={colors.primary}
              />
              <Text style={[styles.directionChipText, { color: colors.text }]}>
                {sortLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {items.length === 0 && !isLoading ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="folder"
            title="No Media In Folder"
            subtitle="Sync device media again or add audio or video to this folder."
          />
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad }}
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
          renderItem={({ item }) => <VideoCard video={item} compact />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
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
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 4,
  },
  sortChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortChipText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  directionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  directionChipText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
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
});
