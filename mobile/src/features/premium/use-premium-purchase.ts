import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import type { User } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { useAsyncAction } from '@/hooks/use-async-action';
import { queryKeys } from '@/lib/query-client';
import { buyPremium, type PremiumOffer, restorePremium } from '@/purchases/purchases';

/**
 * Buy or restore Premium. The server decides `isPremium`; the user it returns replaces ours and
 * today's words reload (the Premium word appears). `onPremium` runs once Premium is active.
 */
export function usePremiumPurchase({ onPremium }: { onPremium: () => void }) {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { busy, run } = useAsyncAction<'buy' | 'restore'>();

  const apply = async (updated: User) => {
    updateUser(updated);
    await queryClient.invalidateQueries({ queryKey: queryKeys.daily });
    if (updated.isPremium) onPremium();
    else Alert.alert('Nothing to restore', 'No Premium purchase was found for this store account.');
  };

  const buy = (offer: PremiumOffer) =>
    run(
      'buy',
      async () => {
        const result = await buyPremium(offer);
        if (result !== 'cancelled') await apply(result);
      },
      { errorTitle: 'Purchase failed' },
    );

  const restore = () =>
    run('restore', async () => apply(await restorePremium()), { errorTitle: 'Could not restore purchases' });

  return { busy, buy, restore };
}
