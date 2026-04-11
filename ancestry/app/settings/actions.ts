"use server";

import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import {
  getOrCreateTree,
  addTreeMember,
  removeTreeMember,
  updateTreeMemberRole,
  updateTreeVisibility,
  getTreeRole,
} from "@/lib/db/queries";
import type { TreeRole } from "@/lib/types";

async function requireOwner(treeId: string) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const role = await getTreeRole(treeId, session.user.email);
  if (role !== "owner") {
    throw new Error("only the tree owner can modify sharing settings");
  }

  return session.user.email;
}

export async function inviteMemberAction(formData: FormData) {
  const treeId = formData.get("treeId") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as TreeRole;

  if (!treeId || !email || !role) {
    throw new Error("missing required fields");
  }
  if (!["editor", "viewer"].includes(role)) {
    throw new Error("invalid role");
  }

  const ownerEmail = await requireOwner(treeId);

  if (email === ownerEmail) {
    throw new Error("you cannot invite yourself");
  }

  await addTreeMember(treeId, email, role);
  redirect("/settings");
}

export async function removeMemberAction(formData: FormData) {
  const treeId = formData.get("treeId") as string;
  const email = formData.get("email") as string;

  if (!treeId || !email) {
    throw new Error("missing required fields");
  }

  await requireOwner(treeId);
  await removeTreeMember(treeId, email);
  redirect("/settings");
}

export async function updateRoleAction(formData: FormData) {
  const treeId = formData.get("treeId") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as TreeRole;

  if (!treeId || !email || !role) {
    throw new Error("missing required fields");
  }
  if (!["editor", "viewer"].includes(role)) {
    throw new Error("invalid role");
  }

  await requireOwner(treeId);
  await updateTreeMemberRole(treeId, email, role);
  redirect("/settings");
}

export async function updateVisibilityAction(formData: FormData) {
  const treeId = formData.get("treeId") as string;
  const visibility = formData.get("visibility") as string;

  if (!treeId || !visibility) {
    throw new Error("missing required fields");
  }
  if (!["public", "authenticated", "private"].includes(visibility)) {
    throw new Error("invalid visibility");
  }

  await requireOwner(treeId);
  await updateTreeVisibility(treeId, visibility);
  redirect("/settings");
}
