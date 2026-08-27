import React from "react";
import { StyleSheet, Text, View, Image, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ActivityScreen from "./src/screens/ActivityScreen";
import DashboardScreen from "./src/screens/DashBoardScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import TimeTableScreen from "./src/screens/TimeTableScreen";
import Register from "./src/screens/Register";
import LoginScreen from "./src/screens/LoginScreen";
import { UserProvider, UserContext } from "./src/context/userContext";
import CreateScreen from "./src/screens/CreateScreen";
import { TaskProvider, TaskContext } from "./src/context/TaskContext";
import { EventProvider, EventContext } from "./src/context/eventContext";
import ExamScreen from "./src/screens/ExamScreen";
import CreateExamScreen from "./src/screens/CreateExamScreen"
import { ExamProvider, ExamContext } from "./src/context/examContext";

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// เป็น helper component ที่คอยซิงค์ dispatch ให้กับ userContext
const GlobalSyncLogic = () => {
  const { setGlobalDispatchers } = React.useContext(UserContext);
  const { dispatch: eventDispatch } = React.useContext(EventContext);
  const { dispatch: examDispatch } = React.useContext(ExamContext);
  const { dispatch: taskDispatch } = React.useContext(TaskContext);

  React.useEffect(() => {
    if (setGlobalDispatchers) {
      setGlobalDispatchers({ eventDispatch, examDispatch, taskDispatch });
    }
  }, [setGlobalDispatchers, eventDispatch, examDispatch, taskDispatch]);

  return null;
};

// เป็น Stack Navigator ของส่วนตารางเรียน
const TimeTableStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name='TimeTable'
        component={TimeTableScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name='Create'
        component={CreateScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name='Exam'
        component={ExamScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name='CreateExam'
        component={CreateExamScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  )
}

// เป็น Tab Navigator สำหรับจัดการแถบเมนูด้านล่าง
const AllTabsScreen = () => {
  return (
    <Tab.Navigator
      initialRouteName="DashboardScreen"
      screenOptions={{
        headerTintColor: '#fff',
        headerStyle: { height: 100, backgroundColor: '#006664', borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
        tabBarActiveTintColor: '#c3eb32ff',
        tabBarInactiveTintColor: '#e4e6e2ff',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#006664',
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        headerTitle: () => (
          <Image
            source={{ uri: 'https://cdn.discordapp.com/attachments/1097251790602375319/1472152473077682301/Gemini_Generated_Image_agwzv4agwzv4agwz-removebg-preview_1.png?ex=69b27dd4&is=69b12c54&hm=8392ccccb528f46fcfdfd76315a429d760efc4edfbf42477ee44e28d1fedd259&' }}
            style={{ width: 100, height: 100, marginBottom: 10, resizeMode: 'contain' }}
          />
        ),
      }}
    >
      <Tab.Screen
        name='DashboardScreen'
        component={DashboardScreen}
        options={{ title: 'Dashboard', tabBarIcon: ({ focused, color, size }) => (<Ionicons name={focused ? 'grid' : 'grid-outline'} color={color} size={22} />) }}
      />
      <Tab.Screen
        name='TimeTableScreen'
        component={TimeTableStack}
        options={{ title: 'TimeTable', tabBarIcon: ({ focused, color, size }) => (<Ionicons name={focused ? 'time' : 'time-outline'} color={color} size={22} />) }}
      />
      <Tab.Screen
        name='ActivityScreen'
        component={ActivityScreen}
        options={{ title: 'Activity', tabBarIcon: ({ focused, color, size }) => (<Ionicons name={focused ? 'list-circle' : 'list-circle-outline'} color={color} size={24} />) }}
      />
      <Tab.Screen
        name='ProfileScreen'
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ focused, color, size }) => (<Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={22} />) }}
      />

    </Tab.Navigator>
  )
}

// เป็นฟังก์ชันหลักของแอปที่รวม Provider และ Stack Navigator เข้าไว้ด้วยกัน
export default function App() {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <TaskProvider>
          <EventProvider>
            <ExamProvider>
              <GlobalSyncLogic />
              <NavigationContainer>
                <Stack.Navigator initialRouteName="Login" screenOptions={{ headerTintColor: '#fff', headerStyle: { backgroundColor: '#006664', borderBottomRightRadius: 20, borderBottomLeftRadius: 20, position: 'absolute', height: 100 } }}>
                  <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="Register"
                    component={Register}
                    options={{ headerShown: false }}
                  />

                  <Stack.Screen
                    name="HomeApp"
                    component={AllTabsScreen}
                    options={{ headerShown: false }}
                  />
                </Stack.Navigator>
              </NavigationContainer >
            </ExamProvider>
          </EventProvider>
        </TaskProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
