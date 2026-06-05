import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { View, Text, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import * as React from 'react';

// ─── Top-level diagnostic wrapper ──────────────────────────────────────────
// Catches module-load errors (before React mounts) so Android doesn't show a
// pure white screen. If ANY require/import below this throws, we register a
// fallback diagnostic component that renders the error on-screen.

let bootError: Error | null = null;
let App: any = null;
const bootLog: string[] = [];

function logBoot(msg: string) {
    bootLog.push(msg);
    // eslint-disable-next-line no-console
    console.log('[boot]', msg);
}

logBoot('index.ts: start');

try {
    logBoot('require react-native-track-player');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TrackPlayer = require('react-native-track-player').default;
    logBoot('require trackPlayerService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PlaybackService } = require('./utils/trackPlayerService');
    logBoot('registerPlaybackService');
    TrackPlayer.registerPlaybackService(() => PlaybackService);
    logBoot('TrackPlayer registration: ok');
} catch (e: any) {
    bootError = e;
    logBoot('TrackPlayer registration FAILED: ' + (e?.message ?? String(e)));
}

try {
    logBoot('require ./App');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    App = require('./App').default;
    logBoot('App loaded: ok');
} catch (e: any) {
    bootError = e;
    logBoot('App load FAILED: ' + (e?.message ?? String(e)));
}

// Diagnostic fallback shown ONLY when boot fails. Pure JS, no native deps,
// so it can render even if a native module is broken.
const BootError: React.FC = () => {
    const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
    return React.createElement(
        View,
        { style: { flex: 1, backgroundColor: '#1a0000', padding: 24, paddingTop: 80 } },
        React.createElement(
            Text,
            { style: { color: '#ff6b6b', fontSize: 18, fontWeight: 'bold', marginBottom: 12 } },
            'Tahajjud+ failed to boot'
        ),
        React.createElement(
            Text,
            { style: { color: '#ffcccc', fontSize: 14, fontFamily: monoFont, marginBottom: 12 } },
            bootError
                ? `${bootError.name}: ${bootError.message}`
                : 'Unknown boot failure (no error captured)'
        ),
        bootError?.stack &&
            React.createElement(
                Text,
                { style: { color: '#ff9999', fontSize: 11, fontFamily: monoFont, marginBottom: 12 } },
                String(bootError.stack).slice(0, 1500)
            ),
        React.createElement(
            Text,
            { style: { color: '#ffaaaa', fontSize: 10, fontFamily: monoFont, marginBottom: 12 } },
            'Boot log:\n' + bootLog.join('\n')
        ),
        React.createElement(
            Text,
            { style: { color: '#fff', fontSize: 12, marginTop: 8, opacity: 0.7 } },
            `Platform: ${Platform.OS} ${Platform.Version}`
        ),
        React.createElement(
            Text,
            { style: { color: '#fff', fontSize: 12, marginTop: 4, opacity: 0.7 } },
            'Screenshot this and send to support.'
        )
    );
};

// Register either the real App (if it loaded) or the diagnostic fallback.
const Root: React.FC = () =>
    bootError || !App ? React.createElement(BootError) : React.createElement(App);

logBoot('registerRootComponent');
registerRootComponent(Root);
