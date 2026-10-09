import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isPlanId, DEFAULT_PLAN, TRIAL_DAYS } from "@/lib/plans";
import { sendWelcomeEmail } from "@/lib/lifecycleEmails";
import { INVITE_PLAN, INVITE_ACCESS_DAYS, inviteStatus, normalizeEmail } from "@/lib/invites";

export async function POST(req) {
  if (!rateLimit(`register:${clientIp(req)}`, { limit: 5, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
  }
  const { email, password, name, plan, invite, team } = await req.json();

  if (!email?.includes("@") || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email valide et mot de passe d'au moins 8 caractères requis." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  // Invitation à rejoindre une équipe d'agence : l'adresse doit être celle invitée ; le compte rejoint l'agence (accès de l'agence, sans abonnement)
  if (team) {
    const ti = /^[a-f0-9]{48}$/.test(String(team)) ? await prisma.agencyInvite.findUnique({ where: { token: team } }) : null;
    if (!ti || inviteStatus(ti) !== "pending") {
      return NextResponse.json({ error: "Cette invitation n'est plus valide. Demandez-en une nouvelle au propriétaire de l'agence." }, { status: 400 });
    }
    if (normalizeEmail(email) !== ti.email) {
      return NextResponse.json({ error: "Créez votre compte avec l'adresse e-mail qui a reçu l'invitation." }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 12);
    let member;
    try {
      member = await prisma.$transaction(async (tx) => {
        const claim = await tx.agencyInvite.updateMany({ where: { id: ti.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
        if (claim.count !== 1) throw new Error("invitation-used");
        const created = await tx.user.create({ data: { email: email.toLowerCase(), password: hash, name: name?.trim() || null, plan: "agence", planUpdatedAt: new Date(), onboardedAt: new Date() } });
        await tx.agencyMember.create({ data: { agencyId: ti.agencyId, userId: created.id, role: "member" } });
        await tx.agencyInvite.update({ where: { id: ti.id }, data: { acceptedUserId: created.id } });
        return created;
      });
    } catch (e) {
      if (e.message === "invitation-used") return NextResponse.json({ error: "Cette invitation a déjà été utilisée ou n'est plus valide." }, { status: 400 });
      throw e;
    }
    const resTeam = NextResponse.json({ user: { id: member.id, email: member.email, name: member.name, plan: member.plan, trialEndsAt: null, billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY) } });
    resTeam.cookies.set(SESSION_COOKIE, await createSessionToken(member.id), sessionCookieOptions());
    return resTeam;
  }

  // Invitation de test : l'adresse doit être celle invitée ; l'accès est offert (offre et durée fixes)
  let invitation = null;
  if (invite) {
    invitation = /^[a-f0-9]{48}$/.test(String(invite)) ? await prisma.invitation.findUnique({ where: { token: invite } }) : null;
    if (!invitation || inviteStatus(invitation) !== "pending") {
      return NextResponse.json({ error: "Cette invitation n'est plus valide. Demandez-en une nouvelle." }, { status: 400 });
    }
    if (normalizeEmail(email) !== invitation.email) {
      return NextResponse.json({ error: "Créez votre compte avec l'adresse e-mail qui a reçu l'invitation." }, { status: 400 });
    }
  }

  const chosenPlan = invitation ? INVITE_PLAN : isPlanId(plan) ? plan : DEFAULT_PLAN;
  const trialEndsAt = new Date(Date.now() + (invitation ? INVITE_ACCESS_DAYS : TRIAL_DAYS) * 86400000);
  const passwordHash = await bcrypt.hash(password, 12);

  let user;
  if (invitation) {
    // L'invitation est « réclamée » avant la création du compte : un lien ne sert qu'une fois, même en cas de double clic
    try {
      user = await prisma.$transaction(async (tx) => {
        const claim = await tx.invitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { acceptedAt: new Date() },
        });
        if (claim.count !== 1) throw new Error("invitation-used");
        const created = await tx.user.create({
          data: { email: email.toLowerCase(), password: passwordHash, name: name?.trim() || null, plan: chosenPlan, trialEndsAt, planUpdatedAt: new Date() },
        });
        await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedUserId: created.id } });
        return created;
      });
    } catch (e) {
      if (e.message === "invitation-used") {
        return NextResponse.json({ error: "Cette invitation a déjà été utilisée ou n'est plus valide." }, { status: 400 });
      }
      throw e;
    }
  } else {
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: passwordHash,
        name: name?.trim() || null,
        plan: chosenPlan,
        trialEndsAt,
        planUpdatedAt: new Date(),
      },
    });
  }

  // Email de bienvenue : sans attendre le SMTP, un échec ne doit jamais bloquer l'inscription
  sendWelcomeEmail(user).catch((e) => console.error("[lifecycle] bienvenue :", e.message));

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionInterval: user.subscriptionInterval,
      currentPeriodEnd: user.currentPeriodEnd,
      hasBilling: Boolean(user.stripeCustomerId),
      billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    },
  });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), sessionCookieOptions());
  return res;
}
