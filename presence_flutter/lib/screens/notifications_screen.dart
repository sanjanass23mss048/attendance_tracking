import 'package:flutter/material.dart';

import '../theme.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        Text('Notifications',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        SizedBox(height: 8),
        Text(
          'Attendance reminders, holidays, and approval alerts — same feed concepts as the website Notifications page.',
          style: TextStyle(color: PresenceColors.muted),
        ),
        SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: Icon(Icons.fact_check, color: PresenceColors.primary),
            title: Text('Mark today’s attendance'),
            subtitle: Text('Submit for your assigned classes'),
          ),
        ),
        Card(
          child: ListTile(
            leading: Icon(Icons.sms, color: PresenceColors.primaryDark),
            title: Text('Parent SMS after confirm'),
            subtitle: Text('Send when you tap Save & SMS'),
          ),
        ),
      ],
    );
  }
}
