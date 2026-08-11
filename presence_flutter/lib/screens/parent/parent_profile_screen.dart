import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/parent_students_state.dart';
import '../../theme.dart';

class ParentProfileScreen extends StatelessWidget {
  const ParentProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();

    if (students.loading && !students.loaded) {
      return const Center(child: CircularProgressIndicator());
    }
    if (students.error != null && students.children.isEmpty) {
      return Center(
        child: Text(students.error!, style: const TextStyle(color: PresenceColors.danger)),
      );
    }
    if (students.children.isEmpty) {
      return const Center(child: Text('No linked student profile.'));
    }

    final child = students.selected!;
    final classLabel = ParentStudentsState.classLabelFor(child);

    return RefreshIndicator(
      onRefresh: () => students.load(force: true),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: PresenceColors.primarySoft,
                    child: Text(
                      ParentStudentsState.initialsFor(child['name']?.toString()),
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: PresenceColors.primaryDark,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    child['name']?.toString() ?? 'Student',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (classLabel.isNotEmpty) classLabel,
                      if (child['rollNo'] != null) 'Roll ${child['rollNo']}',
                    ].join(' · '),
                    style: const TextStyle(color: PresenceColors.muted),
                  ),
                  if (students.children.length > 1) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Switch student from the menu or the bar above.',
                      style: TextStyle(fontSize: 12, color: PresenceColors.muted.withValues(alpha: 0.9)),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _infoCard('Admission No', child['admissionNo']?.toString()),
          _infoCard('Date of birth', _fmtDob(child['dob']?.toString())),
          _infoCard('Gender', child['gender']?.toString()),
          _infoCard('Father', child['fatherName']?.toString()),
          _infoCard('Mother', child['motherName']?.toString()),
          _infoCard(
            'Parent phone',
            child['parentPhone']?.toString() ?? child['fatherPhone']?.toString(),
          ),
          _infoCard('Address', child['address']?.toString() ?? child['addressLine1']?.toString()),
          _infoCard('Status', child['status']?.toString()),
        ],
      ),
    );
  }

  Widget _infoCard(String label, String? value) {
    if (value == null || value.trim().isEmpty) return const SizedBox.shrink();
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(label, style: const TextStyle(fontSize: 12, color: PresenceColors.muted)),
        subtitle: Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
      ),
    );
  }

  String? _fmtDob(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(raw));
    } catch (_) {
      return raw;
    }
  }
}
