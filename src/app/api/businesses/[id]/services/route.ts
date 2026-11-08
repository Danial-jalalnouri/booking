import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.number().min(5).max(480).optional(),
  price: z.string().optional(),
  active: z.boolean().optional(),
});

async function owned(id: string, userId: string) {
  const b = await prisma.business.findUnique({ where: { id } });
  return !!(b && b.ownerId === userId);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await owned(id, userId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const services = await prisma.service.findMany({ where: { businessId: id } });
  return NextResponse.json({ services });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await owned(id, userId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const service = await prisma.service.create({ data: { ...parsed.data, businessId: id } });
  return NextResponse.json({ service }, { status: 201 });
}
