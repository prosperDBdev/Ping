export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ping-cream to-ping-cream-dark">
      {children}
    </div>
  );
}