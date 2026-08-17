import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme.dart';

String editStatusLabel(String? status) {
  switch ((status ?? '').toUpperCase()) {
    case 'PENDING':
      return 'Waiting for Approval';
    case 'APPROVED':
      return 'Approved – Edit Now';
    case 'DENIED':
      return 'Request Denied';
    case 'EXPIRED':
      return 'Permission Expired';
    case 'USED':
      return 'Edit Completed';
    default:
      return status?.isNotEmpty == true ? status! : 'Attendance locked';
  }
}

String editStatusDetail(Map<String, dynamic>? request, { bool finalized = false }) {
  final status = (request?['status'] ?? '').toString().toUpperCase();
  switch (status) {
    case 'APPROVED':
      final expires = _formatExpire(request?['editExpiresAt']);
      return expires != null
          ? 'Permission expires at $expires'
          : 'Approved. You can edit this date now.';
    case 'DENIED':
      final reason = request?['denyReason']?.toString();
      return (reason != null && reason.isNotEmpty)
          ? reason
          : 'Your edit request was denied. Attendance remains locked.';
    case 'PENDING':
      return 'Waiting for the assigned approver (WhatsApp / in-app).';
    case 'USED':
      return 'Changes were saved. Attendance is locked again.';
    case 'EXPIRED':
      return 'Approval expired. Submit a new edit request.';
    default:
      return finalized
          ? 'Parent SMS was sent. Request approval to edit again.'
          : 'Past dates are locked. Request approval to edit.';
  }
}

String? _formatExpire(dynamic raw) {
  if (raw == null) return null;
  final dt = DateTime.tryParse(raw.toString());
  if (dt == null) return null;
  return DateFormat('dd MMM yyyy, hh:mm a').format(dt.toLocal());
}

class AttendanceEditStatusBanner extends StatelessWidget {
  const AttendanceEditStatusBanner({
    super.key,
    required this.locked,
    required this.canEdit,
    required this.canRequestEdit,
    this.request,
    this.finalized = false,
    this.onRequestEdit,
  });

  final bool locked;
  final bool canEdit;
  final bool canRequestEdit;
  final bool finalized;
  final Map<String, dynamic>? request;
  final VoidCallback? onRequestEdit;

  @override
  Widget build(BuildContext context) {
    if (!locked && request == null) return const SizedBox.shrink();

    final status = request?['status']?.toString().toUpperCase();
    final color = switch (status) {
      'APPROVED' => PresenceColors.success,
      'DENIED' => PresenceColors.danger,
      'PENDING' => const Color(0xFFD97706),
      _ => PresenceColors.primary,
    };
    final icon = switch (status) {
      'APPROVED' => Icons.verified_user_outlined,
      'DENIED' => Icons.cancel_outlined,
      'PENDING' => Icons.schedule,
      _ => Icons.lock_outline,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(
        color: PresenceColors.primarySoft.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PresenceColors.primary.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      editStatusLabel(status),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      editStatusDetail(request, finalized: finalized),
                      style: const TextStyle(color: PresenceColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (canRequestEdit && onRequestEdit != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton(
                onPressed: onRequestEdit,
                child: const Text('Request Edit'),
              ),
            ),
          ],
          if (status == 'APPROVED' && canEdit) ...[
            const SizedBox(height: 8),
            Text(
              'You have a short window to save changes.',
              style: TextStyle(
                color: PresenceColors.success.withValues(alpha: 0.9),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
