import 'package:flutter/material.dart';

import '../theme.dart';

class ApprovalsScreen extends StatelessWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        Text('Edit Approvals',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        SizedBox(height: 8),
        Text(
          'Approve or deny attendance edit requests (same rules as the website). '
          'WhatsApp / in-app approval flow will be wired next against '
          '/api/attendance/edit-requests.',
          style: TextStyle(color: PresenceColors.muted),
        ),
        SizedBox(height: 16),
        Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('No pending requests loaded yet in this build.'),
          ),
        ),
      ],
    );
  }
}
