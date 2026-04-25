import os

path = r'e:\Saraswathan\AI\mx-player-source\artifacts\srkplayer\app\player.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """      if (activePlayer && backgroundPlayRef.current) {
        setPlayerSession(activePlayer, activeVideoId);
        return;
      }"""

new_block = """      const wasPlaying = activePlayer?.playing;
      const lastPos = activePlayer?.currentTime;
      if (activePlayer && backgroundPlayRef.current && wasPlaying && isTrackPlayerAvailable) {
        // Handoff to TrackPlayer so audio continues in mini-player/background
        void (async () => {
          try {
            await TrackPlayer.reset();
            await TrackPlayer.add({
              id: activeVideoId || 'handoff',
              url: playbackUri,
              title: video?.title || "Unknown File",
              artist: video?.folder || "Media Library",
              artwork: getThumbnailUri(video?.thumbnail) ?? undefined,
              mediaType: 'video', // Custom tag for AudioPlayerBar
            } as any);
            if (lastPos && lastPos > 0) {
              await TrackPlayer.seekTo(lastPos);
            }
            await TrackPlayer.play();
          } catch (e) {
            console.error("Unmount handoff failed", e);
          }
        })();
        return;
      }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched player.tsx")
else:
    print("Target block not found in player.tsx")
    # Try a more flexible match
    import re
    pattern = r'if\s*\(activePlayer\s*&&\s*backgroundPlayRef\.current\)\s*{\s*setPlayerSession\(activePlayer,\s*activeVideoId\);\s*return;\s*}'
    if re.search(pattern, content):
        content = re.sub(pattern, new_block, content)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully patched player.tsx using regex")
    else:
        print("Even regex match failed")
