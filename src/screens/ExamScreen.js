import React, { useContext } from "react";
import {
    Text,
    View,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert
} from 'react-native';
import { EventContext } from "../context/eventContext";
import { ExamContext } from "../context/examContext";
import { UserContext } from "../context/userContext";
import { Ionicons } from '@expo/vector-icons';

const CARD_COLORS = [
    '#A23B72', '#2E86AB', '#006664', '#F18F01', '#C73E1D', '#3B1F2B', '#44BBA4'
];

// หน้าจอแสดงตารางสอบทั้งหมดที่บันทึกไว้
const ExamScreen = ({ navigation }) => {
    const { exams, dispatch: examDispatch } = useContext(ExamContext);
    const { events, dispatch: eventDispatch } = useContext(EventContext);
    const { currentUser } = useContext(UserContext);

    // เรียงวันที่จากใกล้ไปไกล
    const sortedExams = [...exams].sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;

        const [h1, m1] = a.startTime.split(':').map(Number);
        const [h2, m2] = b.startTime.split(':').map(Number);
        return (h1 * 60 + m1) - (h2 * 60 + m2);
    });

    // ฟังก์ชันกดลบตารางสอบ (มีให้เลือกลบแค่วิชาสอบ หรือลบวิชาเรียนคู่กันด้วย)
    const handleDelete = (item) => {
        const hasMatchingClass = events.some(e => e.title?.toLowerCase() === item.title?.toLowerCase());

        if (hasMatchingClass) {
            Alert.alert(
                "ลบข้อมูล",
                `พบวิชาเรียนชื่อ "${item.title}" ด้วย คุณต้องการลบทั้งตารางเรียนและตารางสอบเลยหรือไม่?`,
                [
                    { text: "ยกเลิก", style: "cancel" },
                    {
                        text: "ลบแค่สอบ",
                        onPress: () => {
                            examDispatch({ type: 'DELETE_EXAM', payload: { title: item.title, userId: currentUser?.id, firestoreId: item.firestoreId } });
                        }
                    },
                    {
                        text: "ลบทั้งคู่",
                        style: "destructive",
                        onPress: () => {
                            examDispatch({ type: 'DELETE_EXAM', payload: { title: item.title, userId: currentUser?.id, firestoreId: item.firestoreId } });
                            // Find the matching EVENT's own firestoreId, not the exam's
                            const matchingEvent = events.find(e => e.title?.toLowerCase() === item.title?.toLowerCase());
                            if (matchingEvent) {
                                eventDispatch({ type: 'DELETE_EVENT', payload: { title: item.title, userId: currentUser?.id, firestoreId: matchingEvent.firestoreId } });
                            }
                        }
                    }
                ]
            );
        } else {
            Alert.alert(
                "ลบข้อมูล",
                "คุณต้องการลบวิชาสอบนี้ออกใช่หรือไม่?",
                [
                    { text: "ยกเลิก", style: "cancel" },
                    {
                        text: "ลบข้อมูล",
                        style: "destructive",
                        onPress: () => {
                            examDispatch({ type: 'DELETE_EXAM', payload: { title: item.title, userId: currentUser?.id, firestoreId: item.firestoreId } });
                        }
                    }
                ]
            );
        }
    };

    const renderItem = ({ item, index }) => {
        const cardColor = CARD_COLORS[index % CARD_COLORS.length];

        return (
            <View style={[styles.examCard, { backgroundColor: cardColor }]}>
                {/* ปุ่มลบ */}
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                >
                    <Ionicons name="trash-outline" size={14} color="#fff" />
                </TouchableOpacity>

                <View style={styles.eventContent}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.eventRoom} numberOfLines={1}>
                        {item.roomNumber ? `📍 ${item.roomNumber}` : '📍 No Room'}
                    </Text>

                    <View style={styles.eventBottomRow}>
                        <View style={styles.eventDateBox}>
                            <Ionicons name="calendar-outline" size={13} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.eventDateText}>
                                {item.date}
                            </Text>
                        </View>

                        <Text style={styles.eventTime}>
                            {item.startTime} - {item.endTime}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Tab Header */}
            <View style={styles.tabHeaderRow}>
                <TouchableOpacity
                    style={styles.tabHeaderBtn}
                    onPress={() => navigation.navigate('TimeTable')}
                >
                    <Text style={styles.tabHeaderText}>ตารางเรียน</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tabHeaderBtn, styles.tabHeaderActive]}>
                    <Text style={[styles.tabHeaderText, styles.tabHeaderTextActive]}>ตารางสอบ</Text>
                </TouchableOpacity>
            </View>

            {/* Schedule Header */}
            <View style={styles.ongoingHeader}>
                <Text style={styles.ongoingTitle}>
                    Exam Schedule
                </Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('CreateExam')}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Exam List */}
            <FlatList
                data={sortedExams}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                style={styles.listContainer}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="document-text-outline" size={50} color="#ccc" />
                        <Text style={styles.emptyText}>ไม่มีตารางสอบ</Text>
                        <Text style={styles.emptySubText}>โชคดีไปนะมึง!</Text>
                    </View>
                }
            />
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
        marginBottom: 20,
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

    /* Schedule Header */
    ongoingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    ongoingTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a3a3a',
    },
    addButton: {
        backgroundColor: '#006664',
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#006664',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },

    /* List Container */
    listContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },

    /* Exam Cards */
    examCard: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
        position: 'relative',
        minHeight: 100,
    },
    eventContent: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    eventTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
        paddingRight: 30,
        marginBottom: 4,
    },
    eventRoom: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        marginBottom: 14,
    },
    eventBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
    },
    eventDateBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    eventDateText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    eventTime: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        fontWeight: '600',
    },

    /* Delete Button */
    deleteButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 26,
        height: 26,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },

    /* Empty State */
    emptyContainer: {
        alignItems: 'center',
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
});

export default ExamScreen;