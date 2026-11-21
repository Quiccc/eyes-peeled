import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import { api } from '@/api/endpoints';
import type { User } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { useAsyncAction } from '@/hooks/use-async-action';
import { queryKeys } from '@/lib/query-client';

import { prepareAvatar } from './prepare-avatar';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
};

/**
 * Change the signed-in player's profile picture: take one with the camera, pick one from the
 * library, or remove it. `busy` is true while a picture is being prepared or uploaded.
 */
export function useAvatarPicker() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const action = useAsyncAction<'avatar'>();

  const saved = (next: User) => {
    updateUser(next);
    // Lists that show the player's own avatar.
    queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    queryClient.invalidateQueries({ queryKey: queryKeys.leaderboardAll });
  };

  const pick = (source: 'camera' | 'library') =>
    action.run(
      'avatar',
      async () => {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Camera access needed', 'Allow camera access in Settings to take a profile picture.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => void Linking.openSettings() },
            ]);
            return;
          }
        }
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ ...PICKER_OPTIONS, cameraType: ImagePicker.CameraType.front })
            : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
        const asset = result.canceled ? null : result.assets[0];
        if (!asset) return;
        saved(await api.setAvatar(await prepareAvatar(asset)));
      },
      { errorTitle: 'Could not update your picture' },
    );

  const remove = () =>
    action.run('avatar', async () => saved(await api.removeAvatar()), { errorTitle: 'Could not remove your picture' });

  // Android alerts show at most 3 buttons, so "Remove" moves the source choice one step deeper.
  const chooseSource = (title: string) =>
    Alert.alert(title, undefined, [
      { text: 'Take photo', onPress: () => void pick('camera') },
      { text: 'Choose from library', onPress: () => void pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const open = () => {
    if (!user?.avatarUrl) return chooseSource('Add a profile picture');
    Alert.alert('Profile picture', undefined, [
      { text: 'Change picture', onPress: () => chooseSource('Change profile picture') },
      { text: 'Remove picture', style: 'destructive', onPress: () => void remove() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return { open, busy: action.busy === 'avatar' };
}
