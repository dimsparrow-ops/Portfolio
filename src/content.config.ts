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
    client: z.string().optional(),
    order: z.number(),
    year: z.number(),
    country: z.string(),
    services: z.array(z.string()),
    platform: z.enum(['mobile', 'desktop']),
    summary: z.string(), // one line, shown on hover
    cover: z.string().optional(), // empty = placeholder
    hue: z.number().default(220), // placeholder tint until real covers exist
    metrics: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .max(4)
      .optional(),
    sections: z.object({
      input: section,
      reasoning: section,
      process: section,
      outcomes: section,
    }),
    link: z.object({ label: z.string(), url: z.string() }).optional(),
  }),
});

export const collections = { cases };
