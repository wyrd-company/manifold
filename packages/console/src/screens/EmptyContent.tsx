// ---
// relationships:
//   implements: operator-console
// ---
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "../ui/empty.tsx";
export function EmptyState({
  icon: Icon,
  title = "Nothing here yet",
  description = "This screen is not built in this version of Manifold.",
  children,
}: {
  icon: LucideIcon;
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <Empty className="empty-state" size="compact">
      <EmptyHeader>
        <EmptyMedia>
          <Icon size={24} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  );
}
export function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
