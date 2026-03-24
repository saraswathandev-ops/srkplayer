import Feather from 'react-native-vector-icons/Feather';
import FastImage from "react-native-fast-image";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { VideoCard } from "@/components/VideoCard";
import { VideoItem, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getPlaylistVideoIds,
  getPlaylistVideos,
  type PlaylistVideo,
} from "@/services/playlistService";

const PAGE_SIZE = 20;

export default function PlaylistDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params || { id: "" };
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { playlists, videos, addToPlaylist, removeFromPlaylist, setCurrentVideo } =
    usePlayer();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistVideo[]>([]);
  const [playlistVideoIds, setPlaylistVideoIds] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const playlist = playlists.find((item) => item.id === id);
  const selectionMode = selectedVideoIds.length > 0;
  const selectedVideoIdSet = useMemo(
    () => new Set(selectedVideoIds),
    [selectedVideoIds]
  );
  const moveTargets = useMemo(
    () => playlists.filter((item) => item.id !== playlist?.id),
    [playlist?.id, playlists]
  );

  const availableToAdd = useMemo(() => {
    const playlistVideoIdSet = new Set(playlistVideoIds);
    return videos.filter((video) => !playlistVideoIdSet.has(video.id));
  }, [playlistVideoIds, videos]);

  const loadPlaylistPage = useCallback(
    async (nextPage: number, reset = false) => {
      if (!id || loadingRef.current) return;

      loadingRef.current = true;
      setIsLoading(true);

      try {
        const [videoIds, pageVideos] = await Promise.all([
          reset ? getPlaylistVideoIds(id) : Promise.resolve<string[] | null>(null),
          getPlaylistVideos(id, PAGE_SIZE, nextPage * PAGE_SIZE),
        ]);

        if (videoIds) {
          setPlaylistVideoIds(videoIds);
        }

        setPlaylistVideos((prev) =>
          reset ? pageVideos : [...prev, ...pageVideos]
        );
        setHasMore(pageVideos.length === PAGE_SIZE);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (!id) return;

    setPage(0);
    void loadPlaylistPage(0, true);
  }, [id, loadPlaylistPage, playlist?.videoCount]);

  useEffect(() => {
    if (!id || page === 0) return;
    void loadPlaylistPage(page);
  }, [id, loadPlaylistPage, page]);

  useEffect(() => {
    setSelectedVideoIds((prev) =>
      prev.filter((videoId) => playlistVideoIds.includes(videoId))
    );
  }, [playlistVideoIds]);

  if (!playlist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Playlist not found" />
      </View>
    );
  }

  const toggleSelection = useCallback((videoId: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((idItem) => idItem !== videoId)
        : [...prev, videoId]
    );
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectedVideoIds([]);
    setTargetPlaylistId(null);
    setShowMoveModal(false);
  }, []);

  const handleRemoveSelected = useCallback(() => {
    if (selectedVideoIds.length === 0) return;

    const message =
      selectedVideoIds.length === 1
        ? "Remove this video from the playlist?"
        : `Remove ${selectedVideoIds.length} videos from the playlist?`;

    Alert.alert("Remove from Playlist", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await Promise.all(
              selectedVideoIds.map((videoId) =>
                removeFromPlaylist(playlist.id, videoId)
              )
            );
            exitSelectionMode();
            setPage(0);
            await loadPlaylistPage(0, true);
          })();
        },
      },
    ]);
  }, [
    exitSelectionMode,
    loadPlaylistPage,
    playlist.id,
    removeFromPlaylist,
    selectedVideoIds,
  ]);

  const handleMoveSelected = useCallback(async () => {
    if (!targetPlaylistId || selectedVideoIds.length === 0) return;

    await Promise.all(
      selectedVideoIds.map((videoId) => addToPlaylist(targetPlaylistId, videoId))
    );
    await Promise.all(
      selectedVideoIds.map((videoId) => removeFromPlaylist(playlist.id, videoId))
    );
    exitSelectionMode();
    setPage(0);
    await loadPlaylistPage(0, true);
  }, [
    addToPlaylist,
    exitSelectionMode,
    loadPlaylistPage,
    playlist.id,
    removeFromPlaylist,
    selectedVideoIds,
    targetPlaylistId,
  ]);

  const handleAdd = async (videoId: string) => {
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger('impactLight');
    }

    await addToPlaylist(playlist.id, videoId);
  };

  const handlePlayAll = () => {
    if (playlistVideos.length === 0) return;
    setCurrentVideo(playlistVideos[0]);
    navigation.navigate("player", { id: playlistVideos[0].id });
  };

  const moveVideosContent = (
    <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>Move Videos</Text>
        <Pressable
          onPress={() => {
            setShowMoveModal(false);
            setTargetPlaylistId(null);
          }}
          hitSlop={10}
        >
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>
      </View>
      {moveTargets.length === 0 ? (
        <EmptyState
          icon="list"
          title="No Other Playlists"
          subtitle="Create another playlist to move selected videos"
        />
      ) : (
        <View style={styles.moveSheetBody}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalList}
          >
            {moveTargets.map((item) => {
              const active = targetPlaylistId === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTargetPlaylistId(item.id)}
                  style={[
                    styles.targetRow,
                    {
                      backgroundColor: active ? `${colors.primary}16` : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.targetTextWrap}>
                    <Text style={[styles.targetTitle, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.targetMeta, { color: colors.textSecondary }]}
                    >
                      {item.videoCount} {item.videoCount === 1 ? "video" : "videos"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {active ? <Feather name="check" size={14} color="#fff" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.moveActions, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={() => {
                setShowMoveModal(false);
                setTargetPlaylistId(null);
              }}
              style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleMoveSelected();
              }}
              disabled={!targetPlaylistId}
              style={[
                styles.primaryActionBtn,
                {
                  backgroundColor: targetPlaylistId
                    ? colors.primary
                    : colors.backgroundTertiary,
                  opacity: targetPlaylistId ? 1 : 0.55,
                },
              ]}
            >
              <Text style={styles.primaryActionText}>OK Move</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const addVideosContent = (
    <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>Add Videos</Text>
        <Pressable onPress={() => setShowAddModal(false)} hitSlop={10}>
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>
      </View>
      {availableToAdd.length === 0 ? (
        <EmptyState
          icon="film"
          title="No More Videos"
          subtitle="All videos are already in this playlist"
        />
      ) : (
        <FlatList
          data={availableToAdd}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.modalList}
          renderItem={({ item }) => (
            (() => {
              const source = item.thumbnail
                ? item.thumbnail
                : item.thumbnailHash
                  ? { thumbhash: item.thumbnailHash }
                  : null;
              const placeholder =
                item.thumbnail && item.thumbnailHash
                  ? { thumbhash: item.thumbnailHash }
                  : undefined;

              return (
                <Pressable
                  onPress={() => {
                    void handleAdd(item.id);
                  }}
                  style={({ pressed }) => [
                    styles.addableRow,
                    { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.thumbPlaceholder,
                      { backgroundColor: colors.backgroundTertiary },
                    ]}
                  >
                    {source ? (
                      <FastImage
                        source={{ uri: typeof source === 'string' ? source : undefined }}
                        style={styles.thumbImage}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    ) : (
                      <Feather
                        name={item.mediaType === "audio" ? "music" : "film"}
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.addableTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <View style={[styles.addCircle, { backgroundColor: colors.primary }]}>
                    <Feather name="plus" size={16} color="#fff" />
                  </View>
                </Pressable>
              );
            })()
          )}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => {
            if (selectionMode) {
              exitSelectionMode();
              return;
            }
            navigation.goBack();
          }}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {selectionMode
            ? `${selectedVideoIds.length} selected`
            : playlist.name}
        </Text>
        {selectionMode ? (
          <View style={styles.selectionHeaderActions}>
            <Pressable
              onPress={handleRemoveSelected}
              style={[styles.headerActionBtn, { backgroundColor: colors.card }]}
            >
              <Feather name="trash-2" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => {
                setTargetPlaylistId(null);
                setShowMoveModal(true);
              }}
              style={[styles.headerActionBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="corner-up-right" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowAddModal(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={[styles.subheader, { backgroundColor: colors.background }]}>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {selectionMode
            ? "Tap videos to pick multiple items"
            : `${playlist.videoCount} ${playlist.videoCount === 1 ? "video" : "videos"
            }`}
        </Text>
        {!selectionMode && playlistVideos.length > 0 && (
          <Pressable
            onPress={handlePlayAll}
            style={[styles.playAllBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="play" size={14} color="#fff" />
            <Text style={styles.playAllText}>Play All</Text>
          </Pressable>
        )}
      </View>

      {playlist.videoCount === 0 ? (
        <EmptyState
          icon="film"
          title="No Videos"
          subtitle="Add videos to this playlist"
          action={
            <Pressable
              onPress={() => setShowAddModal(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Add Videos</Text>
            </Pressable>
          }
        />
      ) : (
        <FlatList
          data={playlistVideos}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!hasMore || isLoading) return;
            setPage((current) => current + 1);
          }}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <VideoCard
              video={item as VideoItem}
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
          )}
        />
      )}

      {Platform.OS === "web" ? (
        showAddModal ? (
          <View style={[styles.modalOverlay, styles.webModalOverlay]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowAddModal(false)}
            />
            {addVideosContent}
          </View>
        ) : null
      ) : (
        <Modal
          visible={showAddModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddModal(false)}
        >
          {addVideosContent}
        </Modal>
      )}

      {Platform.OS === "web" ? (
        showMoveModal ? (
          <View style={[styles.modalOverlay, styles.webModalOverlay]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setShowMoveModal(false);
                setTargetPlaylistId(null);
              }}
            />
            {moveVideosContent}
          </View>
        ) : null
      ) : (
        <Modal
          visible={showMoveModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowMoveModal(false);
            setTargetPlaylistId(null);
          }}
        >
          {moveVideosContent}
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  subheader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  count: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  playAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  playAllText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  footerLoader: {
    paddingVertical: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  webModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  modalList: { padding: 16, gap: 8 },
  addableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  thumbPlaceholder: {
    width: 44,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  addableTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  addCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  moveSheetBody: {
    flex: 1,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  targetTextWrap: {
    flex: 1,
  },
  targetTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  targetMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  moveActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  secondaryActionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  primaryActionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
