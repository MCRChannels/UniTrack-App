import React, { useState, useContext } from "react";
import {
    Text,
    View,
    StyleSheet,
    Alert,
    TouchableOpacity,
    Image,
    TextInput,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    Modal,
    ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { UserContext } from "../context/userContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

// หน้าจอสำหรับสมัครสมาชิกใหม่
const Register = ({ navigation }) => {
    const { dispatch } = useContext(UserContext);

    const [form, setForm] = useState({
        fullname: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        Dept: 'ศิลปศาสตร์และวิทยาศาสตร์',
        year: '1',
        image: null,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showDeptPicker, setShowDeptPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);

    // ฟังก์ชันตรวจสอบข้อมูลและสมัครสมาชิกบัญชีใหม่ลง Firebase
    const handleRegister = async () => {
        const { fullname, email, username, password, confirmPassword } = form;

        if (!fullname || !email || !username || !password || !confirmPassword) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่องครับ');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกันครับ');
            return;
        }

        if (password.length < 6) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านต้องมีความยาว 6 ตัวอักษรขึ้นไป');
            return;
        }

        setLoading(true);
        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            // Save user profile to Firestore
            const userData = {
                fullname: fullname,
                email: email,
                username: username,
                Dept: form.Dept,
                year: form.year,
                image: form.image,
                createdAt: new Date().toISOString(),
            };

            await setDoc(doc(db, "users", uid), userData);

            const newUser = {
                id: uid,
                ...userData,
            };

            dispatch({ type: 'SET_CURRENT_USER', payload: newUser });

            Alert.alert('สำเร็จ', 'สมัครสมาชิกเรียบร้อยแล้ว!',
                [{
                    text: 'ตกลง',
                    onPress: () => navigation.reset({
                        index: 0,
                        routes: [{ name: 'HomeApp', params: { screen: 'ProfileScreen', params: { user: newUser } } }],
                    })
                }]
            );
        } catch (error) {
            let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email นี้ถูกใช้งานไปแล้วครับ กรุณาใช้ Email อื่น';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'รูปแบบ Email ไม่ถูกต้องครับ';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'รหัสผ่านไม่ปลอดภัยพอครับ กรุณาตั้งรหัสผ่านที่ยาวกว่านี้';
            }
            Alert.alert('สมัครสมาชิกไม่สำเร็จ', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleInput = (key, value) => {
        setForm({ ...form, [key]: value });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

                    {/* Header Image */}
                    <View style={styles.headerContainer}>
                        <Image
                            source={{ uri: 'https://media.discordapp.net/attachments/1097251790602375319/1472155637910732842/Test2-removebg-preview_1.png?ex=69918b47&is=699039c7&hm=027dc8a9620906094d6cb314f6e763e1c7ff7ed27e7c7da09471e0aa10c7b27e&=&format=webp&quality=lossless' }}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.headerTitle}>Create Account</Text>
                        <Text style={styles.headerSubtitle}>Please fill in the form to continue</Text>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formContainer}>

                        {/* Fullname */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="person-outline" size={20} color="#006664" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                placeholderTextColor="#999"
                                value={form.fullname}
                                onChangeText={(text) => handleInput('fullname', text)}
                            />
                        </View>

                        {/* Email */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={20} color="#006664" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor="#999"
                                value={form.email}
                                onChangeText={(text) => handleInput('email', text)}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        {/* Username */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="at-outline" size={20} color="#006664" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Username"
                                placeholderTextColor="#999"
                                value={form.username}
                                onChangeText={(text) => handleInput('username', text)}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Password */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={20} color="#006664" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#999"
                                value={form.password}
                                onChangeText={(text) => handleInput('password', text)}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        {/* Confirm Password */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#006664" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
                                placeholderTextColor="#999"
                                value={form.confirmPassword}
                                onChangeText={(text) => handleInput('confirmPassword', text)}
                                secureTextEntry={!showConfirmPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        {/* Department Picker */}
                        <Text style={styles.label}>Faculty / Department</Text>
                        {Platform.OS === 'ios' ? (
                            <>
                                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
                                    <Ionicons name="business-outline" size={20} color="#006664" style={{ marginRight: 10 }} />
                                    <Text style={styles.pickerButtonText}>{form.Dept}</Text>
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
                                                selectedValue={form.Dept}
                                                onValueChange={(text) => handleInput('Dept', text)}
                                                style={{ width: '100%' }}
                                                itemStyle={{ color: '#000', fontSize: 17 }}
                                            >
                                                <Picker.Item label="ศิลปศาสตร์และวิทยาศาสตร์" value="ศิลปศาสตร์และวิทยาศาสตร์" />
                                                <Picker.Item label="เกษตร" value="เกษตร" />
                                                <Picker.Item label="วิทยาศาสตร์การกีฬาและสุขภาพ" value="วิทยาศาสตร์การกีฬาและสุขภาพ" />
                                                <Picker.Item label="ศึกษาศาสตร์และพัฒนศาสตร์" value="ศึกษาศาสตร์และพัฒนศาสตร์" />
                                                <Picker.Item label="อุตสาหกรรมบริการ" value="อุตสาหกรรมบริการ" />
                                                <Picker.Item label="สัตวแพทย์" value="สัตวแพทย์" />
                                            </Picker>
                                        </View>
                                    </View>
                                </Modal>
                            </>
                        ) : (
                            <View style={styles.pickerWrapper}>
                                <Ionicons name="business-outline" size={20} color="#006664" style={styles.pickerIcon} />
                                <Picker
                                    selectedValue={form.Dept}
                                    onValueChange={(text) => handleInput('Dept', text)}
                                    mode="dropdown"
                                    style={styles.picker}
                                    dropdownIconColor="#006664"
                                >
                                    <Picker.Item label="ศิลปศาสตร์และวิทยาศาสตร์" value="ศิลปศาสตร์และวิทยาศาสตร์" />
                                    <Picker.Item label="เกษตร" value="เกษตร" />
                                    <Picker.Item label="วิทยาศาสตร์การกีฬาและสุขภาพ" value="วิทยาศาสตร์การกีฬาและสุขภาพ" />
                                    <Picker.Item label="ศึกษาศาสตร์และพัฒนศาสตร์" value="ศึกษาศาสตร์และพัฒนศาสตร์" />
                                    <Picker.Item label="อุตสาหกรรมบริการ" value="อุตสาหกรรมบริการ" />
                                    <Picker.Item label="สัตวแพทย์" value="สัตวแพทย์" />
                                </Picker>
                            </View>
                        )}

                        {/* Year Picker */}
                        <Text style={styles.label}>Year</Text>
                        {Platform.OS === 'ios' ? (
                            <>
                                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowYearPicker(true)}>
                                    <Ionicons name="school-outline" size={20} color="#006664" style={{ marginRight: 10 }} />
                                    <Text style={styles.pickerButtonText}>{`ชั้นปีที่ ${form.year}`}</Text>
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
                                                selectedValue={form.year}
                                                onValueChange={(text) => handleInput('year', text)}
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
                            <View style={styles.pickerWrapper}>
                                <Ionicons name="school-outline" size={20} color="#006664" style={styles.pickerIcon} />
                                <Picker
                                    selectedValue={form.year}
                                    onValueChange={(text) => handleInput('year', text)}
                                    mode="dropdown"
                                    style={styles.picker}
                                    dropdownIconColor="#006664"
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
                        )}

                        {/* Register Button */}
                        <TouchableOpacity
                            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                            onPress={handleRegister}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#c3eb32" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.buttonText}>Register</Text>
                                    <Ionicons name="arrow-forward-outline" size={20} color="#c3eb32" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Login Link */}
                        <TouchableOpacity
                            style={styles.loginLink}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.loginLinkText}>
                                มีบัญชีแล้ว? <Text style={styles.loginLinkBold}>เข้าสู่ระบบ</Text>
                            </Text>
                        </TouchableOpacity>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f0f2f0',
    },
    scrollContainer: {
        flexGrow: 1,
        paddingBottom: 40,
    },

    /* Header Section */
    headerContainer: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 20,
    },
    logoImage: {
        width: 180,
        height: 180,
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1a3a3a',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#888',
    },

    /* Form Section */
    formContainer: {
        paddingHorizontal: 25,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006664',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        marginTop: 10,
    },

    /* Inputs */
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        height: 55,
        paddingHorizontal: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e8ebe8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#2D3748',
        height: '100%',
    },

    /* Pickers */
    pickerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        height: 55,
        paddingLeft: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e8ebe8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    pickerIcon: {
        marginRight: 6,
    },
    picker: {
        flex: 1,
        color: '#2D3748',
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        height: 55,
        paddingHorizontal: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e8ebe8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    pickerButtonText: {
        flex: 1,
        fontSize: 15,
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

    /* Register Button */
    registerButton: {
        flexDirection: 'row',
        backgroundColor: '#006664',
        height: 55,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 25,
        shadowColor: '#006664',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    registerButtonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#c3eb32',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },

    /* Login Link */
    loginLink: {
        marginTop: 20,
        padding: 10,
        alignItems: 'center',
    },
    loginLinkText: {
        color: '#666',
        fontSize: 14,
    },
    loginLinkBold: {
        color: '#006664',
        fontWeight: 'bold',
    },
});

export default Register;