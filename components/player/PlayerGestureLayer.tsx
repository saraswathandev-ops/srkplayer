import React from "react";
import { GestureDetector } from "react-native-gesture-handler";

type Props = {
  gesture: any;
  children: React.ReactNode;
};

/**
 * Single native gesture surface for the player viewport.
 * Keeps gesture ownership out of the large player render tree.
 */
export const PlayerGestureLayer = React.memo(function PlayerGestureLayer({
  gesture,
  children,
}: Props) {
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
});
