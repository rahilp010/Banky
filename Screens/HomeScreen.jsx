/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {trigger} from 'react-native-haptic-feedback';
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import DonutChart from '../Components/AnimatedPieChart';
import BootSplash from 'react-native-bootsplash';
import {useTheme} from '../Components/ThemeContext';
import ThemeTransitionOverlay from '../Components/ThemeTransitionOverlay';
import {triggerTestNotification} from '../Components/NotificationService';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import {
  addTransaction,
  clearTransactions,
  closeDatabase,
  getDashboardSummary,
  getMonthlyBudget,
  getTransactions,
  setMonthlyBudget as saveMonthlyBudget,
} from '../Components/db';
import {version} from '../package.json';
import {useNotification} from '../Components/NotificationContext';

const transactionOptions = [
  {name: 'Deposit', type: 'income', icon: 'south-west', accent: '#A7F3D0'},
  {name: 'Salary', type: 'salary', icon: 'payments', accent: '#BFDBFE'},
  {name: 'Fuel', type: 'petrol', icon: 'local-gas-station', accent: '#FDE68A'},
  {name: 'Dining', type: 'food', icon: 'restaurant', accent: '#FBCFE8'},
  {name: 'Savings', type: 'savings', icon: 'savings', accent: '#C4B5FD'},
  {name: 'Other', type: 'other', icon: 'category', accent: '#FCA5A5'},
];

const expenseTransactionTypes = ['petrol', 'food', 'other'];

const notificationOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
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

