import { useEffect } from 'react';
import { usePluginRegistry } from '@/contexts/plugin-registry';
import { SipTrunkingWizard } from '@/components/SipTrunkingWizard';

export function useBuiltinPlugins() {
  const registry = usePluginRegistry();

  useEffect(() => {
    registry.registerPhoneNumbersTab({
      id: 'sip-trunking',
      pluginName: 'builtin-sip',
      label: 'SIP Trunking',
      icon: 'network',
      component: SipTrunkingWizard,
      order: 50,
    });
  }, [registry]);
}
