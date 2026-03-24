import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useRef, useState, useEffect } from "react";
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
import { usePlayer } from "@/context/PlayerContext";
import { useTrackPlayer } from "@/context/TrackPlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDeviceVideoSync } from "@/hooks/useDeviceVideoSync";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { type FolderItem } from "@/types/player";

export default function AudioScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { videos, removeVideo } = usePlayer();
  const { playAudio } = useTrackPlayer();
  const { refreshDeviceVideos, isRefreshing } = useDeviceVideoSync();
  const swipeNavigation = useTabSwipeNavigation("audio");

  const [query, setQuery] = useState("");
  const flashListRef = useRef<FlashList<any>>(null);
  const [selectedAudioIds, setSelectedAudioIds] = useState<string[]>([]);
  const [browserMode, setBrowserMode] = useState<"folders" | "tracks">("folders");

  const audioItems = useMemo(() => {
    return videos.filter((video) => video.mediaType === "audio");
  }, [videos]);

  const audioFolders = useMemo(() => {
    const folderMap = new Map<string, FolderItem>();

    audioItems.forEach((video) => {
      const folderPath = video.folder || "Unknown Album";
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, {
          id: folderPath,
          name: folderPath,
          videoCount: 0,
          updatedAt: video.dateAdded,
          coverUri: typeof video.thumbnail === "string" ? video.thumbnail : undefined,
          coverHash: video.thumbnailHash,
        });
      }

      const folder = folderMap.get(folderPath)!;
      folder.videoCount++;
      if (video.dateAdded > folder.updatedAt) folder.updatedAt = video.dateAdded;
      if (!folder.coverUri && video.thumbnail && typeof video.thumbnail === "string") {
        folder.coverUri = video.thumbnail;
        folder.coverHash = video.thumbnailHash;
      }
    });

    return Array.from(folderMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [audioItems]);

  const filteredFolders = useMemo(() => {
    if (!query.trim()) return audioFolders;
    const normalizedQuery = query.trim().toLowerCase();
    return audioFolders.filter((folder) =>
      (folder.name || "").toLowerCase().includes(normalizedQuery)
    );
  }, [audioFolders, query]);

  const filteredAudio = useMemo(() => {
    if (!query.trim()) return audioItems;
    const normalizedQuery = query.trim().toLowerCase();
    return audioItems.filter((item) =>
      (item.title || "").toLowerCase().includes(normalizedQuery)
    );
  }, [audioItems, query]);

  const sortedAudio = useMemo(() => {
    return [...filteredAudio].sort((left, right) => (right.dateAdded || 0) - (left.dateAdded || 0));
  }, [filteredAudio]);

  const latestArtwork = audioItems[0]?.thumbnail;

  const selectionMode = browserMode === "tracks" && selectedAudioIds.length > 0;
  const selectedAudioIdSet = useMemo(() => new Set(selectedAudioIds), [selectedAudioIds]);
  const allVisibleAudioIds = useMemo(
    () => sortedAudio.map((video) => video.id),
    [sortedAudio]
  );
  const allVisibleSelected =
    allVisibleAudioIds.length > 0 &&
    allVisibleAudioIds.every((id) => selectedAudioIdSet.has(id));

  useEffect(() => {
    setSelectedAudioIds((prev) => prev.filter((id) => videos.some((video) => video.id === id)));
  }, [videos]);

  useEffect(() => {
    if (browserMode !== "tracks") {
      setSelectedAudioIds([]);
    }
  }, [browserMode]);

  const toggleSelection = (id: string) => {
    setSelectedAudioIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedAudioIds([]);

  const handleSelectAllToggle = () => {
    if (allVisibleSelected) {
      clearSelection();
    } else {
      setSelectedAudioIds(allVisibleAudioIds);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedAudioIds.length === 0) return;

    const count = selectedAudioIds.length;
    const message = `Choose how to delete ${count} selected item${count !== 1 ? "s" : ""}.`;

    Alert.alert("Delete Selected", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove from Library",
        onPress: () => {
          void (async () => {
            await Promise.all(
              selectedAudioIds.map((id) => removeVideo(id, "temporary"))
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
              selectedAudioIds.map((id) => removeVideo(id, "permanent"))
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={clearSelection}
                  style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  hitSlop={8}
                >
                  <Feather name="x" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={handleDeleteSelected}
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="trash-2" size={20} color="#fff" />
                </Pressable>
              </View>
            ) : undefined
          }
        />

        <View style={styles.headerArea}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search audio..."
          />

          <View style={styles.actionRow}>
            <View style={styles.toggleRow}>
              {(["folders", "tracks"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setBrowserMode(mode)}
                  style={[
                    styles.browserChip,
                    {
                      backgroundColor: browserMode === mode ? `${colors.primary}33` : colors.card,
                      borderColor: browserMode === mode ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.browserChipText, { color: browserMode === mode ? colors.primary : colors.textSecondary }]}>
                    {mode === "folders" ? "Albums" : "Tracks"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {(browserMode === "tracks" && sortedAudio.length > 0 && selectionMode) ? (
              <Pressable
                onPress={handleSelectAllToggle}
                style={[
                  styles.selectAllChip,
                  { backgroundColor: allVisibleSelected ? colors.primary : colors.card, borderColor: allVisibleSelected ? colors.primary : colors.border },
                ]}
              >
                <Text style={[styles.selectAllChipText, { color: allVisibleSelected ? "#fff" : colors.textSecondary }]}>
                  {allVisibleSelected ? "Clear all" : "Select all"}
                </Text>
              </Pressable>
            ) : <View />}

            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
              {selectionMode ? `${selectedAudioIds.length} picked` : `${browserMode === "folders" ? filteredFolders.length : sortedAudio.length} ${browserMode === "folders" ? "albums" : "tracks"}`}
            </Text>
          </View>
        </View>

        {browserMode === "folders" ? (
          filteredFolders.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyWrap}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            >
              <EmptyState
                icon={query ? "search" : "folder"}
                title={query ? "No Results" : "No Audio Albums"}
                subtitle={query ? `No folders matching "${query}"` : "Sync device media to see audio albums."}
              />
            </ScrollView>
          ) : (
            <FlashList
              data={filteredFolders}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad + 24 }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
              renderItem={({ item }) => (
                <FolderCard
                  folder={item}
                  onPress={() => {
                    // Play all tracks in this album via RNTP
                    const albumTracks = sortedAudio.filter(
                      (v) => (v.folder || "Unknown Album") === item.id
                    );
                    if (albumTracks.length > 0) {
                      void playAudio(albumTracks, 0);
                      navigation.navigate('audio-player');
                    }
                  }}
                />
              )}
            />
          )
        ) : (
          sortedAudio.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyWrap}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
              }
            >
              <EmptyState
                icon={query ? "search" : "music"}
                title={query ? "No Results" : "No Audio"}
                subtitle={
                  query
                    ? `No audio matching "${query}"`
                    : "Sync device media or import audio files to build your music library."
                }
              />
            </ScrollView>
          ) : (
            <FlashList
              ref={flashListRef}
              data={sortedAudio}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad + 24 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
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
                    } else {
                      // Play via RNTP with the full sorted list as queue
                      void playAudio(sortedAudio, index);
                      navigation.navigate('audio-player');
                    }
                  }}
                  onLongPress={() => toggleSelection(item.id)}
                />
              )}
            />
          )
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    flexWrap: "wrap",
    gap: 8,
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
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  countLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 13,
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
