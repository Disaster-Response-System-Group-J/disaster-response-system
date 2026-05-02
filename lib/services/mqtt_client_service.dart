import 'dart:convert';

import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

import 'mqtt_config.dart';

class MqttClientService {
  late MqttServerClient client;

  Future<void> connect() async {
    client = MqttServerClient(MqttConfig.broker, MqttConfig.clientId);
    client.port = MqttConfig.port;

    client.keepAlivePeriod = 20;
    client.logging(on: true);

    final connMess = MqttConnectMessage()
        .withClientIdentifier(MqttConfig.clientId)
        .startClean();

    client.connectionMessage = connMess;

    try {
      await client.connect();
      print('MQTT Connected');
    } catch (e) {
      print('MQTT Connection failed: $e');
      client.disconnect();
    }
  }

  void publish(String message) {
    final builder = MqttClientPayloadBuilder();
    builder.addString(message);

    client.publishMessage(
      MqttConfig.topic,
      MqttQos.atLeastOnce, // QoS 1
      builder.payload!,
    );

    print('Message published: $message');
  }

  void subscribe() {
    client.subscribe(MqttConfig.topic, MqttQos.atLeastOnce);

    client.updates!.listen((messages) {
      final recMess = messages[0].payload as MqttPublishMessage;
      final payloadBytes = recMess.payload.message;
      final payload = payloadBytes == null ? '' : utf8.decode(payloadBytes);

      print('Received message: $payload');
    });
  }
}