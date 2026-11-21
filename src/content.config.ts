import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const localized = z.object({ pl: z.string(), en: z.string().optional() });

export const shirtKinds = ['home', 'away', 'third', 'goalkeeper', 'special', 'unknown'] as const;
export const shirtColors = ['red', 'white', 'blue', 'green', 'yellow', 'orange', 'other'] as const;
export const shirtStatuses = ['match-worn', 'match-issued', 'unconfirmed'] as const;

const shirts = defineCollection({
  loader: file('src/content/shirts.json'),
  schema: ({ image }) =>
    z.object({
      /** Instagram post number (🔵#93) – not the same as the position in the collection. */
      igPost: z.number().int().optional(),
      player: z.string(),
      number: z.number().int(),
      season: z.string().optional(),
      /** First year of the season, used for sorting/filtering (2026 for 2026/27). */
      seasonStart: z.number().int().optional(),
      seasonApprox: z.boolean().default(false),
      competition: z.string().optional(),
      match: localized.optional(),
      kind: z.enum(shirtKinds),
      color: z.enum(shirtColors),
      status: z.enum(shirtStatuses),
      signed: z.boolean(),
      maker: z.string().optional(),
      sponsor: z.string().optional(),
      story: localized.optional(),
      instagram: z.string().url().optional(),
      /** Transparent cut-outs, added later (paths relative to shirts.json). */
      images: z
        .object({
          front: image().optional(),
          back: image().optional(),
        })
        .optional(),
      /** Untouched Instagram photos (proof of authenticity), in post order. */
      originals: z.array(image()).optional(),
      /** Placeholder generated from the wall photo – data still to be filled in. */
      draft: z.boolean().default(false),
      wall: z.object({ row: z.number().int(), col: z.number().int() }).optional(),
    }),
});

export const collections = { shirts };
