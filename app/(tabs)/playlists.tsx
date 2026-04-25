import Feather from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PlaylistCard } from "@/components/PlaylistCard";
import { Playlist, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";

export default function PlaylistsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { playlists, createPlaylist, videos } = usePlayer();
  const swipeNavigation = useTabSwipeNavigation("playlists");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;

    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger('notificationSuccess');
    }

    await createPlaylist(newName.trim());
    setNewName("");
    setShowCreate(false);
  };

  const handlePlaylistPress = (playlist: Playlist) => {
    navigation.navigate("playlist", { id: playlist.id });
  };

  const createPlaylistModal = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[
        styles.modalOverlay,
        Platform.OS === "web" ? styles.webModalOverlay : null,
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setShowCreate(false)}
      />
      <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          New Playlist
        </Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Playlist name"
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.backgroundTertiary,
              borderColor: colors.border,
            },
          ]}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <View style={styles.modalActions}>
          <Pressable
            onPress={() => {
              setShowCreate(false);
              setNewName("");
            }}
            style={[
              styles.cancelBtn,
              { backgroundColor: colors.backgroundTertiary },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleCreate}
            style={[
              styles.createBtn,
              {
                backgroundColor: newName.trim()
                  ? colors.primary
                  : colors.backgroundTertiary,
              },
            ]}
          >
            <Text
              style={[
                styles.createText,
                {
                  color: newName.trim() ? "#fff" : colors.textTertiary,
                },
              ]}
            >
              Create
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={videos[0]?.thumbnail} />
        <ScreenHeader
          title="Playlists"
          topPad={topPad}
          right={
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  ReactNativeHapticFeedback.trigger('impactLight');
                }
                setShowCreate(true);
              }}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={18} color="#fff" />
            </Pressable>
          }
        />

        {/* <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Collections</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Organize media into clean playback groups.
        </Text>
        <Text style={[styles.heroText, { color: colors.textSecondary }]}>
          {playlists.length} playlists built from {videos.length} library items.
        </Text>
      </View> */}

        {playlists.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="list" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Playlists Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Group your favourite videos into collections for quick access.
            </Text>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.emptyBtnText}>Create Playlist</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            renderItem={({ item }) => (
              <PlaylistCard playlist={item} onPress={handlePlaylistPress} />
            )}
          />
        )}

        {Platform.OS === "web" ? (
          showCreate ? createPlaylistModal : null
        ) : (
          <Modal
            visible={showCreate}
            animationType="fade"
            transparent
            onRequestClose={() => setShowCreate(false)}
          >
            {createPlaylistModal}
          </Modal>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  heroCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
  },
  heroText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 10,
    minWidth: 200,
    justifyContent: "center",
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    maxWidth: 260,
    marginBottom: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  webModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  createBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  createText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
