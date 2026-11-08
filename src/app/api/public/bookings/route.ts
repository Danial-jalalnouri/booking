import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  slug: z.string(),
  serviceId: z.string(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  startTime: z.string(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { slug, serviceId, customerName, customerEmail, customerPhone, startTime } = parsed.data;
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.businessId !== business.id) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  const start = new Date(startTime);
  const end = new Date(start.getTime() + business.slotDuration * 60000);
  // collision check
  const conflict = await prisma.booking.findFirst({
    where: {
      businessId: business.id,
      status: { not: "cancelled" },
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (conflict) return NextResponse.json({ error: "Slot no longer available" }, { status: 409 });
  const booking = await prisma.booking.create({
    data: {
      businessId: business.id,
      serviceId,
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      startTime: start,
      endTime: end,
    },
  });
  return NextResponse.json({ booking }, { status: 201 });
}
