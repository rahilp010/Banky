/* eslint-disable prettier/prettier */
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(false);

const db = SQLite.openDatabase(
    { name: 'transactions.db', location: 'default' },
    () => console.log('Database opened'),
    error => console.log('Database error: ', error),
);

const executeSql = (query, params = []) =>
    new Promise((resolve, reject) => {
        db.transaction(tx => {
            tx.executeSql(
                query,
                params,
                (_, result) => resolve(result),
                (_, error) => {
                    reject(error);
                    return false;
                },
            );
        });
    });

const createTables = async () => {
    await executeSql(
        `CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            type TEXT NOT NULL
        );`,
    );
    await executeSql(
        `CREATE TABLE IF NOT EXISTS monthly_budgets (
            month TEXT PRIMARY KEY NOT NULL,
            amount REAL NOT NULL
        );`,
    );
};

const databaseReady = createTables();
databaseReady.catch(error => console.log('Create table error:', error));

const incomeTypes = ['income', 'salary'];
const expenseTypes = ['petrol', 'food', 'other'];

const getDashboardSummary = async () => {
    await databaseReady;
    const result = await executeSql(
        `SELECT
            COALESCE(SUM(CASE WHEN type IN ('income', 'salary') THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type IN ('petrol', 'food', 'other') THEN amount ELSE 0 END), 0) AS expenses,
            COALESCE(SUM(CASE WHEN type = 'savings' THEN amount ELSE 0 END), 0) AS savings,
            COALESCE(SUM(CASE WHEN type IN ('income', 'salary') THEN amount ELSE -amount END), 0) AS balance,
            COUNT(*) AS transactionCount
        FROM transactions;`,
    );

    return result.rows.item(0);
};

const getTransactions = async ({
    type = 'all',
    startDate = null,
    endDate = null,
    limit = null,
} = {}) => {
    await databaseReady;
    let query = 'SELECT * FROM transactions WHERE 1 = 1';
    const params = [];

    if (type && type !== 'all') {
        query += ' AND type = ?';
        params.push(type);
    }

    if (startDate) {
        query += ' AND date(date) >= date(?)';
        params.push(startDate);
    }

    if (endDate) {
        query += ' AND date(date) <= date(?)';
        params.push(endDate);
    }

    query += ' ORDER BY date DESC, id DESC';

    if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
    }

    const result = await executeSql(query, params);
    return result.rows.raw();
};

const addTransaction = async ({ amount, type, date = new Date().toISOString() }) => {
    await databaseReady;
    return executeSql(
        'INSERT INTO transactions (amount, date, type) VALUES (?, ?, ?)',
        [amount, date, type],
    );
};

const updateTransaction = async ({ id, amount, type, date }) => {
    await databaseReady;
    return executeSql(
        'UPDATE transactions SET amount = ?, date = ?, type = ? WHERE id = ?',
        [amount, date, type, id],
    );
};

const deleteTransaction = async id => {
    await databaseReady;
    return executeSql('DELETE FROM transactions WHERE id = ?', [id]);
};

const getMonthlyBudget = async month => {
    await databaseReady;
    const result = await executeSql(
        'SELECT amount FROM monthly_budgets WHERE month = ?',
        [month],
    );
    return result.rows.length ? Number(result.rows.item(0).amount) : 0;
};

const setMonthlyBudget = async (month, amount) => {
    await databaseReady;
    if (amount === 0) {
        return executeSql('DELETE FROM monthly_budgets WHERE month = ?', [month]);
    }
    return executeSql(
        'INSERT OR REPLACE INTO monthly_budgets (month, amount) VALUES (?, ?)',
        [month, amount],
    );
};

const clearTransactions = async () => {
    await databaseReady;
    return executeSql('DELETE FROM transactions');
};

const closeDatabase = async () => {
    await databaseReady;
    return new Promise((resolve, reject) => {
        db.close(
            () => {
                console.log('Database closed');
                resolve();
            },
            error => {
                console.log('Database close error:', error);
                reject(error);
            },
        );
    });
};

export {
    addTransaction,
    clearTransactions,
    closeDatabase,
    deleteTransaction,
    expenseTypes,
    getDashboardSummary,
    getMonthlyBudget,
    getTransactions,
    incomeTypes,
    setMonthlyBudget,
    updateTransaction,
};

export default db;
