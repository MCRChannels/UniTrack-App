import React, { useContext, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TouchableWithoutFeedback } from 'react-native';
import { EventContext } from '../context/eventContext';
import { ExamContext } from '../context/examContext';
import { UserContext } from '../context/userContext';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";

// หน้าจอหลัก (Dashboard) แสดงข้อมูลสรุปตารางเรียน สอบ และกิจกรรมต่างๆ
const DashBoardScreen = ({ navigation }) => {
    const { events } = useContext(EventContext);
    const { exams } = useContext(ExamContext);
    const { currentUser } = useContext(UserContext);

    // --- States ---
    const [timeFilter, setTimeFilter] = useState('today'); // 'today', 'week', 'month'
    const [activeTab, setActiveTab] = useState('classes'); // 'classes', 'exams', 'activities'
    const [activities, setActivities] = useState([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [isFabMenuVisible, setIsFabMenuVisible] = useState(false);
    const [contextReady, setContextReady] = useState(false); // True once context has loaded at least once
    const [currentTime, setCurrentTime] = useState(new Date());

    // Mark context as ready when we receive data from login dispatch
    useEffect(() => {
        if (currentUser?.id) {
            // Give context a moment to receive dispatched data from LoginScreen, then mark ready
            const timer = setTimeout(() => setContextReady(true), 800);
            return () => clearTimeout(timer);
        }
    }, [currentUser?.id]);

    // Update current time every minute to refresh "Next Class" status
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // 1 minute
        return () => clearInterval(timer);
    }, []);

    const isLoading = !contextReady || loadingActivities;

    // --- Date Helpers ---
    const getStartOfDay = (date = new Date()) => new Date(date.setHours(0, 0, 0, 0));
    const getEndOfDay = (date = new Date()) => new Date(date.setHours(23, 59, 59, 999));

    const getStartOfNextWeek = (date = new Date()) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 7; // Next Monday
        return getStartOfDay(new Date(d.setDate(diff)));
    };
    const getEndOfNextWeek = (date = new Date()) => {
        const start = getStartOfNextWeek(date);
        return getEndOfDay(new Date(start.setDate(start.getDate() + 6)));
    };

    const getStartOfNextMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const getEndOfNextMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth() + 2, 0, 23, 59, 59, 999);

    // ฟังก์ชันช่วยแปลงรูปแบบข้อมูลวันที่ (Date) ให้เอาไปใช้งานได้ง่ายขึ้น
    const parseCustomDate = (dateString) => {
        if (!dateString) return null; // FIX: If no date provided, don't fall back to "today"

        // Handle "DD/MM/YYYY" or "YYYY-MM-DD" (Exams format)
        if (dateString.includes('/')) {
            const parts = dateString.split('/');
            // Assumes DD/MM/YYYY
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        } else if (dateString.includes('-')) {
            return new Date(dateString);
        }

        // Handle "15 มี.ค. 2026" (Activities format)
        const parts = dateString.split(' ');
        if (parts.length === 3) {
            const dayStr = parts[0];
            const monthStr = parts[1];
            const yearStr = parts[2];

            const day = parseInt(dayStr, 10);
            const year = parseInt(yearStr, 10) > 2500 ? parseInt(yearStr, 10) - 543 : parseInt(yearStr, 10); // Handle Buddhist year just in case

            const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const month = thaiMonths.findIndex(m => m === monthStr);

            return new Date(year, month !== -1 ? month : 0, day);
        }

        return new Date(dateString); // Fallback
    };

    // --- Load Activities (Real-time) ---
    useEffect(() => {
        let unsubscribe = () => { };

        const setupListener = (uid) => {
            if (!uid) return;
            setLoadingActivities(true);
            unsubscribe = onSnapshot(collection(db, "users", uid, "activities"), (snap) => {
                const loaded = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                // Parse date for filtering
                const withDateObj = loaded.map(item => ({
                    ...item,
                    dateObj: parseCustomDate(item.dateLabel || item.date)
                }));
                setActivities(withDateObj);
                setLoadingActivities(false);
            }, (error) => {
                console.log("Load dashboard activities error:", error);
                setLoadingActivities(false);
            });
        };

        const uid = currentUser?.id || auth.currentUser?.uid;
        if (uid) {
            setupListener(uid);
        } else {
            const authUnsub = onAuthStateChanged(auth, (user) => {
                if (user) setupListener(user.uid);
            });
            return () => {
                unsubscribe();
                authUnsub();
            };
        }

        return () => unsubscribe();
    }, [currentUser?.id]);

    // --- Filter Logic ---
    let filterStart, filterEnd, filterDays;
    const now = new Date();

    if (timeFilter === 'today') {
        filterStart = getStartOfDay(now);
        filterEnd = getEndOfDay(now);
        // Map JS day index to our day mapping
        const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        filterDays = [dayMap[now.getDay()]];
    } else if (timeFilter === 'week') {
        filterStart = getStartOfNextWeek(now);
        filterEnd = getEndOfNextWeek(now);
        filterDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    } else { // month
        filterStart = getStartOfNextMonth(now);
        filterEnd = getEndOfNextMonth(now);
        filterDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // Events repeat every week
    }

    // Filter Classes
    const filteredClasses = events.filter(e => filterDays.includes(e.day)).sort((a, b) => {
        const [h1, m1] = a.startTime.split(':').map(Number);
        const [h2, m2] = b.startTime.split(':').map(Number);
        return (h1 * 60 + m1) - (h2 * 60 + m2);
    });

    // Filter Exams
    const filteredExams = exams.filter(e => {
        if (!e.date) return false;
        const examDate = parseCustomDate(e.date);
        return examDate >= filterStart && examDate <= filterEnd;
    }).sort((a, b) => parseCustomDate(a.date) - parseCustomDate(b.date));

    // Filter Activities
    const filteredActivities = activities.filter(a => {
        if (!a.dateObj) return false;
        return a.dateObj >= filterStart && a.dateObj <= filterEnd;
    }).sort((a, b) => a.dateObj - b.dateObj);

    // --- Next Class Logic ---
    // ฟังก์ชันคำนวณหาวิชาเรียนถัดไป ที่ต้องเรียนในวันนี้
    const getNextClassInfo = () => {
        if (!events || events.length === 0) return { status: 'ยังไม่มีวิชาเรียน', class: null, active: false, empty: true };
        const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const nowTime = currentTime; // Use state-based time for reactivity
        const today = dayMap[nowTime.getDay()];
        const currentMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();

        // Get all classes today and sort by start time
        const todaysClasses = events.filter(e => e.day === today).sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
        });

        // 1. Ongoing?
        const ongoing = todaysClasses.find(e => {
            const [sH, sM] = e.startTime.split(':').map(Number);
            const [eH, eM] = e.endTime.split(':').map(Number);
            const start = sH * 60 + sM;
            const end = eH * 60 + eM;
            return currentMinutes >= start && currentMinutes <= end;
        });
        if (ongoing) return { status: 'กำลังเรียนอยู่', class: ongoing, active: true };

        // 2. Next class today?
        const next = todaysClasses.find(e => {
            const [sH, sM] = e.startTime.split(':').map(Number);
            const start = sH * 60 + sM;
            return start > currentMinutes;
        });
        if (next) return { status: 'วิชาถัดไป', class: next, active: false };

        // 3. Tomorrow's first class? (Look ahead for display in 'no more' state)
        const tomorrowIndex = (nowTime.getDay() + 1) % 7;
        const tomorrow = dayMap[tomorrowIndex];
        const nextClassesTomorrow = events.filter(e => e.day === tomorrow).sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
        });

        return {
            status: 'ไม่มีเรียนแล้ว',
            class: null,
            active: false,
            tomorrowClass: nextClassesTomorrow.length > 0 ? nextClassesTomorrow[0] : null
        };
    };

    const nextClassInfo = getNextClassInfo();

    // --- Render Helpers ---
    // ฟังก์ชันสร้าง UI การ์ดแสดงวิชาเรียนถัดไป
    const renderNextClassCard = () => {
        if (!nextClassInfo) return null;
        const { status, class: item, active, tomorrowClass, empty } = nextClassInfo;

        if (empty) {
            // "No classes at all" state
            return (
                <View style={[styles.nextClassCard, { backgroundColor: '#fff', borderWidth: 2, borderColor: '#006664', borderStyle: 'dashed', shadowOpacity: 0.05, elevation: 1 }]}>
                    <View style={styles.nextClassHeader}>
                        <View style={[styles.statusBadge, { backgroundColor: '#F0FFF4' }]}>
                            <View style={[styles.statusDot, { backgroundColor: '#38A169' }]} />
                            <Text style={[styles.statusText, { color: '#2F855A' }]}>{status}</Text>
                        </View>
                        <Ionicons name="book-outline" size={18} color="#006664" />
                    </View>
                    <View style={styles.nextClassBody}>
                        <Text style={[styles.nextClassTitle, { color: '#006664', fontSize: 20 }]}>เริ่มต้นจัดการตารางเรียน</Text>
                        <TouchableOpacity
                            style={{
                                marginTop: 15,
                                backgroundColor: '#006664',
                                paddingVertical: 10,
                                paddingHorizontal: 20,
                                borderRadius: 12,
                                alignSelf: 'flex-start',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8
                            }}
                            onPress={() => navigation.navigate('TimeTableScreen', { screen: 'Create' })}
                        >
                            <Text style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>เริ่มเพิ่มวิชาเรียน</Text>
                            <Ionicons name="add" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        if (!item) {
            // "No more classes today" state
            return (
                <View style={[styles.nextClassCard, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', shadowOpacity: 0.05, elevation: 1 }]}>
                    <View style={styles.nextClassHeader}>
                        <View style={[styles.statusBadge, { backgroundColor: '#E2E8F0' }]}>
                            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                            <Text style={[styles.statusText, { color: '#64748B' }]}>{status}</Text>
                        </View>
                        <Ionicons name="sunny-outline" size={18} color="#D97706" />
                    </View>
                    <View style={styles.nextClassBody}>
                        <Text style={[styles.nextClassTitle, { color: '#1E293B', fontSize: 20 }]}>เย่! วันนี้ไม่มีเรียนแล้ว</Text>

                        {tomorrowClass ? (
                            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EDF2F7' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <View style={{ width: 4, height: 12, backgroundColor: '#006664', borderRadius: 2 }} />
                                    <Text style={{ fontSize: 12, color: '#006664', fontWeight: 'bold' }}>พรุ่งนี้เริ่มเรียนวิชา:</Text>
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2D3748', marginBottom: 4 }}>{tomorrowClass.title}</Text>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="time-outline" size={12} color="#718096" />
                                        <Text style={{ fontSize: 12, color: '#718096' }}>{tomorrowClass.startTime} - {tomorrowClass.endTime}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="location-outline" size={12} color="#718096" />
                                        <Text style={{ fontSize: 12, color: '#718096' }}>{tomorrowClass.roomNumber || 'N/A'}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                onPress={() => navigation.navigate('TimeTableScreen', { screen: 'Create' })}
                            >
                                <Text style={{ fontSize: 14, color: '#006664', fontWeight: 'bold' }}>เพิ่มวิชาเรียนใหม่</Text>
                                <Ionicons name="add-circle" size={16} color="#006664" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            );
        }

        return (
            <TouchableOpacity
                style={styles.nextClassCard}
                onPress={() => navigation.navigate('TimeTableScreen')}
                activeOpacity={0.9}
            >
                <View style={styles.nextClassHeader}>
                    <View style={[styles.statusBadge, active && styles.statusBadgeActive]}>
                        <View style={[styles.statusDot, active && styles.statusDotActive]} />
                        <Text style={[styles.statusText, active && styles.statusTextActive]}>{status}</Text>
                    </View>
                    <Ionicons name="notifications-outline" size={18} color="#fff" />
                </View>

                <View style={styles.nextClassBody}>
                    <Text style={styles.nextClassTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.nextClassInfoRow}>
                        <View style={styles.nextClassInfoItem}>
                            <Ionicons name="time" size={16} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.nextClassInfoText}>{item.startTime} - {item.endTime}</Text>
                        </View>
                        <View style={styles.nextClassInfoItem}>
                            <Ionicons name="pin" size={16} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.nextClassInfoText}>{item.roomNumber || 'N/A'}</Text>
                        </View>
                    </View>
                </View>

                {/* Decorative glow background element */}
                <View style={styles.nextClassGlow} />
            </TouchableOpacity>
        );
    };

    const renderFilterTabs = () => (
        <View style={styles.timeFilterContainer}>
            <TouchableOpacity
                style={[styles.timeFilterBtn, timeFilter === 'today' && styles.timeFilterBtnActive]}
                onPress={() => setTimeFilter('today')}
            >
                <Text style={[styles.timeFilterText, timeFilter === 'today' && styles.timeFilterTextActive]}>วันนี้</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.timeFilterBtn, timeFilter === 'week' && styles.timeFilterBtnActive]}
                onPress={() => setTimeFilter('week')}
            >
                <Text style={[styles.timeFilterText, timeFilter === 'week' && styles.timeFilterTextActive]}>สัปดาห์หน้า</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.timeFilterBtn, timeFilter === 'month' && styles.timeFilterBtnActive]}
                onPress={() => setTimeFilter('month')}
            >
                <Text style={[styles.timeFilterText, timeFilter === 'month' && styles.timeFilterTextActive]}>เดือนหน้า</Text>
            </TouchableOpacity>
        </View>
    );

    const renderSummaryCards = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: 'rgba(0,102,100,0.1)' }]}>
                    <Ionicons name="book" size={20} color="#006664" />
                </View>
                <View>
                    <Text style={styles.summaryNumber}>{filteredClasses.length}</Text>
                    <Text style={styles.summaryLabel}>คลาส</Text>
                </View>
            </View>
            <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: 'rgba(162,59,114,0.1)' }]}>
                    <Ionicons name="document-text" size={20} color="#A23B72" />
                </View>
                <View>
                    <Text style={styles.summaryNumber}>{filteredExams.length}</Text>
                    <Text style={styles.summaryLabel}>สอบ</Text>
                </View>
            </View>
            <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: 'rgba(46,134,171,0.1)' }]}>
                    <Ionicons name="flag" size={20} color="#2E86AB" />
                </View>
                <View>
                    <Text style={styles.summaryNumber}>{filteredActivities.length}</Text>
                    <Text style={styles.summaryLabel}>กิจกรรม</Text>
                </View>
            </View>
        </View>
    );

    const renderCategoryTabs = () => (
        <View style={styles.categoryTabs}>
            <TouchableOpacity
                style={[styles.categoryTab, activeTab === 'classes' && styles.categoryTabActive]}
                onPress={() => setActiveTab('classes')}
            >
                <Ionicons name="school" size={18} color={activeTab === 'classes' ? '#006664' : '#888'} />
                <Text style={[styles.categoryTabText, activeTab === 'classes' && styles.categoryTabTextActive]}>เรียน</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.categoryTab, activeTab === 'exams' && styles.categoryTabActive]}
                onPress={() => setActiveTab('exams')}
            >
                <Ionicons name="create" size={18} color={activeTab === 'exams' ? '#006664' : '#888'} />
                <Text style={[styles.categoryTabText, activeTab === 'exams' && styles.categoryTabTextActive]}>สอบ</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.categoryTab, activeTab === 'activities' && styles.categoryTabActive]}
                onPress={() => setActiveTab('activities')}
            >
                <Ionicons name="bicycle" size={18} color={activeTab === 'activities' ? '#006664' : '#888'} />
                <Text style={[styles.categoryTabText, activeTab === 'activities' && styles.categoryTabTextActive]}>กิจกรรม</Text>
            </TouchableOpacity>
        </View>
    );

    const renderEmptyState = (icon, title, subtitle, routeStr, params) => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
                <Ionicons name={icon} size={40} color="#006664" />
            </View>
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={styles.emptySubtitle}>{subtitle}</Text>
            <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => navigation.navigate(routeStr, params)}
            >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyActionText}>เพิ่มข้อมูลเลย</Text>
            </TouchableOpacity>
        </View>
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                    <ActivityIndicator size="large" color="#006664" />
                    <Text style={{ color: '#888', fontSize: 14 }}>กำลังโหลดข้อมูล...</Text>
                </View>
            );
        }
        if (activeTab === 'classes') {
            if (filteredClasses.length === 0) return renderEmptyState('cafe', 'ว่างเปล่าสุดๆ!', `ไม่มีวิชาเรียนในช่วงเวลา${timeFilter === 'today' ? 'ของวันนี้' : timeFilter === 'week' ? 'สัปดาห์หน้า' : 'เดือนหน้า'}เลย`, 'TimeTableScreen', { screen: 'Create' });
            return (
                <View style={styles.listContainer}>
                    {filteredClasses.map((item, index) => (
                        <TouchableOpacity key={item.id} style={styles.listItemCard} onPress={() => navigation.navigate('TimeTableScreen')} activeOpacity={0.8}>
                            <View style={[styles.listItemAccent, { backgroundColor: '#006664' }]} />
                            <View style={styles.listItemContent}>
                                <Text style={styles.listItemTitle}>{item.title}</Text>
                                <View style={styles.listItemMeta}>
                                    <View style={styles.metaBadge}>
                                        <Ionicons name="time" size={12} color="#006664" />
                                        <Text style={styles.metaText}>{item.startTime} - {item.endTime}</Text>
                                    </View>
                                    <View style={styles.metaBadge}>
                                        <Ionicons name="calendar" size={12} color="#006664" />
                                        <Text style={styles.metaText}>{item.day}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.roomPill}>
                                <Ionicons name="location" size={10} color="#fff" />
                                <Text style={styles.roomPillText}>{item.roomNumber || 'N/A'}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        if (activeTab === 'exams') {
            if (filteredExams.length === 0) return renderEmptyState('document', 'ไม่มีตารางสอบ', `เย่! คุณยังไม่ต้องสอบในช่วงเวลา${timeFilter === 'today' ? 'วันนี้' : timeFilter === 'week' ? 'สัปดาห์หน้า' : 'เดือนหน้า'}`, 'TimeTableScreen', { screen: 'CreateExam' });
            return (
                <View style={styles.listContainer}>
                    {filteredExams.map((exam, index) => (
                        <TouchableOpacity key={exam.id} style={styles.listItemCard} onPress={() => navigation.navigate('TimeTableScreen', { screen: 'Exam' })} activeOpacity={0.8}>
                            <View style={[styles.listItemAccent, { backgroundColor: '#A23B72' }]} />
                            <View style={styles.listItemContent}>
                                <Text style={styles.listItemTitle}>{exam.title}</Text>
                                <View style={styles.listItemMeta}>
                                    <View style={styles.metaBadgeError}>
                                        <Ionicons name="calendar" size={12} color="#A23B72" />
                                        <Text style={styles.metaTextError}>{exam.date}</Text>
                                    </View>
                                    <View style={styles.metaBadgeError}>
                                        <Ionicons name="time" size={12} color="#A23B72" />
                                        <Text style={styles.metaTextError}>{exam.startTime} - {exam.endTime}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={[styles.roomPill, { backgroundColor: '#A23B72' }]}>
                                <Ionicons name="location" size={10} color="#fff" />
                                <Text style={styles.roomPillText}>{exam.roomNumber || 'N/A'}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        if (activeTab === 'activities') {
            if (loadingActivities) return <ActivityIndicator size="large" color="#006664" style={{ marginTop: 40 }} />;
            if (filteredActivities.length === 0) return renderEmptyState('leaf', 'เวลาว่างเยอะเลย', `ไม่มีกิจกรรมที่วางแผนไว้ในช่วงเวลา${timeFilter === 'today' ? 'วันนี้' : timeFilter === 'week' ? 'สัปดาห์หน้า' : 'เดือนหน้า'}`, 'ActivityScreen');
            return (
                <View style={styles.listContainer}>
                    {filteredActivities.map((act, index) => (
                        <TouchableOpacity key={act.id} style={styles.listItemCard} onPress={() => navigation.navigate('ActivityScreen')} activeOpacity={0.8}>
                            <View style={[styles.listItemAccent, { backgroundColor: act.completed ? '#10B981' : '#2E86AB' }]} />
                            <View style={styles.listItemContent}>
                                <Text style={[styles.listItemTitle, act.completed && { textDecorationLine: 'line-through', color: '#999' }]}>
                                    {act.title}
                                </Text>
                                <View style={styles.listItemMeta}>
                                    <View style={styles.metaBadgeBlue}>
                                        <Ionicons name="time-outline" size={12} color="#2E86AB" />
                                        <Text style={styles.metaTextBlue}>{(act.dateLabel || act.date || '')} {act.time || (act.startTime ? `${act.startTime} - ${act.endTime || '?'}` : '')}</Text>
                                    </View>
                                    {act.location ? (
                                        <View style={styles.metaBadgeBlue}>
                                            <Ionicons name="location-outline" size={12} color="#2E86AB" />
                                            <Text style={styles.metaTextBlue}>{act.location}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {/* Conflict warning badge */}
                                {act.conflictWith && (
                                    <View style={styles.conflictBanner}>
                                        <Ionicons name="warning" size={12} color="#D97706" />
                                        <Text style={styles.conflictBannerText}>ชนกับวิชา "{act.conflictWith}"</Text>
                                    </View>
                                )}
                            </View>
                            {act.completed && (
                                <View style={styles.checkCircle}>
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }
    };

    return (
        <View style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {/* 1. Time Filters */}
                {renderFilterTabs()}

                {/* 2. Next Class Card (Show only for 'today') */}
                {timeFilter === 'today' && renderNextClassCard()}

                {/* 3. Summary Cards */}
                {renderSummaryCards()}

                {/* 3. Category Tabs */}
                {renderCategoryTabs()}

                {/* 4. List Content */}
                <View style={styles.contentWrap}>
                    {renderContent()}
                </View>

            </ScrollView>

            {/* Floating Quick Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsFabMenuVisible(true)}
                activeOpacity={0.9}
            >
                <Ionicons name="add" size={28} color="#c3eb32" />
            </TouchableOpacity>

            {/* FAB Options Modal */}
            <Modal
                transparent={true}
                visible={isFabMenuVisible}
                animationType="fade"
                onRequestClose={() => setIsFabMenuVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setIsFabMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.fabMenuContainer}>
                                <TouchableOpacity
                                    style={styles.fabMenuItem}
                                    onPress={() => {
                                        setIsFabMenuVisible(false);
                                        navigation.navigate('TimeTableScreen', { screen: 'Create' });
                                    }}
                                >
                                    <View style={[styles.fabMenuIconWrap, { backgroundColor: 'rgba(0,102,100,0.1)' }]}>
                                        <Ionicons name="school" size={20} color="#006664" />
                                    </View>
                                    <Text style={styles.fabMenuText}>เพิ่มวิชาเรียน</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.fabMenuItem}
                                    onPress={() => {
                                        setIsFabMenuVisible(false);
                                        navigation.navigate('TimeTableScreen', { screen: 'CreateExam' });
                                    }}
                                >
                                    <View style={[styles.fabMenuIconWrap, { backgroundColor: 'rgba(162,59,114,0.1)' }]}>
                                        <Ionicons name="create" size={20} color="#A23B72" />
                                    </View>
                                    <Text style={styles.fabMenuText}>เพิ่มวิชาสอบ</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.fabMenuItem}
                                    onPress={() => {
                                        setIsFabMenuVisible(false);
                                        navigation.navigate('ActivityScreen', { initialTab: 'activity' });
                                    }}
                                >
                                    <View style={[styles.fabMenuIconWrap, { backgroundColor: 'rgba(46,134,171,0.1)' }]}>
                                        <Ionicons name="bicycle" size={20} color="#2E86AB" />
                                    </View>
                                    <Text style={styles.fabMenuText}>เพิ่มกิจกรรม</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f6f9f8',
    },
    container: {
        flex: 1,
        paddingTop: 15,
        paddingHorizontal: 20,
    },
    /* --- Next Class Card --- */
    nextClassCard: {
        backgroundColor: '#006664',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#006664',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
        position: 'relative',
    },
    nextClassGlow: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(195, 235, 50, 0.15)',
    },
    nextClassHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    statusBadgeActive: {
        backgroundColor: '#c3eb32',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    statusDotActive: {
        backgroundColor: '#006664',
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    statusTextActive: {
        color: '#006664',
    },
    nextClassBody: {
        gap: 8,
    },
    nextClassTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0.5,
    },
    nextClassInfoRow: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 4,
    },
    nextClassInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    nextClassInfoText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '600',
    },


    /* 1. Time Filters */
    timeFilterContainer: {
        flexDirection: 'row',
        backgroundColor: '#e6edea',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    timeFilterBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    timeFilterBtnActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    timeFilterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    timeFilterTextActive: {
        color: '#006664',
        fontWeight: 'bold',
    },

    /* 2. Summary Cards */
    summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    summaryIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2d3748',
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#718096',
        marginTop: 2,
    },

    /* 3. Category Tabs */
    categoryTabs: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    categoryTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    categoryTabActive: {
        borderBottomColor: '#006664',
    },
    categoryTabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#888',
    },
    categoryTabTextActive: {
        color: '#006664',
        fontWeight: 'bold',
    },

    /* 4. List Content */
    contentWrap: {
        flex: 1,
        minHeight: 300,
    },
    listContainer: {
        gap: 12,
        paddingTop: 8,
    },
    listItemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    listItemAccent: {
        width: 6,
        height: '100%',
        marginRight: 14,
    },
    listItemContent: {
        flex: 1,
    },
    listItemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 6,
    },
    listItemMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,102,100,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#006664',
    },
    metaBadgeError: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(162,59,114,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    metaTextError: {
        fontSize: 12,
        fontWeight: '600',
        color: '#A23B72',
    },
    metaBadgeBlue: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(46,134,171,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    metaTextBlue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2E86AB',
    },
    conflictBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        marginTop: 8,
        gap: 6,
    },
    conflictBannerText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#D97706',
    },
    roomPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4A5568',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    roomPillText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },

    /* Empty State */
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e8ebe8',
        borderStyle: 'dashed',
        marginTop: 10,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,102,100,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#718096',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 30,
    },
    emptyActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#006664',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    emptyActionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },

    /* FAB */
    fab: {
        position: 'absolute',
        bottom: 110,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#006664',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#006664',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
    },

    /* FAB Menu Modal */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
    },
    fabMenuContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 10,
        marginRight: 20,
        marginBottom: 180, // Positions it above the FAB
        width: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    fabMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        gap: 12,
    },
    fabMenuIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fabMenuText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#333',
    }
});

export default DashBoardScreen;