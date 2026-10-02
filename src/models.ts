import * as z from "zod";

export namespace BitsnapModels {
  export const BaselinkerFieldsSchema = z.object({
    storageID: z.string().optional(),
  });
  export type BaselinkerFields = z.infer<typeof BaselinkerFieldsSchema>;

  export const MetadataSchema = z.record(z.string(), z.any());

  export const ProductPricingSchema = z.object({
    regularPrice: z.number(),
    effectivePrice: z.number(),
    currency: z.string(),
    discount: z.object({
      id: z.string(),
      type: z.enum(["FIXED", "PERCENTAGE"]),
      value: z.number(),
      status: z.enum(["ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"]),
      startsAt: z.number().optional(),
      endsAt: z.number().optional(),
    }).optional(),
    referencePrice: z.object({
      amount: z.number().optional(),
      windowDays: z.literal(30),
      asOf: z.number(),
      basis: z.literal("observed-history"),
      historyAvailable: z.boolean(),
    }),
    priceVersion: z.string(),
    nextPriceChangeAt: z.number().optional(),
  });
  export type ProductPricing = z.infer<typeof ProductPricingSchema>;

  export const VariantSchema = z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    currency: z.string(),
    metadata: MetadataSchema.optional(),
    images: z.array(z.string()),
    availableQuantity: z.number().optional(),
    isDeliverable: z.boolean().optional(),
    estimatedDeliveryAt: z.number().optional(),
    pricing: ProductPricingSchema.optional(),
  });
  export type Variant = z.infer<typeof VariantSchema>;

  export const AdditionalSchema = z.object({
    sku: z.string().optional(),
    baselinkerFields: BaselinkerFieldsSchema.optional(),
    isPresale: z.boolean().optional(),
  });
  export type Additional = z.infer<typeof AdditionalSchema>;

  export const ItemSchema = z.object({
    id: z.string(),
    ownerID: z.string().optional(),
    name: z.string(),
    description: z.union([z.string(), z.null()]).optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    price: z.number(),
    currency: z.string(),
    metadata: MetadataSchema.optional(),
    image_url: z.string(),
    images: z.array(z.string()),
    isDeliverable: z.boolean().optional(),
    availableQuantity: z.number().optional(),
    additional: AdditionalSchema.optional(),
    variants: z.array(VariantSchema).optional(),
    estimatedDeliveryAt: z.number().optional(),
    pricing: ProductPricingSchema.optional(),
  });
  export type Item = z.infer<typeof ItemSchema>;

  export const DataSchema = z.object({
    success: z.boolean(),
    result: z.array(ItemSchema),
    totalCount: z.number(),
  });
  export type Data = z.infer<typeof DataSchema>;

  export const ProductsResultResultSchema = z.object({
    data: DataSchema,
  });
  export type ProductsResultResult = z.infer<typeof ProductsResultResultSchema>;

  export const ProductsResultElementSchema = z.array(
    z.object({
      result: ProductsResultResultSchema,
    }),
  );
  export type ProductsResultElement = z.infer<
    typeof ProductsResultElementSchema
  >;

  export const ProductResultSchema = z.array(
    z.object({
      result: z.object({
        data: z.object({
          success: z.boolean(),
          message: z.string().optional(),
          result: ItemSchema.optional(),
        }),
      }),
    }),
  );
}
