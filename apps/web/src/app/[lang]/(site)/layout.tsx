import { TooltipProvider } from "@pindou/ui/components/ui/tooltip";
import { Header } from "@/components/header";

export default function SiteLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <TooltipProvider delay={300}>
      <div className="h-full p-0 md:p-2">
        <div className="flex h-full min-h-0 flex-col gap-0 border p-0 md:gap-2 md:p-2">
          <Header />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </TooltipProvider>
  );
}
