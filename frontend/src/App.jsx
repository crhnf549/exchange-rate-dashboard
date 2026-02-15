import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Activity, TrendingUp, Clock } from 'lucide-react';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function App() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "rates"),
      orderBy("timestamp", "desc"),
      limit(24)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRates(data.reverse());
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const currentRate = rates.length > 0 ? rates[rates.length - 1] : null;

  const chartData = {
    labels: rates.map(r => {
      const d = r.timestamp.toDate();
      return `${d.getHours()}:00`;
    }),
    datasets: [
      {
        label: 'USD/JPY',
        data: rates.map(r => r.price),
        borderColor: '#00d2ff',
        backgroundColor: 'rgba(0, 210, 255, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#00d2ff',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(20, 20, 20, 0.8)',
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#a0a0a0' },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#a0a0a0' },
      },
    },
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Initializing FX Intelligence...</p>
        </div>
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="dashboard-container">
        <header>
          <h1>FX Intelligence</h1>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '100px 20px' }}>
          <Activity size={48} style={{ marginBottom: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} />
          <h3>No Market Data Available</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '10px auto' }}>
            The market might be closed or the data fetcher is currently initializing.
            Data will appear here automatically once recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header>
        <h1>FX Intelligence</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          <span className="live-indicator"></span>
          Live Market Analytics • Node: Tokyo
        </p>
      </header>

      <div className="stats-grid">
        <div className="card">
          <div className="card-title">Current Price</div>
          <div className="card-value">
            ¥{currentRate?.price?.toFixed(2)}
          </div>
          <div className="card-subvalue">
            <Activity size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
            USD/JPY • Live
          </div>
        </div>

        <div className="card">
          <div className="card-title">Relative Strength Index</div>
          <div className="card-value" style={{ color: currentRate?.rsi > 70 ? '#ff4b2b' : currentRate?.rsi < 30 ? '#00f2fe' : '#fff' }}>
            {currentRate?.rsi?.toFixed(2) || "N/A"}
          </div>
          <div className="card-subvalue">
            <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
            14 Period Analysis
          </div>
        </div>

        <div className="card">
          <div className="card-title">Last Update</div>
          <div className="card-value">
            {currentRate?.timestamp?.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="card-subvalue">
            <Clock size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
            1-hour cycle
          </div>
        </div>
      </div>

      <div className="chart-container">
        <h3 style={{ marginBottom: '20px', fontWeight: '400' }}>Price Trend (24h)</h3>
        <div style={{ height: '350px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}

export default App;
