const admin = require("firebase-admin");
const axios = require("axios");

// GitHub Secrets からサービスアカウントキーを取得
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function calculateRSI(prices, period = 14) {
    if (prices.length <= period) return null;
    let gains = [];
    let losses = [];
    for (let i = 1; i <= period; i++) {
        let change = prices[i] - prices[i - 1];
        gains.push(Math.max(change, 0));
        losses.push(Math.max(-change, 0));
    }
    let avgGain = gains.reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.reduce((a, b) => a + b, 0) / period;
    let lastRSI = 0;
    for (let i = period; i < prices.length; i++) {
        let change = prices[i] - prices[i - 1];
        let gain = Math.max(change, 0);
        let loss = Math.max(-change, 0);
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        lastRSI = 100 - 100 / (1 + rs);
    }
    return lastRSI;
}

async function fetchAndSave() {
    const symbol = "USD_JPY";
    const API_ENDPOINT = "https://forex-api.coin.z.com/public/v1/ticker";

    try {
        const response = await axios.get(API_ENDPOINT);
        const tickerData = response.data.data.find(d => d.symbol === symbol);

        if (!tickerData) {
            console.error("USD_JPY data not found");
            process.exit(1);
        }

        const currentPrice = (parseFloat(tickerData.ask) + parseFloat(tickerData.bid)) / 2;
        const timestamp = admin.firestore.Timestamp.now();

        const snapshot = await db.collection("rates")
            .where("symbol", "==", symbol)
            .orderBy("timestamp", "desc")
            .limit(20)
            .get();

        const historicalPrices = snapshot.docs.map(doc => doc.data().price).reverse();
        historicalPrices.push(currentPrice);

        const rsi = calculateRSI(historicalPrices, 14);

        await db.collection("rates").add({
            symbol: symbol,
            price: currentPrice,
            rsi: rsi,
            timestamp: timestamp
        });

        console.log(`Successfully saved price: ${currentPrice}, RSI: ${rsi}`);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

fetchAndSave();
