export const money = (amount: number) =>
    new Intl.NumberFormat("en-SG", {
        style: "currency",
        currency: "SGD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);