import React, { createContext, useReducer } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const TaskContext = createContext();

// ฟังก์ชัน Reducer ไว้จัดการ State ของงาน (Task) เช่น เพิ่ม หรือลบงาน
const taskReducer = (state, action) => {
  switch (action.type) {
    case "SET_TASKS":
      return action.payload;
    case "ADD_TASK":
      const isDuplicate = state.find(
        (task) => task.title.toLowerCase() === action.payload.title.toLowerCase()
      );

      if (isDuplicate) return state;

      const newTask = {
        id: Date.now().toString(),
        title: action.payload.title,
        description: action.payload.description || "",
        completed: false,
      };

      // Save to Firestore if userId is present
      if (action.payload.userId) {
        addDoc(collection(db, "users", action.payload.userId, "tasks"), {
          title: newTask.title,
          description: newTask.description,
          completed: false,
        }).then((docRef) => {
          newTask.firestoreId = docRef.id;
        }).catch(err => console.log("Add task error:", err));
      }

      return [newTask, ...state];

    case "TOGGLE_COMPLETED":
      const toggledTasks = state.map((task) => {
        if (task.id === action.payload.id) {
          const updated = { ...task, completed: !task.completed };
          // Update Firestore
          if (action.payload.userId && task.firestoreId) {
            updateDoc(doc(db, "users", action.payload.userId, "tasks", task.firestoreId), {
              completed: updated.completed,
            }).catch(err => console.log("Toggle task error:", err));
          }
          return updated;
        }
        return task;
      });
      return toggledTasks;

    case "DELETE_TASK":
      if (action.payload.userId && action.payload.firestoreId) {
        deleteDoc(doc(db, "users", action.payload.userId, "tasks", action.payload.firestoreId))
          .catch(err => console.log("Delete task error:", err));
      }
      return state.filter((task) => task.id !== action.payload.id);

    case "CLEAR_ALL":
      return [];

    default:
      return state;
  }
};

// ฟังก์ชัน Provider ให้ข้อมูล TaskContext กระจายไปยังส่วนต่างๆ ของแอป
export const TaskProvider = ({ children }) => {
  const [tasks, dispatch] = useReducer(taskReducer, []);

  return (
    <TaskContext.Provider value={{ tasks, dispatch }}>
      {children}
    </TaskContext.Provider>
  );
};