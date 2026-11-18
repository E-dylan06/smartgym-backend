/**
 * Utilidad para el envío de Notificaciones Push reales a través de Expo Push Service
 * Documentación oficial: https://docs.expo.dev/push-notifications/sending-notifications/
 */

export async function sendExpoPushNotification({ tokens = [], title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { ok: false, message: 'No hay tokens destino' };

  // Filtrar únicamente tokens con formato válido ExponentPushToken[...]
  const validTokens = (Array.isArray(tokens) ? tokens : [tokens]).filter(
    (t) => typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
  );

  if (validTokens.length === 0) {
    return { ok: false, message: 'Ningún token cumple el formato ExpoPushToken' };
  }

  const messages = validTokens.map((to) => ({
    to,
    sound: 'default',
    title: title || 'SmartGym 🏋️',
    body: body || '',
    data,
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log(`📱 [Expo Push Enviado] (${messages.length} dispositivos):`, result);
    return { ok: true, result };
  } catch (error) {
    console.error('❌ Error enviando Push a Expo:', error.message);
    return { ok: false, error: error.message };
  }
}
