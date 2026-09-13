"use client";

import { useRouter } from "next/navigation";
import NavSidebar from "@/components/sidebar/NavSidebar";
import MobileBottomNav from "@/components/common/MobileBottomNav";
import PingLogo from "@/components/common/PingLogo";
import ThemeToggle from "@/components/common/ThemeToggle";
import ProfileSettingsPanel from "@/components/settings/ProfileSettingsPanel";

/**
 * Settings as its own route.
 *
 * It used to be a view inside /chat (/chat?view=settings), which caused two
 * separate problems. The chat page renders settings INSTEAD of its inbox, and
 * the phone's bottom nav lived inside the inbox — so opening settings made the
 * nav vanish with no way back except the browser. And swiping between tabs is
 * navigation between routes; a tab that's really a query parameter on another
 * tab's page has no clean neighbour to swipe to.
 *
 * The old URL still works: /chat redirects ?view=settings here.
 */
export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="h-screen bg-ping-cream dark:bg-ping-night-bg flex overflow-hidden font-sans text-ping-dark dark:text-ping-night-text">
      <NavSidebar
        activeView="settings"
        onGoDashboard={() => router.push("/dashboard")}
        onGoMemories={() => router.push("/memories")}
        onGoStatus={() => router.push("/status")}
        onSelectConversations={() => router.push("/chat")}
        onNewChat={() => router.push("/chat?view=new-private")}
        onNewGroup={() => router.push("/chat?view=new-group")}
        onOpenSettings={() => {}}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Phone header. The desktop sidebar carries the logo from lg up. */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-ping-sand/60 dark:border-ping-night-border flex-shrink-0 safe-top">
          <PingLogo compact />
          <ThemeToggle variant="pill" />
        </div>

        <div data-swipe-page className="flex-1 min-h-0 flex">
          <ProfileSettingsPanel />
        </div>

        <MobileBottomNav active="settings" />
      </div>
    </div>
  );
}
