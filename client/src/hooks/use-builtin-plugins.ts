import { useEffect, useRef } from 'react';
import { usePluginRegistry } from '@/contexts/plugin-registry';
import { usePluginStatus } from './use-plugin-status';
import { SipTrunkSettings } from '@/components/admin/SipTrunkSettings';

export function useBuiltinPlugins() {
  const registry = usePluginRegistry();
  const { isPluginEnabled, isLoading } = usePluginStatus();
  const registeredRef = useRef(false);
  
  const sipPluginLoaded = isPluginEnabled('sip-engine');
  
  useEffect(() => {
    if (isLoading || registeredRef.current) return;
    
    if (sipPluginLoaded && !registry.isPluginLoaded('sip-engine-builtin')) {
      console.log('[BuiltinPlugins] Registering SIP Engine settings tab');
      
      registry.registerAdminSettingsTab({
        id: 'sip-trunks',
        pluginName: 'sip-engine',
        label: 'SIP Trunks',
        icon: 'Phone',
        component: SipTrunkSettings,
        order: 100,
      });
      
      registry.markPluginLoaded('sip-engine-builtin');
      registeredRef.current = true;
      
      console.log('[BuiltinPlugins] SIP Engine settings tab registered');
    }
  }, [sipPluginLoaded, isLoading, registry]);
}
