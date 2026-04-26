const fs = require('fs');
const path = require('path');

const filePath = 'e:\\Saraswathan\\AI\\mx-player-source\\artifacts\\srkplayer\\app\\player.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Define the correct blocks
const sleepTimerStates = `
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [showUpNextPopup, setShowUpNextPopup] = useState(false);
  const [showDiscoveryHints, setShowDiscoveryHints] = useState(false);
`;

const sleepTimerLogic = `
  useEffect(() => {
    if (sleepTimerRemaining === null || sleepTimerRemaining <= 0) return;

    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (playerRef.current) {
            playerRef.current.pause();
            setIsPlaying(false);
          }
          Alert.alert("Sleep Timer", "Playback has been stopped by the sleep timer.");
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemaining]);

  useEffect(() => {
    if (!nextVideo || isAudioMode || !isPlaying) {
      setShowUpNextPopup(false);
      return;
    }
    
    const remaining = duration - position;
    if (remaining > 0 && remaining <= 8) {
      setShowUpNextPopup(true);
    } else {
      setShowUpNextPopup(false);
    }
  }, [duration, isAudioMode, isPlaying, nextVideo, position]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowDiscoveryHints(true);
      setTimeout(() => setShowDiscoveryHints(false), 5000);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSetSleepTimer = useCallback((minutes: number | null) => {
    if (minutes === null) {
      setSleepTimerRemaining(null);
      showHud("seek", "Sleep timer off", 0.1);
    } else {
      const seconds = minutes * 60;
      setSleepTimerRemaining(seconds);
      showHud("seek", Sleep timer set for ${minutes}m, 0.8);
    }
  }, [showHud]);
`;

// 1. Clean up duplicated/messy states
// Search for the start of states after zoomScale
const stateStart = content.indexOf('const [zoomScale, setZoomScale]');
const stateEnd = content.indexOf('const videoWrapperProps =');

if (stateStart !== -1 && stateEnd !== -1) {
  const originalStateBlock = content.substring(stateStart, stateEnd);
  const newStateBlock = `const [zoomScale, setZoomScale] = useState(MIN_PINCH_SCALE);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [utilityRailExpanded, setUtilityRailExpanded] = useState(false);
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);
  const [propertiesPanelVisible, setPropertiesPanelVisible] = useState(false);
  const [trimPanelVisible, setTrimPanelVisible] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimTitle, setTrimTitle] = useState("");
  const [isSavingTrim, setIsSavingTrim] = useState(false);
  const [upNextVisibleCount, setUpNextVisibleCount] = useState(UP_NEXT_PAGE_SIZE + 1);
  const [upNextLandscapePage, setUpNextLandscapePage] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [orientationMode, setOrientationMode] = useState<
    "default" | "portrait" | "landscape"
  >("landscape");
  const [gestureHud, setGestureHud] = useState<{
    mode: GestureMode;
    label: string;
    progress: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [transitionMeta, setTransitionMeta] = useState<{
    title: string;
    direction: "next" | "prev";
  } | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<VideoThumbnail | null>(
    null
  );
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [showUpNextPopup, setShowUpNextPopup] = useState(false);
  const [showDiscoveryHints, setShowDiscoveryHints] = useState(false);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumePersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureFrame = useRef<number | null>(null);
  const lastAudibleVolume = useRef(
    clamp01(settings.defaultVolume) > 0.001 ? clamp01(settings.defaultVolume) : 1
  );
  const pendingGestureUpdate = useRef<
    | { mode: "seek"; value: number; duration: number }
    | null
  >(null);
  const seekPreviewPositionRef = useRef<number | null>(null);
  const lastTap = useRef<{ time: number; zone: TapZone | null }>({
    time: 0,
    zone: null,
  });
  const hasRestoredPosition = useRef(false);
  const isMounted = useRef(true);
  const backgroundPlayRef = useRef(settings.backgroundPlay);
  const lastSavedPosition = useRef(0);
  const completionHandledVideoId = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const videoRef = useRef<VideoRef | null>(null);
  const playerRef = useRef<VideoPlayerShim | null>(null);
  const queueListRef = useRef<FlatList<(typeof videos)[number]> | null>(null);
  const loadedPlayerVideoId = useRef<string | null>(null);
  const orientationManagedRef = useRef(false);
  const transitionProgress = useRef(new Animated.Value(1)).current;
  const gestureRef = useRef<{
    mode: GestureMode | null;
    startX: number;
    startPosition: number;
    startVolume: number;
    startBrightness: number;
  }>({
    mode: null,
    startX: 0,
    startPosition: 0,
    startVolume: 1,
    startBrightness: 0.5,
  });
  const pinchGestureRef = useRef({
    active: false,
    startDistance: 0,
    startScale: MIN_PINCH_SCALE,
    hasChanged: false,
  });
`;
  content = content.replace(originalStateBlock, newStateBlock);
}

