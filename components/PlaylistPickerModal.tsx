import Feather from 'react-native-vector-icons/Feather';
import React, { useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayer } from '@/context/PlayerContext';
import { useAppTheme } from '@/hooks/useAppTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (playlistId: string) => void;
  excludePlaylistId?: string;
};

export function PlaylistPickerModal({ visible, onClose, onSelect, excludePlaylistId }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { playlists } = usePlayer();

  const filteredPlaylists = useMemo(() => {
    if (!excludePlaylistId) return playlists;
    return playlists.filter(p => p.id !== excludePlaylistId);
  }, [playlists, excludePlaylistId]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.content,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Add to Playlist</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredPlaylists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => onSelect(item.id)}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="list" size={20} color={colors.primary} />
                </View>
                <View style={styles.itemText}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
                    {item.videoCount} items
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No other playlists found.
                </Text>
              </View>
            }
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingHorizontal: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  itemCount: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
