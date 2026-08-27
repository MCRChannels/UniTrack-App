import React, { createContext, useReducer } from "react";
import { Alert } from 'react-native';
import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { EventContext } from "./eventContext";
import { ExamContext } from "./examContext";
import { TaskContext } from "./TaskContext";

export const UserContext = createContext();

// ฟังก์ชัน Reducer สำหรับจัดการข้อมูลผู้ใช้และการเข้าสู่ระบบ
const userReducer = (state, action) => {
    switch (action.type) {
        case 'SET_CURRENT_USER':
            return {
                ...state,
                currentUser: action.payload,
            };
        case 'ADDED':
            const existUserIndex = state.users.findIndex((item) => item.username.toLowerCase() === action.payload.username.toLowerCase());
            if (existUserIndex !== -1) {
                Alert.alert('Notifications', 'Username นี้ถูกใช้งานไปแล้ว');
                return state;
            }
            const newUser = {
                ...action.payload,
                id: action.payload.id || Date.now().toString()
            };
            return { ...state, users: [...state.users, newUser] };
        case 'UPDATE_USER':
            // Update Firestore (fire-and-forget)
            if (action.payload.id) {
                updateDoc(doc(db, "users", action.payload.id), action.payload).catch(err => console.log("Update user error:", err));
            }
            return {
                ...state,
                currentUser: state.currentUser?.id === action.payload.id
                    ? { ...state.currentUser, ...action.payload }
                    : state.currentUser,
                users: state.users.map(item => item.id === action.payload.id ? { ...item, ...action.payload } : item),
            };
        case 'DELETE_USER':
            if (action.payload) {
                deleteDoc(doc(db, "users", action.payload)).catch(err => console.log("Delete user error:", err));
            }
            return {
                ...state,
                currentUser: null,
                users: state.users.filter(user => user.id !== action.payload),
            };
        case 'LOGOUT':
            return {
                ...state,
                currentUser: null,
            };
        default:
            return state;
    }
};

const initialState = {
    users: [],
    currentUser: null,
};

// คอมโพเนนต์ Provider ดูแลผู้ใช้งานและช่วยเชื่อมต่อการอัปเดตข้อมูลแบบสด (Real-time)
export const UserProvider = ({ children }) => {
    const [state, dispatch] = useReducer(userReducer, initialState);

    // Listeners state to keep track of unsubscribes
    const [unsubscribers, setUnsubscribers] = React.useState([]);

    // We will inject context dispatchers for global real-time sync
    const [globalDispatchers, setGlobalDispatchers] = React.useState(null);

    React.useEffect(() => {
        // Clear old listeners if user changes or logs out
        unsubscribers.forEach(unsub => unsub());
        setUnsubscribers([]);

        if (state.currentUser?.id) {
            const uid = state.currentUser.id;
            const newUnsubs = [];

            // 0. Profile listener (Real-time sync for current user)
            const unsubProfile = onSnapshot(doc(db, "users", uid), (snapshot) => {
                if (snapshot.exists()) {
                    const userData = { id: snapshot.id, ...snapshot.data() };
                    // Avoid infinite loop if data is already same, but dispatch usually handles it
                    dispatch({ type: 'SET_CURRENT_USER', payload: userData });
                }
            });
            newUnsubs.push(unsubProfile);

            if (globalDispatchers) {
                // 1. Events listener
                const unsubEvents = onSnapshot(collection(db, "users", uid, "events"), (snapshot) => {
                    const events = snapshot.docs.map(d => ({ ...d.data(), id: d.id, firestoreId: d.id }));
                    globalDispatchers.eventDispatch({ type: "SET_EVENTS", payload: events });
                });
                newUnsubs.push(unsubEvents);

                // 2. Exams listener
                const unsubExams = onSnapshot(collection(db, "users", uid, "exams"), (snapshot) => {
                    const exams = snapshot.docs.map(d => ({ ...d.data(), id: d.id, firestoreId: d.id }));
                    globalDispatchers.examDispatch({ type: "SET_EXAMS", payload: exams });
                });
                newUnsubs.push(unsubExams);

                // 3. Tasks listener
                const unsubTasks = onSnapshot(collection(db, "users", uid, "tasks"), (snapshot) => {
                    const tasks = snapshot.docs.map(d => ({ ...d.data(), id: d.id, firestoreId: d.id }));
                    globalDispatchers.taskDispatch({ type: "SET_TASKS", payload: tasks });
                });
                newUnsubs.push(unsubTasks);

                // 4. Activities listener (Added for completeness if not already handled elsewhere)
                const unsubActivities = onSnapshot(collection(db, "users", uid, "activities"), (snapshot) => {
                    const activities = snapshot.docs.map(d => ({ ...d.data(), id: d.id, firestoreId: d.id }));
                    if (globalDispatchers.activityDispatch) {
                        globalDispatchers.activityDispatch({ type: "SET_ACTIVITIES", payload: activities });
                    }
                });
                newUnsubs.push(unsubActivities);
            }
            setUnsubscribers(newUnsubs);
        }

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [state.currentUser?.id, globalDispatchers]);

    return (
        <UserContext.Provider value={{
            users: state.users,
            currentUser: state.currentUser,
            dispatch,
            setGlobalDispatchers
        }}>
            {children}
        </UserContext.Provider>
    );
};
