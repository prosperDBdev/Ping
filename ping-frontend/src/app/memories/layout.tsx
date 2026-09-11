import ProtectedRoute from "@/components/common/ProtectedRoute";

export default function MemoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
