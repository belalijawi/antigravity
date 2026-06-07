import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * Runs in the background (separate JS context on iOS).
 * Wires up lock-screen / Control Centre button handlers.
 */
export async function PlaybackService() {
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
    TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
    TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
    // Handles the lock-screen / Control Centre scrubber drag.
    // Without this, Capability.SeekTo is declared but the seek is silently ignored.
    TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
        TrackPlayer.seekTo(position);
    });
}
