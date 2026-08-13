import { z } from "zod";

const moneySchema = z
  .object({
    amount: z.union([z.string(), z.number().transform(String)]),
    currency: z.string()
  })
  .passthrough();

export const accountSchema = z
  .object({
    orgId: z.number(),
    orgName: z.string().optional(),
    displayName: z.string().optional(),
    currency: z.string().optional(),
    timeZone: z.string().optional(),
    roleNames: z.array(z.string()).optional()
  })
  .passthrough();

export const campaignSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    status: z.string().optional(),
    displayStatus: z.string().optional(),
    servingStatus: z.string().optional(),
    countriesOrRegions: z.array(z.string()).optional(),
    budgetAmount: moneySchema.optional(),
    dailyBudgetAmount: moneySchema.optional()
  })
  .passthrough();

export const adGroupSchema = z
  .object({
    id: z.number(),
    campaignId: z.number(),
    name: z.string(),
    status: z.string().optional(),
    displayStatus: z.string().optional(),
    defaultBidAmount: moneySchema.optional()
  })
  .passthrough();

export const keywordSchema = z
  .object({
    id: z.number(),
    adGroupId: z.number(),
    text: z.string(),
    status: z.string().optional(),
    matchType: z.string().optional(),
    bidAmount: moneySchema.optional()
  })
  .passthrough();

const unknownRecord = z.record(z.string(), z.unknown());

export const reportRowSchema = z
  .object({
    metadata: unknownRecord.optional(),
    total: unknownRecord.optional(),
    granularity: z.array(unknownRecord).optional()
  })
  .passthrough();

export const appleEnvelopeSchema = z
  .object({
    data: z.unknown(),
    pagination: z
      .object({
        totalResults: z.number().optional(),
        startIndex: z.number().optional(),
        itemsPerPage: z.number().optional()
      })
      .passthrough()
      .nullish(),
    error: z.unknown().optional()
  })
  .passthrough();
