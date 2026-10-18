import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { XUser } from "@/lib/x/types";

/** Absolute URL on this app, using NEXT_PUBLIC_APP_URL behind a proxy. */
export function appUrl(req: Request, path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  return new URL(path, base).toString();
}

/** One X account per player, one player per X account. Returns a status for the UI. */
export async function linkXAccount(playerId: string, user: XUser, mock: boolean): Promise<"linked" | "taken" | "already"> {
  const mine = await prisma.rutaXLink.findUnique({ where: { playerId } });
  if (mine) return mine.xUserId === user.id ? "linked" : "already";
  try {
    await prisma.rutaXLink.create({
      data: {
        playerId,
        xUserId: user.id,
        username: user.username.toLowerCase(),
        accountCreatedAt: user.createdAt,
        followersCount: user.followers,
        mock,
      },
    });
    return "linked";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "taken";
    throw e;
  }
}
