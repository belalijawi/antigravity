import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
    console.log('=== TAHAJJUD APP LOADED ===');

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Tahajjud App</Text>
            <Text style={styles.subtext}>If you see this, the app is working!</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    subtext: {
        color: '#94a3b8',
        fontSize: 16,
    },
});
