import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            title: Text(auth.user?['name']?.toString() ?? '',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text('${auth.user?['email'] ?? ''}\nRole · ${auth.role}'),
            isThreeLine: true,
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            title: const Text('App'),
            subtitle: Text('${AppConfig.appName} · Flutter native\nAPI · ${AppConfig.apiBase}'),
            isThreeLine: true,
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.tonal(
          onPressed: () => auth.logout(),
          style: FilledButton.styleFrom(foregroundColor: PresenceColors.danger),
          child: const Text('Log out'),
        ),
      ],
    );
  }
}
