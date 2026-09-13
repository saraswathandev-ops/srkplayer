import React, { useState } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { Navbar } from './components/Navbar';
import { TabBar } from './components/TabBar';
import { VideoView } from './components/VideoView';
import { AudioView } from './components/AudioView';
import { PlaylistsView } from './components/PlaylistsView';
import { RecycleBinView } from './components/RecycleBinView';
import { SettingsView } from './components/SettingsView';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AudioPlayerModal } from './components/AudioPlayerModal';
import { NetworkStreamModal } from './components/NetworkStreamModal';
import { ImportMediaModal } from './components/ImportMediaModal';

function MainApp() {
  const { settings, themeColors, activeMedia } = usePlayer();
  const [activeTab, setActiveTab] = useState<string>('videos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isStreamModalOpen, setIsStreamModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  const isDark = settings.theme === 'dark';
  const hasFloatingAudio = activeMedia && activeMedia.mediaType === 'audio';

  return (
    <div
      id="skr-player-app"
      className="min-h-screen flex flex-col font-sans transition-colors duration-200"
      style={{
        backgroundColor: isDark ? themeColors.bgDark : themeColors.bgLight,
        color: isDark ? '#F1F5F9' : '#0F172A',
      }}
    >
      {/* Top Navigation */}
      <Navbar
        onOpenStream={() => setIsStreamModalOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Tabs Navigation */}
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Workspace Area */}
      <main
        id="main-workspace-content"
        className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 transition-all ${
          hasFloatingAudio ? 'pb-28 sm:pb-24' : 'pb-12'
        }`}
      >
        {activeTab === 'videos' && <VideoView searchQuery={searchQuery} />}
        {activeTab === 'audio' && <AudioView searchQuery={searchQuery} />}
        {activeTab === 'playlists' && <PlaylistsView />}
        {activeTab === 'recycle-bin' && <RecycleBinView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Media Player Modals & Persistent Audio Bar */}
      <VideoPlayerModal />
      <AudioPlayerBar />
      <AudioPlayerModal />

      {/* Utility Modals */}
      <NetworkStreamModal
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
      />
      <ImportMediaModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <MainApp />
    </PlayerProvider>
  );
}
