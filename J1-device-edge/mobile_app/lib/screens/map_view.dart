import 'package:flutter/material.dart';

class MapView extends StatelessWidget {
  const MapView({super.key});

  @override
  Widget build(BuildContext context) {
    final incidents = const [
      _Incident('Need clean water', 'Sector A', Colors.red, 0.78, 0.25),
      _Incident('First-aid support', 'Sector B', Colors.orange, 0.35, 0.72),
      _Incident('Temporary shelter', 'Sector C', Colors.red, 0.58, 0.48),
      _Incident('Road blockage', 'Sector D', Colors.orange, 0.22, 0.40),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Map View'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Incident map MVP',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              'This placeholder map shows reported help requests as visual pins until the live map integration is ready.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            AspectRatio(
              aspectRatio: 1.2,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.teal.shade100,
                        Colors.green.shade100,
                        Colors.blue.shade100,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Stack(
                    children: [
                      const _GridBackground(),
                      Positioned(
                        left: 24,
                        top: 24,
                        child: _LegendChip(
                          color: Colors.blue.shade700,
                          label: 'You',
                        ),
                      ),
                      for (final incident in incidents)
                        Positioned(
                          left: 20 + (incident.dx * 240),
                          top: 24 + (incident.dy * 200),
                          child: _IncidentPin(incident: incident),
                        ),
                      const Center(
                        child: _UserDot(),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Open requests',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            ...incidents.map(
              (incident) => Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: incident.color.withOpacity(0.2),
                    child: Icon(Icons.place, color: incident.color),
                  ),
                  title: Text(incident.title),
                  subtitle: Text(incident.location),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Incident {
  const _Incident(this.title, this.location, this.color, this.dx, this.dy);

  final String title;
  final String location;
  final Color color;
  final double dx;
  final double dy;
}

class _GridBackground extends StatelessWidget {
  const _GridBackground();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _GridPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.25)
      ..strokeWidth = 1;

    for (double x = 0; x < size.width; x += 32) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    for (double y = 0; y < size.height; y += 32) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _IncidentPin extends StatelessWidget {
  const _IncidentPin({required this.incident});

  final _Incident incident;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.95),
            borderRadius: BorderRadius.circular(999),
            boxShadow: const [
              BoxShadow(
                blurRadius: 12,
                color: Colors.black26,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Text(
            incident.title,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ),
        const SizedBox(height: 4),
        Icon(Icons.location_pin, color: incident.color, size: 32),
      ],
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 10, color: color),
          const SizedBox(width: 8),
          Text(label),
        ],
      ),
    );
  }
}

class _UserDot extends StatelessWidget {
  const _UserDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        color: Colors.blue.shade700,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 4),
        boxShadow: const [
          BoxShadow(
            blurRadius: 10,
            color: Colors.black26,
            offset: Offset(0, 4),
          ),
        ],
      ),
    );
  }
}
