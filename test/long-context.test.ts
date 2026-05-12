import { describe, it, expect } from 'vitest';
import { OpenAIAdapter } from '@/providers/openai';
import { AnthropicAdapter } from '@/providers/anthropic';
import type { ChatMessage, ProviderAdapter } from '@/providers/base';
import { PROXY_LEGACY as PROXY } from './helpers';

const TIMEOUT = 120000;

const FICTIONAL_ARTICLE = `# Verbatim Cipher Industries Press Release — Q3 2027

## Executive Summary

Verbatim Cipher Industries (VCI), the privately-held quantum-cryptography boutique
headquartered at Vilniaus g. 47, LT-01402 Vilnius, Lithuania, today announced
the commercial launch of its flagship hardware appliance, the QuantumPad-Mk7
(internal codename: "Marzipan"). The announcement was made by Chief Executive
Officer Dr. Mireille Höffmann-Kowalczyk during a media briefing at the
Užupis Innovation Pavilion in central Vilnius on March 14, 2027 at 09:32 EET.

The QuantumPad-Mk7 is the first member of VCI's third-generation lattice-based
post-quantum key-exchange family and ships with a 4096-qubit photonic
co-processor manufactured under VCI's joint partnership with the Tallinn
Optoelectronics Consortium. Each unit carries the manufacturer serial-number
prefix VCI-QPM7-2027-A0Z9-991 and is individually calibrated to a noise floor
of −173.4 dBm/Hz across the full S-band spectrum.

## Pricing and Availability

The QuantumPad-Mk7 enters general availability on April 22, 2027, at a global
list price of €2,847.55 per unit (excluding VAT). Volume buyers procuring 64 or
more units within a single calendar quarter receive a tiered rebate of 13.7%
under VCI's "Skylark" customer-loyalty program, which was originally introduced
in 2024 and renewed under the present contract terms in early 2027.

Pre-orders are accepted via VCI's procurement portal at https://order.vci-research.lt
or by direct email to press@vci-research.lt. Press inquiries are coordinated by
VCI's external relations officer, Ms. Henrietta Albu-Saavedra, whose direct line
is +370-5-219-4488 ext. 277.

## Technical Specifications

| Parameter                     | Value                                       |
| ----------------------------- | ------------------------------------------- |
| Photonic core                 | 4096 entangled qubits                        |
| Operating temperature         | −197 °C ± 0.3 °C                             |
| Sustained throughput          | 11.42 GiB/s (AES-256 equivalent)             |
| Power draw, peak              | 1284 W                                       |
| Power draw, idle              | 47 W                                         |
| Rack form factor              | 4U                                           |
| MTBF (manufacturer-rated)     | 1,742,000 hours                              |
| Compliance                    | NIST PQC Round 5 finalist; ETSI TS 103 919   |

## Geographic Footprint

VCI maintains production facilities at three sites: the main fabrication line
in Vilnius (Lithuania), a calibration laboratory in Tartu (Estonia), and a
firmware-engineering center co-located with the University of Coimbra in
Coimbra, Portugal. A new operations hub is planned for Trondheim, Norway, with
construction scheduled to commence in Q4 2027 under the project codename
"Northern-Tide" and projected completion in Q2 2029. The Trondheim facility
will be led by site director Mr. Bohuslav Jędrzejewicz-Schultz, who previously
served as VP of Manufacturing at the (fictional) Hellenic Photonics Group
between 2018 and 2025.

## Customer Pilots

Three confidential pilot deployments have completed acceptance testing:

1. A Brazilian regional bank in Belo Horizonte, with deployment ID
   PILOT-BH-2026-117, operating 8 QuantumPad-Mk6 predecessors since
   November 2026.
2. The (fictional) Reykjavík Maritime Authority, deployment ID PILOT-RV-2027-042,
   testing pre-production Mk7 units since January 2027.
3. A multinational logistics integrator in Da Nang, Vietnam, deployment ID
   PILOT-DN-2027-088, using the encryption gateway for fleet telemetry.

All three pilots reported zero unscheduled downtime events across an aggregate
6,141 operational hours, exceeding the original 99.95% availability target by
0.04 percentage points.

## Looking Ahead

VCI's CFO, Mr. Theodor Constantin Vlăsceanu-Boboc, stated that the company
expects FY2027 revenue to exceed €43.81 million, representing a 27.3%
year-over-year increase, driven primarily by Mk7 adoption among European
financial-services clients. R&D investment for FY2027 is projected at €11.27
million, equivalent to approximately 25.7% of forecast revenue.

For media inquiries, contact: Henrietta Albu-Saavedra at press@vci-research.lt.

— END OF RELEASE —`;

