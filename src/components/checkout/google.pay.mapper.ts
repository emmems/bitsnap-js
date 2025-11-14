import { GetPreOrderDetailsResponse } from "src/gen/proto/public/v1/public_api_pb";
import { Checkout, GooglePayConfig } from "./CartProvider";
import { formatCurrency, round } from "./lib/round.number";
import { SingleProduct } from "./product.details.model";

export function mapGooglePayConfiguration(args: {
    items: {
        id: string;
        productID: string;
        quantity: number;
        metadata?: {
            [key: string]: string | undefined;
        };
        details?: SingleProduct;
    }[];
    googlePayConfig: GooglePayConfig;
    checkout: Checkout;
    result: GetPreOrderDetailsResponse;
    cartRequiresShipping: boolean;
}): google.payments.api.PaymentDataRequest | undefined {
    const { items, googlePayConfig, checkout, result, cartRequiresShipping } = args;
    if (result.totalAmount == null) {
        return undefined;
    }
    let intents: google.payments.api.CallbackIntent[] = [];
    if (cartRequiresShipping) {
        intents.push('SHIPPING_ADDRESS');
        intents.push('SHIPPING_OPTION');
    }

    const returnValue: google.payments.api.PaymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        callbackIntents: intents,
        allowedPaymentMethods: [
            {
                type: 'CARD',
                parameters: {
                    allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                    allowedCardNetworks: ['MASTERCARD', 'VISA'],
                },
                tokenizationSpecification: {
                    type: 'PAYMENT_GATEWAY',
                    parameters: {
                        gateway: googlePayConfig.gateway,
                        gatewayMerchantId: googlePayConfig.gatewayId,
                    },
                },
            },
        ],
        emailRequired: true,
        shippingAddressParameters: {
            phoneNumberRequired: cartRequiresShipping,
        },
        shippingAddressRequired: cartRequiresShipping,
        shippingOptionRequired: cartRequiresShipping,
        shippingOptionParameters: cartRequiresShipping ? {
            shippingOptions: result.methods.slice(0, 5).map(method => ({
                id: method.id,
                label: method.name + ' - ' + `${formatCurrency(method.amount, result.currency)}`,
                description: (method.description ?? ''),
            })),
            defaultSelectedOptionId: result.selectedDeliveryMethod,
        } : undefined,
        merchantInfo: {
            merchantId: googlePayConfig.merchantId + '',
            merchantName: googlePayConfig.merchantName,
        },
        transactionInfo: {
            totalPriceStatus: 'FINAL',
            totalPriceLabel: 'Płatność za koszyk',
            totalPrice: `${round(result.totalAmount / 100, 2)}`,
            currencyCode: result.currency,
            countryCode: result.country,
            checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE',
            displayItems: mapGooglePayDisplayItems(items, result.methods, result.selectedDeliveryMethod ?? (result.methods.length > 0 ? result.methods[0].id : undefined), checkout.couponCode, result.couponValue),
        },
    }
    console.log('returnValue', returnValue);
    return returnValue;
}

function mapGooglePayDisplayItems(items: {
    id: string;
    productID: string;
    quantity: number;
    metadata?: {
        [key: string]: string | undefined;
    };
    details?: SingleProduct;
}[], methods: GetPreOrderDetailsResponse['methods'], deliveryMethod?: string, couponCode?: string, couponValue?: number): google.payments.api.DisplayItem[] {

    const displayItems: google.payments.api.DisplayItem[] = [];

    let subtotalAmount = 0;
    for (const item of items) {
        if (item.details == null) {
            continue;
        }
        subtotalAmount += item.details.price * item.quantity;
        displayItems.push({
            label: item.details.name + ' x ' + item.quantity,
            price: `${round((item.details.price) / 100, 2)}`,
            type: 'LINE_ITEM',
            status: 'FINAL',
        });
    }

    const selectedDeliveryMethod = methods.find(method => method.id === deliveryMethod);
    if (selectedDeliveryMethod != null) {
        displayItems.push({
            label: selectedDeliveryMethod.name,
            price: `${round(selectedDeliveryMethod.amount / 100, 2)}`,
            type: 'SHIPPING_OPTION',
            status: 'FINAL',
        });
    }

    if (couponCode != null && couponValue != null) {
        displayItems.push({
            label: `Kupon ${couponCode}`,
            price: `${round(couponValue / 100, 2)}`,
            type: 'DISCOUNT',
            status: 'FINAL',
        });
    }
    if (subtotalAmount > 0) {
        displayItems.push({
            label: 'Subtotal',
            price: `${round(subtotalAmount / 100, 2)}`,
            type: 'SUBTOTAL',
            status: 'FINAL',
        });
    }

    return displayItems;
}