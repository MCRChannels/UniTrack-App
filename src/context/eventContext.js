import React, { createContext, useReducer } from "react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const EventContext = createContext();

// ฟังก์ชัน Reducer ไว้สำหรับจัดการข้อมูลกิจกรรม (Event)
const eventReducer = (state, action) => {
    switch (action.type) {
        case "SET_EVENTS":
            return action.payload;
        case "ADD_OR_UPDATE":
            const isOverlap = state.find(
                (event) =>
                    event.day === action.payload.day &&
                    event.startTime === action.payload.startTime
            );

            if (isOverlap) {
                // Validation is handled in screen components before dispatching
                return state;
            }

            const newEvent = {
                ...action.payload,
                id: action.payload.firestoreId || action.payload.id || Date.now().toString(),
            };

            return [newEvent, ...state];
        case "UPDATE_EVENT":
            return state.map((item) =>
                item.id === action.payload.id ? action.payload : item,
            );
        case "DELETE_EVENT":
            // Support both string payload (title) and object payload ({title, userId, firestoreId})
            const deleteTitle = typeof action.payload === 'string' ? action.payload : action.payload?.title;
            const deleteUserId = typeof action.payload === 'object' ? action.payload?.userId : null;
            const deleteFirestoreId = typeof action.payload === 'object' ? action.payload?.firestoreId : null;

            // Delete from Firestore if we have the needed info
            if (deleteUserId && deleteFirestoreId) {
                deleteDoc(doc(db, "users", deleteUserId, "events", deleteFirestoreId))
                    .catch(err => console.log("Delete event error:", err));
            }
            if (!deleteTitle) return state;
            return state.filter((item) => item.title?.toLowerCase() !== deleteTitle.toLowerCase());
        case "CLEAR_ALL":
            return [];
        default:
            return state;
    }
};

// คอมโพเนนต์ Provider สำหรับกระจายข้อมูล Event ทั่วทั้งแอป
export const EventProvider = ({ children }) => {
    const [events, dispatch] = useReducer(eventReducer, []);

    return (
        <EventContext.Provider value={{ events, dispatch }}>
            {children}
        </EventContext.Provider>
    );
};
