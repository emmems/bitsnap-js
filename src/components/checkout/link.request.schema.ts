import zod from "zod";
import { round } from "./lib/round.number";

export const linkAddressSchema = zod.object({
    name: zod.string().optional(),
    line1: zod.string().optional(),
    line2: zod.string().optional(),
    city: zod.string().optional(),
    zipCode: zod.string().optional(),
    country: zod.string().optional()
});

export const linkBillingAddressSchema = zod.object({
    nip: zod.string().optional(),
    name: zod.string().optional(),
    line1: zod.string().optional(),
    line2: zod.string().optional(),
    city: zod.string().optional(),
    zipCode: zod.string().optional()
});

export type LinkAddress = zod.infer<typeof linkAddressSchema>;
export type LinkBillingAddress = zod.infer<typeof linkBillingAddressSchema>;

export interface Recurring {
    billingPeriod: BillingPeriod;
    trialDays?: number;
    subscriptionSchedule?: number;
}

export enum BillingPeriod {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
    SEMI_ANNUALLY = "semi-annually",
    ANNUALLY = "annually"
}


export const agreementSchema = zod.object({
    id: zod.string().optional(),
    name: zod.string(),
    description: zod.string().optional(),
    required: zod.boolean().default(false),
    answer: zod.boolean().optional(),
});
export type CheckoutAgreement = zod.infer<typeof agreementSchema>;

export type LinkRequest = zod.infer<typeof linkRequestSchema>;
export const linkRequestSchema = zod.object({
    askForAddress: zod.boolean().optional(),
    askForPhone: zod.boolean().optional(),
    askForNote: zod.boolean().optional(),
    askForNip: zod.boolean().optional(),
    delivery: zod.array(zod.object({
        name: zod.string(),
        desc: zod.string().optional(),
        min: zod.number(),
        max: zod.number(),
        price: zod.number().transform(val => round(val * 100, 0))
    })).optional(),
    deliveryMethod: zod.string().optional(),

    details: zod.object({
        email: zod.string().email().optional(),
        name: zod.string().optional(),
        lastName: zod.string().optional(),
        phone: zod.string().optional(),

        address: linkAddressSchema.optional(),

        billingAddress: linkBillingAddressSchema.optional(),
    }).optional(),
    countries: zod.array(zod.string()).optional(),
    items: zod.array(
        zod.object({
            id: zod.string(),
            quantity: zod.number().min(1),

            name: zod.string().optional(),
            description: zod.string().optional(),
            imageURL: zod.string().optional(),
            price: zod.number().optional(),
            currency: zod.string().optional(),

            recurring: zod.object({
                billingPeriod: zod.enum([BillingPeriod.DAILY, BillingPeriod.WEEKLY, BillingPeriod.MONTHLY, BillingPeriod.QUARTERLY, BillingPeriod.SEMI_ANNUALLY, BillingPeriod.ANNUALLY]),
                trialDays: zod.number().optional(),
                subscriptionSchedule: zod.number().optional()
            }).optional()
        })
    ),
    metadata: zod.record(zod.string(), zod.string()).optional(),

    additionalAgreements: zod.array(agreementSchema).optional(),

    blikCode: zod.string().optional(),
    couponCode: zod.string().optional(),

    redirect: zod.object({
        successURL: zod.string().optional(),
        cancelURL: zod.string().optional()
    }).optional()
});
