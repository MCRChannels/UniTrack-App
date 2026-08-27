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
import { EventContext } from "../context/eventContext";
import { UserContext } from "../context/userContext";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// หน้าจอสำหรับสร้างตารางเรียนแต่ละวิชา
const CreateScreen = ({ navigation, route }) => {
  const { events, dispatch } = useContext(EventContext);
  const { currentUser } = useContext(UserContext);
  const { initialDay } = route?.params || {};

  const [form, setForm] = useState({
    title: "",
    day: initialDay || "Monday",
    startTime: "09:00",
    endTime: "12:00",
    roomNumber: "",
  });

  const [showPicker, setShowPicker] = useState({ field: null, visible: false });
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

  // ฟังก์ชันเปลี่ยนค่าเวลาตามสไตล์ของแต่ละระบบ (OS)
  const onTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker({ ...showPicker, visible: false });
      if (selectedDate) {
        const hours = selectedDate.getHours().toString().padStart(2, '0');
        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        if (showPicker.field === 'start') {
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
    if (showPicker.field === 'start') {
      setForm({ ...form, startTime: timeString });
    } else {
      setForm({ ...form, endTime: timeString });
    }
    setShowPicker({ field: null, visible: false });
  };

  const openTimePicker = (field) => {
    const currentVal = field === 'start' ? form.startTime : form.endTime;
    const [h, m] = currentVal.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    setTempTime(d);
    setShowPicker({ field, visible: true });
  };

  // ฟังก์ชันไว้บันทึกและเซฟตารางเรียนใหม่ลง Firebase
  const handleCreate = async () => {
    if (!form.title || !form.startTime || !form.endTime) {
      Alert.alert("แจ้งเตือน", "กรุณากรอกชื่อวิชาและเวลาให้ครบถ้วน");
      return;
    }

    if (form.endTime <= form.startTime) {
      Alert.alert('แจ้งเตือน', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น กรุณาเลือกเวลาใหม่')
      return
    }

    // เช็คว่ามีวิชาเรียนซ้ำวัน+เวลาเดียวกันหรือไม่
    const [newStartH, newStartM] = form.startTime.split(':').map(Number);
    const [newEndH, newEndM] = form.endTime.split(':').map(Number);
    const newStart = newStartH * 60 + newStartM;
    const newEnd = newEndH * 60 + newEndM;

    const overlap = events.find(e => {
      if (e.day !== form.day) return false;
      const [eStartH, eStartM] = e.startTime.split(':').map(Number);
      const [eEndH, eEndM] = e.endTime.split(':').map(Number);
      const eStart = eStartH * 60 + eStartM;
      const eEnd = eEndH * 60 + eEndM;
      // เช็คว่าเวลาทับกันหรือไม่
      return newStart < eEnd && newEnd > eStart;
    });

    if (overlap) {
      Alert.alert(
        'เวลาชนกัน',
        `เวลานี้ชนกับวิชา "${overlap.title}" (${overlap.startTime} - ${overlap.endTime}) ในวัน ${form.day} กรุณาเลือกเวลาใหม่`
      );
      return;
    }

    // Save to Firestore FIRST, then dispatch to context
    const eventData = {
      title: form.title,
      day: form.day,
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
      const docRef = await addDoc(collection(db, "users", currentUser.id, "events"), eventData);
      firestoreId = docRef.id;
    } catch (error) {
      console.log("Save event error full stack:", error);
      Alert.alert('ข้อผิดพลาดจาก Firestore', `สาเหตุ: ${error.message} (Code: ${error.code})`);
      return; // Stop here if Firestore fails!
    }

    dispatch({
      type: "ADD_OR_UPDATE",
      payload: { ...eventData, firestoreId, id: firestoreId }
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
        <Text style={styles.headerTitle}>Create Class</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            {/* Subject Name */}
            <Text style={styles.label}>SUBJECT NAME</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="book-outline" size={18} color="#006664" style={styles.inputIcon} />
              <TextInput
                style={styles.fullInput}
                placeholder="e.g. Mobile Application"
                placeholderTextColor="#A0AEC0"
                value={form.title}
                onChangeText={(text) => setForm({ ...form, title: text })}
              />
            </View>

            {/* Day Picker */}
            <Text style={styles.label}>SELECT DAY</Text>
            {Platform.OS === 'ios' ? (
              <>
                <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDayPicker(true)}>
                  <Ionicons name="calendar-outline" size={18} color="#006664" style={styles.inputIcon} />
                  <Text style={styles.valueText}>{form.day}</Text>
                  <Ionicons name="chevron-down" size={18} color="#888" />
                </TouchableOpacity>
                <Modal visible={showDayPicker} transparent animationType="slide">
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowDayPicker(false)}>
                          <Text style={styles.modalDoneText}>เสร็จสิ้น</Text>
                        </TouchableOpacity>
                      </View>
                      <Picker
                        selectedValue={form.day}
                        onValueChange={(val) => setForm({ ...form, day: val })}
                        style={{ width: '100%' }}
                        itemStyle={{ color: '#000', fontSize: 18 }}
                      >
                        <Picker.Item label="Monday" value="Monday" />
                        <Picker.Item label="Tuesday" value="Tuesday" />
                        <Picker.Item label="Wednesday" value="Wednesday" />
                        <Picker.Item label="Thursday" value="Thursday" />
                        <Picker.Item label="Friday" value="Friday" />
                        <Picker.Item label="Saturday" value="Saturday" />
                        <Picker.Item label="Sunday" value="Sunday" />
                      </Picker>
                    </View>
                  </View>
                </Modal>
              </>
            ) : (
              <View style={[styles.inputWrapper, { paddingLeft: 0 }]}>
                <Ionicons name="calendar-outline" size={18} color="#006664" style={[styles.inputIcon, { marginLeft: 15 }]} />
                <Picker
                  selectedValue={form.day}
                  onValueChange={(val) => setForm({ ...form, day: val })}
                  style={styles.picker}
                  dropdownIconColor="#006664"
                >
                  <Picker.Item label="Monday" value="Monday" />
                  <Picker.Item label="Tuesday" value="Tuesday" />
                  <Picker.Item label="Wednesday" value="Wednesday" />
                  <Picker.Item label="Thursday" value="Thursday" />
                  <Picker.Item label="Friday" value="Friday" />
                  <Picker.Item label="Saturday" value="Saturday" />
                  <Picker.Item label="Sunday" value="Sunday" />
                </Picker>
              </View>
            )}

            {/* Time Row */}
            <View style={styles.row}>
              <View style={{ width: "48%" }}>
                <Text style={styles.label}>START TIME</Text>
                <TouchableOpacity
                  style={[styles.inputWrapper, styles.halfInputWrapper]}
                  onPress={() => openTimePicker('start')}
                >
                  <Ionicons name="time-outline" size={18} color="#006664" style={styles.inputIcon} />
                  <Text style={styles.valueText}>{form.startTime}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ width: "48%" }}>
                <Text style={styles.label}>END TIME</Text>
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
            <Text style={styles.label}>ROOM NUMBER</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="location-outline" size={18} color="#006664" style={styles.inputIcon} />
              <TextInput
                style={styles.fullInput}
                placeholder="Room: SC-xxx"
                placeholderTextColor="#A0AEC0"
                value={form.roomNumber}
                onChangeText={(text) => setForm({ ...form, roomNumber: text })}
              />
            </View>
          </View>

          {/* Footer Button - Inside ScrollView */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.createButton} onPress={handleCreate} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Create Schedule</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Time Picker - Android: inline, iOS: Modal */}
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
    fontSize: 12,
    fontWeight: "700",
    color: "#006664",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.8,
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
  picker: {
    flex: 1,
    color: '#2D3748',
  },
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

  /* Footer */
  footer: {
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // เพิ่มพื้นที่ให้พ้น Tab Bar เมื่อเลื่อนจนสุด
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

export default CreateScreen;