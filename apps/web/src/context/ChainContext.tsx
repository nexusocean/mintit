import { createContext, useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Chain, ConfigResponseDto } from '@mintit/types';

export const CHAINS_QUERY_KEY = ['chains'];

export async function fetchEnabledChains(): Promise<Chain[]> {
  const { data } = await api.get<ConfigResponseDto>('/chains');
  return data.enabledChains;
}

export type ChainStatus = 'loading' | 'ready' | 'error' | 'no-chains';

type ChainsQueryState = {
  isLoading: boolean;
  isError: boolean;
  enabledChains: Chain[] | undefined;
};

export function deriveChainStatus({
  isLoading,
  isError,
  enabledChains,
}: ChainsQueryState): ChainStatus {
  switch (true) {
    case isLoading:
      return 'loading';
    case isError:
      return 'error';
    case !enabledChains || enabledChains.length === 0:
      return 'no-chains';
    default:
      return 'ready';
  }
}

/** Prefers the user's explicit selection if still valid, else the first enabled chain. */
export function deriveSelectedChain(
  selected: Chain | null,
  enabledChains: Chain[] | undefined,
): Chain | null {
  if (!enabledChains || enabledChains.length === 0) return null;
  return selected && enabledChains.includes(selected)
    ? selected
    : enabledChains[0];
}

interface ChainContextValue {
  chain: Chain | null;
  setChain: (c: Chain) => void;
  enabledChains: Chain[];
  /** False while only one chain is enabled: chain pickers/columns are hidden. */
  multiChain: boolean;
  status: ChainStatus;
}

const ChainContext = createContext<ChainContextValue>({
  chain: null,
  setChain: () => {},
  enabledChains: [],
  multiChain: false,
  status: 'loading',
});

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Chain | null>(null);
  const {
    data: enabledChains,
    isLoading,
    isError,
  } = useQuery({
    queryKey: CHAINS_QUERY_KEY,
    queryFn: fetchEnabledChains,
  });

  const status = deriveChainStatus({ isLoading, isError, enabledChains });
  const chain = deriveSelectedChain(selected, enabledChains);

  return (
    <ChainContext.Provider
      value={{
        chain,
        setChain: setSelected,
        enabledChains: enabledChains ?? [],
        multiChain: (enabledChains?.length ?? 0) > 1,
        status,
      }}
    >
      {children}
    </ChainContext.Provider>
  );
}

export function useChain() {
  return useContext(ChainContext);
}

/**
 * For pages that only ever render inside DashboardLayout's <Outlet/>, which
 * already blocks rendering until status === 'ready' — chain is guaranteed
 * non-null there.
 */
export function useReadyChain(): Chain {
  const { chain } = useContext(ChainContext);
  if (!chain) {
    throw new Error('useReadyChain() called before chains finished loading');
  }
  return chain;
}