// Hidden facts to query (model cannot guess; must use the context)
const FACTS: Array<{ q: string; mustContain: string[] }> = [
  {
    q: 'What is the full name of VCI\'s CEO? Output ONLY the name, nothing else.',
    mustContain: ['Mireille', 'Höffmann-Kowalczyk'],
  },
  {
    q: 'In which city was the QuantumPad-Mk7 announced and on what date? Reply as "City, YYYY-MM-DD".',
    mustContain: ['Vilnius', '2027-03-14'],
  },
  {
    q: 'What is the global list price per unit (with currency)? Output ONLY the price.',
    mustContain: ['€2,847.55'],
  },
  {
    q: 'What is the manufacturer serial-number prefix? Output ONLY the prefix.',
    mustContain: ['VCI-QPM7-2027-A0Z9-991'],
  },
  {
    q: 'What are the three pilot deployment IDs? Output them comma-separated, in the order they appear in the document.',
    mustContain: ['PILOT-BH-2026-117', 'PILOT-RV-2027-042', 'PILOT-DN-2027-088'],
  },
  {
    q: 'Who will lead the new Trondheim facility, and what is the project codename? Reply as "Name | Codename".',
    mustContain: ['Bohuslav', 'Jędrzejewicz-Schultz', 'Northern-Tide'],
  },
];

async function ask(
  adapter: ProviderAdapter,
  model: string,
  history: ChatMessage[],
  q: string,
): Promise<string> {
  const messages = [...history, { role: 'user' as const, content: q }];
  let out = '';
  for await (const ev of adapter.stream({ model, messages, max_tokens: 300, temperature: 0 })) {
    if (ev.type === 'text_delta') out += ev.text;
    if (ev.type === 'error') throw new Error(ev.message);
  }
  return out;
}

async function runLongContext(
  adapter: ProviderAdapter,
  model: string,
  label: string,
): Promise<{ history: ChatMessage[]; turns: Array<{ q: string; a: string; pass: boolean; missing: string[] }>; charCount: number }> {
  // Turn 1: deliver the article + ack
  const article = FICTIONAL_ARTICLE;
  const charCount = article.length;
  const history: ChatMessage[] = [];
  const introUser = `Read the following document carefully. I will ask you questions about specific details from it. Do not look anything up; answer strictly from the document. Reply with only "READ" to acknowledge.\n\n---\n${article}\n---`;
  const introAssistant = await ask(adapter, model, history, introUser);
  history.push({ role: 'user', content: introUser });
  history.push({ role: 'assistant', content: introAssistant });

  console.log(`\n=== ${label} | article=${charCount} chars | intro ack: "${introAssistant.slice(0, 60)}" ===`);

  const turns: Array<{ q: string; a: string; pass: boolean; missing: string[] }> = [];
  for (const f of FACTS) {
    const a = await ask(adapter, model, history, f.q);
    const missing = f.mustContain.filter((needle) => !a.includes(needle));
    const pass = missing.length === 0;
    history.push({ role: 'user', content: f.q });
    history.push({ role: 'assistant', content: a });
    turns.push({ q: f.q, a, pass, missing });
    console.log(`  Q: ${f.q}`);
    console.log(`  A: ${a.slice(0, 200)}${a.length > 200 ? '...' : ''}`);
    console.log(`  → ${pass ? 'PASS' : 'FAIL (missing: ' + missing.join(', ') + ')'}`);
  }

  return { history, turns, charCount };
}

describe('Long-context multi-turn (6 fact-extraction queries after a ~3.7 KB article)', () => {
  it(
    'GPT-5.4 extracts all facts across 7 turns',
    async () => {
      const adapter = new OpenAIAdapter(PROXY);
      const r = await runLongContext(adapter, 'gpt-5.4', 'GPT-5.4');
      const failed = r.turns.filter((t) => !t.pass);
      expect(failed, JSON.stringify(failed.map((t) => ({ q: t.q, missing: t.missing, a: t.a })), null, 2)).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    'Claude Sonnet 4.6 (Anthropic native) extracts all facts across 7 turns',
    async () => {
      const adapter = new AnthropicAdapter(PROXY);
      const r = await runLongContext(adapter, 'claude-sonnet-4-6', 'Claude (Anthropic native)');
      const failed = r.turns.filter((t) => !t.pass);
      expect(failed, JSON.stringify(failed.map((t) => ({ q: t.q, missing: t.missing, a: t.a })), null, 2)).toEqual([]);
    },
    TIMEOUT,
  );
});
