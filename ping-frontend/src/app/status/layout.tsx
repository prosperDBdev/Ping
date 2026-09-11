import ProtectedRoute from "@/components/common/ProtectedRoute";

export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
