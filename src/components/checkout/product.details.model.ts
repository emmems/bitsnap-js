export interface SingleProduct {
  id: string;
  ownerID: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  metadata: unknown;
  image_url: string | null;

  images?: string[];

  availableQuantity?: number;

  isDeliverable?: boolean;

  tax?: number;

  variants?: SingleProductVariant[];

  additional?: {
    sku?: string;

    baselinkerFields?: {
      storageID?: string;
    };
    isTicket?: boolean;

    showProductInPublicList?: boolean;
  };

  isPublished?: boolean;
  recurring?: Recurring;
  createdAt?: number | null;
  updatedAt?: number | null;
  deletedAt?: number | null;
}

export interface SingleProductVariant {
  id: string;
  name: string;
  price: number;
  currency: string;
  metadata?: unknown;
  images?: string[];
  availableQuantity?: number;
  isDeliverable?: boolean;
}

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
  ANNUALLY = "annually",
}
