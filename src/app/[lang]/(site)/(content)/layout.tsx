import { Footer } from "@/components/layout/footer";

/** Content pages (home, pattern list, pattern detail) get a footer; the
 * editor lives outside this route group so it stays a full-screen workspace. */
export default function ContentLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <main className="min-h-0 flex-1">{children}</main>
      <Footer />
    </div>
  );
}