import { useEffect, useState } from "react";
import { platform } from "../platform";
import { importSources } from "./work/actions";

export function useIntake(): { dragging: boolean } {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void platform
      .onFileDrop({ hover: setDragging, sources: (sources) => void importSources(sources) })
      .then((fn) => (cancelled ? fn() : (unlisten = fn)));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return { dragging };
}
