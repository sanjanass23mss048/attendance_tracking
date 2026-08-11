import 'package:flutter/material.dart';

import '../../theme.dart';

class NoticeCard extends StatefulWidget {
  const NoticeCard({
    super.key,
    required this.audienceLabel,
    required this.dateLabel,
    required this.body,
    this.title,
    this.attachmentName,
  });

  final String audienceLabel;
  final String dateLabel;
  final String body;
  final String? title;
  final String? attachmentName;

  @override
  State<NoticeCard> createState() => _NoticeCardState();
}

class _NoticeCardState extends State<NoticeCard> {
  bool expanded = false;

  @override
  Widget build(BuildContext context) {
    final long = widget.body.length > 160;
    final shown = expanded || !long ? widget.body : '${widget.body.substring(0, 160).trimRight()}…';

    return Material(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: PresenceColors.primaryDark,
                  child: const Icon(Icons.apartment, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.audienceLabel,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: PresenceColors.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.calendar_today_outlined, size: 14, color: PresenceColors.muted),
                          const SizedBox(width: 6),
                          Text(
                            widget.dateLabel,
                            style: const TextStyle(color: PresenceColors.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (widget.title != null && widget.title!.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                widget.title!,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              shown,
              style: const TextStyle(height: 1.4, color: PresenceColors.text),
            ),
            if (long)
              TextButton(
                onPressed: () => setState(() => expanded = !expanded),
                style: TextButton.styleFrom(
                  foregroundColor: PresenceColors.primaryDark,
                  padding: EdgeInsets.zero,
                ),
                child: Text(expanded ? 'Less' : 'More...'),
              ),
            if (widget.attachmentName != null && widget.attachmentName!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDBEAFE),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'DOC',
                      style: TextStyle(
                        color: PresenceColors.primaryDark,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.attachmentName!,
                      style: const TextStyle(color: PresenceColors.muted, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
