import type { PermissionResponse } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import type { DailyWord } from '@/api/types';
import { Button } from '@/components/button';
import { GearIcon } from '@/components/hunt-icons';
import { CameraEyeArt } from '@/components/illustrations/hunt-art';
import { HuntCameraIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { HuntActions, HuntScreenShell, HuntStatus, huntStyles, HuntTopBar } from '@/features/hunt/hunt-layout';

type Props = {
  word: DailyWord;
  permission: PermissionResponse;
  requestPermission: () => unknown;
  onClose: () => void;
};

/** Camera access not granted yet: ask for it, or send the player to Settings if they can't be asked again. */
export function CameraPermissionPrompt({ word, permission, requestPermission, onClose }: Props) {
  const { t } = useTranslation();
  const canAsk = permission.canAskAgain;
  return (
    <HuntScreenShell>
      <HuntTopBar word={word} />
      <HuntStatus>
        <CameraEyeArt closed={!canAsk} />
        <ThemedText type="subtitle" style={huntStyles.centerText}>
          {canAsk ? t('camera.permissionTitle') : t('camera.offTitle')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={huntStyles.centerText}>
          {canAsk ? t('camera.permissionBody') : t('camera.offBody')}
        </ThemedText>
      </HuntStatus>
      <HuntActions>
        {canAsk ? (
          <Button title={t('camera.allow')} iconNode={<HuntCameraIcon size={20} />} onPress={() => requestPermission()} />
        ) : (
          <Button title={t('camera.openSettings')} iconNode={<GearIcon />} onPress={() => Linking.openSettings()} />
        )}
        <Button title={t('common.notNow')} variant="ghost" onPress={onClose} />
      </HuntActions>
    </HuntScreenShell>
  );
}
