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

async function processSymbol(symbol, tickerData) {
    try {
        const currentPrice = (parseFloat(tickerData.ask) + parseFloat(tickerData.bid)) / 2;
        const apiTimestamp = tickerData.timestamp;

        // 市場が閉じているかチェック
        if (tickerData.status === "CLOSE") {
            // console.log(`Skipping ${symbol}: Market is closed`);
            return;
        }

        const snapshot = await db.collection("rates")
            .where("symbol", "==", symbol)
            .orderBy("timestamp", "desc")
            .limit(20)
            .get();

        const latestDoc = snapshot.docs[0];
        if (latestDoc) {
            const lastData = latestDoc.data();
            if (lastData.price === currentPrice && lastData.apiTimestamp === apiTimestamp) {
                // console.log(`Skipping ${symbol}: Price and timestamp haven't changed`);
                return;
            }
        }

        const historicalPrices = snapshot.docs.map(doc => doc.data().price).reverse();
        historicalPrices.push(currentPrice);

        const rsi = calculateRSI(historicalPrices, 14);

        await db.collection("rates").add({
            symbol: symbol,
            price: currentPrice,
            rsi: rsi,
            apiTimestamp: apiTimestamp,
            timestamp: admin.firestore.Timestamp.now()
        });

        console.log(`Saved ${symbol}: ${currentPrice}, RSI: ${rsi}`);
    } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
    }
}

async function fetchAndSave() {
    const API_ENDPOINT = "https://forex-api.coin.z.get/public/v1/ticker"; // Note: Actual endpoint below
    const REAL_API_ENDPOINT = "https://forex-api.coin.z.com/public/v1/ticker";

    try {
        const response = await axios.get(REAL_API_ENDPOINT);
        const allTickerData = response.data.data;

        if (!allTickerData || allTickerData.length === 0) {
            console.error("No ticker data found");
            process.exit(1);
        }

        // 全シンボルのリストを取得
        const symbols = allTickerData.map(d => d.symbol);

        // 各シンボルを並列処理
        await Promise.all(allTickerData.map(data => processSymbol(data.symbol, data)));

        // メタ情報を更新
        await db.collection("meta").doc("symbols").set({
            list: symbols,
            lastUpdated: admin.firestore.Timestamp.now()
        });

        console.log("Fetcher cycle completed successfully");
    } catch (error) {
        console.error("Fetcher error:", error);
        process.exit(1);
    }
}

fetchAndSave();
