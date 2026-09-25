package com.example.pingBackend.security;

import java.util.Locale;

/**
 * Turns a browser's User-Agent into a name a person recognises:
 * "Chrome on Android", "Safari on iPhone".
 *
 * Only for DISPLAY, in the device list and on the "approve this sign-in?"
 * screen. A User-Agent is whatever the browser chooses to send and anyone can
 * set it to anything, so nothing security-related ever depends on it.
 *
 * Order matters in both lists: Edge and Opera also say "Chrome", and Chrome
 * also says "Safari", so the more specific names are checked first.
 */
public final class DeviceNames {

    private DeviceNames() {
    }

    public static String describe(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown device";
        }
        String ua = userAgent.toLowerCase(Locale.ROOT);
        return browser(ua) + " on " + system(ua);
    }

    private static String browser(String ua) {
        if (ua.contains("edg/") || ua.contains("edga/") || ua.contains("edgios/")) return "Edge";
        if (ua.contains("opr/") || ua.contains("opera")) return "Opera";
        if (ua.contains("samsungbrowser")) return "Samsung Internet";
        if (ua.contains("firefox/") || ua.contains("fxios/")) return "Firefox";
        if (ua.contains("chrome/") || ua.contains("crios/")) return "Chrome";
        if (ua.contains("safari/")) return "Safari";
        return "A browser";
    }

    private static String system(String ua) {
        if (ua.contains("android")) return "Android";
        if (ua.contains("iphone")) return "iPhone";
        if (ua.contains("ipad")) return "iPad";
        if (ua.contains("windows")) return "Windows";
        if (ua.contains("cros")) return "Chromebook";
        if (ua.contains("mac os x") || ua.contains("macintosh")) return "Mac";
        if (ua.contains("linux")) return "Linux";
        return "an unknown system";
    }
}
