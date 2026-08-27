import React, { useState, useContext } from "react";
import { Text, View, StyleSheet, Image, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import { UserContext } from "../context/userContext";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { signOut, deleteUser } from "firebase/auth";
import { doc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { EventContext } from "../context/eventContext";
import { ExamContext } from "../context/examContext";
import { TaskContext } from "../context/TaskContext";
import { uploadImageToCloudinary } from "../cloudinaryConfig";

// หน้าจอโปรไฟล์ผู้ใช้ สำหรับแสดงและแก้ไขข้อมูลส่วนตัว
const ProfileScreen = ({ route, navigation }) => {
    const { currentUser, dispatch: userDispatch } = useContext(UserContext);
    const { dispatch: eventDispatch } = useContext(EventContext);
    const { dispatch: examDispatch } = useContext(ExamContext);
    const { dispatch: taskDispatch } = useContext(TaskContext);

    // Use currentUser from context as source of truth, fall back to route params for initial state
    const user = currentUser || route.params?.user || {};
    const [editUser, setEditUser] = useState(user);
    const [uploading, setUploading] = useState(false);
    const [showDeptPicker, setShowDeptPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);

    // Sync editUser whenever currentUser in context changes (e.g. after Cloudinary upload + save)
    React.useEffect(() => {
        if (currentUser) {
            setEditUser(currentUser);
        }
    }, [currentUser?.image, currentUser?.fullname, currentUser?.Dept, currentUser?.year]);

    const handleEditUser = (key, value) => {
        setEditUser({ ...editUser, [key]: value });
    };

    // ฟังก์ชันบันทึกการแก้ไขข้อมูลโปรไฟล์
    const handleSave = async () => {
        const uid = editUser.id || user.id;
        if (!uid) {
            Alert.alert('ผิดพลาด', 'ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่ครับ');
            return;
        }
        const payload = { ...editUser, id: uid };
        userDispatch({
            type: 'UPDATE_USER',
            payload
        });
        Alert.alert('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้วครับ');
    };

    const handleDelete = () => {
        Alert.alert('Notification', 'คุณแน่ใจที่จะลบบัญชีนี้หรือไม่?', [
            { text: 'ยกเลิก', style: 'cancel' },
            {
                text: 'ลบข้อมูล',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const uid = user.id;
                        // Delete subcollections
                        const subcollections = ['events', 'exams', 'tasks', 'activities'];
                        for (const sub of subcollections) {
                            const snap = await getDocs(collection(db, "users", uid, sub));
                            for (const d of snap.docs) {
                                await deleteDoc(doc(db, "users", uid, sub, d.id));
                            }
                        }
                        // Delete user doc
                        await deleteDoc(doc(db, "users", uid));
                        // Delete Firebase Auth user
                        if (auth.currentUser) {
                            await deleteUser(auth.currentUser);
                        }
                        // Clear contexts
                        userDispatch({ type: 'LOGOUT' });
                        eventDispatch({ type: 'CLEAR_ALL' });
                        examDispatch({ type: 'CLEAR_ALL' });
                        taskDispatch({ type: 'CLEAR_ALL' });

                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    } catch (error) {
                        console.log("Delete account error:", error);
                        Alert.alert('ผิดพลาด', 'ไม่สามารถลบบัญชีได้ กรุณาลองใหม่อีกครั้ง');
                    }
                }
            }
        ]);
    };

    // ฟังก์ชันออกจากระบบ
    const handleLogout = async () => {
        try {
            await signOut(auth);
            userDispatch({ type: 'LOGOUT' });
            eventDispatch({ type: 'CLEAR_ALL' });
            examDispatch({ type: 'CLEAR_ALL' });
            taskDispatch({ type: 'CLEAR_ALL' });
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } catch (error) {
            console.log("Logout error:", error);
        }
    };

    const handleClearData = () => {
        Alert.alert(
            '⚠️ ลบข้อมูลทั้งหมด',
            `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมด?\n\nรายการต่อไปนี้จะถูกลบออกทั้งหมด:\n• วิชาเรียนทั้งหมด\n• ตารางสอบทั้งหมด\n• กิจกรรมและแผนการเรียนทั้งหมด\n\nบัญชีของคุณจะยังคงอยู่ครับ\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้!`,
            [
                { text: 'ยกเลิก', style: 'cancel' },
                {
                    text: 'ลบทั้งหมด',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const uid = user.id;
                            if (!uid) return;
                            const subcollections = ['events', 'exams', 'tasks', 'activities'];
                            for (const sub of subcollections) {
                                const snap = await getDocs(collection(db, "users", uid, sub));
                                for (const d of snap.docs) {
                                    await deleteDoc(doc(db, "users", uid, sub, d.id));
                                }
                            }
                            // Clear contexts
                            eventDispatch({ type: 'CLEAR_ALL' });
                            examDispatch({ type: 'CLEAR_ALL' });
                            taskDispatch({ type: 'CLEAR_ALL' });
                            Alert.alert('✅ ลบสำเร็จ', 'ลบข้อมูลทั้งหมดเรียบร้อยแล้วครับ บัญชีของคุณยังคงอยู่');
                        } catch (error) {
                            console.log('Clear data error:', error);
                            Alert.alert('ผิดพลาด', 'ไม่สามารถลบข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
                        }
                    }
                }
            ]
        );
    };

    // ฟังก์ชันเลือกรูปโปรไฟล์จากคลังภาพมือถือ
    const PickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Notifications', 'ไม่สามารถเข้าถึงคลังภาพได้');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'livePhotos'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8
        });

        if (!result.canceled) {
            const localUri = result.assets[0].uri;
            setUploading(true);
            try {
                const cloudinaryUrl = await uploadImageToCloudinary(localUri);
                setEditUser({ ...editUser, image: cloudinaryUrl });
                Alert.alert('สำเร็จ', 'อัปโหลดรูปภาพเรียบร้อยแล้ว');
            } catch (error) {
                console.log('Cloudinary upload error:', error);
                Alert.alert('ผิดพลาด', 'ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่');
                setEditUser({ ...editUser, image: localUri });
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            {/* Profile Image Section */}
            <View style={[styles.avatarSection, { marginTop: 20 }]}>
                <TouchableOpacity onPress={PickImage} style={styles.avatarWrapper} disabled={uploading}>
                    {editUser.image ? (
                        <Image source={{ uri: editUser.image }} style={styles.avatarImage} />
                    ) : (
                        <Image source={{ uri: 'https://www.pngall.com/wp-content/uploads/5/Profile-PNG-High-Quality-Image.png' }} style={styles.avatarImage} />
                    )}
                    {/* Camera Icon / Loading Overlay */}
                    <View style={styles.cameraIcon}>
                        {uploading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="camera" size={18} color="#fff" />
                        )}
                    </View>
                </TouchableOpacity>

                <Text style={styles.usernameText}>{editUser?.username || 'Guest'}</Text>
                <Text style={styles.emailText}>{editUser?.email || ''}</Text>
                <Text style={styles.deptBadge}>{editUser?.Dept || 'ไม่ระบุคณะ'}</Text>
            </View>

            {/* Info Cards */}
            <View style={styles.cardsContainer}>

                {/* ชื่อ-นามสกุล */}
                <View style={styles.card}>
                    <View style={styles.cardLabelRow}>
                        <Ionicons name="person-outline" size={18} color="#006664" />
                        <Text style={styles.cardLabel}>ชื่อ-นามสกุล</Text>
                    </View>
                    <TextInput
                        style={styles.cardInput}
                        value={editUser.fullname}
                        onChangeText={(text) => handleEditUser('fullname', text)}
                        placeholder="กรอกชื่อ-นามสกุล"
                        placeholderTextColor="#bbb"
                    />
                </View>

                {/* คณะ */}
                <View style={styles.card}>
                    <View style={styles.cardLabelRow}>
                        <Ionicons name="school-outline" size={18} color="#006664" />
                        <Text style={styles.cardLabel}>คณะ</Text>
                    </View>
                    {Platform.OS === 'ios' ? (
                        <>
                            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
                                <Text style={styles.pickerButtonText}>{editUser.Dept || 'เลือกคณะ'}</Text>
                                <Ionicons name="chevron-down" size={18} color="#888" />
                            </TouchableOpacity>
                            <Modal visible={showDeptPicker} transparent animationType="slide">
                                <View style={styles.modalOverlay}>
                                    <View style={styles.modalContent}>
                                        <View style={styles.modalHeader}>
                                            <TouchableOpacity onPress={() => setShowDeptPicker(false)}>
                                                <Text style={styles.modalDoneText}>เสร็จสิ้น</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Picker
                                            selectedValue={editUser.Dept}
                                            onValueChange={(text) => handleEditUser('Dept', text)}
                                            style={{ width: '100%' }}
                                            itemStyle={{ color: '#000', fontSize: 17 }}
                                        >
                                            <Picker.Item label="ศิลปศาสตร์และวิทยาศาสตร์" value="ศิลปศาสตร์และวิทยาศาสตร์" />
                                            <Picker.Item label="เกษตร" value="เกษตร" />
                                            <Picker.Item label="วิทยาศาสตร์การกีฬาและสุขภาพ" value="วิทยาศาสตร์การกีฬาและสุขภาพ" />
                                            <Picker.Item label="ศึกษาศาสตร์และพัฒนศาสตร์" value="ศึกษาศาสตร์และพัฒนศาสตร์" />
                                            <Picker.Item label="อุตสาหกรรมบริการ" value="อุตสาหกรรมบริการ" />
                                            <Picker.Item label="สัตว์แพทย์" value="สัตว์แพทย์" />
                                        </Picker>
                                    </View>
                                </View>
                            </Modal>
                        </>
                    ) : (
                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={editUser.Dept}
                                style={styles.picker}
                                onValueChange={(text) => handleEditUser('Dept', text)}
                                mode="dropdown"
                                dropdownIconColor="#006664"
                            >
                                <Picker.Item label="ศิลปศาสตร์และวิทยาศาสตร์" value="ศิลปศาสตร์และวิทยาศาสตร์" />
                                <Picker.Item label="เกษตร" value="เกษตร" />
                                <Picker.Item label="วิทยาศาสตร์การกีฬาและสุขภาพ" value="วิทยาศาสตร์การกีฬาและสุขภาพ" />
                                <Picker.Item label="ศึกษาศาสตร์และพัฒนศาสตร์" value="ศึกษาศาสตร์และพัฒนศาสตร์" />
                                <Picker.Item label="อุตสาหกรรมบริการ" value="อุตสาหกรรมบริการ" />
                                <Picker.Item label="สัตว์แพทย์" value="สัตว์แพทย์" />
                            </Picker>
                        </View>
                    )}
                </View>

                {/* ชั้นปี */}
                <View style={styles.card}>
                    <View style={styles.cardLabelRow}>
                        <Ionicons name="calendar-outline" size={18} color="#006664" />
                        <Text style={styles.cardLabel}>ชั้นปีที่</Text>
                    </View>
                    {Platform.OS === 'ios' ? (
                        <>
                            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowYearPicker(true)}>
                                <Text style={styles.pickerButtonText}>{editUser.year ? `ชั้นปีที่ ${editUser.year}` : 'เลือกชั้นปี'}</Text>
                                <Ionicons name="chevron-down" size={18} color="#888" />
                            </TouchableOpacity>
                            <Modal visible={showYearPicker} transparent animationType="slide">
                                <View style={styles.modalOverlay}>
                                    <View style={styles.modalContent}>
                                        <View style={styles.modalHeader}>
                                            <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                                                <Text style={styles.modalDoneText}>เสร็จสิ้น</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Picker
                                            selectedValue={editUser.year}
                                            onValueChange={(text) => handleEditUser('year', text)}
                                            style={{ width: '100%' }}
                                            itemStyle={{ color: '#000', fontSize: 17 }}
                                        >
                                            <Picker.Item label="1" value="1" />
                                            <Picker.Item label="2" value="2" />
                                            <Picker.Item label="3" value="3" />
                                            <Picker.Item label="4" value="4" />
                                            <Picker.Item label="5" value="5" />
                                            <Picker.Item label="6" value="6" />
                                            <Picker.Item label="7" value="7" />
                                            <Picker.Item label="8" value="8" />
                                        </Picker>
                                    </View>
                                </View>
                            </Modal>
                        </>
                    ) : (
                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={editUser.year}
                                style={styles.picker}
                                onValueChange={(text) => handleEditUser('year', text)}
                                mode="dropdown"
                                dropdownIconColor="#006664"
                            >
                                <Picker.Item label="ชั้นปี" />
                                <Picker.Item label="1" value="1" />
                                <Picker.Item label="2" value="2" />
                                <Picker.Item label="3" value="3" />
                                <Picker.Item label="4" value="4" />
                                <Picker.Item label="5" value="5" />
                                <Picker.Item label="6" value="6" />
                                <Picker.Item label="7" value="7" />
                                <Picker.Item label="8" value="8" />
                            </Picker>
                        </View>
                    )}
                </View>
            </View>

            {/* Action Buttons */}
            <View style={[styles.buttonRow, { justifyContent: 'center' }]}>
                <TouchableOpacity onPress={handleSave} style={[styles.saveButton, { width: '100%', maxWidth: '100%', marginBottom: 15 }]} activeOpacity={0.85}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.saveButtonText}>บันทึกการแก้ไข</Text>
                </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <View style={styles.logoutRow}>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.85}>
                    <Ionicons name="log-out-outline" size={20} color="#006664" style={{ marginRight: 6 }} />
                    <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
                </TouchableOpacity>
            </View>

            {/* Clear Data Button */}
            <View style={styles.clearDataSection}>
                <TouchableOpacity onPress={handleClearData} style={styles.clearDataButton} activeOpacity={0.8}>
                    <View style={styles.clearDataIconWrap}>
                        <Ionicons name="trash-bin-outline" size={20} color="#DC2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.clearDataTitle}>ลบข้อมูลทั้งหมด</Text>
                        <Text style={styles.clearDataSubtitle}>วิชาเรียน, สอบ, กิจกรรม, แผน (ยังคงบัญชีไว้)</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#DC2626" />
                </TouchableOpacity>
            </View>

            {/* Delete Account Button */}
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
                <TouchableOpacity onPress={handleDelete} style={[styles.deleteButton, { width: '100%', maxWidth: '100%' }]} activeOpacity={0.85}>
                    <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.deleteButtonText}>ลบบัญชีผู้ใช้ถาวร</Text>
                </TouchableOpacity>
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: '#f0f2f0',
    },

    /* ---- Clear Data Button ---- */
    clearDataSection: {
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 28,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    clearDataButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        gap: 12,
    },
    clearDataIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearDataTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#DC2626',
    },
    clearDataSubtitle: {
        fontSize: 11,
        color: '#EF4444',
        marginTop: 2,
    },

    /* ---- Avatar Section ---- */
    avatarSection: {
        alignItems: 'center',
        marginTop: -45,
        marginBottom: 10,
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#fff',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: '#006664',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    usernameText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1a3a3a',
        marginTop: 10,
    },
    emailText: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    deptBadge: {
        fontSize: 13,
        color: '#fff',
        backgroundColor: '#006664',
        paddingHorizontal: 14,
        paddingVertical: 4,
        borderRadius: 20,
        marginTop: 6,
        overflow: 'hidden',
        fontWeight: '500',
    },

    /* ---- Info Cards ---- */
    cardsContainer: {
        paddingHorizontal: 20,
        marginTop: 15,
        gap: 12,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    cardLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#006664',
        marginLeft: 8,
    },
    cardInput: {
        backgroundColor: '#f5f7f6',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: '#333',
        borderWidth: 1,
        borderColor: '#e0e4e3',
    },
    pickerBox: {
        backgroundColor: '#f5f7f6',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e0e4e3',
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
        color: '#333',
    },
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f5f7f6',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e0e4e3',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    pickerButtonText: {
        fontSize: 15,
        color: '#333',
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
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalDoneText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#006664',
    },

    /* ---- Action Buttons ---- */
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 14,
        marginTop: 24,
        paddingHorizontal: 20,
    },
    saveButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#006664',
        paddingVertical: 14,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#006664',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    deleteButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#cc3333',
        paddingVertical: 14,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#cc3333',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },

    /* ---- Logout Button ---- */
    logoutRow: {
        paddingHorizontal: 20,
        marginTop: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#006664',
    },
    logoutButtonText: {
        color: '#006664',
        fontSize: 15,
        fontWeight: 'bold',
    },
});

export default ProfileScreen;