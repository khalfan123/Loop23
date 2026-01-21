'use strict';
import { Router, Response } from 'express';
import { storage } from '../../storage';
import { AdminRequest } from '../../middleware/admin-auth';
import nodemailer from 'nodemailer';

export function registerSmtpRoutes(router: Router) {
  router.get('/smtp', async (req: AdminRequest, res: Response) => {
    try {
      const smtpKeys = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'smtp_secure'];
      const smtpSettings: Record<string, any> = {};
      
      for (const key of smtpKeys) {
        const setting = await storage.getGlobalSetting(key);
        if (setting) {
          if (key === 'smtp_password') {
            smtpSettings[key] = setting.value ? true : false;
          } else {
            smtpSettings[key] = setting.value;
          }
        }
      }
      
      res.json(smtpSettings);
    } catch (error) {
      console.error('Error fetching SMTP settings:', error);
      res.status(500).json({ error: 'Failed to fetch SMTP settings' });
    }
  });

  router.patch('/smtp', async (req: AdminRequest, res: Response) => {
    try {
      const { smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email, smtp_from_name, smtp_secure } = req.body;
      
      if (smtp_host !== undefined) await storage.updateGlobalSetting('smtp_host', smtp_host);
      if (smtp_port !== undefined) await storage.updateGlobalSetting('smtp_port', smtp_port);
      if (smtp_username !== undefined) await storage.updateGlobalSetting('smtp_username', smtp_username);
      if (smtp_password !== undefined) await storage.updateGlobalSetting('smtp_password', smtp_password);
      if (smtp_from_email !== undefined) await storage.updateGlobalSetting('smtp_from_email', smtp_from_email);
      if (smtp_from_name !== undefined) await storage.updateGlobalSetting('smtp_from_name', smtp_from_name);
      if (smtp_secure !== undefined) await storage.updateGlobalSetting('smtp_secure', smtp_secure);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating SMTP settings:', error);
      res.status(500).json({ error: 'Failed to update SMTP settings' });
    }
  });

  router.post('/smtp/test', async (req: AdminRequest, res: Response) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ error: 'Test email address is required' });
      }
      
      const smtpHost = await storage.getGlobalSetting('smtp_host');
      const smtpPort = await storage.getGlobalSetting('smtp_port');
      const smtpUsername = await storage.getGlobalSetting('smtp_username');
      const smtpPassword = await storage.getGlobalSetting('smtp_password');
      const smtpFromEmail = await storage.getGlobalSetting('smtp_from_email');
      const smtpFromName = await storage.getGlobalSetting('smtp_from_name');
      const smtpSecure = await storage.getGlobalSetting('smtp_secure');
      
      if (!smtpHost?.value || !smtpPort?.value || !smtpUsername?.value || !smtpPassword?.value) {
        return res.status(400).json({ error: 'SMTP settings are not fully configured' });
      }
      
      const transporter = nodemailer.createTransport({
        host: smtpHost.value as string,
        port: Number(smtpPort.value),
        secure: smtpSecure?.value === true || smtpSecure?.value === 'true',
        auth: { user: smtpUsername.value as string, pass: smtpPassword.value as string }
      });
      
      await transporter.sendMail({
        from: `"${smtpFromName?.value || 'Test'}" <${smtpFromEmail?.value || smtpUsername.value}>`,
        to: testEmail,
        subject: 'SMTP Test Email',
        text: 'This is a test email to verify your SMTP configuration.',
        html: '<p>This is a test email to verify your SMTP configuration.</p><p>If you received this email, your SMTP settings are working correctly.</p>'
      });
      
      res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      res.status(500).json({ error: `Failed to send test email: ${error.message}` });
    }
  });
}
