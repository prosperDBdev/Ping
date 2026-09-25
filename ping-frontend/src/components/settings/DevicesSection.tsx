"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import QrScannerSheet from "@/components/settings/QrScannerSheet";
import { Device, listDevices, signOutDevice, signOutOtherDevices, timeAgo } from "@/lib/security";
import { apiErrorMessage } from "@/lib/messages";

const HOW: Record<string, string> = {
  PASSWORD: "password",
  EMAIL_CODE: "password + email code",
  QR: "QR code",
  REGISTER: "new account",
};

/**
 * Every device signed in to your account, with a way to sign any of them out
 * (Stage 14). Signing a device out takes effect on its very next request, and
 * closes its live connection, so a lost phone stops receiving messages
 * straight away.
 */
export default function DevicesSection() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<Device | "others" | null>(null);
  const [working, setWorking] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setFailed(false);
    listDevices()
      .then(setDevices)
      .catch(() => setFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  // First load: the state already starts as "loading", so only the result
  // is set here, when it arrives. load() is for the retry button.
  useEffect(() => {
    listDevices()
      .then(setDevices)
      .catch(() => setFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  const onScanned = useCallback(
    (code: string) => {
      setScanning(false);
      router.push(`/link-device#${code}`);
    },
    [router]
  );

  const confirmSignOut = async () => {
    if (!confirming) return;
    setWorking(true);
    try {
      if (confirming === "others") {
        const n = await signOutOtherDevices();
        toast.success(n === 1 ? "Signed out 1 device" : `Signed out ${n} devices`);
        setDevices((prev) => prev.filter((d) => d.current));
      } else {
        await signOutDevice(confirming.id);
        toast.success(`${confirming.deviceName} signed out`);
        setDevices((prev) => prev.filter((d) => d.id !== confirming.id));
      }
      setConfirming(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't sign that device out. Try again."));
    } finally {
      setWorking(false);
    }
  };

  const others = devices.filter((d) => !d.current).length;

  return (
    <div className="bg-white dark:bg-ping-night-card rounded-3xl border border-ping-sand/60 dark:border-ping-night-border p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light">
          Linked devices
        </p>
        {!isLoading && !failed && (
          <span className="text-xs font-bold text-ping-text-light dark:text-ping-night-text-light">{devices.length}</span>
        )}
      </div>
      <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-4 leading-relaxed">
        Everywhere you&apos;re signed in. Don&apos;t recognise one? Sign it out, then change your password.
      </p>

      <button
        onClick={() => setScanning(true)}
        className="w-full mb-4 py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        </svg>
        Link a device
      </button>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
        </div>
      ) : failed ? (
        <div className="text-center py-4">
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-2">Couldn&apos;t load your devices.</p>
          <button onClick={load} className="text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:underline">
            Try again
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-ping-sand/60 dark:divide-ping-night-border">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-xl bg-ping-cream dark:bg-ping-night-surface flex items-center justify-center text-ping-teal dark:text-ping-teal-light flex-shrink-0">
                {/Android|iPhone|iPad/.test(d.deviceName) ? phoneIcon : computerIcon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text truncate">{d.deviceName}</p>
                <p className="text-xs text-ping-text-light dark:text-ping-night-text-light truncate">
                  {d.current ? (
                    <span className="font-bold text-ping-teal dark:text-ping-teal-light">This device</span>
                  ) : (
                    `Active ${timeAgo(d.lastActiveAt)}`
                  )}
                  {" · "}via {HOW[d.method] ?? "sign-in"}
                </p>
              </div>
              {!d.current && (
                <button
                  onClick={() => setConfirming(d)}
                  className="text-xs font-bold text-red-500 hover:underline flex-shrink-0"
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {others > 1 && (
        <button
          onClick={() => setConfirming("others")}
          className="mt-3 text-xs font-bold text-red-500 hover:underline"
        >
          Sign out all other devices
        </button>
      )}

      <QrScannerSheet open={scanning} onClose={() => setScanning(false)} onCode={onScanned} />

      {confirming && (
        <ConfirmDialog
          title={confirming === "others" ? "Sign out all other devices?" : `Sign out ${confirming.deviceName}?`}
          body={
            confirming === "others"
              ? "Every device except this one will need to sign in again."
              : "It will need to sign in again to use Ping. It stops receiving messages straight away."
          }
          confirmLabel="Sign out"
          destructive
          isWorking={working}
          onConfirm={confirmSignOut}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

const phoneIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
);
const computerIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </svg>
);
