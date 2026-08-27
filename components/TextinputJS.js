import React from "react";
import { Text, View, StyleSheet, TextInput } from 'react-native'

// เป็น Component ช่องกรอกข้อความที่สามารถปรับแต่งค่าได้
const TextInputJS = ({ holder, value, onChange }) => {
    return (
        <View>
            <TextInput
                style={styles.input}
                placeholder={holder}
                value={value}
                onChangeText={onChange}>
            </TextInput>
        </View>
    )
}

const styles = StyleSheet.create({
    input: {
        width: 350,
        height: 50,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        paddingHorizontal: 20,
        borderColor: '#b6b6b6',
        borderRadius: 10,
        justifyContent: 'center'
    }
})

export default TextInputJS
