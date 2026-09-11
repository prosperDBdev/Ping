import type { MetadataRoute } from "next";

/**
 * The web app manifest — what turns a website into something installable.
 *
 * Next.js serves this from /manifest.webmanifest and links it automatically, so
 * there's no <link rel="manifest"> to remember. Writing it as TypeScript rather
 * than a static JSON file means the shape is type-checked: a typo in a field
 * name is a build error instead of a silent "why won't it install".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ping — Make it matter",
    // Shown under the home screen icon, where there is room for about 12
    // characters before the launcher truncates it.
    short_name: "Ping",
    description:
      "Real-time messaging with voice notes, photos, temporary chats and 24-hour statuses.",
    start_url: "/dashboard",
    // Where the app is allowed to navigate while still counting as "the app".
    // Follow a link outside this scope and the phone hands off to the browser.
    scope: "/",
    // standalone is what removes the address bar and makes an installed Ping
    // look like an app rather than a bookmark.
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f4ec",
    // Tints the Android status bar and the task switcher entry.
    theme_color: "#e0684b",
    categories: ["social", "communication"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to whatever shape the launcher uses. A "maskable"
      // icon promises its important content sits inside the middle ~80%, so the
      // launcher can crop freely without slicing the logo. Without one, Android
      // puts the icon in a white box it draws itself.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
