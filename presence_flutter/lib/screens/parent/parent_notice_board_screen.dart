import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../theme.dart';
import '../widgets/notice_card.dart';

class ParentNoticeBoardScreen extends StatefulWidget {
  const ParentNoticeBoardScreen({super.key});

  @override
  State<ParentNoticeBoardScreen> createState() => _ParentNoticeBoardScreenState();
}

class _ParentNoticeBoardScreenState extends State<ParentNoticeBoardScreen> {
  List<dynamic> notices = [];
  bool loading = true;
  String? error;
  String query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final list = await context.read<AuthState>().api.parentNotices();
      setState(() => notices = list);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = notices.where((n) {
      if (query.trim().isEmpty) return true;
      final m = Map<String, dynamic>.from(n as Map);
      final hay = [
        m['audienceLabel'],
        m['title'],
        m['body'],
      ].whereType<Object?>().join(' ').toLowerCase();
      return hay.contains(query.trim().toLowerCase());
    }).toList();

    return Column(
      children: [
        Container(
          color: PresenceColors.primaryDark,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: TextField(
            onChanged: (v) => setState(() => query = v),
            decoration: InputDecoration(
              hintText: 'Search',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                    ? ListView(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                          ),
                        ],
                      )
                    : filtered.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 80),
                              Center(child: Text('No notices yet.')),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (context, i) {
                              final m = Map<String, dynamic>.from(filtered[i] as Map);
                              return NoticeCard(
                                audienceLabel: m['audienceLabel']?.toString() ?? 'Notice',
                                dateLabel: _fmtDate(m['date']?.toString() ?? m['createdOn']?.toString()),
                                body: m['body']?.toString() ?? '',
                                title: m['title']?.toString(),
                                attachmentName: m['attachmentName']?.toString(),
                              );
                            },
                          ),
          ),
        ),
      ],
    );
  }

  String _fmtDate(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    try {
      final d = DateTime.parse(raw);
      return DateFormat('dd-MM-yyyy').format(d);
    } catch (_) {
      return raw.length >= 10 ? raw.substring(0, 10) : raw;
    }
  }
}
