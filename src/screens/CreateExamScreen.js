import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ExamContext } from "../context/examContext";
import { UserContext } from "../context/userContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// หน้าจอเอาไว้สร้างตารางสอบอันใหม่
const CreateExamScreen = ({ navigation }) => {
  const { dispatch } = useContext(ExamContext);
  const { currentUser } = useContext(UserContext);

  const [form, setForm] = useState({
    title: "",
    date: new Date().toLocaleDateString('th-TH'),
    rawDate: new Date(),
    startTime: "09:00",
    endTime: "12:00",
    roomNumber: "",
  });

  // Picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState({ field: null, visible: false });
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());

  // --- Date Picker handlers ---
  const openDatePicker = () => {
    setTempDate(form.rawDate);
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) {
        setForm({
          ...form,
          rawDate: selectedDate,
          date: selectedDate.toLocaleDateString('th-TH')
        });
      }
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    setForm({
      ...form,
      rawDate: tempDate,
      date: tempDate.toLocaleDateString('th-TH')
    });
    setShowDatePicker(false);
  };

  // --- Time Picker handlers ---
  const openTimePicker = (field) => {
    const currentVal = field === 'start' ? form.startTime : form.endTime;
    const [h, m] = currentVal.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    setTempTime(d);
    setShowTimePicker({ field, visible: true });
  };

  const onTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowTimePicker({ field: null, visible: false });
      if (selectedDate) {
        const hours = selectedDate.getHours().toString().padStart(2, '0');
        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        if (showTimePicker.field === 'start') {
          setForm({ ...form, startTime: timeString });
        } else {
          setForm({ ...form, endTime: timeString });
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
    if (showTimePicker.field === 'start') {
      setForm({ ...form, startTime: timeString });
    } else {
      setForm({ ...form, endTime: timeString });
    }
    setShowTimePicker({ field: null, visible: false });
  };

  // ฟังก์ชันไว้กดตกลงแล้วเซฟข้อมูลการสอบไปยัง Firebase
  const handleCreate = async () => {
    if (!form.title || !form.startTime || !form.endTime || !form.date) {
      Alert.alert("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (form.endTime <= form.startTime) {
      Alert.alert('แจ้งเตือน', 'เวลาจบการสอบต้องมากกว่าเวลาเริ่มนะครับ');
      return;
    }

    const examData = {
      title: form.title,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      roomNumber: form.roomNumber || "",
    };

    let firestoreId = null;
    if (!currentUser?.id) {
      Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "users", currentUser.id, "exams"), examData);
      firestoreId = docRef.id;
    } catch (error) {
      console.log("Save exam error full stack:", error);
      Alert.alert('ข้อผิดพลาดจาก Firestore', `สาเหตุ: ${error.message} (Code: ${error.code})`);
      return;
    }

    dispatch({
      type: "ADD_OR_UPDATE",
      payload: { ...examData, firestoreId, id: firestoreId }
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1a3a3a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Exam</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            {/* Subject Name */}
            <Text style={styles.label}>Subject Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="book-outline" size={18} color="#006664" style={styles.inputIcon} />
              <TextInput
                style={styles.fullInput}
                placeholder="e.g. Data Structure"
                placeholderTextColor="#A0AEC0"
                value={form.title}
                onChangeText={(text) => setForm({ ...form, title: text })}
              />
            </View>

            {/* Exam Date */}
            <Text style={styles.label}>Exam Date</Text>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={openDatePicker}
            >
              <Ionicons name="calendar-outline" size={18} color="#006664" style={styles.inputIcon} />
              <Text style={styles.valueText}>{form.date}</Text>
              <Ionicons name="chevron-down" size={18} color="#888" />
            </TouchableOpacity>

            {/* Time Row */}
            <View style={styles.row}>
              <View style={{ width: "48%" }}>
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity
                  style={[styles.inputWrapper, styles.halfInputWrapper]}
                  onPress={() => openTimePicker('start')}
                >
                  <Ionicons name="time-outline" size={18} color="#006664" style={styles.inputIcon} />
                  <Text style={styles.valueText}>{form.startTime}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ width: "48%" }}>
                <Text style={styles.label}>End Time</Text>
                <TouchableOpacity
                  style={[styles.inputWrapper, styles.halfInputWrapper]}
                  onPress={() => openTimePicker('end')}
                >
                  <Ionicons name="play-outline" size={18} color="#006664" style={styles.inputIcon} />
                  <Text style={styles.valueText}>{form.endTime}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Room */}
            <Text style={styles.label}>Room & Seat</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="location-outline" size={18} color="#006664" style={styles.inputIcon} />
              <TextInput
                style={styles.fullInput}
                placeholder="Room 402, Seat A1"
                placeholderTextColor="#A0AEC0"
                value={form.roomNumber}
                onChangeText={(text) => setForm({ ...form, roomNumber: text })}
              />
            </View>

            {/* Footer Button - Move inside ScrollView */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.createButton} onPress={handleCreate} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Save Exam Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ===== Date Picker ===== */}
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
            value={form.rawDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )
      )}

      {/* ===== Time Picker ===== */}
      {Platform.OS === 'ios' ? (
        <Modal visible={showTimePicker.visible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker({ field: null, visible: false })}>
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
        showTimePicker.visible && (
          <DateTimePicker
            value={tempTime}
            mode="time"
            is24Hour={true}
            display="spinner"
            onChange={onTimeChange}
          />
        )
      )}

      {/* Footer removed from here */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a3a3a",
  },

  /* Form */
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#006664",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formContainer: {
    padding: 20,
  },
  inputWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 18,
    paddingHorizontal: 15,
    height: 55,
    justifyContent: "center",
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8ebe8',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  inputIcon: {
    marginRight: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  fullInput: {
    flex: 1,
    fontSize: 15,
    color: "#2D3748",
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    color: "#2D3748",
    fontWeight: '500',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
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

  /* Footer */
  footer: {
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Clearance for floating tab bar
    paddingTop: 10,
    alignItems: "center",
  },
  createButton: {
    backgroundColor: "#006664",
    width: "100%",
    height: 55,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: 'row',
    shadowColor: '#006664',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default CreateExamScreen;