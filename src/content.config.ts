import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Case content model (see brief → "Модель контенту кейсу").
 * One Markdown file per case in src/content/cases. A CMS (Keystatic/Tina)
 * will later edit exactly these fields, so the site never needs re-layout
 * to add a case.
 */
const media = z.object({
  kind: z.enum(['image', 'video', 'quote']),
  src: z.string().optional(), // path in /public, empty = placeholder
  alt: z.string().optional(),
  quote: z.string().optional(),
  author: z.string().optional(), // stakeholder name · role
});

const section = z.object({
  text: z.string(),
  media: z.array(media).min(1),
});

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    task: z.string(), // the design task, shown above the card on hover (2–3 lines max)
    client: z.string().optional(),
    order: z.number(),
    year: z.number(),
    country: z.string(),
    services: z.array(z.string()),
    platform: z.enum(['mobile', 'desktop']),
    summary: z.string(), // one line, shown on hover
    cover: z.string().optional(), // empty = placeholder
    hue: z.number().default(220), // placeholder tint until real covers exist
    product: z.string().optional(), // product type, e.g. "B2B platform"; replaces the platform chip on the card and joins the header tags
    role: z.string().optional(), // "Lead Product Designer" — shown in the header row
    team: z.string().optional(), // "Team of 6" — shown in the header row
    mine: z.string().optional(), // one sentence: what exactly was mine (no "we did")
    metrics: z
      .array(
        z.object({
          value: z.string(), // the result, big number
          label: z.string(),
          before: z.string().optional(), // baseline; with it the row gets a small before → after scale
          when: z.string().optional(), // when the result was measured, e.g. "at release", "+3 months"
          note: z.string().optional(), // how it was measured: A/B test, analytics, usability test
        }),
      )
      .max(4)
      .optional(),
    sections: z.object({
      input: section,
      approach: section, // the key decision first, then how we got there
      outcomes: section,
    }),
    link: z.object({ label: z.string(), url: z.string() }).optional(),
  }),
});

export const collections = { cases };
