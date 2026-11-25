import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { Button } from '@/components/button';
import { ShareIcon } from '@/components/hunt-icons';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';

import { SHARE_CAPTURE_WIDTH, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, ShareCard } from './share-card';
import type { ShareFind } from './types';

type Props = {
  find: ShareFind | null;
  onClose: () => void;
};

/** Preview of the branded card + "Share" → system share sheet (Instagram, WhatsApp, Save image, …). */
function ShareFindSheet({ find, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Shrink the preview on narrow phones; the capture is unaffected (it renders the card at its own size).
  const scale = Math.min(1, (screenWidth - Spacing.three * 4 - SHEET_BORDER * 2) / SHARE_CARD_WIDTH);
  const sheetWidth = SHARE_CARD_WIDTH * scale + Spacing.three * 2 + SHEET_BORDER * 2;
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
      // PNG keeps the card's rounded corners transparent.
      uri = await captureRef(cardRef, { format: 'png', width: SHARE_CAPTURE_WIDTH, result: 'tmpfile' });
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      // Resolves when the share sheet closes — whether the user shared or dismissed it.
      await Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your find' });
      onClose();
    } catch (e) {
      Alert.alert('Could not share', errorMessage(e));
    } finally {
      if (uri) releaseCapture(uri);
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={!!find}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        {/* The backdrop sits behind the sheet, so taps on the sheet never reach it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={sharing ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        {find && (
          // A fixed width stops the sheet from being sized to its content: in that pass the
          // Share button's face (flexGrow in Chunky) grew to the screen height.
          <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, borderColor: theme.border, width: sheetWidth }]}>
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
              Share your find
            </ThemedText>
            <View style={{ width: SHARE_CARD_WIDTH * scale, height: SHARE_CARD_HEIGHT * scale }}>
              <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
                <ShareCard ref={cardRef} find={find} onImageLoad={() => setLoadedUri(find.imageUri)} />
              </View>
              {!ready && <ActivityIndicator style={StyleSheet.absoluteFill} color={theme.textSecondary} />}
            </View>
            <View style={styles.actions}>
              <Button title="Share" iconNode={<ShareIcon size={20} />} loading={sharing} disabled={!ready} onPress={share} />
              <Button title="Cancel" variant="ghost" disabled={sharing} onPress={onClose} />
            </View>
          </View>
        )}
      </View>
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

const SHEET_BORDER = 2;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // The app's dark ground at 60%.
    backgroundColor: 'rgba(26,20,16,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  sheet: {
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: SHEET_BORDER,
    borderBottomWidth: Edge.card,
    padding: Spacing.three,
    gap: 14,
  },
  title: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
});
