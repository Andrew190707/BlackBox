import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  getGetRiskScoreQueryKey, 
  getListBreakersQueryKey, 
  getListEventsQueryKey, 
  getGetLockdownStateQueryKey,
  getGetTrustScoreQueryKey,
  getGetTrustAnalyticsQueryKey,
  getListIncidentsQueryKey,
  getListUsersQueryKey,
  SecurityEvent
} from '@workspace/api-client-react';
import { toast } from '@/hooks/use-toast';

export type WSStatus = 'connecting' | 'connected' | 'disconnected';

interface WSContextType {
  status: WSStatus;
  lastSimulation: {
    attacker: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    trustBefore?: number;
    trustAfter?: number;
  } | null;
}

const WSContext = createContext<WSContextType>({ status: 'disconnected', lastSimulation: null });

export const useBlackBoxWS = () => useContext(WSContext);

export function WSProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [lastSimulation, setLastSimulation] = useState<WSContextType['lastSimulation']>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let reconnectDelay = 1000;

    const connect = () => {
      setStatus('connecting');
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;
      
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus('connected');
          reconnectDelay = 1000; // reset
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleMessage(data);
          } catch (e) {
            console.error('Failed to parse WS message', e);
          }
        };

        ws.onclose = () => {
          setStatus('disconnected');
          reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.error("WS error:", err);
      }
    };

    const handleMessage = (msg: any) => {
      switch (msg.type) {
        case 'NEW_EVENT':
          queryClient.setQueryData(getListEventsQueryKey({ limit: 100 }), (old: any) => {
            if (!old) return old;
            const newEvents = [msg.data, ...old.events].slice(0, 100);
            return { ...old, events: newEvents, total: old.total + 1 };
          });
          queryClient.invalidateQueries({ queryKey: getGetRiskScoreQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListBreakersQueryKey() });
          break;
        case 'RISK_UPDATE':
          queryClient.setQueryData(getGetRiskScoreQueryKey(), msg.data);
          break;
        case 'BREAKER_TRIPPED':
        case 'BREAKER_RESET':
          queryClient.invalidateQueries({ queryKey: getListBreakersQueryKey() });
          break;
        case 'LOCKDOWN_PHASE':
          queryClient.invalidateQueries({ queryKey: getGetLockdownStateQueryKey() });
          break;
        case 'USER_TRUST_UPDATED':
        case 'SIMULATION_COMPLETE':
          if (msg.data?.attacker && msg.data?.severity) {
            setLastSimulation({
              attacker: msg.data.attacker,
              severity: msg.data.severity,
              trustBefore: msg.data.trustBefore,
              trustAfter: msg.data.trustAfter,
            });
            toast({
              title: `${msg.data.severity} simulation complete`,
              description: `${msg.data.attacker} trust changed from ${Math.round(msg.data.trustBefore ?? 0)} to ${Math.round(msg.data.trustAfter ?? 0)}.`,
              variant: msg.data.severity === 'HIGH' ? 'destructive' : 'default',
            });
          }
          queryClient.invalidateQueries({ queryKey: getGetTrustScoreQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTrustAnalyticsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey({ limit: 100 }) });
          queryClient.invalidateQueries({ queryKey: getGetRiskScoreQueryKey() });
          break;
        case 'DECEPTION_TRIGGERED':
          toast({
            title: 'Deception Triggered!',
            description: `Asset ${msg.data?.path || 'unknown'} was triggered.`,
            variant: 'destructive',
          });
          break;
        case 'SIMULATION_STEP':
          break;
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [queryClient]);

  return (
    <WSContext.Provider value={{ status, lastSimulation }}>
      {children}
    </WSContext.Provider>
  );
}
