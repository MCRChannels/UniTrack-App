import React, { createContext, useReducer } from "react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const ExamContext = createContext();

// ฟังก์ชัน Reducer สำหรับจัดการ State ของการสอบ (Exam)
const examReducer = (state, action) => {
  switch (action.type) {
    case "SET_EXAMS":
      return action.payload;
    case "ADD_OR_UPDATE":
      const isOverlap = state.find(
        (exam) =>
          exam.date === action.payload.date &&
          exam.startTime === action.payload.startTime
      );

      if (isOverlap) {
        return state;
      }

      const newExam = {
        ...action.payload,
        id: action.payload.firestoreId || action.payload.id || Date.now().toString(),
      };

      return [newExam, ...state];

    case "UPDATE_EXAM":
      return state.map((exam) =>
        exam.id === action.payload.id ? { ...exam, ...action.payload } : exam
      );

    case "DELETE_EXAM":
      // Support both string payload (title) and object payload ({title, userId, firestoreId})
      const delTitle = typeof action.payload === 'string' ? action.payload : action.payload?.title;
      const delUserId = typeof action.payload === 'object' ? action.payload?.userId : null;
      const delFirestoreId = typeof action.payload === 'object' ? action.payload?.firestoreId : null;

      if (delUserId && delFirestoreId) {
        deleteDoc(doc(db, "users", delUserId, "exams", delFirestoreId))
          .catch(err => console.log("Delete exam error:", err));
      }
      if (!delTitle) return state;
      return state.filter((exam) => exam.title?.toLowerCase() !== delTitle.toLowerCase());

    case "CLEAR_ALL":
      return [];

    default:
      return state;
  }
};

// คอมโพเนนต์ Provider แจกจ่ายข้อมูลการสอบไปให้ส่วนอื่นๆ ใช้งาน
export const ExamProvider = ({ children }) => {
  const [exams, dispatch] = useReducer(examReducer, []);

  return (
    <ExamContext.Provider value={{ exams, dispatch }}>
      {children}
    </ExamContext.Provider>
  );
};