import axios, { AxiosError } from 'axios';

interface TransactionPayload {
  transactionId: string;
  amount: number;
  currency: string;
  accountId: string;
}

// Утилита для реализации Exponential Backoff с джиттером
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
  
    // Экспоненциальная задержка с защитой от шторма запросов (jitter)
    const nextDelay = delay * 2 + Math.random() * 200;
    console.warn(`Ошибка запроса. Повтор через ${Math.round(nextDelay)}ms. Осталось попыток: ${retries}`);
  
    await new Promise((resolve) => setTimeout(resolve, nextDelay));
    return retryWithBackoff(fn, retries - 1, nextDelay);
  }
}

// Обработчик входящего POST запроса транзакции
export async function handleTransactionPost(payload: TransactionPayload, idempotencyKey: string): Promise<any> {
  // Проверка идемпотентности (псевдокод работы с БД)
  // const existing = await db.findByIdempotencyKey(idempotencyKey);
  // if (existing) return existing.response;

  const syncToOracle = async () => {
    // Вызов Legacy Oracle через хранимую процедуру или оптимизированный SQL/REST адаптер
    const response = await axios.post('https://legacy-oracle-adapter/api/v1/internal/tx', payload, {
      headers: { 'X-Idempotency-Key': idempotencyKey },
      timeout: 5000,
    });
    return response.data;
  };

  try {
    const result = await retryWithBackoff(syncToOracle, 3, 500);
    // Сохранение в БД со статусом SUCCESS
    return { status: 'CREATED', data: result };
  } catch (error: any) {
    console.error('Критический сбой интеграции с Oracle:', error.message);
    // Логирование в ELK, сохранение в Dead Letter Queue (DLQ) для ручного разбора
    throw new Error('Transaction processing failed after retries');
  }
}