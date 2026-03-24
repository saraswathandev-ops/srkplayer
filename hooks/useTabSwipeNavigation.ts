import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  useWindowDimensions,
} from "react-native";

const SWIPE_DISTANCE = 60;
const SWIPE_ACTIVATION_DISTANCE = 24;
const MAX_VERTICAL_DRIFT = 72;
const MAX_SWIPE_DURATION = 700;
const MIN_FLING_DISTANCE = 36;
const SWIPE_VELOCITY_THRESHOLD = 0.45;
const ENTRY_OFFSET_RATIO = 0.18;
const EXIT_DURATION = 160;
const ENTRY_DURATION = 180;
const RESET_DURATION = 180;
const EDGE_RESISTANCE = 0.18;

type SwipeTab = "index" | "library" | "audio" | "playlists" | "search" | "settings";
type SwipeTabPath =
  | "/"
  | "/library"
  | "/audio"
  | "/playlists"
  | "/search"
  | "/settings";

const TAB_PATHS: Record<SwipeTab, SwipeTabPath> = {
  index: "/",
  library: "/library",
  audio: "/audio",
  playlists: "/playlists",
  search: "/search",
  settings: "/settings",
};

let pendingEntryDirection = 0;

export function useTabSwipeNavigation(
  currentTab: SwipeTab,
  order: SwipeTab[] = ["index", "library", "audio", "playlists", "search", "settings"]
) {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isNavigating = useRef(false);
  const hasActiveDrag = useRef(false);

  useEffect(() => {
    if (!width || pendingEntryDirection === 0) return;

    translateX.setValue(width * ENTRY_OFFSET_RATIO * pendingEntryDirection);
    opacity.setValue(0.94);

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: ENTRY_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTRY_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    pendingEntryDirection = 0;
  }, [opacity, translateX, width]);

  const resetPosition = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: RESET_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: RESET_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > SWIPE_ACTIVATION_DISTANCE &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35,
        onPanResponderGrant: (event) => {
          touchStart.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
            time: event.nativeEvent.timestamp ?? Date.now(),
          };
          hasActiveDrag.current = false;
          translateX.stopAnimation();
          opacity.stopAnimation();
        },
        onPanResponderMove: (_event, gestureState) => {
          if (isNavigating.current) return;

          const currentIndex = order.indexOf(currentTab);
          const hasTarget =
            currentIndex >= 0 &&
            (gestureState.dx < 0 ? !!order[currentIndex + 1] : !!order[currentIndex - 1]);

          if (!hasTarget) {
            translateX.setValue(gestureState.dx * EDGE_RESISTANCE);
            opacity.setValue(1);
            return;
          }

          const absDx = Math.abs(gestureState.dx);
          if (absDx <= SWIPE_ACTIVATION_DISTANCE) {
            if (!hasActiveDrag.current) {
              translateX.setValue(0);
              opacity.setValue(1);
            }
            return;
          }

          hasActiveDrag.current = true;
          const adjustedDx =
            Math.sign(gestureState.dx) * (absDx - SWIPE_ACTIVATION_DISTANCE);
          const nextDx = Math.max(-width, Math.min(width, adjustedDx));
          translateX.setValue(nextDx);
          opacity.setValue(1 - Math.min(Math.abs(nextDx) / Math.max(width, 1), 1) * 0.1);
        },
        onPanResponderRelease: (event, gestureState) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (isNavigating.current) return;

          const elapsed = (event.nativeEvent.timestamp ?? Date.now()) - (start?.time ?? 0);
          const dx = gestureState.dx;
          const dy = gestureState.dy;
          const vx = gestureState.vx;
          const currentIndex = order.indexOf(currentTab);
          const targetTab =
            currentIndex < 0 ? undefined : dx < 0 ? order[currentIndex + 1] : order[currentIndex - 1];

          const shouldNavigate =
            !!targetTab &&
            hasActiveDrag.current &&
            (Math.abs(dx) >= SWIPE_DISTANCE ||
              (Math.abs(dx) >= MIN_FLING_DISTANCE &&
                Math.abs(vx) >= SWIPE_VELOCITY_THRESHOLD)) &&
            Math.abs(dy) <= MAX_VERTICAL_DRIFT &&
            elapsed <= MAX_SWIPE_DURATION;

          hasActiveDrag.current = false;

          if (!shouldNavigate || !targetTab) {
            resetPosition();
            return;
          }

          isNavigating.current = true;
          pendingEntryDirection = dx < 0 ? 1 : -1;

          if (Platform.OS !== "web") {
            ReactNativeHapticFeedback.trigger('impactLight');
          }

          Animated.parallel([
            Animated.timing(translateX, {
              toValue: dx < 0 ? -width : width,
              duration: EXIT_DURATION,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.08,
              duration: EXIT_DURATION,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(() => {
            isNavigating.current = false;
            setTimeout(() => {
              navigation.navigate(targetTab);
              translateX.setValue(0);
              opacity.setValue(1);
            }, 0);
          });
        },
        onPanResponderTerminate: () => {
          touchStart.current = null;
          hasActiveDrag.current = false;
          resetPosition();
        },
      }),
    [currentTab, opacity, order, translateX, width]
  );

  return useMemo(
    () => ({
      animatedStyle: {
        transform: [{ translateX }],
        opacity,
      },
      panHandlers: panResponder.panHandlers,
    }),
    [opacity, panResponder.panHandlers, translateX]
  );
}
