import React, { useState, useContext } from "react";
import {
    Text,
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput
} from 'react-native';
import { EventContext } from "../context/eventContext";
import { ExamContext } from "../context/examContext";
import { UserContext } from "../context/userContext";
import { Ionicons } from '@expo/vector-icons';

const CARD_COLORS = [
    '#006664', '#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#3B1F2B', '#44BBA4'
];

const HOUR_HEIGHT = 80;
const START_HOUR = 7;
const END_HOUR = 21;

// หน้าจอแสดงตารางเรียนแบบจำลองตารางเวลา (Timeline)
const TimeTableScreen = ({ navigation }) => {
    const { events, dispatch: eventDispatch } = useContext(EventContext);
    const { dispatch: examDispatch } = useContext(ExamContext);
    const { currentUser } = useContext(UserContext);
    const [selectedDay, setSelectedDay] = useState('M');

    // Share Schedule States
    const [isShareModalVisible, setShareModalVisible] = useState(false);
    const [isImportMode, setIsImportMode] = useState(false);
    const [shareCodeInput, setShareCodeInput] = useState('');

    // ฟังก์ชันสร้างโค้ด (ข้อความ) สำหรับแชร์ตารางเรียนให้เพื่อน
    const generateShareCode = () => {
        if (events.length === 0) return 'ยังไม่มีวิชาเรียนในตาราง';
        const minifiedEvents = events.map(e => ({ t: e.title, d: e.day, s: e.startTime, e: e.endTime, r: e.roomNumber || '' }));
        return JSON.stringify(minifiedEvents);
    };

    // ฟังก์ชันนำเข้าตารางเรียนจากโค้ดที่คัดลอกมา
    const handleImport = async () => {
        if (!shareCodeInput.trim()) return;
        try {
            const parsed = JSON.parse(shareCodeInput.trim());
            if (!Array.isArray(parsed)) throw new Error('Invalid format');

            let added = 0;
            const addPromises = parsed
                .filter(e => e.t && e.d && e.s && e.e)
                .filter(e => !events.find(ev => ev.day === e.d && ev.startTime === e.s))
                .map(async (e) => {
                    const eventData = { title: e.t, day: e.d, startTime: e.s, endTime: e.e, roomNumber: e.r || '' };
                    let firestoreId = null;
                    if (currentUser?.id) {
                        try {
                            const { addDoc, collection } = await import('firebase/firestore');
                            const { db } = await import('../firebaseConfig');
                            const docRef = await addDoc(collection(db, 'users', currentUser.id, 'events'), eventData);
                            firestoreId = docRef.id;
                        } catch (err) {
                            console.log('Import to Firestore error:', err);
                        }
                    }
                    eventDispatch({
                        type: 'ADD_OR_UPDATE',
                        payload: { ...eventData, firestoreId, id: firestoreId || Date.now().toString() }
                    });
                    added++;
                });
            await Promise.all(addPromises);
            Alert.alert("นำเข้าสำเร็จ 🎉", `เพิ่มตารางเรียนทั้งหมด ${added} วิชาเรียบร้อย! (ข้ามช่วงเวลาที่มีวิชาเรียนอยู่แล้ว)`);
            setShareModalVisible(false);
            setShareCodeInput('');
        } catch (error) {
            Alert.alert("ขออภัย", "โค้ดแชร์ไม่ถูกต้อง หรือมีรูปแบบผิดพลาด กรุณาตรวจสอบอีกครั้ง");
        }
    };

    const dayMapping = {
        'M': 'Monday',
        'Tu': 'Tuesday',
        'W': 'Wednesday',
        'TH': 'Thursday',
        'F': 'Friday',
        'SAT': 'Saturday',
        'SUN': 'Sunday'
    };

    const filteredEvents = events
        .filter(event => event.day === dayMapping[selectedDay])
        .sort((a, b) => {
            const [h1, m1] = a.startTime.split(':').map(Number);
            const [h2, m2] = b.startTime.split(':').map(Number);
            return (h1 * 60 + m1) - (h2 * 60 + m2);
        });

    const days = [
        { id: 'M', label: 'M', color: '#FFD700' },
        { id: 'Tu', label: 'Tu', color: '#FF69B4' },
        { id: 'W', label: 'W', color: '#4CAF50' },
        { id: 'TH', label: 'TH', color: '#FF9800' },
        { id: 'F', label: 'F', color: '#03A9F4' },
        { id: 'SAT', label: 'SAT', color: '#9C27B0' },
        { id: 'SUN', label: 'SUN', color: '#F44336' }
    ];

    const handleDelete = (item) => {
        Alert.alert(
            "ยืนยันการลบ",
            `คุณต้องการลบ "${item.title}" ออกจากตาราง ใช่หรือไม่?`,
            [
                { text: "ยกเลิก", style: "cancel" },
                {
                    text: "ลบข้อมูล",
                    style: "destructive",
                    onPress: () => {
                        eventDispatch({ type: 'DELETE_EVENT', payload: { title: item.title, userId: currentUser?.id, firestoreId: item.firestoreId } });
                        examDispatch({ type: 'DELETE_EXAM', payload: { title: item.title, userId: currentUser?.id, firestoreId: item.firestoreId } });
                    }
                }
            ]
        );
    };

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const isToday = dayMapping[selectedDay] === currentDayName;
    const currentTimeOffset = (currentHour - START_HOUR) * HOUR_HEIGHT + (currentMinute / 60) * HOUR_HEIGHT;
    const showTimeLine = isToday && currentHour >= START_HOUR && currentHour < END_HOUR;

    // สร้าง array ของเวลาทุกชั่วโมง
    const timeSlots = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
        const label = h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`;
        timeSlots.push({ hour: h, label });
    }

    // คำนวณตำแหน่งและความสูงของ card ตาม startTime/endTime
    const getCardPosition = (startTime, endTime) => {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        const top = (sh - START_HOUR) * HOUR_HEIGHT + (sm / 60) * HOUR_HEIGHT;
        const durationHours = (eh * 60 + em - sh * 60 - sm) / 60;
        const height = Math.max(durationHours * HOUR_HEIGHT, 50); // อย่างน้อย 50px
        return { top, height };
    };

    const totalTimelineHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

    return (
        <View style={styles.container}>
            {/* Tab Header */}
            <View style={styles.tabHeaderRow}>
                <TouchableOpacity style={[styles.tabHeaderBtn, styles.tabHeaderActive]}>
                    <Text style={[styles.tabHeaderText, styles.tabHeaderTextActive]}>ตารางเรียน</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabHeaderBtn} onPress={() => navigation.navigate('Exam')}>
                    <Text style={styles.tabHeaderText}>ตารางสอบ</Text>
                </TouchableOpacity>
            </View>

            {/* Day Selector */}
            <View style={styles.daysContainer}>
                <ScrollView
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dayScrollContent}
                >
                    {days.map((day) => {
                        const isSelected = selectedDay === day.id;
                        return (
                            <TouchableOpacity
                                key={day.id}
                                style={[
                                    styles.dayCard,
                                    isSelected ? { backgroundColor: day.color, borderColor: day.color } : {}
                                ]}
                                onPress={() => setSelectedDay(day.id)}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.dayLabel,
                                    isSelected ? { color: '#fff' } : { color: '#555' }
                                ]}>
                                    {day.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Schedule Header */}
            <View style={styles.ongoingHeader}>
                <Text style={styles.ongoingTitle}>
                    {dayMapping[selectedDay]}'s Schedule
                </Text>
                <View style={styles.headerActionRow}>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: '#2E86AB' }]}
                        onPress={() => { setShareModalVisible(true); setIsImportMode(false); setShareCodeInput(''); }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="share-social" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('Create', { initialDay: dayMapping[selectedDay] })}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Timeline View */}
            {filteredEvents.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="cafe-outline" size={50} color="#ccc" />
                    <Text style={styles.emptyText}>วันนี้ไม่มีคลาสเรียน</Text>
                    <Text style={styles.emptySubText}>ขอให้มีความสุข</Text>
                </View>
            ) : (
                <ScrollView style={styles.timelineScroll} contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
                    <View style={[styles.timelineWrapper, { height: totalTimelineHeight }]}>
                        {/* Time Labels + Lines */}
                        {timeSlots.map((slot) => {
                            const topPos = (slot.hour - START_HOUR) * HOUR_HEIGHT;
                            return (
                                <View key={slot.hour} style={[styles.timeSlotRow, { top: topPos }]}>
                                    <Text style={styles.timeLabel}>{slot.label}</Text>
                                    <View style={styles.timeLine} />
                                </View>
                            );
                        })}

                        {/* Current Time Indicator */}
                        {showTimeLine && (
                            <View style={[styles.currentTimeRow, { top: currentTimeOffset }]}>
                                <View style={styles.currentTimeDot} />
                                <View style={styles.currentTimeLine} />
                            </View>
                        )}

                        {/* Event Cards */}
                        {filteredEvents.map((item, index) => {
                            const { top, height } = getCardPosition(item.startTime, item.endTime);
                            const cardColor = CARD_COLORS[index % CARD_COLORS.length];
                            return (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.eventCard,
                                        {
                                            top: top,
                                            height: height,
                                            backgroundColor: cardColor,
                                        }
                                    ]}
                                >
                                    {/* ปุ่มลบ */}
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDelete(item)}
                                    >
                                        <Ionicons name="trash-outline" size={14} color="#fff" />
                                    </TouchableOpacity>

                                    <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                                    <Text style={styles.eventRoom} numberOfLines={1}>
                                        {item.roomNumber || 'No Room'}
                                    </Text>
                                    <Text style={styles.eventTime}>
                                        {item.startTime} - {item.endTime}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            )}

            {/* Share & Import Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isShareModalVisible}
                onRequestClose={() => setShareModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Close Modal Button */}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShareModalVisible(false)}>
                            <Ionicons name="close" size={22} color="#555" />
                        </TouchableOpacity>

                        {/* Header Tabs */}
                        <View style={styles.modalTabs}>
                            <TouchableOpacity
                                style={[styles.modalTabBtn, !isImportMode && styles.modalTabActive]}
                                onPress={() => setIsImportMode(false)}
                            >
                                <Text style={[styles.modalTabText, !isImportMode && styles.modalTabTextActive]}>ส่งตารางให้เพื่อน</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTabBtn, isImportMode && styles.modalTabActive]}
                                onPress={() => setIsImportMode(true)}
                            >
                                <Text style={[styles.modalTabText, isImportMode && styles.modalTabTextActive]}>นำเข้าตารางเรียน</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <View style={styles.modalBody}>
                            {!isImportMode ? (
                                <>
                                    <Text style={styles.modalSubHead}>คัดลอกโค้ดด้านล่างแล้วส่งให้เพื่อนได้เลย!</Text>
                                    <TextInput
                                        style={styles.codeInputBox}
                                        value={generateShareCode()}
                                        multiline
                                        editable={false}
                                        selectTextOnFocus={true}
                                    />
                                    <Text style={styles.helperText}>*กดที่ช่องโค้ดค้างไว้ เพื่อคัดลอก (Copy)</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.modalSubHead}>วางโค้ดจากเพื่อนลงในช่องด้านล่างนี้</Text>
                                    <TextInput
                                        style={[styles.codeInputBox, { borderColor: '#2E86AB', backgroundColor: '#fff', fontSize: 13 }]}
                                        placeholder="วางโค้ดที่นี่..."
                                        placeholderTextColor="#ccc"
                                        multiline
                                        value={shareCodeInput}
                                        onChangeText={setShareCodeInput}
                                    />
                                    <TouchableOpacity style={styles.importConfirmBtn} onPress={handleImport}>
                                        <Text style={styles.importConfirmText}>ยืนยันการนำเข้าข้อมูล</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f0',
        paddingTop: 15,
    },

    /* Tab Header */
    tabHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    tabHeaderBtn: {
        paddingVertical: 8,
        paddingHorizontal: 22,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#ddd',
        elevation: 1,
    },
    tabHeaderActive: {
        backgroundColor: '#006664',
        borderColor: '#006664',
    },
    tabHeaderText: {
        fontWeight: 'bold',
        fontSize: 13,
        color: '#555',
    },
    tabHeaderTextActive: {
        color: '#fff',
    },

    /* Day Selector */
    daysContainer: {
        height: 90,
        marginBottom: 4,
    },
    dayScrollContent: {
        paddingHorizontal: 15,
        alignItems: 'center',
    },
    dayCard: {
        width: 55,
        height: 75,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 5,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e8e8e8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    dayLabel: {
        fontSize: 18,
        fontWeight: 'bold',
    },

    /* Schedule Header */
    ongoingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    ongoingTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a3a3a',
    },
    headerActionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    addButton: {
        backgroundColor: '#006664',
        width: 36,
        height: 36,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#006664',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },

    /* Timeline */
    timelineScroll: {
        flex: 1,
    },
    timelineWrapper: {
        position: 'relative',
        marginLeft: 0,
        marginRight: 20,
    },

    /* Time Slot Rows */
    timeSlotRow: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        height: 20,
        marginTop: -10,
    },
    timeLabel: {
        width: 50,
        fontSize: 12,
        color: '#999',
        fontWeight: '600',
        textAlign: 'right',
        paddingRight: 10,
    },
    timeLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#ddd',
    },

    /* Current Time Indicator */
    currentTimeRow: {
        position: 'absolute',
        left: 40,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    currentTimeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#03A9F4',
    },
    currentTimeLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#03A9F4',
    },

    /* Event Cards */
    eventCard: {
        position: 'absolute',
        left: 60,
        right: 0,
        borderRadius: 14,
        padding: 14,
        justifyContent: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    eventTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        paddingRight: 30,
    },
    eventRoom: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        marginTop: 2,
    },
    eventTime: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '500',
        position: 'absolute',
        bottom: 12,
        right: 14,
    },

    /* Delete Button */
    deleteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },

    /* Empty State */
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 17,
        color: '#999',
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubText: {
        fontSize: 13,
        color: '#bbb',
        marginTop: 4,
    },

    /* Modal Styles */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    modalTabs: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingTop: 10,
    },
    modalTabBtn: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalTabActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#006664',
    },
    modalTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#999',
    },
    modalTabTextActive: {
        color: '#006664',
        fontWeight: 'bold',
    },
    modalBody: {
        padding: 24,
    },
    modalSubHead: {
        fontSize: 14,
        color: '#555',
        marginBottom: 12,
        fontWeight: '500',
    },
    codeInputBox: {
        backgroundColor: '#f9f9f9',
        borderWidth: 1.5,
        borderColor: '#e8e8e8',
        borderRadius: 12,
        padding: 14,
        fontSize: 12,
        color: '#777',
        minHeight: 120,
        textAlignVertical: 'top',
    },
    helperText: {
        fontSize: 11,
        color: '#888',
        marginTop: 10,
        fontStyle: 'italic',
        textAlign: 'center'
    },
    importConfirmBtn: {
        backgroundColor: '#2E86AB',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#2E86AB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    importConfirmText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    modalCloseBtn: {
        position: 'absolute',
        top: 10,
        right: 12,
        zIndex: 10,
        padding: 6,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 20,
    },
});

export default TimeTableScreen;