# 📚 Student Planner — Mobile Application

A full-featured student productivity app built with **React Native (Expo)** and **Firebase**. Manage your class schedule, track activities, stay on top of exams, and keep your academic life organized — all in one place.

[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-blue?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=for-the-badge&logo=react)](https://reactnative.dev)
[![Firebase](https://img.shields.io/badge/Firebase-v12-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com)

---

## ✨ Features

- **Dashboard**: A personalized home screen showing an overview of today's schedule, upcoming exams, and pending activities.
- **Timetable Management**: Add, view, and organize your weekly class schedule with ease.
- **Activity Tracker**: Log and manage academic activities and to-do items.
- **Exam Planner**: Create and track upcoming exams with dates and details.
- **User Authentication**: Secure login and registration backed by Firebase Auth.
- **Profile Management**: View and update your profile, including photo upload via Cloudinary.
- **Persistent State**: Context-based global state management for users, tasks, events, and exams.

---

## 🛠️ Tech Stack

**Mobile (Frontend):**
- React Native `0.81`
- Expo SDK `~54`
- React Navigation (Stack + Bottom Tabs)
- Expo Vector Icons
- Expo Image Picker
- AsyncStorage
- React `19`

**Backend & Cloud:**
- Firebase (Authentication + Firestore)
- Cloudinary (Profile image storage)

**Testing:**
- Jest `^30`
- jest-expo
- @testing-library/react-native

---

## 📁 Project Structure

```
MobileApplicationProject/
├── App.js                   # Root component — navigation & providers
├── index.js                 # Expo entry point
├── app.json                 # Expo app configuration
├── components/
│   └── TextinputJS.js       # Reusable text input component
├── src/
│   ├── context/             # Global state providers
│   │   ├── userContext.js
│   │   ├── TaskContext.js
│   │   ├── eventContext.js
│   │   └── examContext.js
│   ├── screens/             # App screens
│   │   ├── LoginScreen.js
│   │   ├── Register.js
│   │   ├── DashBoardScreen.js
│   │   ├── TimeTableScreen.js
│   │   ├── CreateScreen.js
│   │   ├── ActivityScreen.js
│   │   ├── ExamScreen.js
│   │   ├── CreateExamScreen.js
│   │   └── ProfileScreen.js
│   ├── firebaseConfig.js    # Firebase initialization
│   └── cloudinaryConfig.js  # Cloudinary configuration
└── __tests__/               # Unit tests
    ├── eventReducer.test.js
    ├── examReducer.test.js
    ├── formValidation.test.js
    └── utilityFunctions.test.js
```

---

## 📄 License

This project is for educational purposes as part of a Mobile Application Development course.
