import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/parent_child_dropdown.dart';
import '../widgets/student_identity_chip.dart';

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

    return RefreshIndicator(
      onRefresh: () => students.load(force: true),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const ParentChildDropdown(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _ChildDetailSection(students: students, child: child),
          ),
        ],
      ),
    );
  }
}

class _ChildDetailSection extends StatelessWidget {
  const _ChildDetailSection({required this.students, required this.child});
  final ParentStudentsState students;
  final Map<String, dynamic> child;

  @override
  Widget build(BuildContext context) {
    final color = siblingChipColorForChild(students, child);
    final classLabel = ParentStudentsState.displayClassLabelFor(child);
    final name = child['name']?.toString() ?? 'Student';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: color.withValues(alpha: 0.15),
                    child: Text(
                      ParentStudentsState.initialsFor(name),
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: color,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    name,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  if (classLabel.isNotEmpty)
                    Text(classLabel, style: const TextStyle(color: PresenceColors.muted)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (child['rollNo'] != null) _infoRow('Roll No', child['rollNo']?.toString()),
            _infoRow('Admission No', child['admissionNo']?.toString()),
            _infoRow('Date of birth', _fmtDob(child['dob']?.toString())),
            _infoRow('Gender', child['gender']?.toString()),
            _infoRow('Father', child['fatherName']?.toString()),
            _infoRow('Mother', child['motherName']?.toString()),
            _infoRow(
              'Parent phone',
              child['parentPhone']?.toString() ?? child['fatherPhone']?.toString(),
            ),
            _infoRow('Address', child['address']?.toString() ?? child['addressLine1']?.toString()),
            _infoRow('Status', child['status']?.toString()),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String? value) {
    if (value == null || value.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: PresenceColors.muted)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
        ],
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
