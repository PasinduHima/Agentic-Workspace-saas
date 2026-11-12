"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export async function checkUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  // Clerk has no first/last name for email sign-ups, so fall back to the
  // username, then to the part of the email before the "@".
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    email?.split("@")[0] ||
    null;

  const existing = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
  });

  if (existing) {
    // Keep the row in sync with Clerk, writing only when something changed.
    if (existing.name === name && existing.imageUrl === clerkUser.imageUrl) {
      return existing;
    }
    return prisma.user.update({
      where: { clerkId: clerkUser.id },
      data: { name, imageUrl: clerkUser.imageUrl },
    });
  }

  if (!email) return null;

  // upsert rather than create: two parallel first requests would otherwise race
  // on the clerkId unique constraint.
  return prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {},
    create: {
      clerkId: clerkUser.id,
      email,
      name,
      imageUrl: clerkUser.imageUrl,
    },
  });
}
