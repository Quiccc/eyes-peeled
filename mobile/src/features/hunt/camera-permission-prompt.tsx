import type { PermissionResponse } from 'expo-camera';
import { Linking, StyleSheet } from 'react-native';

import type { DailyWord } from '@/api/types';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { HuntActions, HuntScreenShell, HuntStatus, huntStyles, HuntTarget, PhotoFrame } from '@/features/hunt/hunt-layout';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  word: DailyWord;
  permission: PermissionResponse;
  requestPermission: () => unknown;
  onClose: () => void;
};

/** Camera access not granted yet: ask for it, or send the player to Settings if they can't be asked again. */
export function CameraPermissionPrompt({ word, permission, requestPermission, onClose }: Props) {
  const theme = useTheme();
  const canAsk = permission.canAskAgain;
  return (
    <HuntScreenShell>
      <HuntTarget word={word} />
      <PhotoFrame borderColor={theme.border} style={styles.frame}>
        <Icon name="camera" size={72} color={theme.textSecondary} />
      </PhotoFrame>
      <HuntStatus style={styles.status}>
        <ThemedText type="subtitle" style={huntStyles.centerText}>
          {canAsk ? 'Allow the camera' : 'Camera is off'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
          {canAsk
            ? 'Word Hunt needs your camera to snap your find.'
            : 'Turn on camera access for Word Hunt in Settings to snap your find.'}
        </ThemedText>
      </HuntStatus>
      <HuntActions>
        <Button
          title={canAsk ? 'Allow camera' : 'Open settings'}
          icon={canAsk ? 'camera' : undefined}
          onPress={() => (canAsk ? requestPermission() : Linking.openSettings())}
        />
        <Button title="Not now" variant="ghost" onPress={onClose} />
      </HuntActions>
    </HuntScreenShell>
  );
}

const styles = StyleSheet.create({
  frame: {
    maxHeight: 320,
  },
  status: {
    flex: 1,
    justifyContent: 'center',
  },
});
