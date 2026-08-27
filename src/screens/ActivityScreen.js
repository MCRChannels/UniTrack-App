import React, { useState, useContext, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, ScrollView, Platform, KeyboardAvoidingView, Alert, StatusBar, SafeAreaView, FlatList, Modal
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { UserContext } from "../context/userContext";
import { EventContext } from "../context/eventContext";
import { ExamContext } from "../context/examContext";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

// เป็นหน้าจอแสดงรายการกิจกรรมและแผนการเรียน (Activity & Planner)
const ActivityScreen = ({ route }) => {
  const { currentUser } = useContext(UserContext);
  const { events } = useContext(EventContext);
  const { exams } = useContext(ExamContext);
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'planner');
  const [inputText, setInputText] = useState("");
  const [locationText, setLocationText] = useState("");

  // Date & Time States
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPicker, setShowPicker] = useState({ field: null, visible: false });
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());

  const [items, setItems] = useState([]);

  // React to tab parameter changes when navigating to an already mounted screen
  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Load activities from Firestore on mount (Real-time)
  useEffect(() => {
    let unsubscribe = () => { };

    if (currentUser?.id) {
      unsubscribe = onSnapshot(collection(db, "users", currentUser.id, "activities"), (snap) => {
        const loaded = snap.docs.map(d => ({ ...d.data(), id: d.id, firestoreId: d.id }));
        setItems(loaded);
      }, (error) => {
        console.log("Listen activities error:", error);
      });
    } else {
      setItems([]);
    }

    return () => unsubscribe();
  }, [currentUser?.id]);

  const openDatePicker = () => {
    setTempDate(date);
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) setDate(selectedDate);
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    setDate(tempDate);
    setShowDatePicker(false);
  };

  const openTimePicker = (field) => {
    const currentVal = field === 'start' ? startTime : endTime;
    const [h, m] = currentVal.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    setTempTime(d);
    setShowPicker({ field, visible: true });
  };

  const onTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker({ ...showPicker, visible: false });
      if (selectedDate) {
        const hours = selectedDate.getHours().toString().padStart(2, '0');
        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        if (showPicker.field === 'start') {
          setStartTime(timeString);
        } else {
          setEndTime(timeString);
        }
      }
    } else {
      if (selectedDate) setTempTime(selectedDate);
    }
  };

  const confirmIOSTime = () => {
    const hours = tempTime.getHours().toString().padStart(2, '0');
    const minutes = tempTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    if (showPicker.field === 'start') {
      setStartTime(timeString);
    } else {
      setEndTime(timeString);
    }
    setShowPicker({ field: null, visible: false });
  };

  // ฟังก์ชันไว้เช็กว่าเวลาที่เลือกชนกับวิชาเรียน ทวนสอบ หรือกิจกรรมอื่นที่สร้างไว้ไหม
  const findConflict = (activityDate) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[activityDate.getDay()];

    // Format date for comparisons
    const dateLabel = activityDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

    // For exams (matching both EN and TH formats)
    const formattedDateEN = activityDate.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
    });

    const [actStartH, actStartM] = startTime.split(':').map(Number);
    const [actEndH, actEndM] = endTime.split(':').map(Number);
    const actStart = actStartH * 60 + actStartM;
    const actEnd = actEndH * 60 + actEndM;

    // 1. Check Classes
    const classConflict = events.find(e => {
      if (e.day !== dayName) return false;
      const [startH, startM] = e.startTime.split(':').map(Number);
      const [endH, endM] = e.endTime.split(':').map(Number);
      const start = startH * 60 + startM;
      const end = endH * 60 + endM;
      return (actStart < end && actEnd > start);
    });
    if (classConflict) return { type: 'class', data: classConflict };

    // 2. Check Exams
    const examConflict = exams.find(e => {
      // Try multiple date matches
      let sameDate = (e.date === formattedDateEN || e.date === dateLabel);
      if (!sameDate && e.rawDate) {
        sameDate = new Date(e.rawDate).toDateString() === activityDate.toDateString();
      }
      if (!sameDate) return false;

      const [startH, startM] = e.startTime.split(':').map(Number);
      const [endH, endM] = e.endTime.split(':').map(Number);
      const start = startH * 60 + startM;
      const end = endH * 60 + endM;
      return (actStart < end && actEnd > start);
    });
    if (examConflict) return { type: 'exam', data: examConflict };

    // 3. Check Other Activities
    const activityConflict = items.find(item => {
      if (item.type !== 'activity' || item.dateLabel !== dateLabel) return false;
      const [startH, startM] = item.startTime.split(':').map(Number);
      const [endH, endM] = item.endTime.split(':').map(Number);
      const start = startH * 60 + startM;
      const end = endH * 60 + endM;
      return (actStart < end && actEnd > start);
    });
    if (activityConflict) return { type: 'other_activity', data: activityConflict };

    return null;
  };

  const saveActivity = async (newItem) => {
    if (currentUser?.id) {
      try {
        await addDoc(collection(db, "users", currentUser.id, "activities"), newItem);
        setInputText("");
        setLocationText("");
      } catch (error) {
        console.log("Add activity error:", error);
        Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกกิจกรรมได้ครับ');
      }
    } else {
      // Fallback for non-logged in state (should not happen with existing flows)
      newItem.id = Date.now().toString();
      setItems(prev => [newItem, ...prev]);
      setInputText("");
      setLocationText("");
    }
  };

  // ฟังก์ชันสำหรับตรวจความถูกต้องและเพิ่มกิจกรรมใหม่
  const handleAddItem = async () => {
    if (!inputText.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อรายการก่อนครับ');
      return;
    }

    const dateLabel = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const startTimeLabel = startTime;
    const endTimeLabel = endTime;

    // Validate times
    if (activeTab === 'activity') {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (startMinutes >= endMinutes) {
        Alert.alert('แจ้งเตือน', 'เวลาเริ่มต้องมาก่อนเวลาสิ้นสุดครับ');
        return;
      }
    }

    const newItem = {
      title: inputText,
      type: activeTab,
      completed: false,
      ...(activeTab === 'activity' && {
        location: locationText || 'ไม่ระบุสถานที่',
        time: `${startTimeLabel} - ${endTimeLabel}`,
        startTime: startTimeLabel,
        endTime: endTimeLabel,
        dateLabel: dateLabel
      })
    };

    // Only check conflicts for 'activity' tab (not planner)
    if (activeTab === 'activity') {
      const conflict = findConflict(date);
      if (conflict) {
        const { type, data } = conflict;
        const conflictTitle = data.title;

        let conflictTypeLabel = 'รายการอื่น';
        if (type === 'class') conflictTypeLabel = 'วิชาเรียน';
        if (type === 'exam') conflictTypeLabel = 'สอบ';
        if (type === 'other_activity') conflictTypeLabel = 'กิจกรรมอื่น';

        // For other activities, we strictly block as requested
        if (type === 'other_activity') {
          Alert.alert(
            `❌ เวลาทับซ้อนกับ${conflictTypeLabel}!`,
            `กิจกรรม "${inputText}" มีเวลาทับซ้อนกับ "${conflictTitle}" (${data.startTime} - ${data.endTime}) ในช่วงเวลาเดียวกันพอดีครับ`,
            [{ text: 'ตกลง', style: 'default' }]
          );
          return;
        }

        // For classes/exams, we can keep the "Add anyway" option or block too
        // User asked "cannot add" (เพิ่มไม่ได้) and "popup เหมือนตอนใส่เวลาเรียนซ้ำ"
        // Let's make it a strict check for all for consistency if requested, but usually classes are priority.
        // User said: "เขียนให้มันไม่สามารถเพิ่มกิจกรรมในเวลาเดียวกันได้ด้วยครับ"
        Alert.alert(
          `⏰ เวลาทับซ้อนกับ${conflictTypeLabel}!`,
          `เวลา ${startTimeLabel} - ${endTimeLabel} ตรงกับ${conflictTypeLabel} "${conflictTitle}" (${data.startTime} - ${data.endTime}) กรุณาเปลี่ยนช่วงเวลาใหม่ครับ`,
          [{ text: 'ตกลง', style: 'default' }]
        );
        return;
      }
    }

    await saveActivity(newItem);
  };

  // ฟังก์ชันไว้ลบกิจกรรมตามไอดี
  const deleteItem = async (id) => {
    // Delete from Firestore
    if (currentUser?.id) {
      try {
        await deleteDoc(doc(db, "users", currentUser.id, "activities", id));
      } catch (error) {
        console.log("Delete activity error:", error);
      }
    }
    setItems(items.filter(item => item.id !== id));
  };

  // ฟังก์ชันไว้สลับสถานะว่าทำกิจกรรมเสร็จหรือยัง
  const toggleItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (item && currentUser?.id && item.firestoreId) {
      try {
        await updateDoc(doc(db, "users", currentUser.id, "activities", item.firestoreId), {
          completed: !item.completed,
        });
      } catch (error) {
        console.log("Toggle activity error:", error);
      }
    }
    setItems(items.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const plannerCount = items.filter(i => i.type === 'planner').length;
  const activityCount = items.filter(i => i.type === 'activity').length;
  const completedPlanner = items.filter(i => i.type === 'planner' && i.completed).length;

  const renderPlanner = ({ item }) => (
    <View style={[styles.planCard, item.completed && styles.planCardCompleted]}>
      <TouchableOpacity
        style={[styles.checkCircle, item.completed && styles.checkCircleDone]}
        onPress={() => toggleItem(item.id)}
        activeOpacity={0.7}
      >
        {item.completed && <Ionicons name="checkmark" size={15} color="#fff" />}
      </TouchableOpacity>
      <View style={styles.planContent}>
        <Text style={[styles.planTitle, item.completed && styles.planTitleDone]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.completed && (
          <Text style={styles.planDoneBadge}>เสร็จแล้ว ✓</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteIconBtn}
        onPress={() => Alert.alert('ลบรายการ', `ลบ "${item.title}" หรือไม่?`, [
          { text: 'ยกเลิก', style: 'cancel' },
          { text: 'ลบ', style: 'destructive', onPress: () => deleteItem(item.id) }
        ])}
      >
        <Ionicons name="close-circle" size={22} color="#E53E3E" />
      </TouchableOpacity>
    </View>
  );

  const renderActivity = ({ item }) => (
    <View style={styles.actCard}>
      <View style={styles.actAccent} />
      <View style={styles.actBody}>
        <View style={styles.actTopRow}>
          <View style={styles.actIconCircle}>
            <Ionicons name="flag" size={16} color="#006664" />
          </View>
          <Text style={styles.actTitle} numberOfLines={1}>{item.title}</Text>
          <TouchableOpacity
            onPress={() => Alert.alert('ลบกิจกรรม', `ลบ "${item.title}" หรือไม่?`, [
              { text: 'ยกเลิก', style: 'cancel' },
              { text: 'ลบ', style: 'destructive', onPress: () => deleteItem(item.id) }
            ])}
          >
            <Ionicons name="trash-outline" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
        <View style={styles.actTagRow}>
          <View style={styles.actTag}>
            <Ionicons name="location" size={12} color="#006664" />
            <Text style={styles.actTagText}>{item.location}</Text>
          </View>
          <View style={styles.actTag}>
            <Ionicons name="calendar" size={12} color="#006664" />
            <Text style={styles.actTagText}>{item.dateLabel}</Text>
          </View>
          <View style={styles.actTag}>
            <Ionicons name="time" size={12} color="#006664" />
            <Text style={styles.actTagText}>{item.time}</Text>
          </View>
        </View>
        {/* Conflict warning badge */}
        {item.conflictWith && (
          <View style={styles.conflictBanner}>
            <Ionicons name="warning" size={12} color="#D97706" />
            <Text style={styles.conflictBannerText}>ชนกับวิชา "{item.conflictWith}"</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons
          name={activeTab === 'planner' ? 'book-outline' : 'rocket-outline'}
          size={40}
          color="#006664"
        />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === 'planner' ? 'ยังไม่มีแผนการเรียน' : 'ยังไม่มีกิจกรรม'}
      </Text>
      <Text style={styles.emptySubText}>
        {activeTab === 'planner' ? 'เพิ่มสิ่งที่ต้องทำวันนี้ได้เลย!' : 'เพิ่มกิจกรรมใหม่ได้เลย!'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ===== Header ===== */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>กิจกรรม & แผน</Text>
          <Text style={styles.headerSubtitle}>จัดการทุกอย่างในที่เดียว</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="layers" size={18} color="#fff" />
        </View>
      </View>

      {/* ===== Tab Switcher ===== */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'planner' && styles.tabBtnActive]}
          onPress={() => setActiveTab('planner')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'planner' ? 'book' : 'book-outline'}
            size={18}
            color={activeTab === 'planner' ? '#fff' : '#94A3B8'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'planner' && styles.tabBtnTextActive]}>
            Study Plan
          </Text>
          {plannerCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'planner' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'planner' && styles.tabBadgeTextActive]}>
                {completedPlanner}/{plannerCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'activity' && styles.tabBtnActive]}
          onPress={() => setActiveTab('activity')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'activity' ? 'flag' : 'flag-outline'}
            size={18}
            color={activeTab === 'activity' ? '#fff' : '#94A3B8'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'activity' && styles.tabBtnTextActive]}>
            กิจกรรม
          </Text>
          {activityCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'activity' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'activity' && styles.tabBadgeTextActive]}>
                {activityCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

        {/* ===== Input Card ===== */}
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <View style={styles.inputIconCircle}>
              <Ionicons
                name={activeTab === 'planner' ? 'create-outline' : 'add-outline'}
                size={18}
                color="#006664"
              />
            </View>
            <TextInput
              style={styles.mainInput}
              placeholder={activeTab === 'planner' ? "เพิ่มแผนการเรียน..." : "ชื่อกิจกรรม..."}
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
            />
          </View>

          {activeTab === 'activity' && (
            <>
              <View style={styles.subInputRow}>
                <Ionicons name="location-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.subInput}
                  placeholder="สถานที่..."
                  placeholderTextColor="#CBD5E1"
                  value={locationText}
                  onChangeText={setLocationText}
                />
              </View>

              <View style={styles.dateTimeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>DATE</Text>
                  <TouchableOpacity
                    style={styles.pickerInputWrapper}
                    onPress={openDatePicker}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#006664" style={styles.pickerIcon} />
                    <Text style={styles.pickerValueText}>
                      {date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>START</Text>
                  <TouchableOpacity
                    style={styles.pickerInputWrapper}
                    onPress={() => openTimePicker('start')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={18} color="#006664" style={styles.pickerIcon} />
                    <Text style={styles.pickerValueText}>
                      {startTime}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLabel}>END</Text>
                  <TouchableOpacity
                    style={styles.pickerInputWrapper}
                    onPress={() => openTimePicker('end')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={18} color="#006664" style={styles.pickerIcon} />
                    <Text style={styles.pickerValueText}>
                      {endTime}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={handleAddItem}>
            <Ionicons name="add-circle" size={20} color="#c3eb32" style={{ marginRight: 6 }} />
            <Text style={styles.addBtnText}>บันทึกรายการ</Text>
          </TouchableOpacity>
        </View>

        {/* Date/Time Pickers - iOS: Modal, Android: inline */}
        {Platform.OS === 'ios' ? (
          <Modal visible={showDatePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={[styles.modalDoneText, { color: '#999' }]}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmIOSDate}>
                    <Text style={styles.modalDoneText}>เสร็จสิ้น</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  textColor="#333"
                  style={{ height: 200, width: '100%' }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )
        )}
        {Platform.OS === 'ios' ? (
          <Modal visible={showPicker.visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowPicker({ field: null, visible: false })}>
                    <Text style={[styles.modalDoneText, { color: '#999' }]}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmIOSTime}>
                    <Text style={styles.modalDoneText}>เสร็จสิ้น</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempTime}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={onTimeChange}
                  textColor="#333"
                  style={{ height: 200, width: '100%' }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          showPicker.visible && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={onTimeChange}
            />
          )
        )}

        {/* ===== List Section ===== */}
        <FlatList
          data={items.filter(i => i.type === activeTab)}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'planner' ? renderPlanner : renderActivity}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
        />
      </KeyboardAvoidingView>
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f0',
  },

  /* ===== Header ===== */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 15,
    paddingBottom: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a3a3a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#006664',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#006664',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },

  /* ===== Tab Bar ===== */
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tabBtnActive: {
    backgroundColor: '#006664',
    borderColor: '#006664',
    shadowColor: '#006664',
    shadowOpacity: 0.3,
    elevation: 4,
  },
  tabBtnText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(195,235,50,0.25)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  tabBadgeTextActive: {
    color: '#c3eb32',
  },

  /* ===== Input Card ===== */
  inputCard: {
    margin: 20,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f2f0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,102,100,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mainInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a3a3a',
  },
  subInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8faf9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8ebe8',
  },
  subInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 1,
  },
  pickerInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pickerIcon: {
    marginRight: 10,
  },
  pickerValueText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: '#006664',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#006664',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  /* ===== List ===== */
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 4,
  },

  /* ===== Planner Cards ===== */
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f2f0',
  },
  planCardCompleted: {
    backgroundColor: '#f8faf9',
    borderColor: '#e0e4e3',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#006664',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkCircleDone: {
    backgroundColor: '#006664',
    borderColor: '#006664',
  },
  planContent: {
    flex: 1,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a3a3a',
    lineHeight: 22,
  },
  planTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  planDoneBadge: {
    fontSize: 11,
    color: '#006664',
    fontWeight: '700',
    marginTop: 3,
  },
  deleteIconBtn: {
    padding: 4,
    marginLeft: 8,
  },

  /* ===== Activity Cards ===== */
  actCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f2f0',
  },
  actAccent: {
    width: 5,
    backgroundColor: '#006664',
  },
  actBody: {
    flex: 1,
    padding: 16,
  },
  actTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  actIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0,102,100,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a3a3a',
  },
  actTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,102,100,0.06)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 5,
  },
  actTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
  },

  /* ===== Empty State ===== */
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(0,102,100,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#555',
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  conflictBannerText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },

  /* Modal Picker */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 110 : 90,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  modalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#006664',
  },
});

export default ActivityScreen;