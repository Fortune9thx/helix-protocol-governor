import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HOSTS, isConfigured, type HostEntry } from "./genlayer";
import {
  readHelixStatus,
  readHostState,
  type HelixStatus,
  type HostState,
  type JuryTally,
} from "./helix-contracts";

const JURY_STORAGE_KEY = "helix:jury";

type HelixState = {
  hosts: HostEntry[];
  selectedHost: string;
  setSelectedHost: (address: string) => void;
  /** Real on-chain frozen state of the selected host only. No local override exists anymore. */
  spliced: boolean;
  /** Live state for every registered host, keyed by address. */
  hostStates: Record<string, HostState>;
  /** Live Helix-wide status (alarm/host counts, generation, treasury). */
  status: HelixStatus | null;
  /** True once contract addresses are present. */
  live: boolean;
  refresh: () => Promise<void>;
  /** True while a raise_alarm write is in flight (submitted, not yet finalized). */
  ingesting: boolean;
  setIngesting: (v: boolean) => void;
  /** Last real on-chain jury tally (AGREE count / round size). Null = never ingested. */
  jury: JuryTally | null;
  /** Records a fresh tally and persists it so a reload keeps the last real result. */
  recordJury: (tally: JuryTally | null) => void;
};

const HelixContext = createContext<HelixState>({
  hosts: [],
  selectedHost: "",
  setSelectedHost: () => {},
  spliced: false,
  hostStates: {},
  status: null,
  live: false,
  refresh: async () => {},
  ingesting: false,
  setIngesting: () => {},
  jury: null,
  recordJury: () => {},
});

// studio-dev enforces a hard per-account RPC rate limit (500 req/hour,
// confirmed empirically). Each tick costs 1 read per host + 1 for Helix
// status; at a tight interval a single viewer with several hosts open
// could exhaust the hourly budget alone. 20s keeps that well under budget.
const POLL_MS = 20000;

export function HelixProvider({ children }: { children: ReactNode }) {
  const [selectedHost, setSelectedHost] = useState(HOSTS[0]?.address ?? "");
  const [hostStates, setHostStates] = useState<Record<string, HostState>>({});
  const [status, setStatus] = useState<HelixStatus | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [jury, setJury] = useState<JuryTally | null>(null);
  const live = isConfigured();
  const mounted = useRef(true);

  // Hydrate the last known jury tally from a prior visit - a fresh page
  // load has no in-flight alarm to read a tally off, but it shouldn't fall
  // back to a fabricated number either.
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
      const [states, s] = await Promise.all([
        Promise.all(
          HOSTS.map((h) =>
            readHostState(h.address)
              .then((state) => [h.address, state] as const)
              .catch(() => null),
          ),
        ),
        readHelixStatus().catch(() => null),
      ]);
      if (!mounted.current) return;
      const next: Record<string, HostState> = {};
      for (const entry of states) {
        if (entry) next[entry[0]] = entry[1];
      }
      if (Object.keys(next).length > 0) setHostStates((prev) => ({ ...prev, ...next }));
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

  const spliced = hostStates[selectedHost]?.frozen === true;

  return (
    <HelixContext.Provider
      value={{
        hosts: HOSTS,
        selectedHost,
        setSelectedHost,
        spliced,
        hostStates,
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
