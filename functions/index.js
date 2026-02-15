const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

const db = admin.firestore();

/**
 * RSI計算ロジック
 */
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

/**
 * 1時間おきに価格を取得しFirestoreに保存する
 */
exports.scheduledFetchPrice = functions.pubsub
    .schedule("0 * * * *")
    .timeZone("Asia/Tokyo")
    .onRun(async (context) => {
        const symbol = "USD_JPY";
        const API_ENDPOINT = "https://forex-api.coin.z.com/public/v1/ticker";

        try {
            // 1. 現在価格の取得
            const response = await axios.get(API_ENDPOINT);
            const tickerData = response.data.data.find(d => d.symbol === symbol);

            if (!tickerData) {
                console.error("USD_JPY data not found in ticker");
                return null;
            }

            const currentPrice = (parseFloat(tickerData.ask) + parseFloat(tickerData.bid)) / 2;
            const timestamp = admin.firestore.Timestamp.now();

            // 2. 過去のデータを取得してRSIを計算
            const snapshot = await db.collection("rates")
                .where("symbol", "==", symbol)
                .orderBy("timestamp", "desc")
                .limit(20)
                .get();

            const historicalPrices = snapshot.docs.map(doc => doc.data().price).reverse();
            historicalPrices.push(currentPrice);

            const rsi = calculateRSI(historicalPrices, 14);

            // 3. Firestoreに保存
            await db.collection("rates").add({
                symbol: symbol,
                price: currentPrice,
                rsi: rsi,
                timestamp: timestamp
            });

            console.log(`Saved price for ${symbol}: ${currentPrice}, RSI: ${rsi}`);
            return null;
        } catch (error) {
            console.error("Error fetching price:", error);
            return null;
        }
    });
