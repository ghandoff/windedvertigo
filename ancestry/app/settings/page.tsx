import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateTree, getTreeMembers, getTreeRole } from "@/lib/db/queries";
import {
  inviteMemberAction,
  removeMemberAction,
  updateRoleAction,
  updateVisibilityAction,
} from "./actions";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const role = await getTreeRole(tree.id, session.user.email);
  const isOwner = role === "owner";
  const members = await getTreeMembers(tree.id);

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; back to tree
            </Link>
            <h1 className="text-lg font-semibold text-foreground">tree settings</h1>
          </div>
          <span className="text-sm text-muted-foreground">{tree.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-6 space-y-8">
        {/* visibility */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">visibility</h2>
          {isOwner ? (
            <form action={updateVisibilityAction} className="flex items-center gap-3">
              <input type="hidden" name="treeId" value={tree.id} />
              <select
                name="visibility"
                defaultValue={tree.visibility}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                <option value="private">private — only you and invited members</option>
                <option value="authenticated">authenticated — any signed-in user</option>
                <option value="public">public — anyone with the link</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                save
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tree.visibility} — only the tree owner can change visibility
            </p>
          )}
        </section>

        {/* members list */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">members</h2>

          {/* owner row */}
          <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground">{tree.owner_email}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                owner
              </span>
            </div>
          </div>

          {/* member rows */}
          {members.map((member) => (
            <div
              key={member.member_email}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground">{member.member_email}</span>
                {isOwner ? (
                  <form action={updateRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="treeId" value={tree.id} />
                    <input type="hidden" name="email" value={member.member_email} />
                    <select
                      name="role"
                      defaultValue={member.role}
                      className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                    >
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      update
                    </button>
                  </form>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {member.role}
                  </span>
                )}
              </div>
              {isOwner && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="treeId" value={tree.id} />
                  <input type="hidden" name="email" value={member.member_email} />
                  <button
                    type="submit"
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  >
                    remove
                  </button>
                </form>
              )}
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">no members yet — invite someone below</p>
          )}
        </section>

        {/* invite form */}
        {isOwner && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">invite a member</h2>
            <form action={inviteMemberAction} className="flex items-end gap-3">
              <input type="hidden" name="treeId" value={tree.id} />
              <div className="flex-1 space-y-1">
                <label htmlFor="invite-email" className="text-xs text-muted-foreground">
                  email
                </label>
                <input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                  placeholder="family@example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="invite-role" className="text-xs text-muted-foreground">
                  role
                </label>
                <select
                  id="invite-role"
                  name="role"
                  defaultValue="viewer"
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
              </div>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                invite
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
