/* eslint-disable prettier/prettier */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../Components/ThemeContext';
import { deleteTransaction, getTransactions, updateTransaction } from '../Components/db';
import { useNotification } from '../Components/NotificationContext';

const filters = [
    { label: 'All', value: 'all' },
    { label: 'Income', value: 'income' },
    { label: 'Salary', value: 'salary' },
    { label: 'Fuel', value: 'petrol' },
    { label: 'Food', value: 'food' },
    { label: 'Savings', value: 'savings' },
    { label: 'Other', value: 'other' },
];

const accentByType = {
    income: '#22C55E',
    salary: '#0EA5E9',
    petrol: '#F59E0B',
    food: '#EC4899',
    savings: '#8B5CF6',
    other: '#EF4444',
};

const formatCurrency = value =>
    `Rs ${Number(value || 0).toLocaleString('en-IN', {
        maximumFractionDigits: 0,
    })}`;

const formatDate = value =>
    new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

const formatDateInput = value => value.toISOString().split('T')[0];

const TransactionHistoryScreen = () => {
    const { isDarkMode, colors } = useTheme();
    const { showNotification } = useNotification();

    const showMessage = useCallback(
        (message, type = 'info', title = 'Banky') => {
            showNotification({ title, message, type });
        },
        [showNotification],
    );

    const [transactions, setTransactions] = useState([]);
    const [selectedType, setSelectedType] = useState('all');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [pickerTarget, setPickerTarget] = useState(null);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingAmount, setEditingAmount] = useState('');
    const [editingType, setEditingType] = useState('');
    const [editingDate, setEditingDate] = useState(new Date());
    const [editDatePickerVisible, setEditDatePickerVisible] = useState(false);

    const loadTransactions = useCallback(async () => {
        try {
            const rows = await getTransactions({
                type: selectedType,
                startDate: startDate ? formatDateInput(startDate) : null,
                endDate: endDate ? formatDateInput(endDate) : null,
            });
            setTransactions(rows);
        } catch (error) {
            console.log('History load error:', error);
            showMessage('Unable to load history.', 'error');
        }
    }, [endDate, selectedType, showMessage, startDate]);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    const beginEditing = () => {
        if (!selectedTransaction) {
            return;
        }
        setEditingAmount(String(selectedTransaction.amount));
        setEditingType(selectedTransaction.type);
        setEditingDate(new Date(selectedTransaction.date));
        setIsEditing(true);
    };

    const saveEditedTransaction = async () => {
        const amount = Number(editingAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            showMessage('Enter a valid amount greater than zero.', 'warning');
            return;
        }

        try {
            const updated = {
                ...selectedTransaction,
                amount,
                type: editingType,
                date: editingDate.toISOString(),
            };
            await updateTransaction(updated);
            setSelectedTransaction(updated);
            setIsEditing(false);
            await loadTransactions();
            showMessage('Transaction updated.', 'success');
        } catch (error) {
            console.log('Transaction update error:', error);
            showMessage('Unable to update this transaction.', 'error');
        }
    };

    const confirmDeleteTransaction = () => {
        if (!selectedTransaction) {
            return;
        }

        Alert.alert(
            'Delete transaction?',
            'This entry will be permanently removed from your history.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteTransaction(selectedTransaction.id);
                            setTransactions(current =>
                                current.filter(
                                    item => item.id !== selectedTransaction.id,
                                ),
                            );
                            setSelectedTransaction(null);
                            setIsEditing(false);
                            showMessage('Transaction deleted.', 'success');
                        } catch (error) {
                            console.log('Transaction delete error:', error);
                            showMessage('Unable to delete this transaction.', 'error');
                        }
                    },
                },
            ],
        );
    };

    const report = useMemo(() => {
        return transactions.reduce(
            (accumulator, item) => {
                const amount = Number(item.amount);

                if (['income', 'salary'].includes(item.type)) {
                    accumulator.income += amount;
                } else if (item.type === 'savings') {
                    accumulator.savings += amount;
                } else {
                    accumulator.expenses += amount;
                }

                accumulator.total += amount;
                return accumulator;
            },
            { income: 0, expenses: 0, savings: 0, total: 0 },
        );
    }, [transactions]);

    const handleDateChange = (_, value) => {
        setPickerTarget(null);

        if (!value) {
            return;
        }

        if (pickerTarget === 'start') {
            setStartDate(value);
            return;
        }

        setEndDate(value);
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
                {/* <View style={[styles.headerCard, { backgroundColor: colors.surface, borderWidth: isDarkMode ? 0 : 1, borderColor: colors.border }]}>
                    <Text style={[styles.headerEyebrow, { color: colors.textMuted }]}>HISTORY</Text>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Every entry, filtered and report-ready.</Text>
                    <Text style={[styles.headerText, { color: colors.textMuted }]}>
                        Your history, totals, and category breakdown stay aligned with the home dashboard.
                    </Text>
                </View> */}

                <View style={styles.reportRow}>
                    <View style={[styles.reportCard, styles.incomeCard, !isDarkMode && { borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' }]}>
                        <Text style={[styles.reportLabel, { color: isDarkMode ? '#CBD5E1' : colors.textMuted }]}>Income</Text>
                        <Text style={[styles.reportValue, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>{formatCurrency(report.income)}</Text>
                    </View>
                    <View style={[styles.reportCard, styles.expenseCard, !isDarkMode && { borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' }]}>
                        <Text style={[styles.reportLabel, { color: isDarkMode ? '#CBD5E1' : colors.textMuted }]}>Expenses</Text>
                        <Text style={[styles.reportValue, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>{formatCurrency(report.expenses)}</Text>
                    </View>
                </View>

                <View style={[styles.filterSection, { backgroundColor: colors.surface, borderWidth: isDarkMode ? 0 : 1, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Filter entries</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        {filters.map(filter => {
                            const active = filter.value === selectedType;
                            return (
                                <Pressable
                                    key={filter.value}
                                    style={[
                                        styles.chip, 
                                        { backgroundColor: isDarkMode ? '#122033' : '#F1F5F9' },
                                        active && (isDarkMode ? styles.chipActive : { backgroundColor: colors.buttonBackground })
                                    ]}
                                    onPress={() => setSelectedType(filter.value)}
                                >
                                    <Text style={[
                                        styles.chipText, 
                                        { color: isDarkMode ? '#D7E4F5' : '#475569' },
                                        active && (isDarkMode ? styles.chipTextActive : { color: '#FFFFFF' })
                                    ]}>
                                        {filter.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.dateRow}>
                        <Pressable style={[styles.dateButton, { backgroundColor: isDarkMode ? '#122033' : '#F1F5F9' }]} onPress={() => setPickerTarget('start')}>
                            <Icon name="calendar-month" size={18} color={colors.textMuted} />
                            <Text style={[styles.dateText, { color: colors.text }]}>
                                {startDate ? formatDate(startDate) : 'Start date'}
                            </Text>
                        </Pressable>
                        <Pressable style={[styles.dateButton, { backgroundColor: isDarkMode ? '#122033' : '#F1F5F9' }]} onPress={() => setPickerTarget('end')}>
                            <Icon name="event" size={18} color={colors.textMuted} />
                            <Text style={[styles.dateText, { color: colors.text }]}>
                                {endDate ? formatDate(endDate) : 'End date'}
                            </Text>
                        </Pressable>
                    </View>

                    <Pressable
                        style={styles.clearButton}
                        onPress={() => {
                            setSelectedType('all');
                            setStartDate(null);
                            setEndDate(null);
                        }}
                    >
                        <Text style={[styles.clearButtonText, { color: isDarkMode ? '#7DD3FC' : '#0EA5E9' }]}>Clear filters</Text>
                    </Pressable>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Transaction list</Text>
                    <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>{transactions.length} entries found</Text>
                </View>

                <View style={[styles.listCard, { backgroundColor: colors.surface, borderWidth: isDarkMode ? 0 : 1, borderColor: colors.border }]}>
                    {transactions.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions match this filter yet.</Text>
                    ) : (
                        transactions.map(item => (
                            <Pressable
                                key={item.id}
                                style={[styles.transactionRow, { borderBottomColor: isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.05)' }]}
                                onPress={() => {
                                    setSelectedTransaction(item);
                                    setIsEditing(false);
                                }}
                            >
                                <View style={styles.transactionLeft}>
                                    <View
                                        style={[
                                            styles.transactionAccent,
                                            { backgroundColor: accentByType[item.type] || colors.textMuted },
                                        ]}
                                    />
                                    <View>
                                        <Text style={[styles.transactionTitle, { color: colors.text }]}>{item.type.toUpperCase()}</Text>
                                        <Text style={[styles.transactionSubtitle, { color: colors.textMuted }]}>{formatDate(item.date)}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.transactionAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
                            </Pressable>
                        ))
                    )}
                </View>
            </ScrollView>

            {pickerTarget ? (
                <DateTimePicker
                    value={pickerTarget === 'start' ? startDate || new Date() : endDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                />
            ) : null}

            <Modal
                visible={Boolean(selectedTransaction)}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedTransaction(null)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(3, 7, 18, 0.72)' : 'rgba(15, 23, 42, 0.4)' }]}>
                    <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
                        {selectedTransaction ? (
                            <>
                                <View
                                    style={[
                                        styles.modalBadge,
                                        { backgroundColor: accentByType[selectedTransaction.type] || '#64748B' },
                                    ]}
                                >
                                    <Icon name={isEditing ? 'edit' : 'receipt-long'} size={24} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    {isEditing ? 'Edit transaction' : selectedTransaction.type.toUpperCase()}
                                </Text>
                                {isEditing ? (
                                    <>
                                        <Text style={[styles.editLabel, { color: colors.textMuted }]}>Amount</Text>
                                        <TextInput
                                            accessibilityLabel="Transaction amount"
                                            value={editingAmount}
                                            onChangeText={setEditingAmount}
                                            keyboardType="decimal-pad"
                                            style={[styles.editInput, { color: colors.text, borderColor: colors.border }]}
                                        />
                                        <Text style={[styles.editLabel, { color: colors.textMuted }]}>Category</Text>
                                        <View style={styles.editTypeGrid}>
                                            {filters.filter(filter => filter.value !== 'all').map(filter => {
                                                const active = editingType === filter.value;
                                                return (
                                                    <Pressable
                                                        key={filter.value}
                                                        style={[
                                                            styles.editTypeChip,
                                                            {
                                                                borderColor: accentByType[filter.value],
                                                                backgroundColor: active ? accentByType[filter.value] : 'transparent',
                                                            },
                                                        ]}
                                                        onPress={() => setEditingType(filter.value)}
                                                    >
                                                        <Text style={[
                                                            styles.editTypeText,
                                                            { color: active ? '#FFFFFF' : colors.text },
                                                        ]}>
                                                            {filter.label}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                        <Text style={[styles.editLabel, { color: colors.textMuted }]}>Date</Text>
                                        <Pressable
                                            style={[styles.editDateButton, { borderColor: colors.border }]}
                                            onPress={() => setEditDatePickerVisible(true)}
                                        >
                                            <Icon name="calendar-month" size={18} color={colors.textMuted} />
                                            <Text style={[styles.editDateText, { color: colors.text }]}>
                                                {formatDate(editingDate)}
                                            </Text>
                                        </Pressable>
                                    </>
                                ) : (
                                    <>
                                        <Text style={[styles.modalAmount, { color: colors.text }]}>{formatCurrency(selectedTransaction.amount)}</Text>
                                        <View style={[styles.modalDetailRow, { borderBottomColor: colors.border }]}>
                                            <Text style={[styles.modalDetailLabel, { color: colors.textMuted }]}>Date</Text>
                                            <Text style={[styles.modalDetailValue, { color: colors.text }]}>{formatDate(selectedTransaction.date)}</Text>
                                        </View>
                                        <View style={[styles.modalDetailRow, { borderBottomColor: colors.border }]}>
                                            <Text style={[styles.modalDetailLabel, { color: colors.textMuted }]}>Type</Text>
                                            <Text style={[styles.modalDetailValue, { color: colors.text }]}>{selectedTransaction.type}</Text>
                                        </View>
                                    </>
                                )}
                            </>
                        ) : null}
                        {isEditing ? (
                            <View style={styles.editActions}>
                                <Pressable
                                    style={[styles.closeButton, styles.editActionButton, { backgroundColor: colors.buttonBackground }]}
                                    onPress={saveEditedTransaction}
                                >
                                    <Text style={[styles.closeButtonText, { color: colors.buttonText }]}>Save changes</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.cancelEditButton, styles.editActionButton, { borderColor: colors.border }]}
                                    onPress={() => setIsEditing(false)}
                                >
                                    <Text style={[styles.cancelEditText, { color: colors.textMuted }]}>Cancel</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                <View style={styles.detailActions}>
                                    <Pressable
                                        style={[styles.closeButton, styles.detailActionButton, { backgroundColor: colors.buttonBackground }]}
                                        onPress={beginEditing}
                                    >
                                        <Icon name="edit" size={17} color={colors.buttonText} />
                                        <Text style={[styles.closeButtonText, { color: colors.buttonText }]}>Edit</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.deleteButton, styles.detailActionButton]}
                                        onPress={confirmDeleteTransaction}
                                    >
                                        <Icon name="delete-outline" size={18} color="#EF4444" />
                                        <Text style={styles.deleteButtonText}>Delete</Text>
                                    </Pressable>
                                </View>
                                <Pressable
                                    style={[styles.cancelEditButton, { borderColor: colors.border }]}
                                    onPress={() => setSelectedTransaction(null)}
                                >
                                    <Text style={[styles.cancelEditText, { color: colors.textMuted }]}>Close</Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {editDatePickerVisible ? (
                <DateTimePicker
                    value={editingDate}
                    mode="date"
                    display="default"
                    onChange={(_, value) => {
                        setEditDatePickerVisible(Platform.OS === 'ios');
                        if (value) {
                            setEditingDate(value);
                        }
                    }}
                />
            ) : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#07111F',
    },
    container: {
        flex: 1,
        backgroundColor: '#07111F',
    },
    content: {
        padding: 20,
        paddingBottom: 110,
    },
    headerCard: {
        backgroundColor: '#0D192B',
        borderRadius: 28,
        padding: 22,
        marginBottom: 18,
    },
    headerEyebrow: {
        color: '#94A3B8',
        fontSize: 12,
        letterSpacing: 2,
        marginBottom: 8,
        fontWeight: '700',
    },
    headerTitle: {
        color: '#F8FAFC',
        fontSize: 28,
        lineHeight: 34,
        fontWeight: '700',
        marginBottom: 10,
    },
    headerText: {
        color: '#94A3B8',
        lineHeight: 20,
    },
    reportRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    reportCard: {
        flex: 1,
        borderRadius: 20,
        padding: 16,
        marginHorizontal: 4,
    },
    incomeCard: {
        backgroundColor: '#122033',
    },
    expenseCard: {
        backgroundColor: '#241B30',
    },
    savingsCard: {
        backgroundColor: '#162926',
    },
    reportLabel: {
        color: '#CBD5E1',
        fontSize: 12,
        marginBottom: 8,
    },
    reportValue: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    filterSection: {
        backgroundColor: '#0D192B',
        borderRadius: 24,
        padding: 18,
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#F8FAFC',
        fontSize: 20,
        fontWeight: '700',
    },
    sectionCaption: {
        color: '#94A3B8',
        fontSize: 12,
    },
    chipRow: {
        paddingVertical: 14,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: '#122033',
        marginRight: 10,
    },
    chipActive: {
        backgroundColor: '#F8FAFC',
    },
    chipText: {
        color: '#D7E4F5',
        fontWeight: '700',
    },
    chipTextActive: {
        color: '#0F172A',
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    dateButton: {
        width: '48%',
        backgroundColor: '#122033',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        color: '#E2E8F0',
        marginLeft: 10,
        fontWeight: '600',
    },
    clearButton: {
        alignSelf: 'flex-start',
        paddingVertical: 10,
    },
    clearButtonText: {
        color: '#7DD3FC',
        fontWeight: '700',
    },
    listCard: {
        backgroundColor: '#0D192B',
        borderRadius: 24,
        padding: 18,
    },
    emptyText: {
        color: '#94A3B8',
        textAlign: 'center',
        paddingVertical: 20,
        lineHeight: 22,
    },
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(148, 163, 184, 0.12)',
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    transactionAccent: {
        width: 12,
        height: 44,
        borderRadius: 8,
        marginRight: 14,
    },
    transactionTitle: {
        color: '#F8FAFC',
        fontWeight: '700',
        marginBottom: 4,
    },
    transactionSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
    },
    transactionAmount: {
        color: '#F8FAFC',
        fontWeight: '800',
        marginLeft: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(3, 7, 18, 0.72)',
        justifyContent: 'center',
        padding: 20,
    },
    modalCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 28,
        padding: 24,
        maxHeight: '90%',
    },
    modalBadge: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        color: '#0F172A',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
    },
    modalAmount: {
        color: '#0F172A',
        fontSize: 30,
        fontWeight: '800',
        marginBottom: 20,
    },
    modalDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    modalDetailLabel: {
        color: '#64748B',
        fontWeight: '600',
    },
    modalDetailValue: {
        color: '#0F172A',
        fontWeight: '700',
    },
    editLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 6,
    },
    editInput: {
        borderWidth: 1,
        borderRadius: 14,
        fontSize: 18,
        fontWeight: '700',
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    editTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -3,
    },
    editTypeChip: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 11,
        paddingVertical: 8,
        margin: 3,
    },
    editTypeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    editDateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    editDateText: {
        marginLeft: 9,
        fontWeight: '700',
    },
    detailActions: {
        flexDirection: 'row',
        marginTop: 18,
    },
    editActions: {
        marginTop: 10,
    },
    detailActionButton: {
        flex: 1,
        marginTop: 0,
        marginHorizontal: 4,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editActionButton: {
        marginTop: 8,
    },
    deleteButton: {
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.35)',
        borderRadius: 16,
        paddingVertical: 14,
    },
    deleteButtonText: {
        color: '#EF4444',
        fontWeight: '800',
        fontSize: 15,
        marginLeft: 4,
    },
    cancelEditButton: {
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 13,
        alignItems: 'center',
        marginTop: 10,
    },
    cancelEditText: {
        fontWeight: '700',
        fontSize: 14,
    },
    closeButton: {
        marginTop: 18,
        backgroundColor: '#0F172A',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#F8FAFC',
        fontWeight: '800',
        fontSize: 15,
    },
});

export default TransactionHistoryScreen;
