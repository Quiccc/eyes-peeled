import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { Button } from '@/components/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, ShareCard } from './share-card';
import type { ShareFind } from './types';

type Props = {
  find: ShareFind | null;
  onClose: () => void;
};

/** Preview of the branded card + "Share" → system share sheet (Instagram, WhatsApp, Save image, …). */
export function ShareFindSheet({ find, onClose }: Props) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  // Shrink the preview on narrow phones; the capture is unaffected (it renders the card at its own size).
  const scale = Math.min(1, (screenWidth - Spacing.three * 4) / SHARE_CARD_WIDTH);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const ready = !!find && loadedUri === find.imageUri;

  const share = async () => {
    if (!cardRef.current || !ready) return;
    setSharing(true);
    let uri: string | null = null;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', "This device doesn't support sharing images.");
        return;
      }
      uri = await captureRef(cardRef, { format: 'jpg', quality: 0.92, width: SHARE_CARD_WIDTH * 3, result: 'tmpfile' });
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      // Resolves when the share sheet closes — whether the user shared or dismissed it.
      await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Share your find' });
      onClose();
    } catch (e) {
      Alert.alert('Could not share', errorMessage(e));
    } finally {
      if (uri) releaseCapture(uri);
      setSharing(false);
    }
  };

  return (
    <Modal visible={!!find} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={sharing ? undefined : onClose} accessibilityLabel="Close">
        {find && (
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={() => {}}>
            <View style={{ width: SHARE_CARD_WIDTH * scale, height: SHARE_CARD_HEIGHT * scale }}>
              <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
                <ShareCard ref={cardRef} find={find} onImageLoad={() => setLoadedUri(find.imageUri)} />
              </View>
              {!ready && <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" />}
            </View>
            <View style={styles.actions}>
              <Button title="Share" loading={sharing} disabled={!ready} onPress={share} />
              <Button title="Cancel" variant="ghost" disabled={sharing} onPress={onClose} />
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

/** `const { share, sheet } = useShareFind();` — call share(find), render {sheet} once in the screen. */
export function useShareFind() {
  const [find, setFind] = useState<ShareFind | null>(null);
  return {
    share: (next: ShareFind | null) => {
      if (next) setFind(next);
    },
    sheet: <ShareFindSheet find={find} onClose={() => setFind(null)} />,
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  sheet: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
});
