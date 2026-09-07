import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isConfigured } from "./genlayer";
import { readHelixStatus, readHostState, type HelixStatus, type HostState } from "./helix-contracts";

type HelixState = {
  /** True when the vault is really frozen on-chain, or the local preview is on. */
  spliced: boolean;
  /** Flips the local "Spliced preview" control. */
  setSpliced: (v: boolean) => void;
  /** Live HostVault state, null until the first read lands. */
  host: HostState | null;
  /** Live Helix verdict, null until the first read lands. */
  status: HelixStatus | null;
  /** True once contract addresses are present in the env. */
  live: boolean;
  refresh: () => Promise<void>;
};

const HelixContext = createContext<HelixState>({
  spliced: false,
  setSpliced: () => {},
  host: null,
  status: null,
  live: false,
  refresh: async () => {},
});

const POLL_MS = 4000;

export function HelixProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState(false);
  const [host, setHost] = useState<HostState | null>(null);
  const [status, setStatus] = useState<HelixStatus | null>(null);
  const live = isConfigured();
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!live || typeof window === "undefined") return;
    try {
      const [h, s] = await Promise.all([
        readHostState().catch(() => null),
        readHelixStatus().catch(() => null),
      ]);
      if (!mounted.current) return;
      if (h) setHost(h);
      if (s) setStatus(s);
    } catch {
      // Reads are best-effort; the theater keeps rendering the last known state.
    }
  }, [live]);

  useEffect(() => {
    mounted.current = true;
    if (!live) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [live, refresh]);

  const spliced = preview || host?.frozen === true;

  return (
    <HelixContext.Provider
      value={{ spliced, setSpliced: setPreview, host, status, live, refresh }}
    >
      {children}
    </HelixContext.Provider>
  );
}

export const useHelix = () => useContext(HelixContext);
