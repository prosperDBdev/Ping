import ProtectedRoute from "@/components/common/ProtectedRoute";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}