import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { LeadInput } from '@ureducator/shared';
import { P } from '../domain/paths';
import type { Deps } from './exam';
import { hashSubject } from '../infra/ratelimit';

export const CONSENT_TEXT_VERSION = 'lead-consent-v1';
/** Minimal PII: name plus one contact method. The IP is stored only as a salted hash on the consent record. */
export async function captureLead(d: Deps, ip: string, i: z.infer<typeof LeadInput>) {
  const contact = (i.email ?? i.phone ?? '').toLowerCase();
  const id = 'l_' + createHash('sha256').update(contact).digest('hex').slice(0, 20);
  const existing = await d.store.get<{ createdAtMs: number }>(P.lead(id));
  const consentId = `c_${id}_${d.clock()}`;
  await d.store.set(P.consent(consentId), { leadId: id, purpose: 'marketing_contact', channel: i.contactPreference, textVersion: CONSENT_TEXT_VERSION, grantedAtMs: d.clock(), ipHash: hashSubject(ip) });
  const { consent: _c, ...rest } = i;
  await d.store.merge(P.lead(id), { ...rest, status: 'new', createdAtMs: existing?.createdAtMs ?? d.clock(), updatedAtMs: d.clock(), consentId });
  return { ok: true as const };
}
