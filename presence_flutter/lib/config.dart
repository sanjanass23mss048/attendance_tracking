/// Presence Flutter — shared config.
class AppConfig {
  static const appName = 'Presence';
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://www.rioassetmanagement.info',
  );

  static const staffManagerRoles = {
    'INCHARGE',
    'HOD',
    'VICE_PRINCIPAL',
    'PRINCIPAL',
    'ADMIN',
    'HEADMASTER',
  };
}

class StatusOption {
  final String code;
  final String label;
  final int color;
  const StatusOption(this.code, this.label, this.color);
}

const statusOptions = [
  StatusOption('P', 'Present', 0xFF22C55E),
  StatusOption('A', 'Absent', 0xFFEF4444),
  StatusOption('L', 'Late', 0xFFF59E0B),
  StatusOption('H', 'Half Day', 0xFF8B5CF6),
  StatusOption('OH', 'OD Half', 0xFF06B6D4),
  StatusOption('OF', 'OD Full', 0xFF0F766E),
];

StatusOption statusMeta(String? code) {
  return statusOptions.firstWhere(
    (s) => s.code == code,
    orElse: () => statusOptions.first,
  );
}

String dateYmd(DateTime d) {
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '${d.year}-$m-$day';
}

String todayYmd() => dateYmd(DateTime.now());

DateTime? parseYmd(String ymd) {
  final parts = ymd.split('-');
  if (parts.length != 3) return null;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return null;
  return DateTime(y, m, d);
}