const getMonthKey = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const {showNotification} = useNotification();

  const showMessage = useCallback(
    (message, type = 'info', title = 'Banky') => {
      showNotification({title, message, type});
    },
    [showNotification],
  );

  const [summary, setSummary] = useState({
    balance: 0,
    income: 0,
    expenses: 0,
    savings: 0,
    transactionCount: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [budgetVisible, setBudgetVisible] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [resetVisible, setResetVisible] = useState(false);
  const {isDarkMode, toggleTheme, colors} = useTheme();
  const [selectedItem, setSelectedItem] = useState(transactionOptions[0]);
  const [formValue, setFormValue] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [backupVisible, setBackupVisible] = useState(false);
  const [isQuickEntry, setIsQuickEntry] = useState(false);
  const chartScrollRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedBarIndex, setSelectedBarIndex] = useState(null);

  // Initialize to the first day of the current month
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  });

  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const floatingPillStyle = useAnimatedStyle(() => {
    const isVisible = scrollY.value > 50;
    return {
      opacity: withTiming(isVisible ? 1 : 0, {duration: 200}),
      transform: [
        {scale: withSpring(isVisible ? 1 : 0.8)},
        {translateY: withSpring(isVisible ? 0 : -20)},
      ],
    };
  });

  const handleThemeToggle = () => {
    setIsTransitioning(true);
    toggleTheme();
  };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboard, recent, transactions, budget] = await Promise.all([
        getDashboardSummary(),
        getTransactions({limit: 5}),
        getTransactions(),
        getMonthlyBudget(getMonthKey(selectedReportMonth)),
      ]);

      setSummary(dashboard);
      setRecentTransactions(recent);
      setAllTransactions(transactions);
      setMonthlyBudget(budget);
    } catch (error) {
      console.log('Dashboard load error:', error);
      showMessage('Unable to refresh your dashboard.', 'error', 'Oops!');
    } finally {
      setLoading(false);
    }
  }, [selectedReportMonth, showMessage]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    BootSplash.hide({fade: true}).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadDashboard);
    return unsubscribe;
  }, [navigation, loadDashboard]);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        label:
          i === 0
            ? 'This Month'
            : d.toLocaleDateString('en-IN', {month: 'long'}),
        value: d.toISOString(),
        short:
          i === 0 ? 'Current' : d.toLocaleDateString('en-IN', {month: 'short'}),
      });
    }
    return options;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  // Updated to filter by the specific selected report month
  const reportData = useMemo(() => {
    const targetDate = new Date(selectedReportMonth);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    const filteredTransactions = allTransactions.filter(item => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getMonth() === targetMonth &&
        itemDate.getFullYear() === targetYear
      );
    });

    const categories = transactionOptions.reduce((accumulator, item) => {
      accumulator[item.type] = filteredTransactions
        .filter(entry => entry.type === item.type)
        .reduce((total, entry) => total + Number(entry.amount), 0);
      return accumulator;
    }, {});

    const income = ['income', 'salary'].reduce(
      (total, type) => total + categories[type],
      0,
    );
    const expenses = expenseTransactionTypes.reduce(
      (total, type) => total + categories[type],
      0,
    );

    const now = new Date();
    const spentToday = allTransactions
      .filter(item => {
        const itemDate = new Date(item.date);
        return (
          itemDate.toDateString() === now.toDateString() &&
          expenseTransactionTypes.includes(item.type)
        );
      })
      .reduce((total, item) => total + Number(item.amount), 0);

    return {
      categories,
      income,
      expenses,
      savings: categories.savings,
      totalAmount: expenses,
      spentToday,
    };
  }, [allTransactions, selectedReportMonth]);

  const statItems = [
    {label: 'Income', value: reportData.income, color: '#22C55E'},
    {label: 'Expenses', value: reportData.expenses, color: '#F97316'},
    {label: 'Savings', value: reportData.savings, color: '#8B5CF6'},
  ];

  const budgetProgress =
    monthlyBudget > 0
      ? Math.min(reportData.expenses / monthlyBudget, 1)
      : 0;
  const budgetRemaining = Math.max(monthlyBudget - reportData.expenses, 0);
  const budgetOverspend = Math.max(reportData.expenses - monthlyBudget, 0);

  // Calculate day-by-day consumption for the selected month
  const dailyConsumptionData = useMemo(() => {
    const targetDate = new Date(selectedReportMonth);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    // Initialize an array for all days in the month (1st to 28th/30th/31st)
    const days = Array.from({length: daysInMonth}, (_, i) => ({
      day: i + 1,
      value: 0,
    }));

    // Sum only expense categories for each day.
    allTransactions.forEach(item => {
      const itemDate = new Date(item.date);
      if (
        itemDate.getMonth() === targetMonth &&
        itemDate.getFullYear() === targetYear &&
        expenseTransactionTypes.includes(item.type)
      ) {
        const dayIndex = itemDate.getDate() - 1;
        days[dayIndex].value += Number(item.amount) || 0;
      }
    });

    return days;
  }, [allTransactions, selectedReportMonth]);

  // Find the max value to scale the bars properly
  const maxDailyValue = Math.max(...dailyConsumptionData.map(d => d.value), 1);

  // Find the array index for today (if we are viewing the current month)
  const todayIndex = useMemo(() => {
    const targetDate = new Date(selectedReportMonth);
    const now = new Date();
    if (
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getFullYear() === now.getFullYear()
    ) {
      return now.getDate() - 1;
    }
    return -1; // We are looking at a past/future month
  }, [selectedReportMonth]);

  // Auto-scroll to center today's date whenever the chart loads or month changes
  useEffect(() => {
    if (chartScrollRef.current && chartWidth > 0 && todayIndex !== -1) {
      const itemWidth = 38; // 24px width + 14px marginRight
      const centerOffset =
        todayIndex * itemWidth - chartWidth / 2 + itemWidth / 2;

      // Brief timeout ensures the ScrollView has fully rendered its content before moving
      setTimeout(() => {
        chartScrollRef.current?.scrollTo({
          x: Math.max(0, centerOffset),
          animated: true,
        });
      }, 300);
    }
  }, [todayIndex, chartWidth, dailyConsumptionData]);

  const handleOpenEntry = (item, isQuick = false) => {
    setSelectedItem(item);
    setIsQuickEntry(isQuick);
    setFormValue('');
    const now = new Date();
    setSelectedMonth(
      new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    );
    setSelectedDay(now.getDate());
    setModalVisible(true);
  };

  const handleAddTransaction = async () => {
    const amount = parseFloat(formValue);

    if (!amount || amount <= 0) {
      showMessage('Enter a valid amount.', 'warning', 'Alert');
      return;
    }

    try {
      // Incorporate the selected day into the ISO string
      const date = new Date(selectedMonth);
      date.setDate(selectedDay);

      await addTransaction({
        amount,
        type: selectedItem.type,
        date: date.toISOString(),
      });
      trigger('notificationSuccess', notificationOptions);
      setModalVisible(false);
      await loadDashboard();
      showMessage(`${selectedItem.name} saved.`, 'success', 'Success');
    } catch (error) {
      console.log('Add transaction error:', error);
      trigger('notificationError', notificationOptions);
      showMessage('Unable to save this entry.', 'error', 'Oops!');
    }
  };

  const handleSaveBudget = async () => {
    const amount = Number(budgetInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage('Enter a budget greater than zero.', 'warning', 'Alert');
      return;
    }

    try {
      await saveMonthlyBudget(getMonthKey(selectedReportMonth), amount);
      setMonthlyBudget(amount);
      setBudgetVisible(false);
      setBudgetInput('');
      showMessage('Monthly spending budget saved.', 'success', 'Success');
    } catch (error) {
      console.log('Budget save error:', error);
      showMessage('Unable to save this budget.', 'error', 'Oops!');
    }
  };

  const handleClearBudget = async () => {
    try {
      await saveMonthlyBudget(getMonthKey(selectedReportMonth), 0);
      setMonthlyBudget(0);
      showMessage('Monthly budget removed.', 'success', 'Success');
    } catch (error) {
      console.log('Budget removal error:', error);
      showMessage('Unable to remove this budget.', 'error', 'Oops!');
    }
  };

  const handleReset = async () => {
    if (resetPin !== '1009') {
      trigger('notificationError', notificationOptions);
      showMessage('Incorrect PIN.', 'error', 'Oops!');
      return;
    }

    try {
      await clearTransactions();
      trigger('impactHeavy', notificationOptions);
      setResetVisible(false);
      setResetPin('');
      await loadDashboard();
      showMessage('All entries cleared.', 'success', 'Success');
    } catch (error) {
      console.log('Reset error:', error);
      showMessage('Unable to clear entries.', 'error', 'Oops!');
    }
  };

  const handleExport = async () => {
    try {
      const dbName = 'transactions.db';
      const dbPath =
        Platform.OS === 'android'
          ? `/data/data/com.banky/databases/${dbName}`
          : `${RNFS.LibraryDirectoryPath}/LocalDatabase/${dbName}`;

      const exists = await RNFS.exists(dbPath);
      if (!exists) {
        showMessage('Database file not found.', 'warning', 'Alert');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const destPath = `${
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath
      }/Banky_Backup_${timestamp}.db`;

      await RNFS.copyFile(dbPath, destPath);
      showMessage(
        `Exported to ${
          Platform.OS === 'android' ? 'Downloads' : 'Documents'
        } folder.`,
        'success',
        'Success',
      );
    } catch (error) {
      console.log('Export error:', error);
      showMessage('Export failed.', 'error', 'Oops!');
    }
  };

  const handleImport = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      const pickedFile = res[0];
      if (!pickedFile.name.endsWith('.db')) {
        showMessage('Please select a valid .db file.', 'warning', 'Alert');
        return;
      }

      const dbName = 'transactions.db';
      const dbPath =
        Platform.OS === 'android'
          ? `/data/data/com.banky/databases/${dbName}`
          : `${RNFS.LibraryDirectoryPath}/LocalDatabase/${dbName}`;

      // Create databases folder if it doesn't exist (Android)
      if (Platform.OS === 'android') {
        const dbDir = '/data/data/com.banky/databases';
        const dirExists = await RNFS.exists(dbDir);
        if (!dirExists) {
          await RNFS.mkdir(dbDir);
        }
      }

      const fileContent = await RNFS.readFile(pickedFile.uri, 'base64');
      await closeDatabase();
      await RNFS.writeFile(dbPath, fileContent, 'base64');
      setBackupVisible(false);
      showMessage(
        'Database has been imported. Please restart the app for changes to take effect.',
        'success',
        'Import Successful',
      );
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled the picker
      } else {
        console.log('Import error:', err);
        showMessage('Import failed.', 'error', 'Oops!');
      }
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, {backgroundColor: colors.background}]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {isTransitioning && (
        <ThemeTransitionOverlay
          isDarkMode={isDarkMode}
          onAnimationComplete={() => setIsTransitioning(false)}
        />
      )}

      <Animated.View
        style={[
          styles.floatingTopPill,
          {
            backgroundColor: isDarkMode
              ? 'rgba(30, 41, 59, 0.85)'
              : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDarkMode
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(0, 0, 0, 0.05)',
          },
          floatingPillStyle,
        ]}>
        <Text style={[styles.floatingPillText, {color: colors.text}]}>
          Banky
        </Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={[styles.container, {backgroundColor: colors.background}]}
        contentContainerStyle={styles.content}>
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={styles.topHeader}>
          <Pressable
            delayLongPress={5000}
            onLongPress={() => {
              trigger('impactHeavy', notificationOptions);
              setBackupVisible(true);
            }}>
            <Text style={[styles.appTitle, {color: colors.text}]}>Banky</Text>
          </Pressable>
          <View style={styles.headerIcons}>
            <Pressable
              style={[
                styles.iconButton,
                {backgroundColor: colors.iconBackground},
              ]}
              onPress={handleThemeToggle}>
              <Icon
                name={isDarkMode ? 'light-mode' : 'dark-mode'}
                size={24}
                color={colors.text}
              />
            </Pressable>
            <Pressable
              style={[
                styles.iconButton,
                {backgroundColor: colors.iconBackground},
              ]}
              onPress={() => navigation.navigate('TransactionHistoryScreen')}>
              <Icon name="history" size={24} color={colors.text} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <LinearGradient
            colors={
              isDarkMode
                ? ['#10233D', '#0C1729', '#08101B']
                : ['#E2E8F0', '#F1F5F9', '#F8FAFC']
            }
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={[
              styles.heroCard,
              !isDarkMode && {borderWidth: 1, borderColor: colors.border},
            ]}>
            <Text style={[styles.balanceLabel, {color: colors.textMuted}]}>
              Available balance
            </Text>
            <Text style={[styles.balanceValue, {color: colors.text}]}>
              {formatCurrency(summary.balance)}
            </Text>

            <View style={styles.heroMetaRow}>
              <View>
                <Text style={[styles.metaLabel, {color: colors.textMuted}]}>
                  Entries logged
                </Text>
                <Text style={[styles.metaValue, {color: colors.text}]}>
                  {summary.transactionCount}
                </Text>
              </View>
              <View>
                <Text style={[styles.metaLabel, {color: colors.textMuted}]}>
                  Spent today
                </Text>
                <Text style={[styles.metaValue, {color: colors.text}]}>
                  {formatCurrency(reportData.spentToday)}
                </Text>
              </View>
            </View>

            <View style={styles.heroActions}>
              <Pressable
                style={[
                  styles.primaryAction,
                  {backgroundColor: colors.buttonBackground},
                ]}
                onPress={() => handleOpenEntry(transactionOptions[0], false)}>
                <Icon
                  name="add"
                  size={18}
                  color={isDarkMode ? '#0B1220' : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.primaryActionText,
                    {color: isDarkMode ? '#0B1220' : '#FFFFFF'},
                  ]}>
                  New entry
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryAction,
                  {
                    borderColor: isDarkMode
                      ? 'rgba(217, 231, 255, 0.2)'
                      : 'rgba(15, 23, 42, 0.1)',
                  },
                ]}
                onLongPress={() => setResetVisible(true)}>
                <Icon
                  name="lock-reset"
                  size={18}
                  color={isDarkMode ? '#D9E7FF' : colors.text}
                />
                <Text
                  style={[
                    styles.secondaryActionText,
                    {color: isDarkMode ? '#D9E7FF' : colors.text},
                  ]}>
                  Hold to reset
                </Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(300).duration(500)}
          style={styles.statsGrid}>
          {statItems.map(item => (
            <View
              key={item.label}
              style={[
                styles.statCardGrid,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: isDarkMode ? 0 : 1,
                },
              ]}>
              <View style={styles.statLabelRow}>
                <View
                  style={[styles.statDot, {backgroundColor: item.color}]}
                />
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>
                  {item.label}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.statValue, {color: colors.text}]}>
                {formatCurrency(item.value)}
              </Text>
              <Text style={[styles.statPeriod, {color: colors.textMuted}]}>
                {new Date(selectedReportMonth).toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(350).duration(500)}
          style={[
            styles.budgetCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: isDarkMode ? 0 : 1,
            },
          ]}>
          <View style={styles.budgetHeader}>
            <View style={styles.budgetTitleGroup}>
              <View
                style={[
                  styles.budgetIcon,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(34, 197, 94, 0.14)'
                      : '#DCFCE7',
                  },
                ]}>
                <Icon name="track-changes" size={20} color="#22C55E" />
              </View>
              <View>
                <Text style={[styles.budgetTitle, {color: colors.text}]}>
                  Monthly budget
                </Text>
                <Text style={[styles.budgetSubtitle, {color: colors.textMuted}]}>
                  {new Date(selectedReportMonth).toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                monthlyBudget > 0 ? 'Edit monthly budget' : 'Set monthly budget'
              }
              style={[
                styles.budgetAction,
                {backgroundColor: colors.iconBackground},
              ]}
              onPress={() => {
                setBudgetInput(monthlyBudget > 0 ? String(monthlyBudget) : '');
                setBudgetVisible(true);
              }}>
              <Icon
                name={monthlyBudget > 0 ? 'edit' : 'add'}
                size={18}
                color={colors.text}
              />
            </Pressable>
          </View>
          {monthlyBudget > 0 ? (
            <>
              <View style={styles.budgetAmountRow}>
                <Text style={[styles.budgetSpent, {color: colors.text}]}>
                  {formatCurrency(reportData.expenses)}
                </Text>
                <Text style={[styles.budgetLimit, {color: colors.textMuted}]}>
                  of {formatCurrency(monthlyBudget)}
                </Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(budgetProgress * 100),
                }}
                style={[
                  styles.budgetTrack,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                  },
                ]}>
                <View
                  style={[
                    styles.budgetFill,
                    {
                      width: `${budgetProgress * 100}%`,
                      backgroundColor:
                        budgetProgress >= 1
                          ? '#EF4444'
                          : budgetProgress >= 0.8
                          ? '#F59E0B'
                          : '#22C55E',
                    },
                  ]}
                />
              </View>
              <View style={styles.budgetFooter}>
                <Text style={[styles.budgetSubtitle, {color: colors.textMuted}]}>
                  {Math.round(budgetProgress * 100)}% used
                </Text>
                <Text
                  style={[
                    styles.budgetSubtitle,
                    {
                      color:
                        budgetOverspend > 0
                          ? '#EF4444'
                          : colors.textMuted,
                    },
                  ]}>
                  {budgetOverspend > 0
                    ? `${formatCurrency(budgetOverspend)} over budget`
                    : budgetRemaining > 0
                    ? `${formatCurrency(budgetRemaining)} remaining`
                    : 'Budget reached'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={handleClearBudget}
                style={styles.clearBudgetButton}>
                <Text style={[styles.clearBudgetText, {color: colors.textMuted}]}>
                  Remove budget
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.budgetEmpty, {color: colors.textMuted}]}>
              Set a monthly limit to track spending and stay on plan.
            </Text>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>
            Quick entry
          </Text>
          <Text style={[styles.sectionHint, {color: colors.textMuted}]}>
            Log income, spending, and savings from one place.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          style={styles.grid}>
          {transactionOptions.map(item => (
            <Pressable
              key={item.type}
              style={[
                styles.gridCard,
                {
                  backgroundColor: colors.surface,
                  borderWidth: isDarkMode ? 0 : 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleOpenEntry(item, true)}>
              <View style={[styles.iconBadge, {backgroundColor: item.accent}]}>
                <Icon name={item.icon} size={20} color="#0F172A" />
              </View>
              <Text style={[styles.gridTitle, {color: colors.text}]}>
                {item.name}
              </Text>
              <Text style={[styles.gridSubtitle, {color: colors.textMuted}]}>
                Tap to add amount
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(600).duration(500)}
          style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>
              Report
            </Text>
            <Text style={[styles.sectionHint, {color: colors.textMuted}]}>
              Monthly spending breakdown.
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(700).duration(500)}
          style={[
            styles.reportCard,
            {
              backgroundColor: colors.surface,
              borderWidth: isDarkMode ? 0 : 1,
              borderColor: colors.border,
            },
          ]}>
          {/* Three Selection Pills */}
          <View
            style={[
              styles.reportPillContainer,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}>
            {monthOptions.map(m => {
              const isSelected = selectedReportMonth === m.value;
              return (
                <Pressable
                  key={m.value}
                  style={[
                    styles.reportMonthPill,
                    isSelected && {backgroundColor: colors.buttonBackground},
                  ]}
                  onPress={() => setSelectedReportMonth(m.value)}>
                  <Text
                    style={[
                      styles.reportMonthText,
                      isSelected
                        ? {color: isDarkMode ? '#0B1220' : '#FFFFFF'}
                        : {color: colors.textMuted},
                    ]}>
                    {m.short}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <DonutChart
            data={transactionOptions
              .map(t => ({
                ...t,
                value: reportData.categories[t.type] || 0,
                color: t.accent,
              }))
              .filter(
                t =>
                  expenseTransactionTypes.includes(t.type) && t.value > 0,
              )}
            total={reportData.totalAmount}
          />
          <View style={{marginTop: 16}}>
            {transactionOptions
              .filter(item => expenseTransactionTypes.includes(item.type))
              .map(item => (
                <View
                  key={item.type}
                  style={[
                    styles.reportRow,
                    {
                      borderBottomColor: isDarkMode
                        ? 'rgba(148, 163, 184, 0.12)'
                        : 'rgba(15, 23, 42, 0.05)',
                    },
                  ]}>
                  <View
                    style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: item.accent,
                        marginRight: 8,
                      }}
                    />
                    <Text
                      style={[
                        styles.reportLabel,
                        {color: isDarkMode ? '#CBD5E1' : '#475569'},
                      ]}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={[styles.reportValue, {color: colors.text}]}>
                    {formatCurrency(reportData.categories[item.type])}
                  </Text>
                </View>
              ))}
          </View>
        </Animated.View>

        {/* --- DAILY CONSUMPTION CHART --- */}
        <Animated.View
          entering={FadeInDown.delay(750).duration(500)}
          style={[
            styles.reportCard,
            {
              backgroundColor: colors.surface,
              borderWidth: isDarkMode ? 0 : 1,
              borderColor: colors.border,
            },
          ]}>
          <Text
            style={[
              styles.reportLabel,
              {color: colors.text, marginBottom: 16, fontWeight: '700'},
            ]}>
            Daily Consumption
          </Text>

          <ScrollView
            ref={chartScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onLayout={event => setChartWidth(event.nativeEvent.layout.width)}
            contentContainerStyle={{
              alignItems: 'flex-end',
              paddingBottom: 8,
              paddingRight: 16,
              paddingTop: 30, // Added padding so the tooltip doesn't get clipped
            }}>
            {dailyConsumptionData.map((item, index) => {
              const heightPercent =
                item.value > 0
                  ? Math.max((item.value / maxDailyValue) * 100, 4)
                  : 0;

              const isToday = todayIndex === index;
              const isSelected = selectedBarIndex === index;

              return (
                <Pressable
                  key={index}
                  onPress={() => setSelectedBarIndex(isSelected ? null : index)}
                  style={{
                    alignItems: 'center',
                    marginRight: 14,
                    width: 24,
                    position: 'relative',
                  }}>
                  {/* Tooltip showing the exact amount when tapped */}
                  {isSelected && item.value > 0 && (
                    <Animated.View
                      entering={FadeInDown.duration(200)}
                      style={{
                        position: 'absolute',
                        top: -30,
                        backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        zIndex: 10,
                        minWidth: 50,
                        alignItems: 'center',
                      }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isDarkMode ? '#F8FAFC' : '#0F172A',
                        }}>
                        {formatCurrency(item.value).replace('Rs ', '₹')}
                      </Text>
                    </Animated.View>
                  )}

                  <View
                    style={{
                      height: 120, // Max height of the bar chart
                      width: 8,
                      backgroundColor: isDarkMode
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.05)',
                      borderRadius: 4,
                      justifyContent: 'flex-end',
                    }}>
                    <Animated.View
                      style={{
                        height: `${heightPercent}%`,
                        width: '100%',
                        backgroundColor: isToday
                          ? '#C4B5FD' // Highlight today
                          : item.value > 0
                          ? isDarkMode
                            ? '#94A3B8'
                            : '#64748B'
                          : 'transparent',
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      color: isToday ? colors.text : colors.textMuted,
                      fontWeight: isToday ? '800' : '500',
                    }}>
                    {item.day}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
        {/* --- END DAILY CONSUMPTION CHART --- */}

        <Animated.View
          entering={FadeInDown.delay(800).duration(500)}
          style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>
            Recent activity
          </Text>
          <Text style={[styles.sectionHint, {color: colors.textMuted}]}>
            {loading ? 'Refreshing entries...' : 'Latest five transactions.'}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(900).duration(500)}
          style={[
            styles.listCard,
            {
              backgroundColor: colors.surface,
              borderWidth: isDarkMode ? 0 : 1,
              borderColor: colors.border,
            },
          ]}>
          {recentTransactions.length === 0 ? (
            <Text style={[styles.emptyState, {color: colors.textMuted}]}>
              No entries yet. Start by adding your first amount.
            </Text>
          ) : (
            recentTransactions.map(item => (
              <View
                key={item.id}
                style={[
                  styles.listRow,
                  {
                    borderBottomColor: isDarkMode
                      ? 'rgba(148, 163, 184, 0.12)'
                      : 'rgba(15, 23, 42, 0.05)',
                  },
                ]}>
                <View>
                  <Text style={[styles.listTitle, {color: colors.text}]}>
                    {item.type.toUpperCase()}
                  </Text>
                  <Text
                    style={[styles.listSubtitle, {color: colors.textMuted}]}>
                    {formatDate(item.date)}
                  </Text>
                </View>
                <Text style={[styles.listAmount, {color: colors.text}]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))
          )}
        </Animated.View>

        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, {color: colors.textMuted}]}>
            v{version}
          </Text>
        </View>
      </Animated.ScrollView>

      {/* FIXED NEW ENTRY MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCardEnhanced,
              {backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF'},
            ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleEnhanced, {color: colors.text}]}>
                New entry
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingBottom: 20}}>
              <Text style={[styles.modalLabel, {color: colors.textMuted}]}>
                Select period
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.pillContainer,
                  {marginBottom: 10},
                ]}>
                {monthOptions.map(m => (
                  <Pressable
                    key={m.value}
                    onPress={() => {
                      setSelectedMonth(m.value);
                      const maxDays = new Date(
                        new Date(m.value).getFullYear(),
                        new Date(m.value).getMonth() + 1,
                        0,
                      ).getDate();
                      if (selectedDay > maxDays) {
                        setSelectedDay(maxDays);
                      }
                    }}
                    style={[
                      styles.monthPill,
                      {borderColor: colors.border},
                      selectedMonth === m.value && {
                        backgroundColor: colors.buttonBackground,
                        borderColor: colors.buttonBackground,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.pillText,
                        {color: colors.text},
                        selectedMonth === m.value && {
                          color: isDarkMode ? '#0B1220' : '#FFFFFF',
                        },
                      ]}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {!isQuickEntry && (
                <>
                  <Text
                    style={[
                      styles.modalLabel,
                      {color: colors.textMuted, marginTop: 4},
                    ]}>
                    Select date
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                      styles.pillContainer,
                      {marginBottom: 10},
                    ]}>
                    {Array.from(
                      {
                        length: new Date(
                          new Date(selectedMonth).getFullYear(),
                          new Date(selectedMonth).getMonth() + 1,
                          0,
                        ).getDate(),
                      },
                      (_, i) => i + 1,
                    ).map(day => (
                      <Pressable
                        key={day}
                        onPress={() => setSelectedDay(day)}
                        style={[
                          styles.dayPill,
                          {borderColor: colors.border},
                          selectedDay === day && {
                            backgroundColor: colors.buttonBackground,
                            borderColor: colors.buttonBackground,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.pillText,
                            {color: colors.text},
                            selectedDay === day && {
                              color: isDarkMode ? '#0B1220' : '#FFFFFF',
                            },
                          ]}>
                          {day}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              {!isQuickEntry && (
                <>
                  <Text
                    style={[
                      styles.modalLabel,
                      {color: colors.textMuted, marginTop: 14},
                    ]}>
                    Entry type
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                    }}>
                    {transactionOptions.map(item => {
                      const isSelected = selectedItem.type === item.type;
                      return (
                        <Pressable
                          key={item.type}
                          onPress={() => setSelectedItem(item)}
                          style={[
                            styles.typePill,
                            {
                              borderColor: item.accent,
                              width: '32%',
                              marginBottom: 10,
                              justifyContent: 'center',
                            },
                            isSelected && {backgroundColor: item.accent},
                          ]}>
                          <Icon
                            name={item.icon}
                            size={16}
                            color={isSelected ? '#0F172A' : item.accent}
                            style={{marginRight: 6}}
                          />
                          <Text
                            style={[
                              styles.pillText,
                              {color: item.accent},
                              isSelected && {color: '#0F172A'},
                            ]}>
                            {item.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.modalLabel, {color: colors.textMuted}]}>
                How much?
              </Text>
              <View
                style={[
                  styles.amountContainer,
                  {borderBottomColor: colors.border},
                ]}>
                <Text style={[styles.currencySign, {color: colors.text}]}>
                  Rs
                </Text>
                <TextInput
                  value={formValue}
                  onChangeText={setFormValue}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.amountInputEnhanced, {color: colors.text}]}
                  autoFocus
                />
              </View>

              <Pressable
                style={[
                  styles.modalPrimaryAction,
                  {backgroundColor: colors.buttonBackground},
                ]}
                onPress={handleAddTransaction}>
                <Text
                  style={[
                    styles.modalPrimaryTextEnhanced,
                    {color: isDarkMode ? '#0B1220' : '#FFFFFF'},
                  ]}>
                  Confirm and save
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={budgetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBudgetVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <View
            style={[
              styles.budgetModal,
              {backgroundColor: colors.surface},
            ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleEnhanced, {color: colors.text}]}>
                Set monthly budget
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close budget form"
                onPress={() => setBudgetVisible(false)}>
                <Icon name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.budgetModalHint, {color: colors.textMuted}]}>
              Spending limit for{' '}
              {new Date(selectedReportMonth).toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
              })}
              .
            </Text>
            <View
              style={[
                styles.amountContainer,
                {borderBottomColor: colors.border},
              ]}>
              <Text style={[styles.currencySign, {color: colors.text}]}>Rs</Text>
              <TextInput
                accessibilityLabel="Monthly spending limit"
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={[styles.amountInputEnhanced, {color: colors.text}]}
              />
            </View>
            <Pressable
              style={[
                styles.modalPrimaryAction,
                {backgroundColor: colors.buttonBackground},
              ]}
              onPress={handleSaveBudget}>
              <Text
                style={[
                  styles.modalPrimaryTextEnhanced,
                  {color: isDarkMode ? '#0B1220' : '#FFFFFF'},
                ]}>
                Save budget
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={resetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetVisible(false)}>
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: isDarkMode
                ? 'rgba(3, 7, 18, 0.72)'
                : 'rgba(15, 23, 42, 0.4)',
            },
          ]}>
          <View
            style={[
              styles.resetCard,
              {backgroundColor: isDarkMode ? '#111827' : colors.surface},
            ]}>
            <Text style={[styles.resetTitle, {color: colors.text}]}>
              Reset all data
            </Text>
            <Text style={[styles.resetSubtitle, {color: colors.textMuted}]}>
              Enter the 4-digit PIN to delete every transaction.
            </Text>
            <TextInput
              value={resetPin}
              onChangeText={setResetPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="PIN"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.pinInput,
                {
                  backgroundColor: isDarkMode
                    ? 'rgba(148, 163, 184, 0.12)'
                    : 'rgba(15, 23, 42, 0.05)',
                  color: colors.text,
                },
              ]}
            />
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Delete everything</Text>
            </Pressable>
            <Pressable
              style={styles.modalSecondary}
              onPress={() => setResetVisible(false)}>
              <Text
                style={[styles.modalSecondaryText, {color: colors.textMuted}]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={backupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBackupVisible(false)}>
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: isDarkMode
                ? 'rgba(3, 7, 18, 0.72)'
                : 'rgba(15, 23, 42, 0.4)',
            },
          ]}>
          <View
            style={[
              styles.modalCardEnhanced,
              {backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF'},
            ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleEnhanced, {color: colors.text}]}>
                Manage Database
              </Text>
              <Pressable onPress={() => setBackupVisible(false)}>
                <Icon name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text
              style={[
                styles.resetSubtitle,
                {color: colors.textMuted, marginBottom: 30},
              ]}>
              Export your transaction history to a .db file or import an
              existing backup.
            </Text>

            <Pressable
              style={[
                styles.modalPrimaryAction,
                {backgroundColor: colors.buttonBackground},
              ]}
              onPress={handleExport}>
              <Text
                style={[
                  styles.modalPrimaryTextEnhanced,
                  {color: isDarkMode ? '#0B1220' : '#FFFFFF'},
                ]}>
                Export to Storage
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.modalPrimaryAction,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                  marginBottom: 12,
                },
              ]}
              onPress={handleImport}>
              <Text
                style={[styles.modalPrimaryTextEnhanced, {color: colors.text}]}>
                Import from File
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  heroCard: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 20,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  metaLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  metaValue: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '700',
  },
  heroActions: {
    flexDirection: 'row',
  },
  primaryAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  primaryActionText: {
    color: '#0B1220',
    fontWeight: '800',
    marginLeft: 8,
  },
  secondaryAction: {
    paddingHorizontal: 16,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 231, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryActionText: {
    color: '#D9E7FF',
    fontWeight: '700',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCardGrid: {
    width: '31.5%',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  statPeriod: {
    fontSize: 10,
    marginTop: 5,
  },
  budgetCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  budgetTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  budgetTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  budgetSubtitle: {
    fontSize: 12,
  },
  budgetAction: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  budgetSpent: {
    fontSize: 23,
    fontWeight: '800',
    marginRight: 6,
  },
  budgetLimit: {
    fontSize: 13,
  },
  budgetTrack: {
    height: 9,
    borderRadius: 6,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 6,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  budgetEmpty: {
    fontSize: 13,
    lineHeight: 20,
  },
  clearBudgetButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 4,
  },
  clearBudgetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  budgetModal: {
    borderRadius: 28,
    padding: 24,
  },
  budgetModalHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -12,
    marginBottom: 14,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  /* NEW REPORT PILLS STYLES */
  reportPillContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  reportMonthPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  reportMonthText: {
    fontSize: 13,
    fontWeight: '700',
  },

  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHint: {
    color: '#94A3B8',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#0D192B',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  gridTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  gridSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  reportCard: {
    backgroundColor: '#0D192B',
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  reportLabel: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  reportValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  listCard: {
    backgroundColor: '#0D192B',
    borderRadius: 24,
    padding: 18,
  },
  emptyState: {
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 18,
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  listTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  listSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  listAmount: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },

  /* MODAL UPDATES FOR CENTERED LAYOUT */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCardEnhanced: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32, // Fixed: Makes it fully rounded and centered
    padding: 24,
    maxHeight: '90%', // Fixed: Allows scroll to actually kick in
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },

  resetCard: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 24,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  amountInput: {
    backgroundColor: '#E2E8F0',
    borderRadius: 18,
    fontSize: 34,
    color: '#0F172A',
    textAlign: 'center',
    fontWeight: '800',
    paddingVertical: 18,
    marginBottom: 16,
  },
  modalPrimary: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPrimaryText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 15,
  },
  modalSecondary: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSecondaryText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 15,
  },
  pinInput: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 18,
    fontSize: 28,
    color: '#F8FAFC',
    textAlign: 'center',
    fontWeight: '800',
    paddingVertical: 16,
    marginBottom: 16,
  },
  resetButton: {
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  resetButtonText: {
    color: '#FFF7ED',
    fontWeight: '800',
    fontSize: 15,
  },
  resetTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  resetSubtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitleEnhanced: {
    fontSize: 22,
    fontWeight: '800',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  pillContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  monthPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  dayPill: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    marginBottom: 32,
    paddingVertical: 10,
  },
  currencySign: {
    fontSize: 28,
    fontWeight: '800',
    marginRight: 10,
  },
  amountInputEnhanced: {
    fontSize: 42,
    fontWeight: '800',
    flex: 1,
    padding: 0,
  },
  modalPrimaryAction: {
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  modalPrimaryTextEnhanced: {
    fontSize: 16,
    fontWeight: '800',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  floatingTopPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 20,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  floatingPillText: {
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 5,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default HomeScreen;
