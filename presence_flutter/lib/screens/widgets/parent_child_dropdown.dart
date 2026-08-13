import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/parent_students_state.dart';
import '../../theme.dart';

/// Yellow child selector card used across parent portal screens.
class ParentChildDropdown extends StatelessWidget {
  const ParentChildDropdown({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(16, 12, 16, 8),
  });

  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();
    if (students.children.isEmpty) return const SizedBox.shrink();

    final child = students.selected ?? students.children.first;
    final name = child['name']?.toString() ?? 'Student';
    final classLabel = ParentStudentsState.displayClassLabelFor(child);
    final initials = ParentStudentsState.initialsFor(name);
    final multi = students.children.length > 1;

    return Padding(
      padding: padding,
      child: Material(
        color: PresenceColors.accent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: multi ? () => _openPicker(context, students) : null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: PresenceColors.primaryDark,
                  child: Text(
                    initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: PresenceColors.text,
                        ),
                      ),
                      if (classLabel.isNotEmpty)
                        Text(
                          classLabel,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: PresenceColors.text.withValues(alpha: 0.75),
                          ),
                        ),
                    ],
                  ),
                ),
                if (multi)
                  const Icon(Icons.keyboard_arrow_down_rounded, color: PresenceColors.primaryDark),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openPicker(BuildContext context, ParentStudentsState students) async {
    final selectedId = students.selected?['id']?.toString();
    await showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: PresenceColors.border,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Select child',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
              ),
              for (final child in students.children)
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: PresenceColors.primaryDark,
                    child: Text(
                      ParentStudentsState.initialsFor(child['name']?.toString()),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  title: Text(
                    child['name']?.toString() ?? 'Student',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(ParentStudentsState.displayClassLabelFor(child)),
                  trailing: child['id']?.toString() == selectedId
                      ? const Icon(Icons.check_circle, color: PresenceColors.primaryDark)
                      : null,
                  onTap: () {
                    final id = child['id']?.toString();
                    if (id != null) students.select(id);
                    Navigator.pop(ctx);
                  },
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
