import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  slotDuration: z.number().min(5).max(240).optional(),
});

async function owned(id: string, userId: string) {
  const b = await prisma.business.findUnique({ where: { id } });
  if (!b || b.ownerId !== userId) return null;
  return b;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await owned(id, userId);
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const business = await prisma.business.findUnique({
    where: { id },
    include: { hours: true, services: true },
  });
  return NextResponse.json({ business });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await owned(id, userId);
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const business = await prisma.business.update({
    where: { id },
    data: parsed.data,
    include: { hours: true, services: true },
  });
  return NextResponse.json({ business });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await owned(id, userId);
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.business.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
