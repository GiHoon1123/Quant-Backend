export default {
  monitoredSymbols: process.env.MONITORED_SYMBOLS?.split(',') ?? [
    'BTCUSDT',
    // 'ETHUSDT',
    // 'ADAUSDT',
    // 'SOLUSDT',
    // 'DOGEUSDT',
    // 'XRPUSDT',
    // 'DOTUSDT',
    // 'AVAXUSDT',
    // 'MATICUSDT',
    // 'LINKUSDT',
  ],
  maxMemoryCandles: Number(process.env.MAX_MEMORY_CANDLES) || 200,
  reconnectInterval: Number(process.env.RECONNECT_INTERVAL) || 5000,
  healthCheckInterval: Number(process.env.HEALTH_CHECK_INTERVAL) || 60000,
};
