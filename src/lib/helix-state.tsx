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
import {
  readHelixStatus,
  readHostState,
  type HelixStatus,
  type HostState,
  type JuryTally,
} from "./helix-contracts";

const JURY_STORAGE_KEY = "helix:jury";

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
  /** True while an ingest_threat write is in flight (submitted, not yet finalized). */
  ingesting: boolean;
  setIngesting: (v: boolean) => void;
  /** Last real on-chain jury tally (AGREE count / round size). Null = never ingested. */
  jury: JuryTally | null;
  /** Records a fresh tally and persists it so a reload keeps the last real result. */
  recordJury: (tally: JuryTally | null) => void;
};

const HelixContext = createContext<HelixState>({
  spliced: false,
  setSpliced: () => {},
  host: null,
  status: null,
  live: false,
  refresh: async () => {},
  ingesting: false,
  setIngesting: () => {},
  jury: null,
  recordJury: () => {},
});

// studio-dev enforces a hard per-account RPC rate limit (500 req/hour,
// confirmed empirically). Each tick costs 2 reads (get_state + get_status);
// at the old 4s interval a single viewer left open for ~17 minutes could
// exhaust the entire hourly budget on its own. 20s keeps one viewer under
// 360 req/hour, leaving headroom for a few concurrent viewers plus writes.
const POLL_MS = 20000;

export function HelixProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState(false);
  const [host, setHost] = useState<HostState | null>(null);
  const [status, setStatus] = useState<HelixStatus | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [jury, setJury] = useState<JuryTally | null>(null);
  const live = isConfigured();
  const mounted = useRef(true);

  // Hydrate the last known jury tally from a prior visit - a fresh page
  // load has no in-flight ingest to read a tally off, but it shouldn't
  // fall back to a fabricated number either.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(JURY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as JuryTally;
      if (typeof parsed?.agree === "number" && typeof parsed?.total === "number") {
        setJury(parsed);
      }
    } catch {
      // Corrupt/blocked storage - just keep the "never ingested" state.
    }
  }, []);

  const recordJury = useCallback((tally: JuryTally | null) => {
    setJury(tally);
    if (typeof window === "undefined") return;
    try {
      if (tally) window.localStorage.setItem(JURY_STORAGE_KEY, JSON.stringify(tally));
    } catch {
      // Best-effort persistence only.
    }
  }, []);

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
      value={{
        spliced,
        setSpliced: setPreview,
        host,
        status,
        live,
        refresh,
        ingesting,
        setIngesting,
        jury,
        recordJury,
      }}
    >
      {children}
    </HelixContext.Provider>
  );
}

export const useHelix = () => useContext(HelixContext);
