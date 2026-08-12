import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/parent_students_state.dart';
import '../../theme.dart';
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

    return RefreshIndicator(
      onRefresh: () => students.load(force: true),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'My Children',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: PresenceColors.text,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'All linked siblings — no switching required.',
            style: TextStyle(fontSize: 12, color: PresenceColors.muted),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final child in students.children)
                _MyChildCard(students: students, child: child),
            ],
          ),
          const SizedBox(height: 20),
          for (final child in students.children) ...[
            _ChildDetailSection(students: students, child: child),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _MyChildCard extends StatelessWidget {
  const _MyChildCard({required this.students, required this.child});
  final ParentStudentsState students;
  final Map<String, dynamic> child;

  @override
  Widget build(BuildContext context) {
    final name = child['name']?.toString() ?? 'Student';
    final classLabel = ParentStudentsState.shortClassLabelFor(child);
    final color = siblingChipColorForChild(students, child);

    return Container(
      width: 150,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: color.withValues(alpha: 0.15),
            child: Text(
              ParentStudentsState.initialsFor(name),
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            classLabel.isEmpty ? '—' : classLabel,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: PresenceColors.muted,
            ),
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StudentIdentityBlock.fromChild(students, child),
            const SizedBox(height: 12),
            if (child['rollNo'] != null)
              _infoRow('Roll No', child['rollNo']?.toString()),
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
            if (classLabel.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    classLabel,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String? value) {
    if (value == null || value.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: PresenceColors.muted)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
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
