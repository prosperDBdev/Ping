import PingLogo from "@/components/common/PingLogo";

interface AuthSplitLayoutProps {
  eyebrow: string;
  titleLines: { text: string; accent?: boolean }[];
  description: string;
  children: React.ReactNode;
}

export default function AuthSplitLayout({
  eyebrow,
  titleLines,
  description,
  children,
}: AuthSplitLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ping-cream">
      {/* Brand panel */}
      <div className="lg:w-[42%] bg-ping-dark px-8 py-10 sm:px-12 sm:py-12 lg:px-14 lg:py-16 flex flex-col justify-between">
        <PingLogo light />

        <div className="my-10 lg:my-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45 mb-5">
            {eyebrow}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-[0.95] text-white mb-6">
            {titleLines.map((line, i) => (
              <span
                key={i}
                className={`block ${line.accent ? "text-ping-orange" : ""}`}
              >
                {line.text}
              </span>
            ))}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-white/60">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-2 text-white/45 text-xs font-medium">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          Private by default · Made for small circles
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
