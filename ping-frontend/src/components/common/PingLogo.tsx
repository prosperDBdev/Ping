export default function PingLogo({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-9 h-9">
        <div className="w-9 h-9 bg-ping-orange rounded-xl flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
          </svg>
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#f4d063] rounded-full" />
      </div>

      {!compact && (
        <div className="leading-tight">
          <p
            className={`font-bold text-base leading-none ${
              light ? "text-white" : "text-ping-dark dark:text-ping-night-text"
            }`}
          >
            ping
          </p>
          <p
            className={`text-[9px] font-semibold tracking-widest uppercase leading-tight ${
              light
                ? "text-white/50"
                : "text-ping-text-light dark:text-ping-night-text-light"
            }`}
          >
            MAKE IT MATTER
          </p>
        </div>
      )}
    </div>
  );
}