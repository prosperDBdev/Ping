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

/**
 * Open the live connection, proving who we are with the login token.
 *
 * This used to send `userId` in the connect headers — and the server believed
 * it. Anyone could type in someone else's id and be treated as them: shown as
 * online, sending messages in their name. Now the connection carries the same
 * token the REST API uses, and the server works out the user from that token
 * itself. There is nothing left for the browser to claim.
 *
 * The token goes in the STOMP CONNECT frame rather than the WebSocket handshake
 * because browsers don't let JavaScript set an Authorization header on a
 * WebSocket handshake. The CONNECT frame is the first thing the server reads
 * after the socket opens, so it's the earliest point the token can be checked.
 */
export const createStompClient = (token: string): Client => {
  if (stompClient && stompClient.active) {
    stompClient.deactivate();
  }

  stompClient = new Client({
    webSocketFactory: () => new SockJS(WEBSOCKET_URL) as WebSocket,
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 5000,
    debug: (str) => {
      if (str.includes("SEND") || str.includes("MESSAGE") || str.includes("CONNECTED")) {
        console.log("[STOMP]", str);
      }
    },
  });

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
