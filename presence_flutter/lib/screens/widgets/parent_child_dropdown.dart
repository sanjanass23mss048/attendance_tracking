import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/parent_students_state.dart';
import '../../theme.dart';
import 'student_identity_chip.dart';

/// Dropdown to pick which linked child to view (profile, diary, timetable, calendar).
class ParentChildDropdown extends StatelessWidget {
  const ParentChildDropdown({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(16, 12, 16, 4),
  });

  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();
    if (students.children.isEmpty) return const SizedBox.shrink();

    if (students.children.length == 1) {
      final child = students.children.first;
      return Padding(
        padding: padding,
        child: StudentIdentityChip.fromChild(students, child),
      );
    }

    final selected = students.selected;
    final selectedId = selected?['id']?.toString() ?? '';

    return Padding(
      padding: padding,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: 'Select child',
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: PresenceColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: PresenceColors.border),
          ),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            isExpanded: true,
            value: students.children.any((c) => c['id']?.toString() == selectedId)
                ? selectedId
                : students.children.first['id']?.toString(),
            items: [
              for (final child in students.children)
                DropdownMenuItem<String>(
                  value: child['id']?.toString(),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor:
                            siblingChipColorForChild(students, child).withValues(alpha: 0.15),
                        child: Text(
                          ParentStudentsState.initialsFor(child['name']?.toString()),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: siblingChipColorForChild(students, child),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              child['name']?.toString() ?? 'Student',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              ParentStudentsState.shortClassLabelFor(child),
                              style: const TextStyle(
                                fontSize: 12,
                                color: PresenceColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
            onChanged: (id) {
              if (id != null) students.select(id);
            },
          ),
        ),
      ),
    );
  }
}
