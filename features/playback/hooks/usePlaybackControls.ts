import { useCallback, useEffect, useRef, useState } from "react";

export function usePlaybackControls(options: {
  isPlaying: boolean;
  holdVisible: boolean;
  timeout: number;
  onHide: () => void;
}) {
  const { isPlaying, holdVisible, timeout, onHide } = options;
  const [controlsVisible, setControlsVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHide = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const hideAllControls = useCallback(() => {
    cancelHide();
    onHide();
    setControlsVisible(false);
  }, [cancelHide, onHide]);
  const scheduleHideControls = useCallback(() => {
    cancelHide();
    if (holdVisible || !isPlaying) return;
    timer.current = setTimeout(hideAllControls, timeout);
  }, [cancelHide, hideAllControls, holdVisible, isPlaying, timeout]);

  useEffect(() => {
    if (holdVisible) {
      cancelHide();
      setControlsVisible(true);
    } else if (controlsVisible && isPlaying) {
      scheduleHideControls();
    } else {
      cancelHide();
    }
    return cancelHide;
  }, [holdVisible, controlsVisible, isPlaying, scheduleHideControls, cancelHide]);

  return { controlsVisible, setControlsVisible, hideAllControls, scheduleHideControls };
}
