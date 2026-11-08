import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  durationMin: z.number().min(5).max(480).optional(),
  price: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, sid } = await params;
  const b = await prisma.business.findUnique({ where: { id } });
  if (!b || b.ownerId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const service = await prisma.service.update({ where: { id: sid }, data: parsed.data });
  return NextResponse.json({ service });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, sid } = await params;
  const b = await prisma.business.findUnique({ where: { id } });
  if (!b || b.ownerId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.service.delete({ where: { id: sid } });
  return NextResponse.json({ ok: true });
}
