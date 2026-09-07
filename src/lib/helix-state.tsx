import { createContext, useContext, useState, type ReactNode } from "react";

type HelixState = {
  spliced: boolean;
  setSpliced: (v: boolean) => void;
};

const HelixContext = createContext<HelixState>({ spliced: false, setSpliced: () => {} });

export function HelixProvider({ children }: { children: ReactNode }) {
  const [spliced, setSpliced] = useState(false);
  return (
    <HelixContext.Provider value={{ spliced, setSpliced }}>{children}</HelixContext.Provider>
  );
}

export const useHelix = () => useContext(HelixContext);
