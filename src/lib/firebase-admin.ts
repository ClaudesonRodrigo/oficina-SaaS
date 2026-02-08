import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // Tratamento da chave privada para aceitar quebras de linha tanto em local como em produção (Vercel)
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  // Verificação de segurança para alertar no log se as variáveis essenciais falharem
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error("⚠️ ERRO CRÍTICO: Faltam variáveis de ambiente do Firebase Admin! A gravação no Firestore irá falhar.");
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log("✅ Firebase Admin inicializado com sucesso.");
  } catch (error: any) {
    console.error("❌ Erro ao inicializar Firebase Admin:", error.message);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();