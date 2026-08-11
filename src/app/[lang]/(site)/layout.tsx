import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/header";

export default function SiteLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <TooltipProvider delay={300}>
      <div className="h-full p-2">
        <div className="flex h-full min-h-0 flex-col gap-2 border p-2">
          <Header />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </TooltipProvider>
  );
}
