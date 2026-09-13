import React, { useState, useMemo } from 'react';
import { Play, Shuffle, Music, User, Disc, Folder, Search } from 'lucide-react';
import { VideoItem } from '../types';
import { AudioTrackItem } from './AudioTrackItem';
import { usePlayer } from '../context/PlayerContext';

interface AudioViewProps {
  searchQuery: string;
}

export function AudioView({ searchQuery }: AudioViewProps) {
  const { mediaList, playMedia, settings, themeColors } = usePlayer();
  const [subTab, setSubTab] = useState<'tracks' | 'artists' | 'albums' | 'folders'>('tracks');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const isDark = settings.theme === 'dark';

  const allAudio = useMemo(() => {
    return mediaList.filter((m) => m.mediaType === 'audio');
  }, [mediaList]);

  // Distinct artists
  const artists = useMemo(() => {
    const map = new Map<string, number>();
    allAudio.forEach((a) => {
      const art = a.artist || 'Unknown Artist';
      map.set(art, (map.get(art) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [allAudio]);

  // Distinct albums
  const albums = useMemo(() => {
    const map = new Map<string, { count: number; cover?: string }>();
    allAudio.forEach((a) => {
      const alb = a.album || 'Unknown Album';
      const existing = map.get(alb);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(alb, { count: 1, cover: a.thumbnail });
      }
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [allAudio]);

  // Distinct folders
  const folders = useMemo(() => {
    const map = new Map<string, number>();
    allAudio.forEach((a) => {
      const f = a.folder || 'Music';
      map.set(f, (map.get(f) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [allAudio]);

  // Filtered tracks
  const filteredAudio = useMemo(() => {
    let list = allAudio;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.artist && a.artist.toLowerCase().includes(q)) ||
          (a.album && a.album.toLowerCase().includes(q)) ||
          a.folder.toLowerCase().includes(q)
      );
    }

    if (selectedArtist) {
      list = list.filter((a) => (a.artist || 'Unknown Artist') === selectedArtist);
    }

    if (selectedAlbum) {
      list = list.filter((a) => (a.album || 'Unknown Album') === selectedAlbum);
    }

    if (selectedFolder) {
      list = list.filter((a) => a.folder === selectedFolder);
    }

    return list;
  }, [allAudio, searchQuery, selectedArtist, selectedAlbum, selectedFolder]);

  const handlePlayAll = () => {
    if (filteredAudio.length > 0) {
      playMedia(filteredAudio[0], filteredAudio, false);
    }
  };

  const handleShuffleAll = () => {
    if (filteredAudio.length > 0) {
      const shuffled = [...filteredAudio].sort(() => Math.random() - 0.5);
      playMedia(shuffled[0], shuffled, false);
    }
  };

  return (
    <div id="audio-view-container" className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Music & Audio</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {allAudio.length} tracks • {artists.length} artists • {albums.length} albums
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="play-all-audio-btn"
            onClick={handlePlayAll}
            disabled={filteredAudio.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: themeColors.primary }}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Play All</span>
          </button>

          <button
            id="shuffle-all-audio-btn"
            onClick={handleShuffleAll}
            disabled={filteredAudio.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-slate-700/20 disabled:opacity-50 cursor-pointer"
            style={{
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
            }}
          >
            <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      {/* Sub tabs: Tracks / Artists / Albums / Folders */}
      <div className="flex items-center gap-1.5 border-b pb-2" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
        {[
          { id: 'tracks', label: 'All Tracks', icon: Music },
          { id: 'artists', label: 'Artists', icon: User },
          { id: 'albums', label: 'Albums', icon: Disc },
          { id: 'folders', label: 'Folders', icon: Folder },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSubTab(tab.id as any);
                setSelectedArtist(null);
                setSelectedAlbum(null);
                setSelectedFolder(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: isActive ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                color: isActive ? themeColors.primary : undefined,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter breadcrumb if artist/album selected */}
      {(selectedArtist || selectedAlbum || selectedFolder) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Filtered by:</span>
          <span className="px-2 py-0.5 rounded-md font-semibold text-white" style={{ backgroundColor: themeColors.primary }}>
            {selectedArtist || selectedAlbum || selectedFolder}
          </span>
          <button
            onClick={() => {
              setSelectedArtist(null);
              setSelectedAlbum(null);
              setSelectedFolder(null);
            }}
            className="text-slate-400 hover:text-white underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Tab: Artists */}
      {subTab === 'artists' && !selectedArtist && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {artists.map((art) => (
            <div
              key={art.name}
              onClick={() => setSelectedArtist(art.name)}
              className="p-4 rounded-2xl border text-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <div
                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.accent})`,
                }}
              >
                <User className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm truncate">{art.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{art.count} {art.count === 1 ? 'track' : 'tracks'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Albums */}
      {subTab === 'albums' && !selectedAlbum && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {albums.map((alb) => (
            <div
              key={alb.name}
              onClick={() => setSelectedAlbum(alb.name)}
              className="p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-800 mb-2.5 shadow-sm">
                {alb.cover ? (
                  <img src={alb.cover} alt={alb.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <Disc className="w-8 h-8" />
                  </div>
                )}
              </div>
              <h4 className="font-bold text-sm truncate">{alb.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{alb.count} {alb.count === 1 ? 'track' : 'tracks'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Folders */}
      {subTab === 'folders' && !selectedFolder && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map((f) => (
            <div
              key={f.name}
              onClick={() => setSelectedFolder(f.name)}
              className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md flex items-center gap-3"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: themeColors.primary }}
              >
                <Folder className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{f.name}</h4>
                <p className="text-xs text-slate-400">{f.count} tracks</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tracks List (When in tracks tab or when artist/album/folder is selected) */}
      {(subTab === 'tracks' || selectedArtist || selectedAlbum || selectedFolder) && (
        <div className="space-y-2">
          {filteredAudio.length === 0 ? (
            <div
              className="text-center py-16 px-4 rounded-3xl border"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <Music className="w-12 h-12 mx-auto text-slate-500 mb-3 opacity-60" />
              <h3 className="font-bold text-base">No audio tracks found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No audio tracks match "${searchQuery}".`
                  : 'Import local audio files or play online streams.'}
              </p>
            </div>
          ) : (
            filteredAudio.map((track, idx) => (
              <AudioTrackItem
                key={track.id}
                track={track}
                index={idx}
                onPlay={(t) => playMedia(t, filteredAudio, false)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
