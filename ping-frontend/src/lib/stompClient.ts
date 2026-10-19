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
 * Open the live connection, proven by the login cookie.
 *
 * This used to send `userId` in the connect headers — and the server believed
 * it. Anyone could type in someone else's id and be treated as them. Then it
 * sent the login token in a STOMP CONNECT frame — which forced the browser to
 * keep the token in JavaScript just for this, the one weakness the cookie
 * switch exists to remove.
 *
 * Now neither happens: the HttpOnly login cookie rides along on the SockJS/
 * WebSocket handshake itself (browsers attach cookies automatically, and
 * JavaScript cannot forge what it cannot read), and the backend verifies it
 * in two steps — WebSocketHandshakeAuth as the transport opens, and
 * StompAuthChannelInterceptor again at CONNECT, with the same
 * TokenAuthenticator the REST requests use. There is no header here at all,
 * and nothing for the browser to claim.
 */
export const createStompClient = (): Client => {
  if (stompClient && stompClient.active) {
    stompClient.deactivate();
  }

  stompClient = new Client({
    webSocketFactory: () => new SockJS(WEBSOCKET_URL) as WebSocket,
    // SockJS sends cookies (withCredentials) on its own transports by
    // default — that fact is what makes the cookie handshake work.
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
