export function round(num: number, numberOfDecimals: number = 2): number {
    return Number(
        +(
            Math.round(Number(num + "e+" + numberOfDecimals)) +
            "e-" +
            numberOfDecimals
        )
    );
}

export function formatCurrency(amount: number, currency: string): string {
    const formatter = Intl.NumberFormat(navigator.language, {
        style: "currency",
        currency: currency,
        currencyDisplay: 'symbol',
    });

    return formatter.format(amount / 100);
}