// 2. Fix the corrupted effects section
// Search for completion of position restoration
const restorationEnd = content.indexOf('hasRestoredPosition.current = true;');
const nextStablePoint = content.indexOf('const showHud = useCallback');

if (restorationEnd !== -1 && nextStablePoint !== -1) {
  const corruptedBlock = content.substring(restorationEnd, nextStablePoint);
  const fixedBlock = `hasRestoredPosition.current = true;
  }, [player, settings.rememberPosition, sourceDuration, video, clearReleasedPlayer]);

${sleepTimerLogic}

  useEffect(() => {
    if (!player) return;
    if (!videoId) return;

    let backgroundHandoffState: {
      active: boolean;
      position: number;
    } = { active: false, position: 0 };

    const subscription = AppState.addEventListener("change", async (nextState) => {
      let nextPosition = position;
      try {
        nextPosition = Number.isFinite(player.currentTime)
          ? getRelativePlaybackPosition(
            video,
            player.currentTime,
            sourceDuration || player.duration || duration || video?.duration || 0
          )
          : position;
      } catch {
        // player might be gone
      }

      if (nextState === "background" || nextState === "inactive") {
        if (settings.rememberPosition && nextPosition > 0) {
          void updateLastPosition(videoId, nextPosition);
        }

        if (settings.backgroundPlay && playbackUri && player.playing && isTrackPlayerAvailable) {
          // Handoff to TrackPlayer
          backgroundHandoffState.active = true;
          try {
            await TrackPlayer.reset();
            await TrackPlayer.add({
              id: videoId,
              url: playbackUri,
              title: video?.title || "Unknown File",
              artist: video?.folder || "Media Library",
              artwork: getThumbnailUri(video?.thumbnail) ?? undefined,
            });
            await TrackPlayer.seekTo(player.currentTime);
            setTimeout(async () => {
              try {
                player.pause();
                await TrackPlayer.play();
              } catch (e) {}
            }, 100);
          } catch (e) {
            console.log("TrackPlayer background handoff failed", e);
          }
        } else {
          try {
            player.pause();
            setIsPlaying(false);
          } catch {
            clearReleasedPlayer(player);
          }
        }
      } else if (nextState === "active") {
        // Restore from TrackPlayer
        if (backgroundHandoffState.active && isTrackPlayerAvailable) {
          try {
            const trackPlayerPosition = await TrackPlayer.getPosition();
            const trackPlayerState = await TrackPlayer.getPlaybackState();
            await TrackPlayer.pause();
            backgroundHandoffState.active = false;

            if (Number.isFinite(trackPlayerPosition) && trackPlayerPosition > 0) {
              player.currentTime = trackPlayerPosition;
              setPosition(getRelativePlaybackPosition(video, trackPlayerPosition, sourceDuration || duration));
            }
            if (trackPlayerState.state === State.Playing) {
              player.play();
              setIsPlaying(true);
            }
          } catch (e) {
            console.log("TrackPlayer foreground restore failed", e);
          }
        }
      }
    });

    return () => subscription.remove();
  }, [
    player,
    position,
    sourceDuration,
    settings.backgroundPlay,
    settings.rememberPosition,
    playbackUri,
    updateLastPosition,
    video,
    videoId,
    duration,
    clearReleasedPlayer,
  ]);

  useEffect(() => {
    const nextBrightness = clamp01(settings.defaultBrightness);
    setBrightnessLevel(nextBrightness);
  }, [settings.defaultBrightness]);

  useEffect(() => {
    if (Platform.OS === "web") return;
  }, [effectiveOrientationMode]);

  useEffect(() => {
    return () => {
      // orientation cleanup is a no-op (ScreenOrientation removed)
    };
  }, []);

`;
  content = content.replace(corruptedBlock, fixedBlock);
}

// 3. Ensure showHud and others are intact
if (content.indexOf('const showHud = useCallback') === -1) {
  // If somehow deleted, we'll have to restore it too.
}

fs.writeFileSync(filePath, content);
console.log('Repair complete!');
