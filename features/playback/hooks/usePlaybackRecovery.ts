import { useRef, useState } from "react";

type RecoveryStage = "hardware" | "software" | "media3";

export function usePlaybackRecovery(videoId: string | undefined, uri: string | null, preferVlc: boolean, softwareSelected: boolean) {
  const [override, setOverride] = useState<{ key: string; stage: RecoveryStage } | null>(null);
  const key = JSON.stringify([videoId, uri]);
  const activeOverride = override?.key === key ? override.stage : null;
  const useLibVlc = preferVlc && activeOverride !== "media3";
  const effectiveSoftwareDecoding = softwareSelected || activeOverride === "software";
  const stage: RecoveryStage = useLibVlc ? (effectiveSoftwareDecoding ? "software" : "hardware") : "media3";
  const token = JSON.stringify([key, stage]);
  const activeToken = useRef(token);
  const handledToken = useRef<string | null>(null);
  if (activeToken.current !== token) {
    activeToken.current = token;
    handledToken.current = null;
  }

  function recover(): "software" | "media3" | "terminal" | "ignored" {
    if (activeToken.current !== token || handledToken.current === token) return "ignored";
    handledToken.current = token;
    if (!uri || stage === "media3") return "terminal";
    const next = stage === "hardware" ? "software" : "media3";
    setOverride({ key, stage: next });
    return next;
  }

  function forceMedia3() {
    setOverride({ key, stage: "media3" });
  }

  return { useLibVlc, effectiveSoftwareDecoding, recover, forceMedia3 };
}
