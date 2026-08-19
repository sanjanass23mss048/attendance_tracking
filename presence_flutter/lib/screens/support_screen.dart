import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';

const _supportPhone = '8072180274';
const _supportEmail = 'info@riobizsols.com';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  Future<void> _copy(BuildContext context, String value, String label) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label copied')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: PresenceColors.primaryDark,
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Row(
            children: [
              Icon(Icons.headset_mic_outlined, color: Colors.white, size: 28),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Need Help?',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Support Center · Rio Biz Solutions',
                      style: TextStyle(color: Color(0xFFBFDBFE), fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.schedule_outlined, color: PresenceColors.primaryDark),
            title: const Text('Working hours'),
            subtitle: const Text('9:00 AM – 5:00 PM · Monday to Friday'),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: ListTile(
            leading: const Icon(Icons.phone_outlined, color: PresenceColors.primaryDark),
            title: const Text('Support number'),
            subtitle: const Text(_supportPhone),
            onTap: () => _copy(context, _supportPhone, 'Support number'),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: ListTile(
            leading: const Icon(Icons.mail_outline, color: PresenceColors.primaryDark),
            title: const Text('Email'),
            subtitle: const Text(_supportEmail),
            onTap: () => _copy(context, _supportEmail, 'Email'),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: ListTile(
            leading: const Icon(Icons.chat_outlined, color: PresenceColors.success),
            title: const Text('Chat on WhatsApp'),
            subtitle: const Text('Opens a chat with $_supportPhone'),
            onTap: () => _copy(context, 'https://wa.me/91$_supportPhone', 'WhatsApp link'),
          ),
        ),
      ],
    );
  }
}
