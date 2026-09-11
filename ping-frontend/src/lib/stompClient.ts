import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Deliberately its own variable rather than derived from the API URL. The two
// happen to share a host today, but the API path ends in /api and this one
// doesn't, so deriving it would mean string-surgery that breaks the first time
// either moves.
//
// http:// rather than ws:// is correct here — SockJS negotiates over HTTP and
// upgrades to a WebSocket itself. Against a deployed backend this must be
// https://, or browsers will block it as mixed content from an https page.
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080/ws";

let stompClient: Client | null = null;

export const createStompClient = (userId: string): Client => {
  // Disconnect existing client if any
  if (stompClient && stompClient.active) {
    stompClient.deactivate();
  }

  stompClient = new Client({
    webSocketFactory: () => new SockJS(WEBSOCKET_URL) as WebSocket,
    connectHeaders: {},
    reconnectDelay: 5000,
    debug: (str) => {
      if (str.includes("SEND") || str.includes("MESSAGE") || str.includes("CONNECTED")) {
        console.log("[STOMP]", str);
      }
    },
  });

  // Add userId to STOMP connect headers
  const originalBeforeConnect = stompClient.beforeConnect;
  stompClient.beforeConnect = () => {
    if (stompClient) {
      stompClient.connectHeaders = {
        userId: userId,
      };
    }
    if (originalBeforeConnect && stompClient) {
      (originalBeforeConnect as (client: Client) => void)(stompClient);
    }
  };

  return stompClient;
};

export const getStompClient = (): Client | null => {
  return stompClient;
};

export const disconnectStomp = () => {
  if (stompClient && stompClient.active) {
    stompClient.deactivate();
    console.log("[STOMP] Disconnected");
  }
  stompClient = null;
};