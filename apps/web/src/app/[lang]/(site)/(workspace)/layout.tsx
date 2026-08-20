/** Full-screen workspaces (editor, pattern-edit): a `<main>` landmark with no
 * footer so the canvas keeps every pixel of vertical space. */
export default function WorkspaceLayout({ children }: LayoutProps<"/[lang]">) {
  return <main className="min-h-0 flex-1">{children}</main>;
}
