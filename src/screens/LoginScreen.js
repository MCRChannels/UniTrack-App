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
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { UserContext } from "../context/userContext";
import { EventContext } from "../context/eventContext";
import { ExamContext } from "../context/examContext";
import { TaskContext } from "../context/TaskContext";

// หน้าจอสำหรับล็อกอินเข้าสู่ระบบ
const LoginScreen = ({ navigation }) => {
    const { dispatch: userDispatch } = useContext(UserContext);
    const { dispatch: eventDispatch } = useContext(EventContext);
    const { dispatch: examDispatch } = useContext(ExamContext);
    const { dispatch: taskDispatch } = useContext(TaskContext);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // (Removed getDocs function as App.js now handles real-time subscriptions)
    // ฟังก์ชันตรวจสอบอีเมลรหัสผ่าน และล็อกอินผ่าน Firebase
    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอก Email และ Password ให้ครบครับ');
            return;
        }

        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            // Load user profile from Firestore
            const userDoc = await getDoc(doc(db, "users", uid));
            let userData = {};
            if (userDoc.exists()) {
                userData = { id: uid, ...userDoc.data() };
            } else {
                userData = {
                    id: uid,
                    email: email,
                    fullname: userCredential.user.displayName || '',
                    username: '',
                    Dept: '',
                    year: '',
                    image: null,
                };
            }

            // Set current user in context
            userDispatch({ type: 'SET_CURRENT_USER', payload: userData });

            // Global listeners in UserContext will automatically fetch classes, exams, and tasks.
            navigation.reset({
                index: 0,
                routes: [{ name: 'HomeApp', params: { screen: 'ProfileScreen', params: { user: userData } } }],
            });

        } catch (error) {
            let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                errorMessage = 'Email หรือ Password ไม่ถูกต้องครับ';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Password ไม่ถูกต้องครับ';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'รูปแบบ Email ไม่ถูกต้องครับ';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่ครับ';
            }
            Alert.alert('เข้าสู่ระบบไม่สำเร็จ', errorMessage);
        } finally {
            setLoading(false);
        }
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
                            source={{ uri: 'https://cdn.discordapp.com/attachments/1097251790602375319/1472155637910732842/Test2-removebg-preview_1.png?ex=69b280c7&is=69b12f47&hm=ed33020238c33e5566bb74a31f420252305f9d0af49163ce9f27f8c4bded9753&' }}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.headerTitle}>Welcome Back!</Text>
                        <Text style={styles.headerSubtitle}>เข้าสู่ระบบเพื่อจัดการตารางเรียนของคุณ</Text>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formContainer}>

                        {/* Email */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={20} color="#006664" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        {/* Password */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={20} color="#006664" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#c3eb32" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>
                                    <Ionicons name="arrow-forward-outline" size={20} color="#c3eb32" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>หรือ</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Register Link */}
                        <TouchableOpacity
                            style={styles.registerLink}
                            onPress={() => navigation.navigate('Register')}
                        >
                            <Text style={styles.registerLinkText}>
                                ยังไม่มีบัญชี? <Text style={styles.registerLinkBold}>สมัครสมาชิก</Text>
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
        justifyContent: 'center',
        paddingBottom: 20,
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
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a3a3a',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
    },

    /* Form Section */
    formContainer: {
        paddingHorizontal: 25,
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

    /* Login Button */
    loginButton: {
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
    loginButtonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#c3eb32',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },

    /* Divider */
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 25,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#ddd',
    },
    dividerText: {
        marginHorizontal: 15,
        color: '#999',
        fontSize: 13,
        fontWeight: '600',
    },

    /* Register Link */
    registerLink: {
        alignItems: 'center',
        padding: 10,
    },
    registerLinkText: {
        color: '#666',
        fontSize: 14,
    },
    registerLinkBold: {
        color: '#006664',
        fontWeight: 'bold',
    },
});

export default LoginScreen;
