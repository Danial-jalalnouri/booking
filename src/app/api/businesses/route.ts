import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  slotDuration: z.number().min(5).max(240).optional(),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businesses = await prisma.business.findMany({
    where: { ownerId: userId },
    include: { hours: true, services: true, _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ businesses });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const exists = await prisma.business.findUnique({ where: { slug: parsed.data.slug } });
  if (exists) return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  const business = await prisma.business.create({
    data: {
      ...parsed.data,
      ownerId: userId,
    },
    include: { hours: true, services: true },
  });
  return NextResponse.json({ business }, { status: 201 });
}
